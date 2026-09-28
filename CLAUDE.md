# MedTools — Turni specializzandi Pronto Soccorso

Documento di passaggio dalla conversazione con Claude (chat) a VS Code.
Contiene: obiettivo, tutte le regole dette finora, gestione dell'anno di specializzazione, com'è fatto il file Excel attuale, punti aperti e proposta di stack/hosting gratuito.

Convenzioni: **[detto]** = regola dichiarata dall'utente; **[assunzione]** = interpretazione mia, da confermare; **[TODO]** = non ancora fatto; **[dubbio]** = punto aperto da rivedere insieme.

> Salvato come `CLAUDE.md` nella root del repo: se apri questa cartella con Claude Code (anche dentro VS Code) viene letto in automatico a ogni sessione, senza doverlo incollare di nuovo.

---

## 1. Obiettivo

Costruire uno strumento **generico** per compilare ogni mese i turni di **tutti gli specializzandi** (PS, OBI, Pediatria Urgenza), non solo del IV anno. **[detto]**

Requisiti espressi:

- Lo strumento è usabile da tutti gli specializzandi (III, IV e V anno), ognuno con le regole del proprio anno. Le regole definite finora restano valide. **[detto]**
- Le regole si applicano da sole ogni mese e precompilano il calendario. **[detto]**
- Il foglio delle disponibilità (ferie/assenze) alimenta l'assegnazione dei turni di **tutti** gli anni: ognuno compila le proprie assenze. **[detto]**
- Le persone si possono **aggiungere (e togliere) in modo flessibile durante l'anno**, non solo all'inizio. **[detto]**
- L'anno di specializzazione **si resetta a fine ottobre**, quando il V anno se ne va. **[detto]** Vedi sezione 3.
- Il **primo anno gestito dall'app parte da novembre 2026**. **[detto]**
- Panoramica per medico: turni fatti per tipo, ferie/assenze, come nel foglio "Ottobre 2026" dell'Excel originale. **[detto]**
- Riequilibrare carico e tipologia di turni usando lo storico multi-mese, che si azzera a novembre. **[detto]**
- Interfaccia migliore di Excel: web app accessibile a tutti, pubblicata gratis, codice gestito in VS Code. **[detto]**
- Repository GitHub creato dall'utente: `https://github.com/incardo/medtools.git`.

Decisione presa: si procede con una **web app vera** (non solo una dashboard da chat).

---

## 2. Persone

Le persone sono un'**anagrafica unica**, non una lista fissa per anno. Ogni persona ha:

- un **anno di corso** (III, IV, V) che dipende dall'anno di specializzazione in corso (vedi sezione 3);
- un periodo di **attività** (`attivo dal` / `attivo fino al`), così si può aggiungere qualcuno a metà anno o farlo uscire prima, senza toccare i mesi già chiusi. **[detto]** (flessibilità) / **[assunzione]** (forma con date)
- l'eventuale interesse a coprire **Bambi** (turno facoltativo, vedi sezione 4).

Non ci sono eccezioni personali sulle regole: ognuno segue le regole del proprio anno di corso. **[detto]**

Il motore assegna una persona solo nei giorni in cui è attiva. Chi entra a metà anno parte con il **conteggio da zero**: non viene messo in pari con gli altri. **[detto]**

**Nomi e composizione** **[detto]**:

- Persone e nomi si possono **aggiungere, togliere o modificare in qualsiasi momento**.
- L'app mostra una **tabella della composizione corrente**: chi c'è oggi in ogni anno di corso (III, IV, V).
- Per ora si usano **nomi fittizi** (anche nei dati di esempio e nei test). I nomi reali si inseriscono dall'app.

**Gruppo noto per il V anno 2026/27:** Incardona, Somenzi, Cortesia, Serra, più chi rientra (nomi da definire). **[detto]**

---

## 3. Anno di specializzazione e passaggio d'anno

- L'anno di specializzazione va da **novembre a ottobre**. **[detto]** (reset a fine ottobre)
- Primo anno gestito dall'app: **novembre 2026 – ottobre 2027**. **[detto]**
- A fine ottobre il **V anno esce**. **[detto]**
- Al 1° novembre la **promozione è automatica**: III → IV, IV → V. **[detto]** Entra un **nuovo III anno**. **[assunzione]**
- In **qualsiasi momento** si possono aggiungere o togliere persone, anche subito dopo la promozione. **[detto]** Il gruppo non passa 1:1 all'anno dopo: alcuni escono, altri **rientrano**.
  - Esempio novembre 2026: il gruppo IV anno 2025/26 passa al **V anno**, ma Aluffi e Topalli vanno via. Restano Incardona, Somenzi, Cortesia, Serra, più chi rientra. **[detto]**
  - Chi rientra viene riattivato in anagrafica con una nuova iscrizione, senza ricrearlo da zero. **[detto]**
