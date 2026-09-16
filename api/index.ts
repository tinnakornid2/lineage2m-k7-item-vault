import type { Request, Response } from 'express';

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        // On Vercel production, dist/server.js is built and contains pure ESM JavaScript
        const distModule = await import('../dist/server.js').catch(() => null);
        if (distModule && typeof distModule.createApp === 'function') {
          return await distModule.createApp({ serveFrontend: false });
        }
        // Fallback to server.ts in tsx / local environment
        const tsModule = await import('../server.ts');
        return await tsModule.createApp({ serveFrontend: false });
      } catch (err) {
        console.error('Failed to initialize createApp:', err);
        throw err;
      }
    })();
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Serverless Function Handler Error:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVERLESS_FUNCTION_ERROR',
      message: String(err?.message || err),
      stack: String(err?.stack || '')
    });
  }
}
