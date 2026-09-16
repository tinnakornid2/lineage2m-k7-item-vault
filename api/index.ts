import type { Request, Response } from 'express';
import { createApp } from './_server.ts';

let appPromise: Promise<any> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp({ serveFrontend: false });
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
      message: String(err?.message || err)
    });
  }
}
