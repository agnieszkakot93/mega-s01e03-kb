// Splits a merged ticket into the problems it really holds.
// causes.ts places each report by tenant and channel; desk-notes.json lists reports the desk
// read as a one-day move, which is neither a day/month swap nor a form hint, so it is its own problem.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day-move' | 'unplaced';

export const PROBLEM_TEXT: Record<Problem, string> = {
  parser: 'Shared parser reads dates month first; day-first tenants get day and month swapped.',
  hint: 'booking-v3 form hint says MM/DD/YYYY, but the form reads the date day first.',
  'one-day-move': 'Booking lands exactly one day early or late; no swap involved.',
  unplaced: 'No tenant on file, or the tenant writes month first.',
};

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'one-day-move';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemRow = { problem: Problem; reports: number; tenants: number; firstSeen: string; lastSeen: string; taggedRight: number };

export function splitTicket(all: Report[], ticket: number, tenantOf: (r: Report) => Tenant | undefined, oneDayMove: readonly string[]) {
  const merged = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const rows: ProblemRow[] = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs.length,
        tenants: new Set(rs.map((r) => r.tenant)).size,
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
        taggedRight: rs.filter((r) => r.meta.intakeTag === problem).length,
      };
    })
    .sort((a, b) => b.reports - a.reports);
  return { exportRows: all.length, merged: merged.length, rows };
}
