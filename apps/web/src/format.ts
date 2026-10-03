import type { Dispatch, SetStateAction } from 'react';
import { weekday } from '@medtools/engine';
import type { AppData } from './store';

export interface ViewProps {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  month: string;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dayLabel(date: string): { dow: string; day: string } {
  return { dow: DAYS[weekday(date)], day: date.slice(8, 10) };
}

export function shortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** Data di oggi (ora locale) in formato YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
