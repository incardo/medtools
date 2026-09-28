# MedTools — Turni specializzandi Pronto Soccorso

Documento di passaggio dalla conversazione con Claude (chat) a VS Code.
Contiene: obiettivo, tutte le regole dette finora, com'è fatto il file Excel attuale, cosa non funziona ancora, punti aperti e proposta di stack/hosting gratuito.

Convenzioni: **[detto]** = regola dichiarata dall'utente; **[assunzione]** = interpretazione mia, da confermare; **[TODO]** = non ancora fatto.

> Salvato come `CLAUDE.md` nella root del repo: se apri questa cartella con Claude Code (anche dentro VS Code) viene letto in automatico a ogni sessione, senza doverlo incollare di nuovo.

---

## 1. Obiettivo

Costruire uno strumento per compilare ogni mese i turni degli specializzandi (PS, OBI, Pediatria Urgenza) per il gruppo del **IV anno**, tenendo conto anche di **III e V anno**.

Requisiti espressi:

- Le regole si applicano da sole ogni mese e precompilano il calendario. **[detto]**
- Il foglio delle disponibilità (ferie/assenze) alimenta l'assegnazione dei turni del IV anno. **[detto]**
- Panoramica per medico: turni fatti per tipo, ferie/assenze, come nel foglio "Ottobre 2026" dell'Excel originale. **[detto]**
- Riequilibrare carico e tipologia di turni usando lo storico luglio–settembre. **[detto]**
- In futuro estendere la stessa logica a III e V anno, se tutti compilano le proprie assenze. **[detto]**
- Interfaccia migliore di Excel: web app accessibile a tutti, pubblicata gratis, codice gestito in VS Code. **[detto]**
- Repository GitHub creato dall'utente: `https://github.com/incardo/medtools.git` (vuota).

Decisione presa: si procede con una **web app vera** (non solo una dashboard da chat).

---

## 2. Persone

**IV anno (7 medici, gestiti dal motore):** Incardona, Somenzi, Cortesia, Aluffi, Topalli, Serra, Spina.

