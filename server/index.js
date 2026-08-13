import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// The React app (client) is a static export — the generator runs
// entirely client-side in the browser (canvas), so the server's only
// job is to serve the built frontend. No extra routes are added.
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

app.use(express.static(CLIENT_DIST));

// SPA fallback so a direct load/refresh of any route still serves the app
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HH Goa 2026 app listening on http://localhost:${PORT}`);
});
