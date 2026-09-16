import { createApp } from './_server.ts';

// Initialize the Express app for Vercel Serverless environment
const app = await createApp({ serveFrontend: false });

export default app;
