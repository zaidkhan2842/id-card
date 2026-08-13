# HH Goa 2026 — Frame & Badge Generator

Same functionality and design as the original single-file app, split into a
React (Vite) frontend and an Express backend.

## Structure

```
hhgoa-app/
  client/   React + Vite frontend (all upload/canvas/share logic)
  server/   Express backend (serves the built frontend, no extra routes)
```

There is no API between frontend and backend — the original app has no
server-side logic (photo processing, frame/badge composition, and export all
happen client-side on <canvas>), so the Express server's only responsibility
is to serve the built React app.

## Run locally

```bash
# 1. Frontend dev server (hot reload)
cd client
npm install
npm run dev
# open http://localhost:5173

# 2. Production build served by Express
cd client
npm install
npm run build          # outputs client/dist

cd ../server
npm install
npm start               # open http://localhost:3000
```
