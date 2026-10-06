import { useMemo, useState } from 'react';
import {
  ABSENCE_BLOCKS,
  ABSENCE_INFO,
  ABSENCE_LIMITS,
  OPTIONAL_WARDS,
  COLUMNS,
  COST,
  RUNS,
  SLOT_INFO,
  WEIGHTS,
  addDays,
  buildDemand,
  yearCanCover,
  type AbsenceKind,
  type Fascia,
  type Position,
  type SlotCode,
  type Year,
} from '@medtools/engine';
import { YEAR_LABEL, academicYearFor } from '../store';
import { dayLabel, shortDate, type ViewProps } from '../format';
import { HEADERS, type HeadNode } from '../calendarHeaders';

/** Una settimana qualsiasi (lunedì → domenica): le regole dipendono solo dal giorno della settimana. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays('2026-11-02', i));

/** Nome di ogni colonna del calendario, dalle intestazioni (es. "PS · Mattina · Alti"). */
function leafPaths(nodes: HeadNode[], prefix: string[] = []): string[] {
  return nodes.flatMap((n) => {
    const path = n.label ? [...prefix, n.label] : prefix;
    return n.children ? leafPaths(n.children, path) : [path.join(' · ')];
  });
}
const COLUMN_LABELS = leafPaths(HEADERS);

const FASCIA: Record<Fascia, string> = { M: 'mattina', P: 'pomeriggio', N: 'notte' };
const ALL_SLOTS = Object.keys(SLOT_INFO) as SlotCode[];

function notes(pos: Position): string[] {
  // Posti compilati solo a mano: il motore non li riempie.
  if (pos.manualOnly) {
    if (pos.slot === 'BAMBI') return ['a mano, solo interessati', 'fuori bilanciamento'];
    if (OPTIONAL_WARDS.includes(pos.slot)) return ['a mano, tutto il giorno', 'fuori bilanciamento'];
    if (pos.slot === 'PS_NOTTE') return ['a mano: ruota comune', 'o un IV anno', '(conta come notte)'];
    return ['a mano'];
  }
  const out: string[] = [];
  if (pos.alsoSlots.length) out.push('12h');
  if (pos.planBlock) out.push(pos.slot === 'OBI_M' ? 'weekend OBI: anche dom' : 'inizio blocco');
  else if (pos.slot === 'PS_NOTTE' && pos.blockAhead) out.push('→ dom alti 12h');
  else if (pos.slot === 'PS_ALTI_M' && pos.blockAhead) out.push('→ notte di dom');
  if (pos.prevDaySlot?.startsWith('PEDU') || pos.prevDaySlot === 'OBI_M') out.push('come sabato');
  else if (pos.prevDaySlot === 'PS_NOTTE') out.push('chi ha fatto la notte di ven');
  else if (pos.slot === 'PS_NOTTE' && pos.prevDaySlot) out.push('chi ha fatto gli alti sab');
  else if (pos.prevDaySlot) out.push('scambio col sabato');
  if (pos.notPrevDay) out.push('≠ sabato');
  if (pos.ruotaFallback) out.push('se nessuno: ruota comune');
  return out;
}

