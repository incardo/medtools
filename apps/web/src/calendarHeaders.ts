/** Intestazioni del calendario su tre livelli: reparto → fascia → posto. Stesso ordine di COLUMNS (+ ruota comune dopo la notte). */
export type HeadNode = { label: string; children?: HeadNode[] };

export const HEADERS: HeadNode[] = [
  {
    label: 'PS',
    children: [
      { label: 'Mattina', children: [{ label: 'Alti' }, { label: 'Alti' }, { label: 'Verdi' }] },
      { label: 'Pomeriggio', children: [{ label: 'Alti' }, { label: 'Alti' }, { label: 'Verdi' }] },
      { label: 'Notte', children: [{ label: 'Specializzando' }, { label: 'Ruota comune' }] },
    ],
  },
  { label: 'OBI', children: [{ label: 'Mattina', children: [{ label: '' }] }, { label: 'Pomeriggio', children: [{ label: '' }] }] },
  {
    label: 'Ped Urg',
    children: [{ label: 'Mattina', children: [{ label: 'IV' }, { label: 'III' }] }, { label: 'Pomeriggio', children: [{ label: 'IV' }] }],
  },
  { label: 'Bambi' },
  { label: 'Amb' },
];

export const HEADER_DEPTH = 3;

export type HeadCell = { label: string; row: number; col: number; colSpan: number; rowSpan: number };

const leaves = (n: HeadNode): number => (n.children ? n.children.reduce((s, c) => s + leaves(c), 0) : 1);
const depth = (list: HeadNode[]): number => Math.max(...list.map((n) => 1 + (n.children ? depth(n.children) : 0)));

/**
 * Celle d'intestazione riga per riga, con le colonne contate da 0 dopo la colonna "Giorno".
 * Un nodo senza figli occupa tutte le righe rimanenti.
 */
export function headerRows(nodes: HeadNode[] = HEADERS): HeadCell[][] {
  const rowCount = depth(nodes);
  const rows: HeadCell[][] = Array.from({ length: rowCount }, () => []);
  const walk = (list: HeadNode[], row: number, col: number) => {
    for (const n of list) {
      const colSpan = leaves(n);
      rows[row].push({ label: n.label, row, col, colSpan, rowSpan: n.children ? 1 : rowCount - row });
      if (n.children) walk(n.children, row + 1, col);
      col += colSpan;
    }
  };
  walk(nodes, 0, 0);
  return rows;
}

/** Ultima colonna (contata da 0) di ogni reparto: lì va il bordo spesso. */
export const groupEnds = (rows: HeadCell[][]) => new Set(rows[0].map((h) => h.col + h.colSpan - 1));

export const GROUP_ENDS = groupEnds(headerRows());
