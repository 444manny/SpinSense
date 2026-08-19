# Swing Lab frontend

Next.js 14 (App Router) + TypeScript interface for the sports motion tracking
system. Talks to the Flask backend in `../webapp`.

## Requirements

Node.js 18.17 or newer. Check with `node --version`; install from nodejs.org if missing.

## Setup

```
npm install
```

## Running

Two processes are needed. In one terminal, start the backend:

```
cd ../webapp
python app.py
```

In a second terminal, start the frontend:

```
cd frontend
npm run dev
```

Open http://localhost:3000

Requests to `/api/*` are proxied to Flask on port 5000 by `next.config.mjs`, so
the browser sees a single origin and no CORS setup is required.

## Production build

```
npm run build
npm start
```

## Structure

```
app/
  layout.tsx            root layout and font loading
  page.tsx              view switching and navigation rail
  globals.css           shared styles
  overview.module.css   scoped styles for the overview page
components/
  Overview.tsx          hero, scroll-revealed pipeline, equipment illustrations
  Recorder.tsx          recording controls and live signal trace
  Analysis.tsx          results, accuracy, consistency, link quality
  Sessions.tsx          recorded session list and deletion
lib/
  types.ts              response shapes shared across the app
  api.ts                typed fetch wrappers for every endpoint
  useReveal.ts          IntersectionObserver hook for scroll animations
```
