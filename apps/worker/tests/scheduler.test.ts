import { describe, expect, it } from 'vitest';
import { resolveScheduleHour, shouldRunDaily } from '../src/scheduler.js';

/**
 * The schedule has to hold two properties that are easy to get wrong and
 * expensive to notice: it must not fetch other people's servers twice in a day,
 * and it must still fetch them once after a restart.
 */
describe('the daily intake schedule', () => {
  const hour = 5;

  it('waits until the scheduled hour on a machine that has never run', () => {
    expect(shouldRunDaily({ now: new Date('2026-09-13T04:59:00Z'), lastRunAt: null, hour })).toBe(
      false,
    );
    expect(shouldRunDaily({ now: new Date('2026-09-13T05:00:00Z'), lastRunAt: null, hour })).toBe(
      true,
    );
  });

  it('does not run twice in one day', () => {
    expect(
      shouldRunDaily({
        now: new Date('2026-09-13T11:00:00Z'),
        lastRunAt: new Date('2026-09-13T05:02:00Z'),
        hour,
      }),
    ).toBe(false);
  });

  it('runs again the next day', () => {
    expect(
      shouldRunDaily({
        now: new Date('2026-09-14T05:01:00Z'),
        lastRunAt: new Date('2026-09-13T05:02:00Z'),
        hour,
      }),
    ).toBe(true);
  });

  it('survives a restart: the decision comes from the database, not a timer', () => {
    // Four restarts in one afternoon, each asking the same question.
    const lastRunAt = new Date('2026-09-13T05:02:00Z');
    for (const minute of ['06:00', '09:30', '14:15', '23:59']) {
      expect(
        shouldRunDaily({ now: new Date(`2026-09-13T${minute}:00Z`), lastRunAt, hour }),
      ).toBe(false);
    }
  });

  it('catches up on a day it missed', () => {
    expect(
      shouldRunDaily({
        now: new Date('2026-09-20T08:00:00Z'),
        lastRunAt: new Date('2026-09-13T05:02:00Z'),
        hour,
      }),
    ).toBe(true);
  });

  it('reads the hour from the environment and refuses nonsense', () => {
    expect(resolveScheduleHour({ INTAKE_HOUR_UTC: '3' })).toBe(3);
    expect(resolveScheduleHour({ INTAKE_HOUR_UTC: '0' })).toBe(0);
    expect(resolveScheduleHour({})).toBe(5);
    expect(resolveScheduleHour({ INTAKE_HOUR_UTC: '25' })).toBe(5);
    expect(resolveScheduleHour({ INTAKE_HOUR_UTC: 'midnight' })).toBe(5);
    expect(resolveScheduleHour({ INTAKE_HOUR_UTC: '-1' })).toBe(5);
  });
});
