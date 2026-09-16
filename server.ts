export * from './api/_server.ts';
import { startServer } from './api/_server.ts';

if (!process.env.VERCEL) {
  startServer().catch((err) => console.error("Failed to start server:", err));
}
