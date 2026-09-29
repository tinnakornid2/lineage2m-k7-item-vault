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
  try {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathParam = parsedUrl.searchParams.get('__path');
    const forwardedUri = req.headers?.['x-forwarded-uri'] || req.headers?.['x-original-url'];
    const invokePath = req.headers?.['x-invoke-path'] || req.headers?.['x-matched-path'];

    if (pathParam && typeof pathParam === 'string' && pathParam.startsWith('/api')) {
      parsedUrl.searchParams.delete('__path');
      const remainingSearch = parsedUrl.searchParams.toString();
      req.url = pathParam + (remainingSearch ? `?${remainingSearch}` : '');
    } else if (forwardedUri && typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
      req.url = forwardedUri;
    } else if (invokePath && typeof invokePath === 'string' && invokePath.startsWith('/api') && invokePath !== '/api/index' && invokePath !== '/api') {
      req.url = invokePath;
    }
  } catch {}

  const sendJson = (statusCode: number, data: any) => {
    if (res.headersSent) return;
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(statusCode).json(data);
    }
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(data));
  };

  // Fast-path health check
  const cleanUrl = typeof req.url === 'string' ? req.url.split('?')[0].replace(/\/$/, '') : '';
  if (cleanUrl === '/api/health' || cleanUrl === '/health' || cleanUrl === '/api') {
    return sendJson(200, { status: 'ok', serverless: true, timestamp: Date.now() });
  }

  try {
    const app = await getApp();
    return new Promise((resolve) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      app(req, res, (err: any) => {
        if (err) {
          console.error('Express Unhandled Error in serverless handler:', err);
          sendJson(500, {
            success: false,
            error: 'EXPRESS_UNHANDLED_ERROR',
            message: String(err?.message || err)
          });
        } else if (!res.headersSent) {
          sendJson(404, {
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
    return sendJson(500, {
      success: false,
      error: 'SERVERLESS_FUNCTION_ERROR',
      message: String(err?.message || err),
      stack: String(err?.stack || '')
    });
  }
}
