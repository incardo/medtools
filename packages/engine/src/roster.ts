import { SLOT_INFO } from './rules';
import type { Absence, AbsenceKind, AcademicYear, Enrollment, ExamDay, Fascia, Person, SlotCode, Year } from './types';
import { academicYearOf } from './dates';

/** Chi c'è, in che anno di corso, e quando è disponibile. */
export class Roster {
  private absences = new Map<string, AbsenceKind>();

  constructor(
    readonly people: Person[],
    private enrollments: Enrollment[],
    private academicYear: AcademicYear,
    absences: Absence[],
    private exams: ExamDay[],
  ) {
    for (const a of absences) this.absences.set(`${a.personId}|${a.date}`, a.kind);
  }

  /** Anno di corso della persona in quella data, o null se non è attiva. */
  private yearCache = new Map<string, Year | null>();

  yearOf(personId: string, date: string): Year | null {
    const k = `${personId}|${date}`;
    if (!this.yearCache.has(k)) this.yearCache.set(k, this.computeYear(personId, date));
    return this.yearCache.get(k)!;
  }

  private computeYear(personId: string, date: string): Year | null {
    const ay = academicYearOf(date);
    const e = this.enrollments.find(
      (x) => x.personId === personId && x.academicYear === ay && x.activeFrom <= date && (!x.activeTo || date <= x.activeTo),
    );
    if (!e) return null;
    if (e.year === 5 && ay === this.academicYear.id && date > this.academicYear.vLastDay) return null;
    return e.year;
  }

  private activeCache = new Map<string, { person: Person; year: Year }[]>();

  activeOn(date: string): { person: Person; year: Year }[] {
    let out = this.activeCache.get(date);
    if (!out) {
      out = [];
      for (const person of this.people) {
        const year = this.yearOf(person.id, date);
        if (year) out.push({ person, year });
      }
      this.activeCache.set(date, out);
    }
    return out;
  }

  vPresent(date: string): boolean {
    return this.activeOn(date).some((x) => x.year === 5);
  }

  absenceOf(personId: string, date: string): AbsenceKind | undefined {
    return this.absences.get(`${personId}|${date}`);
  }

  /** Indisponibile in quella fascia per assenza o esame. */
  unavailable(personId: string, date: string, fascia: Fascia): string | null {
    const kind = this.absenceOf(personId, date);
    if (kind === 'X' || kind === 'F') return kind === 'F' ? 'ferie' : 'indisponibile';
    if (kind === 'noM' && fascia === 'M') return 'no mattina';
    if (kind === 'noP' && fascia === 'P') return 'no pomeriggio';
    const year = this.yearOf(personId, date);
    for (const ex of this.exams) {
      if (ex.date !== date || !year || !ex.years.includes(year)) continue;
      if (!ex.nightOnly || fascia === 'N') return 'esame';
    }
    return null;
  }

  unavailableForSlots(personId: string, date: string, slots: SlotCode[]): string | null {
    for (const s of slots) {
      const why = this.unavailable(personId, date, SLOT_INFO[s].fascia);
      if (why) return why;
    }
    return null;
  }
}
