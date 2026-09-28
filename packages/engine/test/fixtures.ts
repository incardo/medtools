import type { EngineInput, Enrollment, Person, Year } from '../src';

/** Nomi fittizi: 5 V anno, 6 IV anno, 6 III anno, anno 2026/27. */
export function exampleInput(overrides: Partial<EngineInput> = {}): EngineInput {
  const groups: [Year, string[]][] = [
    [5, ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo']],
    [4, ['Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo']],
    [3, ['Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec']],
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
    params: { month: '2026-11', exams: [], vNightsPerPerson: 5 },
    locked: [],
    history: {},
    runs: 10,
    ...overrides,
  };
}
