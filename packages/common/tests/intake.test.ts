import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_THRESHOLD,
  INTAKE_THRESHOLDS,
  assessIntake,
  findNearDuplicate,
  jaccard,
  shingles,
  titleSimilarity,
  type IntakeContext,
} from '../src/index.js';

/**
 * These cases are not invented. Every accepted document below was actually
 * queued by a live cycle, and every rejected one was actually thrown out by it:
 * the brown hyaena record, the silage trial and the WHO partnership signing all
 * arrived from real feeds and are exactly the failure mode the gate exists to
 * stop. Pinning them here is what keeps a later tweak from re-admitting them.
 */

const context = (over: Partial<IntakeContext> = {}): IntakeContext => ({
  reliability: 'HIGH',
  existingTitles: [],
  domains: ['health', 'climate'],
  now: new Date('2026-09-13T00:00:00Z'),
  ...over,
});

const body = (text: string): string => text.padEnd(400, ' A sentence of ordinary context. ');

describe('intake relevance gate', () => {
  it('accepts a document that states a gap, names stakes and has a societal title', () => {
    const result = assessIntake(
      {
        title: 'In utero exposure to extreme heat increases neonatal mortality',
        body: body(
          'Exposure to extreme heat during pregnancy was associated with a 12% increase in neonatal mortality across 14 countries. The mechanism remains unclear and the contribution of preterm birth has not been quantified.',
        ),
        publisher: 'Nature Climate Change',
        url: 'https://doi.org/10.1000/example',
        publishedAt: '2026-08-01',
      },
      context(),
    );

    expect(result.verdict).toBe('ACCEPT');
    expect(result.score).toBeGreaterThanOrEqual(INTAKE_THRESHOLDS.accept);
    expect(result.matched).toContain('MORTALITY');
    expect(result.code).toBeNull();
  });

  it('rejects a specimen record even though it states an unknown', () => {
    const result = assessIntake(
      {
        title: 'A Novel Record of Brown Hyaena (Parahyaena brunnea) in Zinave National Park, Mozambique',
        body: body(
          'We report a camera-trap observation. The species distribution in the region remains unknown and further research is needed to establish its range.',
        ),
        publisher: 'African Journal of Ecology',
        url: 'https://doi.org/10.1000/hyaena',
        publishedAt: '2026-08-01',
      },
      context({ domains: ['biodiversity'] }),
    );

    expect(result.verdict).toBe('REJECT');
    expect(result.code).toBe('DISQUALIFIED');
  });

  it('rejects a husbandry trial: no consequence and no population in the title', () => {
    const result = assessIntake(
      {
        title: 'Effects of triticale silage substitution for corn silage on growth performance and serum indices',
        body: body(
          'Growth performance was measured over 90 days. The optimal inclusion rate remains unclear and further research is needed.',
        ),
        publisher: 'Animal Feed Science',
        url: 'https://doi.org/10.1000/silage',
        publishedAt: '2026-08-01',
      },
      context({ domains: ['food'] }),
    );

    expect(result.verdict).toBe('REJECT');
    expect(result.code).toBe('NARROW_SUBJECT');
  });

  it('rejects an open question with nothing riding on it', () => {
    const result = assessIntake(
      {
        title: 'Thermoregulatory response of infants to ambient conditions',
        body: body(
          'The thermoregulatory response of infants is poorly understood and further research is needed to characterise it.',
        ),
        publisher: 'Journal of Physiology',
        url: 'https://doi.org/10.1000/thermo',
        publishedAt: '2026-08-01',
      },
      context(),
    );

    expect(result.verdict).toBe('REJECT');
    expect(result.code).toBe('NO_STAKES');
  });

  it('rejects a finished result: no gap language anywhere', () => {
    const result = assessIntake(
      {
        title: 'The EU has cut its greenhouse gas emissions by 40% since 1990',
        body: body(
          'Emissions fell 40% between 1990 and 2025 while the economy grew. The reduction was driven by the power sector.',
        ),
        publisher: 'European Environment Agency',
        url: 'https://www.eea.europa.eu/en/newsroom/news/ghg-40',
        publishedAt: '2026-08-01',
      },
      context({ domains: ['climate'] }),
    );

    expect(result.verdict).toBe('REJECT');
    expect(result.code).toBe('NO_GAP');
  });

  it('rejects a partnership announcement outright, whatever else it says', () => {
    const result = assessIntake(
      {
        title: 'WHO and Switzerland cement cooperation until 2028',
        body: body(
          'The agreement covers pandemic preparedness, where significant knowledge gaps remain and mortality data is poorly understood.',
        ),
        publisher: 'World Health Organization',
        url: 'https://www.who.int/news/item/cooperation',
        publishedAt: '2026-08-01',
      },
      context(),
    );

    expect(result.verdict).toBe('REJECT');
    expect(result.code).toBe('DISQUALIFIED');
    expect(result.matched).toContain('PARTNERSHIP');
  });

  it('rejects a body too thin to assess before it scores anything', () => {
    const result = assessIntake(
      {
        title: 'Heatwave mortality in European cities remains poorly understood',
        body: 'Emissions Gap Report 2023.',
        publisher: 'UNEP',
        url: 'https://www.unep.org/resources/emissions-gap-report-2023',
        publishedAt: '2026-08-01',
      },
      context(),
    );

    expect(result.verdict).toBe('REJECT');
    expect(result.code).toBe('TOO_THIN');
  });

  it('rejects a near-duplicate of something already in the queue', () => {
    const document = {
      title: 'Urban-rural disparities in heatwave effects on under-5 mortality in China',
      body: body(
        'The disparity remains unclear and has not been quantified. Excess deaths among children under five rose during heatwaves.',
      ),
      publisher: 'The Lancet Planetary Health',
      url: 'https://doi.org/10.1000/heat-china',
      publishedAt: '2026-08-01',
    };

    const accepted = assessIntake(document, context());
    expect(accepted.verdict).toBe('ACCEPT');

    const duplicate = assessIntake(
      document,
      context({
        existingTitles: ['Urban-rural disparities in heatwave effects on under-5 mortality in China'],
      }),
    );
    expect(duplicate.verdict).toBe('REJECT');
    expect(duplicate.code).toBe('DUPLICATE');
    expect(duplicate.duplicateOf?.similarity).toBeGreaterThan(DUPLICATE_THRESHOLD);
  });

  it('penalises a document published outside the intake window', () => {
    const base = {
      title: 'Drought and crop failure threaten food security across the Sahel',
      body: body(
        'Yield losses remain poorly understood across the region and further research is needed. Millions of people are affected.',
      ),
      publisher: 'FAO',
      url: 'https://www.fao.org/example',
    };

    const fresh = assessIntake({ ...base, publishedAt: '2026-08-01' }, context({ domains: ['food'] }));
    const stale = assessIntake({ ...base, publishedAt: '2019-01-01' }, context({ domains: ['food'] }));

    expect(stale.score).toBeLessThan(fresh.score);
    expect(stale.reasons.join(' ')).toContain('older than the intake window');
  });

  it('does not queue a document it only half believes in', () => {
    const result = assessIntake(
      {
        title: 'Air quality in one district remains unclear',
        body: body('Some uncertainty about pollution levels remains unclear here.'),
        publisher: 'A local blog',
        url: 'https://example.com/post',
        publishedAt: '2026-08-01',
      },
      context({ reliability: 'LOW', domains: ['other'] }),
    );

    expect(result.verdict).not.toBe('ACCEPT');
  });
});

describe('near-duplicate detection', () => {
  it('shingles a string into overlapping trigrams', () => {
    expect([...shingles('abcd', 3)]).toEqual(['abc', 'bcd']);
    expect([...shingles('ab', 3)]).toEqual(['ab']);
  });

  it('scores identical strings 1 and disjoint strings 0', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    // Two titles that both normalise to nothing are the same nothing.
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(['a']), new Set())).toBe(0);
  });

  it('treats punctuation and case as noise', () => {
    expect(
      titleSimilarity(
        'Heatwave mortality in Paris: a 2025 review',
        'heatwave mortality in paris — a 2025 review',
      ),
    ).toBeGreaterThan(0.9);
  });

  it('does not confuse two different problems in the same domain', () => {
    expect(
      titleSimilarity(
        'Groundwater depletion in the Indo-Gangetic basin',
        'Antimicrobial resistance in neonatal sepsis',
      ),
    ).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it('finds the closest match above the threshold and nothing below it', () => {
    const existing = ['Heatwave mortality among older adults in southern Europe'];
    expect(findNearDuplicate('Heatwave mortality among older adults in Southern Europe', existing))
      .not.toBeNull();
    expect(findNearDuplicate('Grid inertia in island power systems', existing)).toBeNull();
  });
});
