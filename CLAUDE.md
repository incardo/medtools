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
- La composizione caricata nell'app (V anno 14–15 persone, vedi database online) è quella **effettiva** e si corregge a mano dalla scheda Persone. **[detto]** Solo i **test** usano nomi fittizi.

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
| `PS_ALTI_M` / `PS_ALTI_P` | PS codici alti, mattina / pomeriggio | 2 posti alti per fascia; venerdì pomeriggio 1 (IV) |
| `PS_AUTO_M` / `PS_AUTO_P` | PS **autonomo**, mattina / pomeriggio | **V anno**, tutti i giorni (weekend 12h); **obbligatorio** e **conta nel bilanciamento** **[detto]** (06/10/2026) |
| `PS_VERDI_M` / `PS_VERDI_P` | PS codici bassi ("verdista"), mattina / pomeriggio | 1 posto per fascia |
| `PS_NOTTE` | PS notte | |
| `OBI_M` / `OBI_P` | Osservazione breve, mattina / pomeriggio | |
| `PEDU_M` / `PEDU_P` | Pediatria Urgenza, mattina / pomeriggio | mattina feriale: **2 posti** (un IV e un III anno); pomeriggio: 1 posto (IV); weekend: un IV per 12h |
| `BAMBI` | Bambi | **facoltativo**: può restare scoperto; si assegna solo a chi è interessato; **non entra nel bilanciamento** **[detto]** |
| `AMB` | Ambulatorio | coperto dal **III anno** **[detto]** |
| `ORTO` / `RADIO` / `ANEST` / `CHIR` | Ortopedia, Radiologia, Anestesia, Chirurgia | **facoltativi**, **lun–ven**, tutto il giorno (senza mattina/pomeriggio); **V o IV anno**; **solo a mano**; **fuori dal bilanciamento e dal totale**; chi è in reparto quel giorno non riceve altri turni **[detto]** (06/10/2026) |

L'**alti opzionale** (`PS_OPZ`) è stato **tolto** il 06/10/2026 **[detto]**: le celle già salvate restano nel database ma l'app non le mostra né le conta.

Fasce per la disponibilità: `mattina`, `pomeriggio`, `notte` (3 righe per giorno).

---

## 5. Regole per anno di corso

Le regole seguono l'anno di corso, non i nomi (vedi sezione 3).

### IV anno **[detto]**

- Ped Urg mattina **e** pomeriggio, **tutti i giorni**.
- **Notte**: il **secondo posto** il **sabato e la domenica** (scelto dal motore), con smonto; dal lunedì al venerdì il secondo posto lo può fare a mano un IV anno (vedi "Ruota comune"). **[detto]** (06/10/2026) Non fa più la notte del giovedì né l'OBI del lunedì.
- PS **lunedì, mercoledì, venerdì**: mattina **verdi**, pomeriggio **alti**.
- PS **martedì e giovedì**: mattina **alti**, pomeriggio **verdi**.
- Nel weekend Ped Urg è coperto da **un solo specializzando** per mattina e pomeriggio insieme.
- **Blocco Ped Urg**: la stessa persona copre Ped Urg dal **venerdì pomeriggio** al **lunedì mattina** (ven P, sab 12h, dom 12h, lun M), poi smonto, di preferenza il martedì (non obbligatorio). **[detto]** È una **preferenza forte**: se la persona non è disponibile in uno dei giorni, il blocco si spezza invece di lasciare il posto scoperto; nessun avviso se si spezza a mano. I blocchi **ruotano in automatico** tra i IV anno grazie al riequilibrio. **[detto]**

### V anno **[detto]** (riscritte il 06/10/2026)

