import type { Borders, Cell as XCell, Fill, Worksheet } from 'exceljs';
import { COLUMNS, RUOTA, daysOfMonth, isWeekend, keyOf, type Position, type Roster, type Year } from '@medtools/engine';
import { YEAR_LABEL, type AppData, type Cell } from './store';
import { dayLabel, monthLabel, shortDate } from './format';
import { groupEnds, headerRows, type HeadCell } from './calendarHeaders';
import { SUMMARY_COLS, SUMMARY_HEADERS, summarize, summaryValue } from './summary';

/** Stessi colori dell'app (styles.css), in ARGB. */
const COLOR = {
  5: 'FFFFF1C2',
  4: 'FFD8F3DC',
  3: 'FFFDE2EA',
  ruota: 'FFDBEAFE',
  weekend: 'FFEEF0F4',
  unused: 'FFF3F4F6',
  head: 'FF1F3B63',
  subhead: 'FFDCE3EE',
  border: 'FFB8C0CC',
  muted: 'FF6B7482',
} as const;

const fill = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: COLOR.border } };
const medium = { style: 'medium' as const, color: { argb: 'FF5B6675' } };
const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };

function title(ws: Worksheet, text: string, subtitle: string, width: number) {
  ws.mergeCells(1, 1, 1, width);
  ws.getCell(1, 1).value = text;
  ws.getCell(1, 1).font = { size: 16, bold: true, color: { argb: COLOR.head } };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, width);
  ws.getCell(2, 1).value = subtitle;
  ws.getCell(2, 1).font = { size: 10, italic: true, color: { argb: COLOR.muted } };
}

function headCell(c: XCell, value: string, dark: boolean) {
  c.value = value;
  c.font = { bold: true, size: dark ? 11 : 10, color: { argb: dark ? 'FFFFFFFF' : COLOR.head } };
  c.fill = fill(dark ? COLOR.head : COLOR.subhead);
  c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  c.border = box;
}

export interface ExcelInput {
  data: AppData;
  month: string;
  demand: Position[][];
  cells: Record<string, Cell>;
  roster: Roster;
  headers: HeadCell[][];
}

