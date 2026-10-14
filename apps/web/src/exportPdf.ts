import type { CellDef } from 'jspdf-autotable';
import { COLUMNS, daysOfMonth, isWeekend, type Year } from '@medtools/engine';
import { YEAR_LABEL } from './store';
import { dayLabel, monthLabel, shortDate } from './format';
import { calendarCell, type ExcelInput } from './exportExcel';
import { headerRows } from './calendarHeaders';
import { SUMMARY_COLS, SUMMARY_HEADERS, summarize, summaryValue } from './summary';

/** Stessi colori dell'export Excel (e di styles.css), in RGB. */
const COLOR = {
  5: [255, 241, 194],
  4: [216, 243, 220],
  3: [253, 226, 234],
  ruota: [219, 234, 254],
  weekend: [238, 240, 244],
  unused: [243, 244, 246],
  head: [31, 59, 99],
  subhead: [220, 227, 238],
  border: [184, 192, 204],
  muted: [107, 116, 130],
  red: [180, 35, 24],
} as const satisfies Record<string, [number, number, number]>;

type RGB = [number, number, number];

/** Calendario del mese in PDF, A4 orizzontale, come il foglio "Turni" dell'Excel; nella seconda pagina il riepilogo per persona. */
export async function exportPdf({ data, month, demand, cells, roster, headers }: ExcelInput) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const label = monthLabel(month);
  const Label = label[0].toUpperCase() + label.slice(1);
  const today = shortDate(new Date().toISOString().slice(0, 10));
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR.head);
  doc.text(`Turni specializzandi · ${Label}`, margin, 12);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text(`Pronto Soccorso, OBI, Pediatria d'Urgenza · aggiornato al ${today}`, margin, 16.5);

  // Intestazioni su tre righe (reparto, fascia, posto), con "Giorno" che le occupa tutte.
  const head: CellDef[][] = headers.map((row, r) => {
    const cellsOfRow: CellDef[] = row.map((h) => ({
      content: h.label,
      colSpan: h.colSpan,
      rowSpan: h.rowSpan,
      styles: r === 0 ? { fillColor: COLOR.head as RGB, textColor: 255 } : { fillColor: COLOR.subhead as RGB, textColor: COLOR.head as RGB },
    }));
    return r === 0
      ? [{ content: 'Giorno', rowSpan: headers.length, styles: { fillColor: COLOR.head as RGB, textColor: 255, valign: 'middle' } }, ...cellsOfRow]
      : cellsOfRow;
  });

  const body: CellDef[][] = demand.map((day) => {
    const date = day[0].date;
    const weekend = isWeekend(date);
    const { dow, day: dd } = dayLabel(date);
    const bg: RGB = weekend ? [...COLOR.weekend] : [255, 255, 255];
    return [
      { content: `${dow} ${dd}`, styles: { fontStyle: 'bold', fillColor: bg, textColor: (weekend ? COLOR.red : COLOR.head) as RGB, halign: 'left' } },
      ...COLUMNS.map(({ slot, idx }) => {
        const { text, color } = calendarCell({ data, cells, roster }, day, slot, idx);
        return { content: text, styles: { fillColor: color ? ([...COLOR[color]] as RGB) : bg, fontStyle: weekend ? 'bold' : 'normal' } } as CellDef;
      }),
    ];
  });

  // Fine settimana: riga più spessa sotto la domenica.
  const sundays = new Set(demand.map((day, i) => (dayLabel(day[0].date).dow === 'dom' ? i : -1)).filter((i) => i >= 0));

  autoTable(doc, {
    head,
    body,
    startY: 20,
    margin: { left: margin, right: margin, top: 10, bottom: 10 },
    theme: 'grid',
    styles: {
      fontSize: 6,
      cellPadding: 0.7,
      halign: 'center',
      valign: 'middle',
      lineColor: COLOR.border as RGB,
      lineWidth: 0.1,
      textColor: 20,
      overflow: 'linebreak',
    },
    headStyles: { fontStyle: 'bold', fontSize: 6.5, halign: 'center', valign: 'middle' },
    columnStyles: { 0: { cellWidth: 12 } },
    didDrawCell: (h) => {
      if (h.section === 'body' && sundays.has(h.row.index)) {
        doc.setDrawColor(91, 102, 117);
        doc.setLineWidth(0.5);
        doc.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height);
      }
    },
  });

  // Legenda sotto la tabella (o in una pagina nuova se non c'è spazio).
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  if (y > pageH - 12) {
    doc.addPage();
    y = 15;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.muted);
  doc.text('Legenda', margin, y + 3);
  const legend: [string, RGB][] = [
    ['V anno', [...COLOR[5]]],
    ['IV anno', [...COLOR[4]]],
    ['III anno', [...COLOR[3]]],
    ['Ruota comune', [...COLOR.ruota]],
    ['Non previsto', [...COLOR.unused]],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20);
  legend.forEach(([t, rgb], i) => {
    const x = margin + 16 + i * 26;
    doc.setFillColor(...rgb);
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.1);
    doc.rect(x, y, 24, 4.5, 'FD');
    doc.text(t, x + 12, y + 3.1, { align: 'center' });
  });

  // ---------- Pagina 2: riepilogo per persona, come il foglio "Riepilogo" dell'Excel ----------
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR.head);
  doc.text(`Riepilogo turni · ${Label}`, margin, 12);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.muted);
  doc.text(
    doc.splitTextToSize(
      'Turni del mese per tipo; mattina e pomeriggio insieme. Un turno da 12h conta come due. Sab/dom: Giorni = giorni di sabato o domenica lavorati (non weekend); Weekend = weekend distinti con almeno un turno. Il totale esclude Bambi e i reparti facoltativi; la ruota comune non è conteggiata.',
      pageW - 2 * margin,
    ),
    margin,
    16.5,
  );

  const sumHead = headerRows(SUMMARY_HEADERS);
  const sumHeadCells: CellDef[][] = sumHead.map((row, r) => {
    const cellsOfRow: CellDef[] = row.map((h) => ({
      content: h.label,
      colSpan: h.colSpan,
      rowSpan: h.rowSpan,
      styles: r === 0 ? { fillColor: COLOR.head as RGB, textColor: 255 } : { fillColor: COLOR.subhead as RGB, textColor: COLOR.head as RGB },
    }));
    const lead = (content: string): CellDef => ({
      content,
      rowSpan: sumHead.length,
      styles: { fillColor: COLOR.head as RGB, textColor: 255, valign: 'middle' },
    });
    return r === 0 ? [lead('Persona'), lead('Anno'), ...cellsOfRow] : cellsOfRow;
  });

  const sums = summarize(data, [month]);
  const days = daysOfMonth(month);
  const people = data.people
    .map((p) => {
      const first = days.find((d) => roster.yearOf(p.id, d));
      return first ? { p, year: roster.yearOf(p.id, first)! as Year } : null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.year - a.year || a.p.name.localeCompare(b.p.name));
  const totalCol = 2 + SUMMARY_COLS.indexOf('total');
  // Ultima persona di ogni anno di corso: riga più spessa sotto.
  const lastOfYear = new Set(people.map((x, i) => (people[i + 1]?.year !== x.year ? i : -1)).filter((i) => i >= 0));

  const sumBody: CellDef[][] = people.map(({ p, year }) => [
    { content: p.name, styles: { fillColor: [...COLOR[year]] as RGB, fontStyle: 'bold', halign: 'left' } },
    { content: YEAR_LABEL[year], styles: { fillColor: [...COLOR[year]] as RGB } },
    ...SUMMARY_COLS.map((c, i): CellDef => {
      const v = summaryValue(sums[p.id], c);
      return { content: String(v), styles: { textColor: v === 0 ? (COLOR.border as RGB) : 20, fontStyle: 2 + i === totalCol ? 'bold' : 'normal' } };
    }),
  ]);

  autoTable(doc, {
    head: sumHeadCells,
    body: sumBody,
    startY: 24,
    margin: { left: margin, right: margin, top: 10, bottom: 10 },
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 0.9,
      halign: 'center',
      valign: 'middle',
      lineColor: COLOR.border as RGB,
      lineWidth: 0.1,
      textColor: 20,
    },
    headStyles: { fontStyle: 'bold', fontSize: 6.5, halign: 'center', valign: 'middle' },
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 10 } },
    didDrawCell: (h) => {
      if (h.section === 'body' && lastOfYear.has(h.row.index)) {
        doc.setDrawColor(91, 102, 117);
        doc.setLineWidth(0.5);
        doc.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height);
      }
    },
  });

  // Piè di pagina su ogni pagina.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR.muted);
    doc.text(`Turni specializzandi · ${label}`, margin, pageH - 4);
    doc.text(`Pagina ${i} di ${pages}`, pageW - margin, pageH - 4, { align: 'right' });
  }

  doc.save(`Turni ${Label}.pdf`);
}
