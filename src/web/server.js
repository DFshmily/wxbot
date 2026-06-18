import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, handleLogin } from './auth.js';
import statusRouter, { captureLogs } from './routes/status.js';
import configRouter from './routes/config.js';
import controlRouter from './routes/control.js';
import templatesRouter from './routes/templates.js';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Web management server — Express HTTP API + static UI.
 */
export function startWebServer() {
  const app = express();

  // Middleware
  app.use(express.json());

  // CORS for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Start capturing logs for /api/status/logs
  captureLogs();

  // Public routes
  app.post('/api/auth/login', handleLogin);

  // Health check (no auth required)
  app.get('/api/status/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Static files for the web UI (no auth required for HTML/CSS/JS)
  app.use(express.static(path.join(__dirname, 'public')));

  // Protected API routes
  app.use('/api/status', authMiddleware, statusRouter);
  app.use('/api/config', authMiddleware, configRouter);
  app.use('/api/control', authMiddleware, controlRouter);
  app.use('/api/templates', authMiddleware, templatesRouter);

  // Catch-all for SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Error handler
  app.use((err, req, res, _next) => {
    console.error('[Web] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  const port = config.web.port;
  const server = app.listen(port, () => {
    console.log(`[Web] Management interface running at http://localhost:${port}`);
  });

  return server;
}
