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
  { label: 'OBI', children: [{ label: 'Mattina' }, { label: 'Pomeriggio' }] },
  {
    label: 'Ped Urg',
    children: [{ label: 'Mattina', children: [{ label: 'IV' }, { label: 'III' }] }, { label: 'Pomeriggio' }],
  },
  { label: 'Bambi' },
  { label: 'Amb' },
];

export const HEADER_DEPTH = 3;

export type HeadCell = { label: string; row: number; col: number; colSpan: number; rowSpan: number };

const leaves = (n: HeadNode): number => (n.children ? n.children.reduce((s, c) => s + leaves(c), 0) : 1);

/**
 * Celle d'intestazione riga per riga, con le colonne contate da 0 dopo la colonna "Giorno".
 * Un nodo senza figli occupa tutte le righe rimanenti.
 */
export function headerRows(nodes: HeadNode[] = HEADERS): HeadCell[][] {
  const rows: HeadCell[][] = Array.from({ length: HEADER_DEPTH }, () => []);
  const walk = (list: HeadNode[], row: number, col: number) => {
    for (const n of list) {
      const colSpan = leaves(n);
      rows[row].push({ label: n.label, row, col, colSpan, rowSpan: n.children ? 1 : HEADER_DEPTH - row });
      if (n.children) walk(n.children, row + 1, col);
      col += colSpan;
    }
  };
  walk(nodes, 0, 0);
  return rows;
}