- **Spina** può fare solo turni di PS mattina o pomeriggio: mai Ped Urg. **[detto]**
- Nel file attuale la escludo anche da OBI e Notte. **[assunzione]** — la frase originale dice "solo PS mattina o pomeriggio", quindi è coerente, ma va confermato.
- Per ottobre Spina deve avere un numero di turni **uguale agli altri**, senza compensare il carico ridotto dei mesi precedenti (non c'era). **[detto]**

**III anno e V anno:** nomi non ancora forniti. Il modello dati deve permettere di aggiungerli da una schermata.

---

## 3. Tipi di turno (slot)

| Codice | Significato | Note |
|---|---|---|
| `PS_ALTI_M` / `PS_ALTI_P` | PS codici alti, mattina / pomeriggio | ogni fascia ha 2 posti alti |
| `PS_VERDI_M` / `PS_VERDI_P` | PS codici bassi ("verdista"), mattina / pomeriggio | 1 posto per fascia |
| `PS_NOTTE` | PS notte | |
| `OBI_M` / `OBI_P` | Osservazione breve, mattina / pomeriggio | |
| `PEDU_M` / `PEDU_P` | Pediatria Urgenza, mattina / pomeriggio | |
| `BAMBI`, `AMB` | Colonne presenti nel foglio | **regole non definite** — restano vuote |

Fasce per la disponibilità: `mattina`, `pomeriggio`, `notte` (3 righe per giorno).

---

## 4. Regole per anno

### IV anno **[detto]**

- Ped Urg mattina **e** pomeriggio, **tutti i giorni**.
- OBI mattina il **lunedì**.
- **Notte** il **giovedì** e il **sabato**, con smonto.
- **Un turno** PS codici alti (mattina **o** pomeriggio) il **lunedì, mercoledì, venerdì**.
- **Un turno** PS codici bassi (mattina **o** pomeriggio) il **martedì e giovedì**.
- Nel weekend Ped Urg è coperto da **un solo specializzando** per mattina e pomeriggio insieme.

### V anno **[detto]**

- PS alti mattina (1 turno) e PS alti pomeriggio (1 turno).
- OBI mattina **e** pomeriggio.
- 5 notti PS nel mese.
- **Esame il 5 ottobre**: non copre nessun turno quel giorno, né la notte del 4 e del 5 ottobre.
- **Dal 27 ottobre non ci sono più**: i loro turni li coprono IV e III anno.

### III anno **[detto]**

- PS alti (mattina **o** pomeriggio) martedì e giovedì.
- PS bassi (mattina **o** pomeriggio) lunedì, mercoledì, venerdì.

### Vincoli sui turni "in dubbio" (pool generici) **[detto]**

Quando il turno non è assegnabile con certezza si scrive "III anno", "V anno" o "Ruota comune":

- III anno **non** può coprire turni al pomeriggio in PS, né OBI.
- Ruota comune **non** può coprire Ped Urg, né OBI.
- V anno: nessuna restrizione (fino al 26/10).

---

## 5. Regole trasversali

Valgono per tutti i medici assegnati dal motore. **[detto]**

1. Una persona con un turno assegnato **non riceve altri turni lo stesso giorno**.
2. Chi fa la **notte** non lavora né il giorno stesso né il giorno dopo.
3. Chi fa **12 ore** (soprattutto dopo il weekend) ha diritto a un giorno di smonto, **dove possibile** (preferenza, non vincolo assoluto).
4. In PS ogni giorno, tra mattina e pomeriggio, i IV anno **si alternano**: uno ai codici alti e uno ai codici bassi, sempre nel rispetto delle regole per anno.
5. Riequilibrare **tipologia di turni e carico** usando i conteggi luglio–settembre.

**[assunzione]** "12 ore" = il turno del weekend in Ped Urg (una persona copre mattina + pomeriggio) → smonto il primo giorno feriale dopo. Da confermare: quali turni contano come 12h?

---

## 6. Indisponibilità

Nel foglio **Ferie e Assenze** dell'Excel:

- Tabella `Table11`, intervallo `A3:S96`, **3 righe per giorno** (mattina, pomeriggio, notte), dal 1 al 31 ottobre 2026.
- Colonne dei 7 medici IV anno: `F:L` nell'ordine Incardona, Somenzi, Cortesia, Aluffi, Topalli, Serra, Spina.
- Il file contiene solo la lettera `x` (indisponibile).

Dalle foto (mai arrivate in chat) la notazione reale è: **`no M`** = non disponibile la mattina, **`no P`** = non disponibile il pomeriggio, **`X`** = indisponibilità, **`F`** = ferie. **[detto]**

Modello suggerito: un'indisponibilità ha `tipo` (`X`, `F`, `noM`, `noP`) e copre una o più fasce (`mattina`, `pomeriggio`, `notte`).

Osservazione sui dati del file: il 9 ottobre risultano assenti tutti tranne Spina, che non può fare Ped Urg, quindi Ped Urg non ha nessuno disponibile. Può essere un dato di prova; da verificare con la foto reale.

Conteggio delle `x` presenti nel file (dato non verificato): Somenzi 40, Aluffi 37, Topalli 33, Serra 33, Spina 26, Incardona 19, Cortesia 18.

---

## 7. Parametri di ottobre 2026

| Parametro | Valore |
|---|---|
| Primo giorno del mese | 01/10/2026 |
| V anno presente fino a | 26/10/2026 (dal 27 assente) |
| V anno assente (esame) | 5 ottobre tutto il giorno; notte del 4 |
| Altre note del file originale | 21 ottobre: esame (III/IV/V anno) |

**Errore noto nel file Excel attuale:** ho segnato il V anno assente per **l'intera giornata sia del 4 sia del 5 ottobre**. Secondo la regola detta, il 4 è assente solo la notte. **[TODO]** correggere.

**Non gestito:** l'esame del 21 ottobre (III/IV/V anno) non è ancora nei parametri. **[TODO]**

---

## 8. Come funziona il file Excel attuale (`Turni_Desiderate_PS.xlsx`)

Il workbook originale ha fogli mensili (Marzo–Settembre 2026), "Desiderate", "Ottobre 2026" (con la panoramica per medico) e "Ferie e Assenze". Ho aggiunto/riscritto:

**`Turni tutti`** — una riga per giorno (righe 4–34).

- Col A: data, generata da `PrimoGiorno` (cella B39) e si ferma a fine mese.
- Col B–D: PS mattina. B = alti (V anno), C = secondo posto alti, D = verdista. Col E–G: uguale per il pomeriggio.
- Col H: notte. Col J–K: OBI M/P. Col L: Ped Urg M. Col O: Ped Urg P (nel weekend copia L). Col P–Q: Bambi/Amb. Col R: note (smonto). Col S: suggerimenti.
- Le celle B–K si riempiono da sole con "V anno", "III anno", "Ruota comune" in base a `WEEKDAY()` e ai parametri V anno (B37 fine presenza, B38:F38 date extra).
- Menu a tendina con i nomi, Spina esclusa da Ped Urg. Cella **rossa** se il nome scelto è assente, **arancione** se compare due volte lo stesso giorno.
- Colori: rosa = III anno, verde = supplement IV anno, giallo = supplement V anno, blu = ruota comune, grigio = weekend/da definire.
- Nessun cambio colori per i turni PS coperti dal IV anno: la colonna "Verdista" ha già un'intestazione apposta. **[detto]**

**`Suggerimenti`** — motore di calcolo, un blocco per turno del IV anno (PedU M, PedU P, OBI M lunedì, Notte gio/sab, PS Alti flex lun/mer/ven, PS Verdi flex mar/gio). Per ogni giorno assegna un punteggio a ogni medico: escluso se assente, se ha già un turno quel giorno, se è già stato suggerito quel giorno per un altro turno, se è in smonto dopo notte. Tra i disponibili sceglie chi ha meno turni di quel tipo, con una rotazione per rompere i pareggi.

**`Overview`** — conteggio turni per tipo e ferie per medico.

**`Ferie e Assenze`** — riga 1 con intestazioni "IV ANNO" (F:L), "III ANNO" (T:X, vuote) e "V ANNO" (Y:AC, vuote), pronte per uso futuro.

### Limiti dell'Excel (motivo del passaggio a web app)

- Il motore è **greedy giorno per giorno**, senza guardare avanti: può arrivare a "nessuno disponibile" anche quando una scelta diversa nei giorni prima avrebbe evitato il buco.
- Non carica lo **storico luglio–settembre**: bilancia solo dentro il mese.
- Lo smonto è gestito solo dopo notti di giovedì/sabato (venerdì e domenica). **Non** c'è lo smonto dopo le 12h del weekend.
- Non assegna i nomi di III e V anno. Non gestisce i 5 turni notte del V anno.
- Non distingue "M o P" con logica di alternanza alti/bassi: sceglie per fascia solo la disponibilità.
- Errore preesistente nel file originale, non mio: foglio "Giugno 2026", cella T44 dà `#VALUE!`.

---

## 9. Cose ancora da ricevere o chiarire

1. **Le tre foto**: (a) turni di settembre parzialmente compilati e tabella da compilare, (b) indisponibilità con notazione `no M / no P / X / F`, (c) conteggi turni luglio–settembre. Non sono mai arrivate in chat, va caricato il materiale (meglio come CSV/Excel o foto nitide).
2. Regole per **Bambi** e **Ambulatorio**.
3. Quali turni contano come **12h** per lo smonto.
4. Come si assegnano le **5 notti del V anno** e in che modo si combinano con gli smonti.
5. I turni del weekend per PS alti/verdi: chi li copre e con che regola (nel file restano "in dubbio").
6. Se nell'app serve **storico multi-mese** e da quando parte il riequilibrio.

---

## 10. Funzionalità desiderate per la web app

Priorità suggerita:

1. **Motore di assegnazione come codice puro** (TypeScript, senza dipendenze dall'interfaccia, con test): regole per anno, vincoli, indisponibilità, storico. Deve poter girare **nel browser**, così l'hosting gratuito non pesa sul calcolo.
2. Anagrafica medici gestibile da schermata (anno, attivo, restrizioni, es. Spina senza Ped Urg).
3. Inserimento disponibilità (griglia mese × fascia; tipo X/F/noM/noP).
4. Calendario mensile con suggerimenti, modifica manuale, avvisi (assente, doppio turno, smonto violato, nessuno disponibile).
5. Panoramica per medico (turni per tipo, ferie, storico) e riequilibrio.
6. Parametri del mese (mese/anno, fine V anno, date d'esame).
7. Esporta in Excel/PDF per l'ospedale.
8. Login con ruoli: chi modifica e chi consulta.

---

## 11. Modello dati proposto (bozza)

```
doctors        id, name, year (3|4|5), active, no_slots[]   -- es. Spina: [PEDU_M, PEDU_P, OBI_M, PS_NOTTE]
availability   id, doctor_id, date, slot (M|P|N), kind (X|F|noM|noP)
month_params   month (YYYY-MM), v_anno_last_day, v_anno_absence_dates[]
assignments    id, date, slot_type, doctor_id, source (manual|suggested)
history        doctor_id, month, slot_type, count            -- da luglio-settembre 2026
```

---

## 12. Dove pubblicarlo gratis

Verificato a fine settembre 2026 su fonti pubbliche. I piani cambiano spesso: ricontrolla prima di decidere.

**Frontend (pagine statiche)**

- **Cloudflare Pages** — consigliato. Piano free: richieste a file statici illimitate, 500 build/mese. Le funzioni lato server consumano la quota Workers (100.000 richieste/giorno, 10 ms CPU): non servono se il calcolo gira nel browser.
- **GitHub Pages** — sul piano Free funziona solo con **repository pubblici** e il sito è comunque pubblico; il controllo d'accesso privato richiede Enterprise Cloud. Poiché il repo conterrà codice e non dati, va bene per il frontend, ma **non** per nomi e assenze reali nel repo.
- **Vercel Hobby** — gratis ma solo per uso personale e non commerciale. Uno strumento di lavoro per un ospedale è una zona grigia: meglio evitarlo.

**Dati + login**

- **Supabase (free)** — Postgres + Auth incluso. 500 MB DB, 50.000 utenti attivi/mese, 2 progetti. **Limite chiave: i progetti gratuiti vengono messi in pausa dopo 7 giorni di inattività.** Basta qualche richiesta al giorno al database per evitarlo; un job schedulato (GitHub Actions ogni 2–3 giorni) risolve.
- **Cloudflare D1 (free)** — SQLite gestito, 5 milioni di righe lette/giorno, 100.000 scritte/giorno, 5 GB. Da 1 settembre 2026 le query falliscono se si supera il limite giornaliero. Non va in pausa. Il login però va costruito o preso da un altro servizio.

**Proposta di partenza (semplice)**

1. Frontend statico (Vite + React o SvelteKit statico) su Cloudflare Pages.
2. Supabase per database e login (link via email), con job di keepalive.
3. Motore di assegnazione come pacchetto TypeScript testato, eseguito nel browser.
4. Repo `medtools` **privato** o, se pubblico, **senza** nomi/assenze reali: solo codice e dati di esempio.

**Privacy:** nomi di colleghi e loro assenze sono dati personali. Non pubblicarli in un sito senza login e non committarli in un repo pubblico.

---

## 13. Struttura repo suggerita

```
medtools/
  CLAUDE.md                 # questo file
  packages/engine/          # motore regole (TS puro) + test
  apps/web/                 # interfaccia
  data/example/             # dati finti per test
  data/legacy/              # Excel originale (solo se il repo è privato)
  docs/regole.md            # regole in forma testabile
```

Primi passi consigliati: 1) trasformare le regole della sezione 4–5 in test unitari; 2) implementare il motore sul solo mese di ottobre con i dati del file; 3) confrontare con le foto quando arrivano; 4) solo dopo, l'interfaccia.

---

## Fonti (hosting)

- Cloudflare Pages Functions pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages free tier 2026 (verificato ago 2026): https://dev.to/david_viejo_4d48fdfa7cfff/cloudflare-pages-free-tier-limits-pricing-2026-1f8f
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare D1 enforcement 1/9/2026: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
- Supabase pricing: https://supabase.com/pricing
- Supabase project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- GitHub piani e Pages privati: https://docs.github.com/get-started/learning-about-github/githubs-products
- Vercel fair use (Hobby non commerciale): https://vercel.com/docs/limits/fair-use-guidelines
