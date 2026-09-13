import type { DomainKey } from '@saveus/common';

/**
 * Seed researchers. DEMO DATA.
 *
 * These are fictional accounts used to populate the collaboration layer. They
 * are deliberately not attributed to real people or institutions, and none of
 * them claims credentials: the platform's premise is that an anonymous account
 * with good evidence outranks a titled account without any.
 */

export interface SeedUser {
  handle: string;
  displayName: string;
  bio: string;
  domains: DomainKey[];
  isAnonymous: boolean;
}

export const SEED_USERS: readonly SeedUser[] = [
  {
    handle: 'm-okonkwo',
    displayName: 'M. Okonkwo',
    bio: 'Urban microclimate. Interested in what actually reaches the person in the top-floor flat.',
    domains: ['cities', 'health', 'climate'],
    isAnonymous: false,
  },
  {
    handle: 'grid-nomad',
    displayName: 'grid_nomad',
    bio: 'Power systems modelling. I care about the worst week in the reanalysis record, not the average year.',
    domains: ['energy'],
    isAnonymous: false,
  },
  {
    handle: 'l-ferreira',
    displayName: 'L. Ferreira',
    bio: 'Materials and standards. Most of my work is about why a material that works is still not allowed.',
    domains: ['materials', 'ai'],
    isAnonymous: false,
  },
  {
    handle: 'anon-4417',
    displayName: 'anon_4417',
    bio: 'Anonymous. Reads more than posts.',
    domains: ['cities', 'materials'],
    isAnonymous: true,
  },
  {
    handle: 'r-castellanos',
    displayName: 'R. Castellanos',
    bio: 'Infectious disease and health systems. Detection delay is my obsession.',
    domains: ['health'],
    isAnonymous: false,
  },
  {
    handle: 'nordwind',
    displayName: 'nordwind',
    bio: 'Transmission planning. Sceptical of anything that assumes the neighbours have spare capacity.',
    domains: ['energy', 'transport'],
    isAnonymous: false,
  },
  {
    handle: 'a-devi',
    displayName: 'A. Devi',
    bio: 'Water and agriculture. Field data or it did not happen.',
    domains: ['water', 'food'],
    isAnonymous: false,
  },
  {
    handle: 'quiet-observer',
    displayName: 'quiet_observer',
    bio: 'Anonymous. Mostly looks for the assumption nobody stated.',
    domains: ['health', 'water'],
    isAnonymous: true,
  },
  {
    handle: 'j-morel',
    displayName: 'J. Morel',
    bio: 'Medicinal chemistry background. Now mostly interested in why good compounds never get made.',
    domains: ['health', 'materials'],
    isAnonymous: false,
  },
  {
    handle: 'k-adeyemi',
    displayName: 'K. Adeyemi',
    bio: 'Post-harvest systems. Weighing things at four points in a chain is underrated.',
    domains: ['food'],
    isAnonymous: false,
  },
  {
    handle: 'thermal-mass',
    displayName: 'thermal_mass',
    bio: 'Building physics. Half of what is called an adaptation problem is a heat transfer problem.',
    domains: ['cities', 'energy'],
    isAnonymous: false,
  },
  {
    handle: 's-lindqvist',
    displayName: 'S. Lindqvist',
    bio: 'Ecology and measurement design. Interested in what we could know, not just what we believe.',
    domains: ['biodiversity', 'ai'],
    isAnonymous: false,
  },
  {
    handle: 'p-raman',
    displayName: 'P. Raman',
    bio: 'Agricultural economics. Incentives beat instructions, almost always.',
    domains: ['food', 'water', 'energy'],
    isAnonymous: false,
  },
  {
    handle: 'codes-and-cracks',
    displayName: 'codes_and_cracks',
    bio: 'Structural engineering. I have read more standards than papers.',
    domains: ['materials', 'cities'],
    isAnonymous: false,
  },
  {
    handle: 'h-tanaka',
    displayName: 'H. Tanaka',
    bio: 'Atmospheric science. Short-lived forcers get less attention than they deserve.',
    domains: ['climate', 'transport'],
    isAnonymous: false,
  },
  {
    handle: 'anon-9082',
    displayName: 'anon_9082',
    bio: 'Anonymous. Logistics and measurement.',
    domains: ['food', 'cities'],
    isAnonymous: true,
  },
  {
    handle: 'field-notes',
    displayName: 'field_notes',
    bio: 'Conservation practitioner. Suspicious of variance decomposition as a guide to action.',
    domains: ['biodiversity', 'climate'],
    isAnonymous: false,
  },
  {
    handle: 'd-hoffmann',
    displayName: 'D. Hoffmann',
    bio: 'Industrial decarbonisation. Mass balances first, narratives later.',
    domains: ['materials', 'energy'],
    isAnonymous: false,
  },
  {
    handle: 'w-osei',
    displayName: 'W. Osei',
    bio: 'Maritime and freight. Someone has to ask who pays for the bunkering.',
    domains: ['transport', 'food'],
    isAnonymous: false,
  },
  {
    handle: 'curator-01',
    displayName: 'Curation desk',
    bio: 'Platform curation account. Reviews ingestion candidates and validation records. Does not author hypotheses.',
    domains: ['other'],
    isAnonymous: false,
  },
];
