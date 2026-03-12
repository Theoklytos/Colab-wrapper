// server.js — Express server for Colab Mobile PWA
// Serves the PWA from /pwa on http://localhost:3000
// CORS is open only on /colab-css/ so bookmarklets can fetch CSS from colab.research.google.com

import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PWA_DIR = join(__dirname, 'pwa');

// Compression for all responses
app.use(compression());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Cache headers by file type
app.use((req, res, next) => {
  const path = req.path;

  if (path === '/sw.js') {
    // Service worker must never be cached — browser checks for updates on every navigation
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
  } else if (path === '/manifest.json') {
    res.setHeader('Cache-Control', 'public, max-age=86400');         // 1 day
  } else if (path.startsWith('/icons/') || path.endsWith('.png')) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
  } else if (path.endsWith('.css') || path.endsWith('.js')) {
    res.setHeader('Cache-Control', 'public, max-age=604800');        // 7 days
  }

  // CORS: allow bookmarklet fetch() calls that originate from Colab's origin
  if (path.startsWith('/colab-css/')) {
    res.setHeader('Access-Control-Allow-Origin', 'https://colab.research.google.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }

  next();
});

// Serve PWA static files
app.use(express.static(PWA_DIR, {
  etag: true,
  lastModified: true,
  index: 'index.html',
  setHeaders: (res, filePath) => {
    // Set correct MIME type for .js ES modules
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// SPA fallback — all unknown routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(join(PWA_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nColab Mobile PWA running at:\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  console.log(`\nOpen Chrome on your Samsung A17 and go to: http://localhost:${PORT}\n`);
});
