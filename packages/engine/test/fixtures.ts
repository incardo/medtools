import type { EngineInput, Enrollment, Person, Year } from '../src';

/** Nomi fittizi: 10 V anno, 8 IV anno, 6 III anno, anno 2026/27. */
export function exampleInput(overrides: Partial<EngineInput> = {}): EngineInput {
  const groups: [Year, string[]][] = [
    [5, ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett']],
    [4, ['Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo']],
    [3, ['Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray']],
  ];
  const people: Person[] = [];
  const enrollments: Enrollment[] = [];
  for (const [year, names] of groups) {
    for (const name of names) {
      const id = name.toLowerCase();
      people.push({ id, name, bambiInterest: false });
      enrollments.push({ personId: id, academicYear: '2026/27', year, activeFrom: '2026-11-01' });
    }
  }
  return {
    month: '2026-11',
    people,
    enrollments,
    academicYear: { id: '2026/27', start: '2026-11-01', end: '2027-10-31', vLastDay: '2027-10-27' },
    absences: [],
    params: { month: '2026-11', exams: [] },
    locked: [],
    history: {},
    runs: 10,
    ...overrides,
  };
}