- Le **regole sono legate all'anno di corso**, non alla persona: chi passa dal IV al V anno adotta automaticamente le regole del V anno. **[detto]**
- Il **V anno finisce il 27 ottobre, incluso** (dal 28 non c'è più). **[detto]** Negli ultimi giorni di ottobre i suoi turni li coprono IV e III anno; l'**OBI solo il IV anno**. **[detto]** La data resta un parametro dell'anno, modificabile.
- **Storico multi-mese** per il riequilibrio, che **si azzera a novembre**. **[detto]**
- Le **regole per anno non cambiano** da un anno all'altro. **[detto]**
- Chi esce non viene cancellato: resta in archivio con i suoi turni. **[assunzione]**

- Chi rientra viene **assegnato a mano** al proprio anno di appartenenza. **[detto]**

---

## 4. Tipi di turno (slot)

| Codice | Significato | Note |
|---|---|---|
| `PS_ALTI_M` / `PS_ALTI_P` | PS codici alti, mattina / pomeriggio | ogni fascia ha 2 posti alti |
| `PS_VERDI_M` / `PS_VERDI_P` | PS codici bassi ("verdista"), mattina / pomeriggio | 1 posto per fascia |
| `PS_NOTTE` | PS notte | |
| `OBI_M` / `OBI_P` | Osservazione breve, mattina / pomeriggio | |
| `PEDU_M` / `PEDU_P` | Pediatria Urgenza, mattina / pomeriggio | mattina feriale: **2 posti** (un IV e un III anno); pomeriggio: 1 posto (IV); weekend: un IV per 12h |
| `BAMBI` | Bambi | **facoltativo**: può restare scoperto; si assegna solo a chi è interessato; **non entra nel bilanciamento** **[detto]** |
| `AMB` | Ambulatorio | coperto dal **III anno** **[detto]** |

Fasce per la disponibilità: `mattina`, `pomeriggio`, `notte` (3 righe per giorno).

---

## 5. Regole per anno di corso

Le regole seguono l'anno di corso, non i nomi (vedi sezione 3).

### IV anno **[detto]**

- Ped Urg mattina **e** pomeriggio, **tutti i giorni**.
- OBI mattina il **lunedì**.
- **Notte** il **giovedì** e il **sabato**, con smonto.
- **Un turno** PS codici bassi (mattina) il **lunedì, mercoledì, venerdì**.
- **Un turno** PS codici alti (mattina) il **martedì e giovedì**.
- **Un turno** PS codici alti (pomeriggio) il **lunedì, mercoledì, venerdì**.
- **Un turno** PS codici bassi (pomeriggio) il **martedì e giovedì**.
- Nel weekend Ped Urg è coperto da **un solo specializzando** per mattina e pomeriggio insieme.

### V anno **[detto]**

- PS alti mattina (1 turno) e PS alti pomeriggio (1 turno) anche weekend.
- **Lunedì e venerdì pomeriggio** PS **bassi** (verdi) al posto degli alti. **[detto]**
- OBI mattina **e** pomeriggio, **anche nel weekend**. **[detto]**
- 5 notti PS nel mese, suggerite dal motore in modo **bilanciato** tra le persone del V anno. **[detto]**
- A fine anno (ultimi giorni di ottobre) non c'è più: i suoi turni li coprono IV e III anno.
- Eventuali giorni d'esame (es. 5 ottobre 2026) sono **parametri del mese**, non regole fisse (vedi sezione 8).

### III anno **[detto]**

- PS alti (mattina e pomeriggio) lunedì e venerdì.
- PS bassi (mattina) martedi e giovedì.
- PS alti (pomeriggio) martedi e giovedì.
- PS alti (mattina) mercoledi.
- PS bassi (pomeriggio) mercoledi.
- PS nel weekend: una persona agli **alti per 12h** (mattina + pomeriggio) e una ai **verdi per 12h**; la **domenica si scambiano** (chi sabato era agli alti va ai verdi e viceversa). **[detto]**
- **Ambulatorio** solo il **giovedì e venerdì**; gli altri giorni non serve copertura. **[detto]**
- **Ped Urg mattina**, insieme a un IV anno (secondo posto di Ped Urg mattina) tutti i giorni tranne i wekkend. **[detto]**


### Weekend in PS **[detto]**

- PS codici alti: **V anno** e **un III anno**.
- PS codici bassi (verdi): **un III anno**.
- I due III anno fanno 12h ciascuno (alti e verdi) e la domenica si scambiano. **[detto]** Nel motore lo scambio è una preferenza: se uno dei due non è disponibile la domenica, il posto va a un altro III anno.

### PS feriale: schema risultante

| | Mattina: alti | Mattina: verdi | Pomeriggio: alti | Pomeriggio: verdi |
|---|---|---|---|---|
| Lun | V + III | IV | IV + III | V |
| Mar | V + IV | III | V + III | IV |
| Mer | V + III | IV | V + IV | III |
| Gio | V + IV | III | V + III | IV |
| Ven | V + III | IV | IV + III | V |

Ogni posto PS feriale ha un anno di corso: non ci sono più posti facoltativi. In codice: `PS_FERIALE` in `packages/engine/src/rules.ts`.

### Vincoli per gruppo **[detto]**

III, IV e V anno sono persone con un nome (fittizio, per ora). I vincoli valgono per loro:

- III anno **non** può coprire **Ped Urg al pomeriggio**, né OBI. Può invece coprire il PS al pomeriggio (es. nel weekend). **[detto]** 
- V anno: nessuna restrizione (finché è presente).

### Ruota comune **[detto]**

- Sono persone **a caso**, non gestite in anagrafica: nel tool resta l'etichetta generica **"Ruota comune"**, assegnabile a un turno al posto di un nome.
- Ruota comune copre **solo le notti in PS dal lunedì al venerdì**. **[detto]** (sostituisce la regola precedente "non può coprire Ped Urg né OBI")
- Nel motore è il ripiego per le notti lun–ven quando nessuno dell'anno previsto è disponibile. **[assunzione]**
- La ruota comune **non entra** nel bilanciamento né nella panoramica per medico. **[detto]**
- Nel calendario, accanto a "Notte PS", c'è una colonna **"Ruota comune"** dove si scrive a mano il nome (testo libero, solo notti lun–ven). **[detto]** Il motore non la legge; finisce nell'export CSV.

---

## 6. Regole trasversali

Valgono per tutte le persone assegnate dal motore, di qualsiasi anno. **[detto]**

1. Una persona con un turno assegnato **non riceve altri turni lo stesso giorno**.
2. Chi fa la **notte** non lavora né il giorno stesso né il giorno dopo.
3. **Smonto dopo il weekend**, **dove possibile** (preferenza, non vincolo assoluto): **[detto]**
   - chi lavora in **PS sia sabato sia domenica** non lavora il **lunedì**;
   - chi fa **Ped Urg 12 ore (mattina + pomeriggio) sia sabato sia domenica** non lavora il **martedì**.
4. Riequilibrare **tipologia di turni e carico** usando lo storico multi-mese, che si azzera a novembre.

Chi lavora un solo giorno del weekend non ha smonto. **[assunzione]**

---

## 7. Indisponibilità

Ogni specializzando, di qualsiasi anno, inserisce le proprie indisponibilità. **[detto]**

Notazione: **`no M`** = non disponibile la mattina, **`no P`** = non disponibile il pomeriggio, **`X`** = indisponibilità, **`F`** = ferie. **[detto]**

Modello suggerito: un'indisponibilità ha `tipo` (`X`, `F`, `noM`, `noP`) e copre una o più fasce (`mattina`, `pomeriggio`, `notte`).

I dati di assenza del vecchio file Excel **non si considerano**. **[detto]**

---

## 8. Parametri del mese e dell'anno

Tutto ciò che cambia da un mese all'altro è un **parametro**, non una regola: date d'esame, assenze collettive di un anno di corso, data di uscita del V anno.

**Parametri dell'anno** (es. 2026/27): primo giorno (01/11/2026), ultimo giorno (31/10/2027), data di uscita del V anno.

**Parametri del mese**: giorni d'esame per anno di corso (tutto il giorno o solo notte), altre assenze collettive, note.

### Ottobre 2026 — ultimo mese del vecchio anno (gestito in Excel, riferimento)

| Parametro | Valore |
|---|---|
| Primo giorno del mese | 01/10/2026 |
| V anno finisce | 27/10/2026 incluso (dal 28 assente) |
| V anno assente (esame) | 5 ottobre tutto il giorno; notte del 4 e del 5 |
| Altre note del file originale | 21 ottobre: esame (III/IV/V anno) |

**Errore noto nel file Excel attuale:** ho segnato il V anno assente per **l'intera giornata sia del 4 sia del 5 ottobre**. Secondo la regola detta, il 4 è assente solo la notte. **[TODO]** correggere.

**Non gestito:** l'esame del 21 ottobre (III/IV/V anno) non è ancora nei parametri. **[TODO]**

### Novembre 2026 — primo mese del nuovo anno

Parametri ancora da definire (esami, composizione dei gruppi). **[TODO]**

---

## 9. Come funziona il file Excel attuale (`Turni_Desiderate_PS.xlsx`)

Serve da riferimento per ottobre 2026 e per importare lo storico. Il workbook originale ha fogli mensili (Marzo–Settembre 2026), "Desiderate", "Ottobre 2026" (con la panoramica per medico) e "Ferie e Assenze". Ho aggiunto/riscritto:

**`Turni tutti`** — una riga per giorno (righe 4–34).

- Col A: data, generata da `PrimoGiorno` (cella B39) e si ferma a fine mese.
- Col B–D: PS mattina. B = alti (V anno), C = secondo posto alti, D = verdista. Col E–G: uguale per il pomeriggio.
- Col H: notte. Col J–K: OBI M/P. Col L: Ped Urg M. Col O: Ped Urg P (nel weekend copia L). Col P–Q: Bambi/Amb. Col R: note (smonto). Col S: suggerimenti.
- Le celle B–K si riempiono da sole con "V anno", "III anno", "Ruota comune" in base a `WEEKDAY()` e ai parametri V anno (B37 fine presenza, B38:F38 date extra).
- Menu a tendina con i nomi. Cella **rossa** se il nome scelto è assente, **arancione** se compare due volte lo stesso giorno.
- Colori: rosa = III anno, verde = supplement IV anno, giallo = supplement V anno, blu = ruota comune, grigio = weekend/da definire.
- Nessun cambio colori per i turni PS coperti dal IV anno: la colonna "Verdista" ha già un'intestazione apposta. **[detto]**

**`Suggerimenti`** — motore di calcolo, un blocco per turno del IV anno (PedU M, PedU P, OBI M lunedì, Notte gio/sab, PS Alti flex lun/mer/ven, PS Verdi flex mar/gio). Per ogni giorno assegna un punteggio a ogni medico: escluso se assente, se ha già un turno quel giorno, se è già stato suggerito quel giorno per un altro turno, se è in smonto dopo notte. Tra i disponibili sceglie chi ha meno turni di quel tipo, con una rotazione per rompere i pareggi.

**`Overview`** — conteggio turni per tipo e ferie per medico.

**`Ferie e Assenze`** — riga 1 con intestazioni "IV ANNO" (F:L), "III ANNO" (T:X, vuote) e "V ANNO" (Y:AC, vuote), pronte per uso futuro.

### Limiti dell'Excel (motivo del passaggio a web app)

- Gestisce solo il IV anno con nomi fissi: niente anagrafica, niente passaggio d'anno.
- Il motore è **greedy giorno per giorno**, senza guardare avanti: può arrivare a "nessuno disponibile" anche quando una scelta diversa nei giorni prima avrebbe evitato il buco.
- Non carica lo **storico**: bilancia solo dentro il mese.
- Lo smonto è gestito solo dopo notti di giovedì/sabato (venerdì e domenica). **Non** c'è lo smonto dopo le 12h del weekend.
- Non assegna i nomi di III e V anno. Non gestisce i 5 turni notte del V anno.
- Non distingue "M o P" con logica di alternanza alti/bassi: sceglie per fascia solo la disponibilità.
- Errore preesistente nel file originale, non mio: foglio "Giugno 2026", cella T44 dà `#VALUE!`.

---

## 10. Dubbi aperti da rivedere insieme

Risolti il 28/09/2026 (due giri): Bambi/Ambulatorio, 12h e smonto, weekend PS, storico, Spina, promozione, nomi, pool, alternanza, assenze Excel, notti V anno, vincolo III anno, ruota comune, 27 ottobre, ingressi a metà anno, regole stabili, smonto lunedì/martedì, rientri, ruota comune fuori dal bilanciamento.

Risolti il 28/09/2026 (terzo giro): posti PS feriali senza anno (ora c'è lo schema completo), V anno ai verdi lun/ven pomeriggio, ambulatorio solo gio/ven, OBI del V anno anche nel weekend.

**Organico di riferimento** (per test e dati di esempio): V anno 10, IV anno 8, III anno 6. **[detto]** Con questi numeri novembre 2026 non ha posti scoperti e la ruota comune non serve.

Risolti il 28/09/2026 (quarto giro): PS del III anno nel weekend (12h alti + 12h verdi, scambio la domenica), OBI di fine ottobre solo al IV anno.

Aperti: nessuno. Restano le assunzioni marcate **[assunzione]** nel documento (es. chi lavora un solo giorno del weekend non ha smonto; chi esce resta in archivio; entra un nuovo III anno a novembre).

---

## 11. Funzionalità desiderate per la web app

Priorità suggerita:

1. **Motore di assegnazione come codice puro** (TypeScript, senza dipendenze dall'interfaccia, con test): regole per anno di corso, vincoli, indisponibilità, storico. Deve poter girare **nel browser**, così l'hosting gratuito non pesa sul calcolo.
2. **Anagrafica persone** gestibile da schermata: nome, anno di corso, periodo di attività (ingresso/uscita in qualsiasi momento), interesse per Bambi. Nomi modificabili in ogni momento.
3. **Tabella della composizione corrente**: chi c'è oggi in III, IV e V anno.
4. **Gestione anno di specializzazione**: apertura del nuovo anno a novembre con promozione automatica III → IV → V, uscita del V anno il 27 ottobre, azzeramento dello storico, archivio degli usciti.
5. Inserimento disponibilità da parte di **ogni specializzando** (griglia mese × fascia; tipo X/F/noM/noP).
6. Calendario mensile con suggerimenti per tutti gli anni, modifica manuale, avvisi (assente, doppio turno, smonto violato, nessuno disponibile).
7. Panoramica per medico (turni per tipo, ferie, storico) e riequilibrio.
8. Parametri dell'anno e del mese (uscita V anno, date d'esame, assenze collettive).
9. Esporta in Excel/PDF per l'ospedale.
10. Login con ruoli: chi modifica e chi consulta.

---

## 12. Modello dati proposto (bozza)

```
academic_years  id, label ("2026/27"), start_date (2026-11-01), end_date (2027-10-31), v_anno_last_day
doctors         id, name, bambi_interest (bool)               -- nessuna eccezione personale sulle regole
enrollments     doctor_id, academic_year_id, year (3|4|5), active_from, active_to
                -- una riga per persona per anno: gestisce promozione, ingressi e uscite a metà anno
availability    id, doctor_id, date, slot (M|P|N), kind (X|F|noM|noP)
month_params    month (YYYY-MM), exam_dates[] (per anno di corso, giorno intero o solo notte), notes
assignments     id, date, slot_type, doctor_id | "RUOTA_COMUNE", source (manual|suggested)
history         doctor_id, academic_year_id, month, slot_type, count   -- si azzera a ogni nuovo anno (novembre)
```

L'anno di corso di una persona in una certa data si ricava da `enrollments`, non è un campo fisso della persona.

---

## 13. Dove pubblicarlo gratis

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

## 14. Struttura repo suggerita

```
medtools/
  CLAUDE.md                 # questo file
  packages/engine/          # motore regole (TS puro) + test
  apps/web/                 # interfaccia
  data/example/             # dati finti per test
  data/legacy/              # Excel originale (solo se il repo è privato)
  docs/regole.md            # regole in forma testabile
```

### Stato (prototipo, 28/09/2026)

- `packages/engine`: motore TS con test (`npm test`). Regole in `src/rules.ts` (`buildDemand`), assegnazione in `src/engine.ts` (`suggestMonth`, `validate`).
- `apps/web`: Vite + React, dati in `localStorage` del browser (solo nomi fittizi), niente login né database.
- Pubblicato su Cloudflare Pages, progetto `medtools`: https://medtools.pages.dev. Deploy: `npm run deploy` (richiede `wrangler login`). Node.js su Windows: `C:\Program Files\nodejs`.
- Assunzioni del prototipo, da rivedere insieme (sono in `buildDemand`):
  - la ruota comune solo come ripiego per le notti lun–ven;
  - lo scambio alti/verdi del III anno la domenica è una preferenza, non un vincolo;
  - 5 notti del V anno **per persona**;
  - festivi infrasettimanali non gestiti.
- Calendario: le celle vuote hanno già il colore dell'anno previsto dalla regola; quando si assegna una persona prendono il colore del suo anno.

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
