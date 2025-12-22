import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import FileStore from "session-file-store";
import { storage } from "./storage";
import { pool, isDatabaseConnected } from "./db";
import { jarvisAI } from "./jarvis-ai";
import { jarvisSelfAnalysis } from "./jarvis-self-analysis";
import { getVapidPublicKey } from "./push-notifications";
import { generateImage, isImageGenerationRequest, extractImagePrompt } from "./image-generation";
import { isSummarizationRequest, processSummarizationCommand, summarizeText, summarizeUrl } from "./text-summarization";
import { generateTotpSecret, generateQRCode, verifyTotpCode, generateBackupCodes, verifyBackupCode } from "./two-factor-auth";
import * as smartHome from "./smart-home";
import * as googleCalendar from "./google-calendar";
import * as fs from "fs/promises";
import * as path from "path";
import OpenAI from "openai";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import { sql } from "drizzle-orm";
import { db } from "./db";
import * as voiceControl from "./voice-control";
import * as jarvisVoice from "./jarvis-voice";

// Используем OPENAI_API_KEY напрямую
let openai: OpenAI | null = null;
const fixedApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
if (fixedApiKey) {
  try {
    openai = new OpenAI({
      apiKey: fixedApiKey,
    });
  } catch (e) {
    console.warn('[RoutesFixed] OpenAI client not initialized:', e);
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    pending2faUserId?: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for production (Replit uses reverse proxy)
  app.set('trust proxy', 1);
  
  let sessionStore: session.Store;
  
  // Try PostgreSQL first, fallback to file-based storage
  try {
    if (pool && isDatabaseConnected()) {
      const PgSession = connectPgSimple(session);
      sessionStore = new PgSession({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
        errorLog: console.error,
      });
      console.log('Using PostgreSQL session store');
    } else {
      throw new Error('Database not connected');
    }
  } catch (error) {
    // Используем файловое хранилище для персистентности сессий
    console.log('Using file-based session store (DB unavailable)');
    const FileSessionStore = FileStore(session);
    const sessionsPath = path.join(process.cwd(), '.sessions');
    sessionStore = new FileSessionStore({
      path: sessionsPath,
      ttl: 30 * 24 * 60 * 60, // 30 дней
      retries: 3,
      reapInterval: 3600, // Очистка каждый час
      logFn: () => {} // Отключаем логирование
    });
  }
  
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "jarvoice-secret-key-2024",
    resave: true, // Важно для сохранения сессии
    saveUninitialized: false,
    proxy: true,
    name: 'jarvoice.sid', // Уникальное имя cookie
    cookie: { 
      secure: false, // Для разработки без HTTPS
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      sameSite: "lax"
    }
  }));


  // === AI-RELATED ROUTES ===

  // 1. Voice Command Processing
  app.post("/api/voice/command", async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Voice command is required" });
      }
      const result = await jarvisVoice.processVoiceCommand(command);
      res.json(result);
    } catch (error) {
      console.error("Error processing voice command:", error);
      res.status(500).json({ error: "Failed to process voice command" });
    }
  });

  // 2. Summarization
  app.post("/api/summarize", async (req, res) => {
    try {
      const { text, url } = req.body;
      let summary;
      if (url) {
        summary = await summarizeUrl(url);
      } else if (text) {
        summary = await summarizeText(text);
      } else {
        return res.status(400).json({ error: "Text or URL is required for summarization" });
      }
      res.json({ summary });
    } catch (error) {
      console.error("Error summarizing:", error);
      res.status(500).json({ error: "Failed to summarize content" });
    }
  });

  // 3. Image Generation
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required for image generation" });
      }
      const imageUrl = await generateImage(prompt);
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });

  // === END AI-RELATED ROUTES ===

  return httpServer;
}
