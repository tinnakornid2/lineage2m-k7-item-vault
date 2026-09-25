export * from './api/_server.ts';
import { startServer } from './api/_server.ts';

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => console.error("Failed to start server:", err));
}
