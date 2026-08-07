# Iron Log — Workout Tracker

A Vite + React workout tracker. All data (workout history, streaks, PRs,
exercise-order settings, in-progress session state) is stored in the
browser's `localStorage`, so it persists across reloads on the same device
with no backend required.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview   # optional local check of the production build
```

## Deploy to Vercel

1. Push this folder to a GitHub repo (or run `vercel` from inside it with
   the [Vercel CLI](https://vercel.com/docs/cli)).
2. Import the repo in the Vercel dashboard. Vercel auto-detects Vite; the
   included `vercel.json` also pins the build command (`npm run build`) and
   output directory (`dist`).
3. Deploy — no environment variables or backend services are needed.

## Notes

- Storage: `src/lib/storage.js` implements a small async
  get/set/delete/list API backed by `localStorage` (namespaced under
  `iron-log:`), as a drop-in for the `window.storage` calls the original
  component used.
- Everything else — timers, sound effects (Web Audio API), charts
  (Recharts), icons (lucide-react) — runs entirely client-side.
