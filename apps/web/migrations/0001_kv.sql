-- Un record per ogni elemento dei dati dell'app (persona, iscrizione, assenza, cella del calendario, ...).
-- v = JSON del record, NULL se cancellato; t = ms dell'ultima modifica (serve alla sincronizzazione).
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT,
  t INTEGER NOT NULL,
  by TEXT
);
CREATE INDEX IF NOT EXISTS kv_t ON kv (t);
