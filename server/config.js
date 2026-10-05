import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || '',
  // Local-disk uploads by default; the storage layer is isolated in core/upload.js
  uploadDir: process.env.UPLOAD_DIR || new URL('./uploads', import.meta.url).pathname,
  maxUploadBytes: 15 * 1024 * 1024,
  // 'mock' is the only bundled provider; see services/ai/index.js to add real ones
  aiProvider: process.env.AI_PROVIDER || 'mock',
  mockAiLatencyMs: Number(process.env.MOCK_AI_LATENCY_MS) || 0,
  cookieSecure: process.env.NODE_ENV === 'production',
};
