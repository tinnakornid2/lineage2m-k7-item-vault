import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const currentFilename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== "undefined" ? __filename : "");
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

// Helper to generate content with modern Gemini model fallback (3.6 -> 2.5 -> 2.0 -> 1.5)
async function generateWithModelFallback(ai: GoogleGenAI, request: { contents: any; systemInstruction?: any }) {
  const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any = null;
  for (const model of candidateModels) {
    try {
      const resp = await ai.models.generateContent({
        ...request,
        model
      });
      return resp;
    } catch (err: any) {
      lastError = err;
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("no longer available") || msg.includes("not_found")) {
        console.warn(`Model ${model} not available, trying next model fallback...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing (allows larger payloads for screenshot images)
  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Check Gemini API Key status
  app.get("/api/gemini-status", (_req, res) => {
    const key = process.env.GEMINI_API_KEY?.trim();
    const isConfigured = Boolean(key && key.length > 10);
    const maskedKey = isConfigured ? `${key!.slice(0, 6)}...${key!.slice(-4)}` : null;
    res.json({
      configured: isConfigured,
      maskedKey: maskedKey
    });
  });

  // Save and Validate Gemini API Key
  app.post("/api/save-gemini-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: "กรุณาระบุ Gemini API Key ให้ถูกต้อง (ต้องมีความยาวอย่างน้อย 10 ตัวอักษร)"
        });
      }

      const cleanKey = apiKey.trim();

      // Test key with a fast verification call to GoogleGenAI
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      await generateWithModelFallback(ai, {
        contents: "ping"
      });

      // Update in-memory environment variable
      process.env.GEMINI_API_KEY = cleanKey;

      // Persist to .env file
      try {
        const fs = await import("fs/promises");
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";
        try {
          envContent = await fs.readFile(envPath, "utf-8");
        } catch {
          envContent = "";
        }

        if (envContent.includes("GEMINI_API_KEY=")) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
        } else {
          envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
        }
        await fs.writeFile(envPath, envContent, "utf-8");
      } catch (fsErr) {
        console.warn("Could not persist GEMINI_API_KEY to .env file:", fsErr);
      }

      return res.json({
        success: true,
        message: "Gemini API Key ผ่านการตรวจสอบและบันทึกเรียบร้อยแล้ว!",
        maskedKey: `${cleanKey.slice(0, 6)}...${cleanKey.slice(-4)}`
      });
    } catch (err: any) {
      console.error("Gemini API Key verification failed:", err);
      let friendlyError = err.message || "การตรวจสอบ API Key ล้มเหลว";
      if (friendlyError.includes("API_KEY_INVALID") || friendlyError.includes("API key not valid")) {
        friendlyError = "API Key ไม่ถูกต้อง กรุณาตรวจสอบคีย์ที่คัดลอกจาก Google AI Studio อีกครั้ง";
      } else if (friendlyError.includes("API_KEY_SERVICE_BLOCKED")) {
        friendlyError = "API Key นี้ไม่ได้รับอนุญาตให้ใช้ Generative Language API กรุณาสร้าง Key ใหม่ที่ https://aistudio.google.com/";
      } else if (friendlyError.includes("RESOURCE_EXHAUSTED")) {
        friendlyError = "โควตา API เต็มชั่วคราว กรุณารอสักครู่";
      }
      return res.status(400).json({
        success: false,
        error: friendlyError
      });
    }
  });

  // OCR Hunter scanner endpoint using Gemini 2.5 Flash with Multi-Image & Deduplication support
  app.post("/api/scan-hunters", async (req, res) => {
    try {
      const { imageBase64, imagesBase64, knownMembers, customApiKey } = req.body;
      const apiKey = (customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 10)
        ? customApiKey.trim()
        : process.env.GEMINI_API_KEY?.trim();

      // Collect images (support single image or multiple images array)
      const rawImages: string[] = [];
      if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
        rawImages.push(...imagesBase64.filter((img) => typeof img === "string" && img.length > 0));
      } else if (imageBase64 && typeof imageBase64 === "string") {
        rawImages.push(imageBase64);
      }

      if (rawImages.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Missing imageBase64 or imagesBase64 data",
          message: "ไม่พบข้อมูลรูปภาพสำหรับสแกน"
        });
      }

      if (!apiKey) {
        return res.json({
          success: false,
          error: "MISSING_API_KEY",
          message: "ระบบยังไม่ได้ตั้งค่า Gemini API Key กรุณาตั้งค่า Key ในระบบเพื่อเปิดใช้งาน AI OCR สแกนชื่อผู้ล่า",
          detectedClanGroups: [],
          rawNames: [],
          duplicatesFilteredCount: 0
        });
      }

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({ apiKey });

      // Prepare image parts for Gemini (up to 8 images per call)
      const imageParts = rawImages.slice(0, 8).map((img) => {
        const cleanBase64 = img.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
        const mimeType = img.match(/^data:(image\/[a-zA-Z]+);base64,/)?.[1] || "image/png";
        return {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType
          }
        };
      });

      const prompt = `You are an expert OCR and game text analyzer for Lineage 2M (Lineage2M).
Examine the attached screenshot(s) (${imageParts.length} screenshot(s) provided).
These screenshots show boss raids, party member panels, combat damage meters, loot drops, member rosters, or chat logs.

Task:
1. Extract all unique player/character names and their Clan names visible across ALL provided screenshots.
2. CRITICAL DEDUPLICATION RULE: Filter out duplicate player names! Each player must only appear ONCE in the final output, even if they appear in multiple screenshots or parties.
3. Compare extracted names against the database list of known clan members below. If an OCR name closely matches a known member (accounting for minor OCR typos or font stylings), use their official inGameName and their registered clan.

Database list of known guild/alliance members:
${JSON.stringify(knownMembers || [], null, 2)}

Output strictly a JSON object with this exact structure:
{
  "detectedClanGroups": [
    {
      "clanName": "Clan:VoltZ",
      "members": ["Zenkaii", "Eloni"]
    },
    {
      "clanName": "Clan:LevelS",
      "members": ["DVD"]
    }
  ],
  "rawNames": ["Zenkaii", "Eloni", "DVD"],
  "duplicatesFilteredCount": 0,
  "notes": "Recognized players across screenshots"
}
Do not include markdown or explanations. Return pure JSON only.`;

      const response = await generateWithModelFallback(ai, {
        contents: [
          {
            role: "user",
            parts: [
              ...imageParts,
              {
                text: prompt
              }
            ]
          }
        ]
      });

      const responseText = response.text || "{}";
      let parsedResult: any = {
        detectedClanGroups: [],
        rawNames: [],
        duplicatesFilteredCount: 0
      };

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
        } catch {
          parsedResult = { rawNames: [], detectedClanGroups: [] };
        }
      }

      // Programmatic Post-Processing & Deduplication Safety Net
      const seenNames = new Set<string>();
      let programmaticDuplicatesCount = 0;
      const cleanClanGroups: { clanName: string; members: string[] }[] = [];

      if (Array.isArray(parsedResult.detectedClanGroups)) {
        for (const group of parsedResult.detectedClanGroups) {
          const cleanMembers: string[] = [];
          const clanName = (group.clanName || "Clan:VoltZ").trim();
          if (Array.isArray(group.members)) {
            for (const member of group.members) {
              const trimmed = typeof member === "string" ? member.trim() : "";
              if (!trimmed) continue;
              const lower = trimmed.toLowerCase();
              if (seenNames.has(lower)) {
                programmaticDuplicatesCount++;
              } else {
                seenNames.add(lower);
                cleanMembers.push(trimmed);
              }
            }
          }
          if (cleanMembers.length > 0) {
            cleanClanGroups.push({ clanName, members: cleanMembers });
          }
        }
      }

      // Also check rawNames
      const cleanRawNames: string[] = [];
      if (Array.isArray(parsedResult.rawNames)) {
        for (const raw of parsedResult.rawNames) {
          const trimmed = typeof raw === "string" ? raw.trim() : "";
          if (trimmed && !cleanRawNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
            cleanRawNames.push(trimmed);
          }
        }
      }

      return res.json({
        success: true,
        detectedClanGroups: cleanClanGroups,
        rawNames: cleanRawNames,
        duplicatesFilteredCount: (parsedResult.duplicatesFilteredCount || 0) + programmaticDuplicatesCount,
        imageCount: imageParts.length,
        notes: parsedResult.notes || `Processed ${imageParts.length} screenshot(s)`
      });
    } catch (err: any) {
      console.error("Error in /api/scan-hunters:", err);
      let friendlyError = err.message || "Failed to scan hunters screenshot";
      if (friendlyError.includes("API_KEY_INVALID") || friendlyError.includes("API key not valid")) {
        friendlyError = "Gemini API Key ไม่ถูกต้อง กรุณาตรวจสอบหรือเปลี่ยน Key ในระบบ";
      } else if (friendlyError.includes("API_KEY_SERVICE_BLOCKED")) {
        friendlyError = "API Key นี้ไม่ได้รับอนุญาตให้ใช้ Generative Language API กรุณาสร้าง Key ใหม่ที่ https://aistudio.google.com/";
      } else if (friendlyError.includes("RESOURCE_EXHAUSTED") || friendlyError.includes("quota")) {
        friendlyError = "โควตาการเรียกใช้งาน Gemini API เต็มชั่วคราว กรุณารอสักครู่แล้วลองใหม่";
      }
      return res.json({
        success: false,
        error: "GEMINI_ERROR",
        message: friendlyError,
        detectedClanGroups: [],
        rawNames: [],
        duplicatesFilteredCount: 0
      });
    }
  });

  // Serve static assets in public folder (including fantasy-original.png and wallpapers)
  app.use(express.static(path.join(process.cwd(), "public")));

  // Background upload endpoint - saves to public/fantasy-original.png
  app.post("/api/save-background", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 data" });
      }
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const fs = await import("fs/promises");
      const targetPath = path.join(process.cwd(), "public", "fantasy-original.png");
      await fs.writeFile(targetPath, buffer);
      return res.json({ success: true, url: "/fantasy-original.png?t=" + Date.now() });
    } catch (err: any) {
      console.error("Failed to save custom background:", err);
      return res.status(500).json({ error: err.message || "Failed to save image" });
    }
  });

  // Discord Webhook Proxy Endpoint (bypasses browser CORS & formats payloads)
  app.post("/api/discord-webhook", async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      if (!webhookUrl || typeof webhookUrl !== "string") {
        return res.status(400).json({ error: "Missing webhookUrl" });
      }

      // Basic URL verification for security
      if (!webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")) {
        return res.status(400).json({ error: "Invalid Discord Webhook URL. It must start with https://discord.com/api/webhooks/" });
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Lineage2M-K7Vault/1.0"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Discord returned non-OK status:", response.status, errText);
        return res.status(response.status).json({
          success: false,
          status: response.status,
          error: `Discord Webhook error (${response.status}): ${errText}`
        });
      }

      return res.json({ success: true, status: response.status });
    } catch (err: any) {
      console.error("Failed to forward Discord webhook:", err);
      return res.status(500).json({ error: err.message || "Internal server error forwarding webhook" });
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lineage2M Clan Hub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
