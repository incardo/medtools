import type { CellDef } from 'jspdf-autotable';
import { COLUMNS, isWeekend } from '@medtools/engine';
import { dayLabel, monthLabel, shortDate } from './format';
import { calendarCell, type ExcelInput } from './exportExcel';

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

/** Calendario del mese in PDF, A4 orizzontale, come il foglio "Turni" dell'Excel. */
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