export async function exportExcel({ data, month, demand, cells, roster, headers }: ExcelInput) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MedTools';
  wb.created = new Date();
  const names = new Map(data.people.map((p) => [p.id, p.name]));
  const ruotaNames = data.ruotaNames ?? {};
  const today = shortDate(new Date().toISOString().slice(0, 10));
  const label = monthLabel(month);
  const Label = label[0].toUpperCase() + label.slice(1);

  // ---------- Foglio 1: calendario ----------
  const ws = wb.addWorksheet('Turni', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: '4:6',
    },
    headerFooter: { oddFooter: `&L&8Turni specializzandi · ${label}&R&8Pagina &P di &N` },
  });

  // Colonne: giorno + slot del calendario, con la ruota comune subito dopo la notte.
  type Col = { kind: 'slot'; slot: (typeof COLUMNS)[number] } | { kind: 'ruota' };
  const cols: Col[] = COLUMNS.flatMap((c): Col[] => (c.slot === 'PS_NOTTE' ? [{ kind: 'slot', slot: c }, { kind: 'ruota' }] : [{ kind: 'slot', slot: c }]));
  const width = cols.length + 1;
  title(ws, `Turni specializzandi · ${Label}`, `Pronto Soccorso, OBI, Pediatria d'Urgenza · aggiornato al ${today}`, width);

  ws.getColumn(1).width = 9;
  for (let i = 2; i <= width; i++) ws.getColumn(i).width = 13.5;

  // Intestazioni su tre righe: reparto, fascia, posto. Un bordo spesso separa reparti e fasce.
  const top = 4;
  const first = top + headers.length; // prima riga dei giorni
  const groupStarts = new Set<number>();
  ws.mergeCells(top, 1, first - 1, 1);
  headCell(ws.getCell(top, 1), 'Giorno', true);
  headers.forEach((row, r) =>
    row.forEach((h) => {
      const c = 2 + h.col;
      if (r < 2) groupStarts.add(c);
      if (h.colSpan > 1 || h.rowSpan > 1) ws.mergeCells(top + r, c, top + r + h.rowSpan - 1, c + h.colSpan - 1);
      headCell(ws.getCell(top + r, c), h.label, r === 0);
    }),
  );
  headers.forEach((_, r) => (ws.getRow(top + r).height = r === 0 ? 20 : 18));

  demand.forEach((day, i) => {
    const date = day[0].date;
    const r = ws.getRow(first + i);
    r.height = 18;
    const weekend = isWeekend(date);
    const { dow, day: dd } = dayLabel(date);
    const d = r.getCell(1);
    d.value = `${dow} ${dd}`;
    d.font = { bold: true, color: { argb: weekend ? 'FFB42318' : COLOR.head } };
    d.fill = fill(weekend ? COLOR.weekend : 'FFFFFFFF');
    d.alignment = { vertical: 'middle' };
    d.border = box;

    cols.forEach((c, j) => {
      const x = r.getCell(j + 2);
      let text = '';
      let bg: string = weekend ? COLOR.weekend : 'FFFFFFFF';
      if (c.kind === 'ruota') {
        text = ruotaNames[date] ?? '';
        if (text) bg = COLOR.ruota;
      } else {
        const { slot, idx } = c.slot;
        const foreseen = day.some((p) => (p.slot === slot || p.alsoSlots.includes(slot)) && p.idx === idx);
        const who = cells[keyOf({ date, slot, idx })]?.who;
        if (who === RUOTA) {
          text = 'Ruota comune';
          bg = COLOR.ruota;
        } else if (who) {
          text = names.get(who) ?? '?';
          const y = roster.yearOf(who, date);
          if (y) bg = COLOR[y];
        } else if (!foreseen) {
          bg = COLOR.unused;
        }
      }
      x.value = text;
      x.fill = fill(bg);
      x.font = { size: 10, bold: weekend };
      x.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      x.border = groupStarts.has(j + 2) ? { ...box, left: medium } : box;
    });
    // Separatore tra una settimana e l'altra
    if (dow === 'dom') for (let j = 1; j <= width; j++) ws.getCell(first + i, j).border = { ...ws.getCell(first + i, j).border, bottom: medium };
  });

  // Legenda sotto la tabella
  const lr = first + demand.length + 1;
  ws.getCell(lr, 1).value = 'Legenda';
  ws.getCell(lr, 1).font = { bold: true, size: 10, color: { argb: COLOR.muted } };
  const legend: [string, string][] = [
    ['V anno', COLOR[5]],
    ['IV anno', COLOR[4]],
    ['III anno', COLOR[3]],
    ['Ruota comune', COLOR.ruota],
    ['Non previsto', COLOR.unused],
  ];
  legend.forEach(([t, argb], i) => {
    const c = ws.getCell(lr, 2 + i);
    c.value = t;
    c.fill = fill(argb);
    c.font = { size: 9 };
    c.alignment = { horizontal: 'center' };
    c.border = box;
  });

  // ---------- Foglio 2: riepilogo per persona ----------
  // Stesse colonne della Panoramica: reparto → fascia → tipo, poi totale, weekend e assenze.
  const sumHead = headerRows(SUMMARY_HEADERS);
  const sumEnds = groupEnds(sumHead);
  const sumTop = 4;
  const sumFirst = sumTop + sumHead.length; // prima riga delle persone
  const sumWidth = 2 + SUMMARY_COLS.length;
  const rs = wb.addWorksheet('Riepilogo', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: sumFirst - 1 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${sumTop}:${sumFirst - 1}`,
    },
  });
  title(
    rs,
    `Riepilogo turni · ${Label}`,
    'Turni del mese per tipo; mattina e pomeriggio insieme. Un turno da 12h conta come due. Weekend = giorni di sabato o domenica lavorati. Il totale esclude Bambi e gli alti opzionali; la ruota comune non è conteggiata.',
    sumWidth,
  );
  for (const [c, text] of [
    [1, 'Persona'],
    [2, 'Anno'],
  ] as const) {
    rs.mergeCells(sumTop, c, sumFirst - 1, c);
    headCell(rs.getCell(sumTop, c), text, true);
  }
  sumHead.forEach((row, r) =>
    row.forEach((h) => {
      const c = 3 + h.col;
      if (h.colSpan > 1 || h.rowSpan > 1) rs.mergeCells(sumTop + r, c, sumTop + r + h.rowSpan - 1, c + h.colSpan - 1);
      headCell(rs.getCell(sumTop + r, c), h.label, r === 0);
    }),
  );
  sumHead.forEach((_, r) => (rs.getRow(sumTop + r).height = r === 0 ? 20 : 18));
  rs.getColumn(1).width = 22;
  rs.getColumn(2).width = 7;
  for (let i = 3; i <= sumWidth; i++) rs.getColumn(i).width = 9;

  const sums = summarize(data, [month]);
  const days = daysOfMonth(month);
  const people = data.people
    .map((p) => {
      const first = days.find((d) => roster.yearOf(p.id, d));
      return first ? { p, year: roster.yearOf(p.id, first)! as Year } : null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.year - a.year || a.p.name.localeCompare(b.p.name));

  const totalCol = 3 + SUMMARY_COLS.indexOf('total');
  people.forEach(({ p, year }, i) => {
    const row = rs.getRow(sumFirst + i);
    row.values = [p.name, YEAR_LABEL[year], ...SUMMARY_COLS.map((c) => summaryValue(sums[p.id], c))];
    // Riga più spessa quando cambia l'anno di corso
    const lastOfYear = people[i + 1] && people[i + 1].year !== year;
    for (let n = 1; n <= sumWidth; n++) {
      const x = row.getCell(n);
      x.border = { ...box, ...(n === 2 || sumEnds.has(n - 3) ? { right: medium } : {}), ...(lastOfYear ? { bottom: medium } : {}) };
      x.font = { size: 10, bold: n === 1 || n === totalCol };
      x.alignment = { horizontal: n === 1 ? 'left' : 'center', vertical: 'middle' };
      if (n <= 2) x.fill = fill(COLOR[year]);
      if (n > 2 && x.value === 0) x.font = { size: 10, color: { argb: 'FFB8C0CC' } };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Turni ${Label}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
