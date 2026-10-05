import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import { config } from './config.js';
import authRoutes from './core/authRoutes.js';
import conversationRoutes from './core/conversationRoutes.js';
import { errorHandler } from './core/http.js';
import { initSocket } from './core/socket.js';
import uploadRoutes from './core/upload.js';
import userRoutes from './core/userRoutes.js';
import aiRoutes from './routes/ai/index.js';
import taskRoutes from './modules/tasks/routes.js';

// All endpoints live under /api/v1 (team contract).
export function createServer() {
  const app = express();
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use('/uploads', express.static(config.uploadDir, { setHeaders: (res) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Content-Security-Policy', 'sandbox'); } }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRoutes);
  api.use('/users', userRoutes);
  api.use('/conversations', conversationRoutes);
  api.use('/upload', uploadRoutes);
  api.use('/ai', aiRoutes);
  api.use('/tasks', taskRoutes);
  app.use('/api/v1', api);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  return { app, httpServer, io };
}
