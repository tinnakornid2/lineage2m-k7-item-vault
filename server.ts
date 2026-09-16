export * from './api/_server.ts';
import { isDirectRun, startServer } from './api/_server.ts';

if (isDirectRun) {
  startServer().catch((err) => console.error("Failed to start server:", err));
}