export function RulesView({ data, month }: ViewProps) {
  const [vPresent, setVPresent] = useState(true);
  const ay = academicYearFor(data, month);
  const week = useMemo(
    () => WEEK.map((date) => buildDemand(date, { vPresent })),
    [vPresent],
  );

  return (
    <section className="rules">
      <div className="toolbar">
        <h2>Regole</h2>
      </div>
      <p className="hint">
        Le regole che il motore segue quando premi <b>Genera suggerimenti</b>. Le tabelle (chi copre ogni posto, vincoli, indisponibilità,
        pesi e numero di tentativi) sono lette direttamente dal codice del motore, quindi sono sempre aggiornate.
      </p>

      <h3>Chi copre ogni posto (settimana tipo)</h3>
      <div className="toolbar">
        <p className="hint">
          Le regole seguono l'<b>anno di corso</b>, non le persone. Il colore dice quale anno copre il posto.
        </p>
        <div className="seg" role="group" aria-label="Periodo dell'anno">
          <button className={vPresent ? 'active' : ''} onClick={() => setVPresent(true)}>
            Con il V anno
          </button>
          <button className={!vPresent ? 'active' : ''} onClick={() => setVPresent(false)}>
            Dopo il {shortDate(ay.vLastDay)}
          </button>
        </div>
      </div>
      {!vPresent && (
        <p className="hint">
          Il V anno finisce il {shortDate(ay.vLastDay)} incluso: dal giorno dopo i suoi posti passano a IV e III anno (l'OBI solo al IV).
        </p>
      )}
      <div className="table-wrap">
        <table className="rules-week">
          <thead>
            <tr>
              <th className="sticky">Posto</th>
              {WEEK.map((d, j) => (
                <th key={d} className={j >= 5 ? 'weekend' : ''}>
                  <span className="dow">{dayLabel(d).dow}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map((col, i) => (
              <tr key={`${col.slot}#${col.idx}`}>
                <th className="sticky name">{COLUMN_LABELS[i]}</th>
                {week.map((day, j) => {
                  const pos = day.find((p) => p.slot === col.slot && p.idx === col.idx);
                  const mirror = day.find((p) => p.idx === col.idx && p.alsoSlots.includes(col.slot));
                  const weekend = j >= 5 ? ' weekend' : '';
                  if (!pos)
                    return (
                      <td key={j} className={`rule-cell${mirror ? '' : ' none'}${weekend}`}>
                        {mirror ? <span className="muted">↑ stessa persona (12h)</span> : '—'}
                      </td>
                    );
                  return (
                    <td key={j} className={`rule-cell${weekend}`}>
                      {pos.years.map((y) => (
                        <span key={y} className={`chip y${y}`}>
                          {YEAR_LABEL[y]}
                        </span>
                      ))}
                      {notes(pos).map((n) => (
                        <small key={n} className="note">
                          {n}
                        </small>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="rules-list">
        <li>
          <b>12h</b>: nel weekend la stessa persona copre mattina e pomeriggio (PS alti e autonomo del V anno, PS del III anno, OBI, Ped
          Urg).
        </li>
        <li>
          <b>Blocco Ped Urg</b> del IV anno: la stessa persona da venerdì pomeriggio a lunedì mattina (ven P, sab 12h, dom 12h, lun M). Se non
          è disponibile in uno dei giorni, il blocco si spezza invece di lasciare il posto scoperto.
        </li>
        <li>
          <b>III anno nel weekend</b>: uno agli alti e uno ai verdi, 12h ciascuno; la domenica si scambiano (preferenza: se uno non c'è, va un
          altro III anno).
        </li>
        <li>
          <b>V anno in PS</b>: ogni giorno, mattina e pomeriggio, uno agli <b>alti</b> e uno <b>autonomo</b> (colonna obbligatoria, conta nel
          bilanciamento). Il venerdì mattina tre V anno (due agli alti e uno autonomo); il venerdì pomeriggio solo l'autonomo (alti al IV,
          verdi al III).
        </li>
        <li>
          <b>Weekend del V anno</b>: chi fa la <b>notte di venerdì</b> fa la <b>domenica gli alti 12h</b>; chi fa gli <b>alti 12h il sabato</b>{' '}
          fa la <b>notte di domenica</b>; la notte di sabato ruota tra i V anno. Sono preferenze forti: se la persona non è disponibile, il
          posto va a un altro V anno. La domenica agli alti c'è sempre una persona diversa dal sabato.
        </li>
        <li>
          <b>OBI del weekend</b>: la stessa persona sabato e domenica (12h), poi smonto il lunedì. I weekend di OBI ruotano tra i V anno: va
          prima a chi ne ha fatti meno nell'anno.
        </li>
        <li>
          <b>Notti in PS</b>: tutte le notti un <b>V anno</b>, bilanciate tra le persone del V anno. Il secondo posto: sabato e domenica un{' '}
          <b>IV anno</b>, scelto dal motore; dal lunedì al venerdì a mano, la <b>ruota comune</b> (si scrive il nome) oppure un{' '}
          <b>IV anno</b>. Uno specializzando nel secondo posto conta come una notte, nella panoramica e nel bilanciamento, e valgono per lui
          le regole per tutti (smonto compreso). Se nessun V anno è disponibile, lun–ven va la ruota comune.
        </li>
        <li>
          <b>Reparti facoltativi</b> (Ortopedia, Radiologia, Anestesia, Chirurgia), dal lunedì al venerdì, tutto il giorno: V o IV anno, a
          mano. Il motore non li riempie e non entrano nel bilanciamento né nel totale; chi è in reparto quel giorno non riceve altri turni.
        </li>
        <li>
          <b>Bambi</b> è facoltativo: si assegna a mano, solo a chi è interessato, e non entra nel bilanciamento.
        </li>
      </ul>

      <h3>Chi non può coprire cosa</h3>
      <ul className="rules-list">
        {([5, 4, 3] as Year[]).map((y) => {
          const no = ALL_SLOTS.filter((s) => !yearCanCover(y, s));
          return (
            <li key={y}>
              <span className={`chip y${y}`}>{YEAR_LABEL[y]} anno</span>{' '}
              {no.length ? `mai: ${no.map((s) => SLOT_INFO[s].label).join(', ')}` : 'nessuna restrizione'}
            </li>
          );
        })}
        <li>
          <span className="chip ruota">Ruota comune</span> solo notti in PS dal lunedì al venerdì: nel secondo posto di notte, oppure nel primo
          come ripiego quando nessuno dell'anno previsto è disponibile. Non entra nel bilanciamento né nella panoramica.
        </li>
      </ul>

      <h3>Regole per tutti</h3>
      <ul className="rules-list">
        <li>Un solo turno al giorno (tranne i 12h del weekend, che valgono come mattina + pomeriggio).</li>
        <li>
          Chi fa la <b>notte</b> non lavora né il giorno stesso né il giorno dopo.
        </li>
        <li>
          <b>Smonto dopo il weekend</b>, dove possibile: chi lavora in PS o in OBI sabato e domenica non lavora il lunedì; chi fa Ped Urg 12h
          sabato e domenica non lavora il martedì. Chi lavora un solo giorno del weekend non ha smonto.
        </li>
        <li>Un V anno che fa 12h il sabato può fare la notte della domenica.</li>
        <li>Nessuno riceve turni nei giorni in cui non è attivo (prima dell'ingresso o dopo l'uscita).</li>
        <li>
          I turni scritti a mano non vengono mai toccati dal motore e <b>contano nel bilanciamento</b> (tranne Bambi e reparti facoltativi). Il
          motore ne tiene conto anche per le regole sopra: per esempio chi è inserito a mano di notte ha lo smonto il giorno dopo.
        </li>
        <li>
          In ogni cella si può mettere a mano chiunque, anche di un altro anno (sostituzioni), oppure scrivere un nome con "Altro nome…".
          Se il nome è nella scheda Persone il turno conta come gli altri; altrimenti resta solo il nome, senza conteggi né controlli.
        </li>
      </ul>

      <h3>Indisponibilità</h3>
      <table className="rules-small">
        <thead>
          <tr>
            <th>Sigla</th>
            <th>Significato</th>
            <th>Fasce escluse</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(ABSENCE_INFO) as AbsenceKind[]).map((k) => (
            <tr key={k}>
              <td>
                <span className={`abs-tag ${k}`}>{ABSENCE_INFO[k].short}</span>
              </td>
              <td>{ABSENCE_INFO[k].label}</td>
              <td>{ABSENCE_BLOCKS[k].map((f) => FASCIA[f]).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Si comunicano <b>entro il {ABSENCE_LIMITS.deadlineDay} del mese precedente</b>. Al massimo <b>{ABSENCE_LIMITS.weekendX} giorni di X nel
        weekend</b> (2 sabati e 2 domeniche, cioè 2 weekend) e <b>{ABSENCE_LIMITS.weekdayX} X nei giorni feriali</b> per persona nel mese (ferie e indisponibilità parziali non
        contano): oltre il limite la scheda Disponibilità dà un avviso.
      </p>
      <p className="hint">
        Gli <b>esami</b> (scheda Parametri) rendono indisponibile un intero anno di corso per tutto il giorno o solo per la notte.
      </p>

      <h3>Come sceglie il motore</h3>
      <ol className="rules-list">
        <li>
          <b>Blocchi per primi.</b> Per ogni venerdì del mese sceglie chi fa il blocco Ped Urg, e per ogni sabato chi fa l'OBI del weekend:
          prima chi ne ha fatti meno nell'anno, poi chi è disponibile in tutti i giorni del blocco e ha meno turni. Così nei giorni feriali
          sa già chi ha il blocco e gli dà meno Ped Urg.
        </li>
        <li>
          <b>Poi giorno per giorno.</b> Prima i posti che continuano un blocco o lo scambio del III anno, poi quelli con meno persone possibili
          (per non bruciare chi è raro).
        </li>
        <li>
          <b>Per ogni posto</b> considera solo chi rispetta tutte le regole sopra, e tra questi sceglie chi ha il <b>punteggio più basso</b>:
          <table className="rules-small">
            <tbody>
              <tr>
                <td>+{WEIGHTS.family}</td>
                <td>per ogni turno dello stesso tipo già fatto (PS alti, autonomo, verdi, notti, OBI, Ped Urg, Amb; non Bambi né reparti)</td>
              </tr>
              <tr>
                <td>+{WEIGHTS.total}</td>
                <td>per ogni turno fatto in totale</td>
              </tr>
              <tr>
                <td>+{WEIGHTS.weekend}</td>
                <td>per ogni giorno di weekend già lavorato (solo per i posti di sabato e domenica)</td>
              </tr>
              <tr>
                <td>+{WEIGHTS.weekendRest}</td>
                <td>se il posto farebbe saltare lo smonto dopo il weekend</td>
              </tr>
              <tr>
                <td>+{WEIGHTS.blockMissing}</td>
                <td>per ogni giorno collegato (blocco Ped Urg, OBI e PS del weekend) in cui la persona non è disponibile</td>
              </tr>
              <tr>
                <td>+{WEIGHTS.blocks}</td>
                <td>per ogni blocco Ped Urg o weekend di OBI già fatto (solo nella scelta di chi fa il blocco)</td>
              </tr>
              <tr>
                <td>+0–1,5</td>
                <td>una piccola quota casuale, per rompere i pareggi</td>
              </tr>
            </tbody>
          </table>
        </li>
        <li>
          <b>{RUNS} tentativi</b> con pareggi rotti in modo diverso; vince il calendario con il <b>costo</b> più basso:
          <table className="rules-small">
            <tbody>
              <tr>
                <td>{COST.hole}</td>
                <td>per ogni posto scoperto</td>
              </tr>
              <tr>
                <td>{COST.brokenLink}</td>
                <td>per ogni blocco o collegamento spezzato (Ped Urg, OBI e PS del weekend, scambio del III anno)</td>
              </tr>
              <tr>
                <td>{COST.weekendRest}</td>
                <td>per ogni smonto dopo il weekend non rispettato</td>
              </tr>
              <tr>
                <td>
                  ×{COST.spreadTotal} / ×{COST.spreadWeekend} / ×{COST.spreadFamily}
                </td>
                <td>squilibrio dentro ogni anno di corso (varianza) su turni totali, giorni di weekend e ogni tipo di turno</td>
              </tr>
            </tbody>
          </table>
          Per questo ogni clic su <b>Genera suggerimenti</b> può dare un calendario diverso ma ugualmente equilibrato.
        </li>
        <li>
          <b>Storico.</b> I conteggi partono dai mesi precedenti dello stesso anno di specializzazione (da novembre) e si azzerano a novembre.
          Chi entra a metà anno parte da zero, senza essere messo in pari. Un turno da 12h conta come due turni. Il totale esclude Bambi e i
          reparti facoltativi; la ruota comune non è conteggiata.
        </li>
      </ol>
    </section>
  );
}
