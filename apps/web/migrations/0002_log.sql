-- Cronologia di tutte le scritture su kv, per poter tornare a una versione precedente.
-- Una riga per ogni record scritto: k, v (NULL = cancellato), t = ms della scrittura.
-- note: 'base' = stato di partenza (copiato da kv quando è nata la cronologia), 'restore:<ms>' = ripristino.
CREATE TABLE IF NOT EXISTS kv_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  k TEXT NOT NULL,
  v TEXT,
  t INTEGER NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS kv_log_t ON kv_log (t);
CREATE INDEX IF NOT EXISTS kv_log_k ON kv_log (k, id);
INSERT INTO kv_log (k, v, t, note) SELECT k, v, t, 'base' FROM kv;
