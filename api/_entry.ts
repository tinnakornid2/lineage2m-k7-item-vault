import { createApp } from './_server.ts';

let appInstance: any = null;
let initError: any = null;

async function getApp() {
  if (appInstance) return appInstance;
  if (initError) throw initError;
  try {
    appInstance = await createApp({ serveFrontend: false });
    return appInstance;
  } catch (err) {
    initError = err;
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  // Normalize incoming Vercel URLs
  const rawPath = (req.headers && (req.headers['x-matched-path'] || req.headers['x-invoke-path'])) || req.url;
  if (rawPath && rawPath !== '/api/index' && rawPath !== '/api') {
    if (typeof rawPath === 'string' && rawPath.startsWith('/api')) {
      req.url = rawPath;
    }
  }

  // Fast-path health check
  if (req.url === '/api/health' || req.url === '/health' || req.url === '/api') {
    return res.status(200).json({ status: 'ok', serverless: true, timestamp: Date.now() });
  }

  try {
    const app = await getApp();
    return new Promise((resolve) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      app(req, res, (err: any) => {
        if (err) {
          console.error('Express Unhandled Error in serverless handler:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'EXPRESS_UNHANDLED_ERROR',
              message: String(err?.message || err)
            });
          }
        } else if (!res.headersSent) {
          res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: `API endpoint not found: ${req.method} ${req.url}`
          });
        }
        resolve(null);
      });
    });
  } catch (err: any) {
    console.error('Vercel Serverless Function Handler Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'SERVERLESS_FUNCTION_ERROR',
        message: String(err?.message || err),
        stack: String(err?.stack || '')
      });
    }
  }
}
