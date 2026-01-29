# Scene Matcher - Gruppo Rosso 🎭

App per la gestione delle scene teatrali del Gruppo Rosso.

## Funzionalità

- ✅ Assegnazione coppie alle scene
- ✅ Gestione date (Lunedì/Mercoledì)
- ✅ Storico completo con statistiche
- ✅ Sincronizzazione real-time tra utenti
- ✅ Gestione dinamica delle scene

## Setup Supabase (già configurato)

La tabella nel database Supabase deve essere creata con:

```sql
CREATE TABLE scene_matcher_data (
  id TEXT PRIMARY KEY DEFAULT 'gruppo_rosso',
  slots JSONB DEFAULT '{}',
  history JSONB DEFAULT '[]',
  skipped_dates JSONB DEFAULT '[]',
  scenes JSONB DEFAULT '["I+III", "V", "VI", "XVI", "XVII", "XII"]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO scene_matcher_data (id) VALUES ('gruppo_rosso');

ALTER TABLE scene_matcher_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON scene_matcher_data
  FOR ALL USING (true) WITH CHECK (true);
```

## Deploy su Vercel

### Opzione 1: Da GitHub (consigliato)

1. Carica questa cartella su un repository GitHub
2. Vai su [vercel.com](https://vercel.com)
3. Clicca "New Project"
4. Importa il repository GitHub
5. Vercel rileverà automaticamente Next.js
6. Clicca "Deploy"

### Opzione 2: Da CLI

```bash
# Installa Vercel CLI
npm i -g vercel

# Dalla cartella del progetto
vercel
```

## Sviluppo locale

```bash
# Installa dipendenze
npm install

# Avvia server di sviluppo
npm run dev

# Apri http://localhost:3000
```

## Struttura progetto

```
scene-matcher-vercel/
├── app/
│   ├── globals.css      # Stili Tailwind
│   ├── layout.js        # Layout principale
│   └── page.js          # Pagina home
├── components/
│   └── SceneMatcher.jsx # Componente principale
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── next.config.js
```

## Note

- I dati sono sincronizzati in tempo reale tra tutti gli utenti
- Le credenziali Supabase sono già configurate nel codice
- Per sicurezza avanzata, considera di usare variabili d'ambiente

---

Made with ❤️ per il Gruppo Rosso