- Organico: **14–15 persone**.
- PS **tutti i giorni**, mattina e pomeriggio: **uno agli alti** e **uno autonomo** (`PS_AUTO`, conta nel bilanciamento). Nel weekend entrambi 12h.
- **Venerdì mattina**: **tre** V anno, due agli alti e uno autonomo. **Venerdì pomeriggio**: solo l'**autonomo** (alti al IV, verdi al III).
- **OBI** mattina **e** pomeriggio, solo V anno, anche il lunedì. Nel **weekend** l'OBI lo copre **la stessa persona sabato e domenica** (12h al giorno), con **smonto il lunedì**; i weekend di OBI **ruotano** tra i V anno, così ogni weekend c'è una persona diversa nei vari mesi (va prima a chi ne ha fatti meno nell'anno).
- **Notti**: **tutte le notti** (lun–dom) c'è un V anno, distribuite in modo **bilanciato**.
- **Weekend in PS** (alti 12h): chi fa la **notte di venerdì** fa la **domenica** tutto il giorno; chi fa il **sabato** di giorno fa la **notte di domenica**; la **notte di sabato** ruota tra i V anno. Nel motore sono preferenze forti: se la persona non è disponibile, il posto va a un altro V anno.
- A fine anno (ultimi giorni di ottobre) non c'è più: i suoi turni li coprono IV e III anno.
- Eventuali giorni d'esame (es. 5 ottobre 2026) sono **parametri del mese**, non regole fisse (vedi sezione 8).

### III anno **[detto]**

- PS **lunedì e mercoledì**: mattina **alti**, pomeriggio **verdi**. **[detto]** (06/10/2026)
- PS **martedì e giovedì**: mattina **verdi**, pomeriggio **alti**.
- PS **venerdì pomeriggio**: **verdi** (il venerdì mattina c'è l'ambulatorio).
- PS nel weekend: una persona agli **alti per 12h** (mattina + pomeriggio) e una ai **verdi per 12h**; la **domenica si scambiano** (chi sabato era agli alti va ai verdi e viceversa). **[detto]**
- **Ambulatorio** solo il **giovedì e venerdì**; gli altri giorni non serve copertura. **[detto]**
- **Ped Urg mattina**, insieme a un IV anno (secondo posto di Ped Urg mattina) tutti i giorni tranne i wekkend. **[detto]**


### Weekend in PS **[detto]**

- PS codici alti: **V anno** e **un III anno**; più l'**autonomo** del V anno.
- Il V anno fa gli alti **12h**: la stessa persona copre mattina e pomeriggio. La **domenica** lo sostituisce **un altro V anno** (mai la stessa persona del sabato): chi ha fatto la notte di venerdì. Chi fa il sabato fa la notte di domenica. **[detto]**
- PS codici bassi (verdi): **un III anno**.
- I due III anno fanno 12h ciascuno (alti e verdi) e la domenica si scambiano. **[detto]** Nel motore lo scambio è una preferenza: se uno dei due non è disponibile la domenica, il posto va a un altro III anno.

### PS feriale: schema risultante (06/10/2026)

| | Mattina: alti | Mattina: verdi | Mattina: autonomo | Pomeriggio: alti | Pomeriggio: verdi | Pomeriggio: autonomo |
|---|---|---|---|---|---|---|
| Lun | V + III | IV | V | V + IV | III | V |
| Mar | V + IV | III | V | V + III | IV | V |
| Mer | V + III | IV | V | V + IV | III | V |
| Gio | V + IV | III | V | V + III | IV | V |
| Ven | V + V | IV | V | IV | III | V |

Ogni posto PS feriale ha un anno di corso. In codice: `PS_FERIALE` in `packages/engine/src/rules.ts`.

### Notti

| | Posto 1 | Posto 2 |
|---|---|---|
| Lun–Ven | V anno | a mano: ruota comune oppure un IV anno |
| Sab–Dom | V anno | IV anno, scelto dal motore |

### Vincoli per gruppo **[detto]**

III, IV e V anno sono persone con un nome. I vincoli valgono per loro:

- III anno **non** può coprire **Ped Urg al pomeriggio**, né OBI, né i reparti facoltativi. Può invece coprire il PS al pomeriggio (es. nel weekend). **[detto]** 
- V anno: nessuna restrizione (finché è presente).

### Ruota comune **[detto]**

- Sono persone **a caso**, non gestite in anagrafica: nel tool resta l'etichetta generica **"Ruota comune"**, assegnabile a un turno al posto di un nome.
- Ruota comune copre **solo le notti in PS dal lunedì al venerdì**. **[detto]** (sostituisce la regola precedente "non può coprire Ped Urg né OBI")
- Nel motore è il ripiego per le notti lun–ven quando nessuno dell'anno previsto è disponibile. **[assunzione]**
- La ruota comune **non entra** nel bilanciamento né nella panoramica per medico. **[detto]**
- Nel calendario, accanto a "Notte PS", c'è una colonna **"Ruota comune / IV"** (secondo posto di notte). Dal lunedì al venerdì è **solo a mano**: si sceglie **la ruota comune** (e si scrive il nome, testo libero) **oppure un IV anno**. **[detto]** (06/10/2026) Il sabato e la domenica lo riempie il motore con un IV anno.
- Uno specializzando nel secondo posto di notte **conta come una notte**: nella panoramica e nel **bilanciamento** (il motore lo legge come turno manuale). Valgono le regole trasversali (smonto dopo la notte, un turno al giorno). **[detto]** In codice: slot `PS_NOTTE` con `idx` 1 (`manualOnly` lun–ven); il nome della ruota comune resta in `ruotaNames`.

---

## 6. Regole trasversali

Valgono per tutte le persone assegnate dal motore, di qualsiasi anno. **[detto]**

1. Una persona con un turno assegnato **non riceve altri turni lo stesso giorno**.
2. Chi fa la **notte** non lavora né il giorno stesso né il giorno dopo.
3. **Smonto dopo il weekend**, **dove possibile** (preferenza, non vincolo assoluto): **[detto]**
   - chi lavora in **PS sia sabato sia domenica** non lavora il **lunedì**;
   - chi fa **OBI sia sabato sia domenica** non lavora il **lunedì** **[detto]** (06/10/2026);
   - chi fa **Ped Urg 12 ore (mattina + pomeriggio) sia sabato sia domenica** non lavora il **martedì**.
4. Riequilibrare **tipologia di turni e carico** usando lo storico multi-mese, che si azzera a novembre.
5. Bilanciare anche i **giorni di weekend lavorati** (sabato/domenica), dentro ogni anno di corso. **[detto]** (29/09/2026)
6. **Blocchi Ped Urg equi**: il blocco va prima a chi ne ha fatti meno nell'anno, e chi ha il blocco riceve meno Ped Urg nei feriali. **[detto]** (29/09/2026) Lo stesso per i **weekend di OBI** del V anno (06/10/2026).

Chi lavora un solo giorno del weekend non ha smonto. **[assunzione]**

Un V anno che fa 12h il sabato (PS alti o OBI) può fare la notte di domenica: non è un errore. **[detto]**

---

## 7. Indisponibilità

Ogni specializzando, di qualsiasi anno, inserisce le proprie indisponibilità. **[detto]**

Notazione: **`no M`** = non disponibile la mattina, **`no P`** = non disponibile il pomeriggio, **`X`** = indisponibilità, **`F`** = ferie. **[detto]**

Aggiunti il 29/09/2026: **`no N`** = non disponibile la notte; **`solo M`**, **`solo P`**, **`solo N`** = disponibile solo in quella fascia. **[detto]**

Un valore per persona e giorno (`AbsenceKind`); le fasce escluse da ogni tipo sono in `ABSENCE_BLOCKS` (`packages/engine/src/types.ts`). Nella scheda Disponibilità si sceglie da un menu che si apre cliccando la cella.

Scheda Disponibilità (29/09/2026) **[detto]**:

- **Pennello** per inserire più giorni insieme: si sceglie un tipo (o "cancella") e si trascina sulla riga di una persona; il trascinamento resta sulla riga dove è iniziato. Con "Menu" il clic apre il menu come prima.
- **Riga "assenti" per ogni anno di corso**: per ogni giorno, quante persone di quell'anno sono assenti tutto il giorno (ferie, indisponibili, esami), più "+N" per chi è assente solo in parte. Colore: **giallo** = nessun margine, **rosso** = non bastano. Il confronto è con una stima delle persone che servono: i posti che le regole danno a quell'anno quel giorno (un 12h = una persona), più chi smonta dalla notte del giorno prima. Il dettaglio con i nomi è nel tooltip della cella.

**Limiti** (06/10/2026) **[detto]**: le indisponibilità si comunicano **entro il 15 del mese precedente**; al massimo **4 giorni di X nel weekend** (2 weekend: sabato e domenica; precisato il 06/10/2026) e **8 X nei giorni feriali** per persona nel mese. Contano solo le **X** (giorno intero): ferie e indisponibilità parziali no. Oltre il limite, o dopo la scadenza, la scheda Disponibilità mostra un **avviso** (non blocca). Valori in `ABSENCE_LIMITS` (`packages/engine/src/types.ts`).

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

**Organico di riferimento** (test): V anno 14, IV anno 8, III anno 6. **[detto]** (06/10/2026: il V anno sarà di 14–15 persone) Con questi numeri novembre 2026 non ha posti scoperti e la ruota comune non serve. Ogni giorno feriale il V anno impegna 8 persone (6 di giorno, 1 di notte, 1 in smonto).

Risolti il 28/09/2026 (quarto giro): PS del III anno nel weekend (12h alti + 12h verdi, scambio la domenica), OBI di fine ottobre solo al IV anno.

Risolto il 29/09/2026: le "5 notti" del V anno sono **5 notti a settimana** coperte dal gruppo (dom, lun, mar, mer, ven), non un tetto per persona. **Superato il 06/10/2026**: ora il V anno copre tutte le notti.

Risolti il 06/10/2026: autonomo del V anno anche nel weekend; OBI del weekend alla stessa persona con smonto il lunedì; OBI del lunedì al V anno; secondo posto di notte lun–ven resta a mano; Ped Urg mattina del III anno resta; avvisi (non blocchi) per limiti e scadenza delle indisponibilità; reparti facoltativi solo lun–ven, tutto il giorno, fuori dal bilanciamento; alti opzionale tolto.

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
  - **Come assegna** (29/09/2026): (1) decide prima i blocchi (`planBlock`): per ogni venerdì il **blocco Ped Urg** (ven P → sab 12h → dom 12h → lun M) e per ogni sabato l'**OBI del weekend** (sab + dom), a chi ne ha fatti meno nell'anno (storico in `extraHistory`: `blocks`, `obiWeekends`), fermandosi al primo giorno in cui la persona non è disponibile; (2) poi giorno per giorno, prima i posti collegati al giorno prima, poi quelli con meno candidati; (3) per ogni posto sceglie il punteggio più basso (`WEIGHTS`: turni dello stesso tipo, totale, **giorni di weekend** per i posti di sab/dom, smonto, disponibilità nel blocco); (4) ripete **`RUNS` = 200** tentativi e tiene quello con il costo più basso (`COST`: buchi, smonti, blocchi spezzati, varianza per anno di corso su totale, weekend e ogni tipo).
  - Giorni di weekend e blocchi dei mesi precedenti: `countExtras` → `extraHistory` (in `apps/web/src/store.ts`, `engineInput`).
  - Prestazioni: `addDays`, `weekday` e `yearOf` sono memorizzati (cache); 200 tentativi ≈ 3 s nel browser.
  - Ogni clic su "Genera suggerimenti" usa un seme casuale diverso: il risultato cambia ma resta ugualmente equilibrato.
- Scheda **Regole** (`apps/web/src/views/RulesView.tsx`): mostra a tutti le regole seguite dal motore. La tabella "chi copre ogni posto" è generata da `buildDemand` su una settimana tipo (con e senza V anno); vincoli da `yearCanCover`, indisponibilità da `ABSENCE_INFO`/`ABSENCE_BLOCKS`, pesi da `WEIGHTS`/`COST`/`RUNS`. Se cambiano le regole nel motore, la pagina si aggiorna da sola; i testi descrittivi (elenchi puntati) vanno invece aggiornati a mano.
- `apps/web`: Vite + React. **Dati condivisi** tra tutti gli utenti su **Cloudflare D1** (database `medtools`), letti e scritti da Pages Functions in `apps/web/functions/api/` (`GET/POST /api/data`).
  - I dati sono spezzati in record chiave → JSON (una persona, un'iscrizione, un'assenza, una cella del calendario, un nome della ruota comune): ogni modifica invia solo i record cambiati, l'ultima scrittura vince record per record. Più persone possono lavorare insieme (es. Disponibilità) senza sovrascriversi. Codice in `apps/web/src/sync.ts`; schema in `apps/web/migrations/`.
  - Le modifiche degli altri arrivano con un controllo ogni 8 secondi, solo mentre la pagina è aperta e visibile.
  - **Versioni precedenti** (02/10/2026): ogni scrittura finisce anche in `kv_log` (migrazione `0002_log.sql`). Nella scheda Parametri, "Versioni precedenti" elenca le sessioni di modifica (scritture a meno di 5 minuti l'una dall'altra) degli ultimi 90 giorni; "Torna a prima" riporta **tutti** i dati a com'erano subito prima della sessione. Il ripristino è una scrittura normale (arriva a tutti con la sincronizzazione, finisce in cronologia e si può annullare). Prima della migrazione non c'è cronologia. API in `apps/web/functions/api/history.ts`, interfaccia in `apps/web/src/views/HistoryPanel.tsx`. Rete di sicurezza in più: D1 Time Travel (`npx wrangler d1 time-travel restore medtools --timestamp=...`), che ripristina l'intero database.
  - **Accesso con password condivisa** tra gli specializzandi. **[detto]** La password è un secret del progetto Pages (`npx wrangler pages secret put APP_PASSWORD --project-name medtools`), mai nel codice. Il login crea un cookie di sessione firmato valido 30 giorni; cambiando la password si scollegano tutti. Senza password impostata le API rispondono 503. Codice in `apps/web/functions/api/_auth.ts`.
  - Limiti accettati: nessuna traccia di chi modifica cosa; se la password circola fuori dal gruppo va cambiata.
  - Sviluppo locale: `npx wrangler pages dev dist` in `apps/web`, con `DEV_NO_AUTH=1` in `apps/web/.dev.vars` (non committato).
- Pubblicato su Cloudflare Pages, progetto `medtools`: https://medtools.pages.dev. Deploy: `npm run deploy` (richiede `wrangler login`). Node.js su Windows: `C:\Program Files\nodejs`.
- Assunzioni del prototipo, da rivedere insieme (sono in `buildDemand`):
  - la ruota comune solo come ripiego per le notti lun–ven;
  - lo scambio alti/verdi del III anno la domenica è una preferenza, non un vincolo;
  - festivi infrasettimanali non gestiti.
- Export Excel (`apps/web/src/exportExcel.ts`, libreria ExcelJS caricata solo al clic): foglio "Turni" formattato per la stampa (A4 orizzontale, colori per anno, legenda) e foglio "Riepilogo" con i turni per persona.
- Calendario, **sostituzioni** (02/10/2026) **[detto]**: in ogni cella si può mettere a mano chiunque, di qualsiasi anno; con "✎ Altro nome…" si scrive un nome. Se corrisponde (senza maiuscole/accenti, o unico nome che lo contiene, con conferma) a una persona della scheda Persone diventa quella persona e **conta** in Panoramica e nel bilanciamento; altrimenti si salva come nome esterno (`EXTERNAL` + nome, `isPerson` in `packages/engine/src/types.ts`): si vede e si esporta, ma non si conta né si controlla. Un III anno messo a mano dove la regola non lo prevede (OBI, Ped Urg pomeriggio) dà un avviso, non un errore.
- Calendario, **"I miei turni"** (02/10/2026): riquadro sopra la griglia con "Io sono: [nome]" (salvato solo nel browser, `localStorage` `medtools:me`). Mostra i turni del mese di quella persona in sequenza con le frecce (M+P dello stesso tipo = "12h"), con "Copia" per incollarla come testo **[detto]**, i totali per tipo (da `summary.ts`, come la Panoramica), le assenze e un export `.ics` (eventi di tutto il giorno: gli orari dei turni non sono nell'app). Nella griglia le sue celle e i suoi giorni sono evidenziati. Codice in `apps/web/src/views/MyShifts.tsx`.
  Il riquadro ha uno sfondo azzurro e tre righe: **Giorni con i miei turni**, **Sommario per tipologia turni**, **Le mie assenze**. **[detto]** (03/10/2026)
- Grafica (03/10/2026): **oggi** evidenziato (pallino nel Calendario, colonna in Disponibilità); sopra la griglia, **elenco di errori e avvisi** che porta alla cella con un clic; sul telefono la tabella scorre nel suo riquadro, così intestazione e giorni restano fissi. Caratteri, angoli e ombre usano le variabili in `:root` di `apps/web/src/styles.css` (`--fs-*`, `--radius*`, `--shadow*`): usare quelle invece di numeri nuovi.
- Calendario: le celle vuote hanno già il colore dell'anno previsto dalla regola; quando si assegna una persona prendono il colore del suo anno.
- Panoramica (e foglio "Riepilogo" dell'Excel): colonne per tipo di turno; in PS mattina e pomeriggio sono **equivalenti** e si contano insieme (restano separati alti, verdi, autonomo e notte) **[detto]**; OBI e Ped Urg in un'unica colonna ciascuno (mattina + pomeriggio) **[detto]**; colonne dei reparti facoltativi (fuori dal totale); più Totale (senza Bambi e reparti), Weekend (giorni di sab/dom lavorati) e Assenze. Un turno da 12h conta come **due turni**. **[detto]** Interruttore Mese / Anno fino al mese scelto; righe raggruppate per anno di corso con la media; celle colorate se lo scarto dalla media del proprio anno è di almeno 1 turno; "·" per i turni non previsti per quell'anno. Colonne e conteggi in `apps/web/src/summary.ts`.

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
