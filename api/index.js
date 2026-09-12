import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { setupBossTracker } = require('../boss_server/index.js');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverless: true, timestamp: Date.now() });
});

// Setup Boss Tracker Engine routes (bosses, events, settings, auth, maintenance)
setupBossTracker(app, null);

export default app;
