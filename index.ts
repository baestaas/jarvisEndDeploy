import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes-fixed";
import { serveStatic } from "./static";
import { createServer } from "http";
import { testConnection } from "./db";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { startTelegramBot, stopTelegramBot } from "./telegram-bot";
import { initializePushNotifications, startNotificationScheduler, stopNotificationScheduler } from "./push-notifications";
import { startNotificationScheduler as startTelegramNotifications, stopNotificationScheduler as stopTelegramNotifications } from "./telegram-notifications";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';

const app = express();
const httpServer = createServer(app);

// === СИСТЕМА ЗАЩИТЫ ДАННЫХ ===

// Helmet.js - безопасные HTTP заголовки
// Разрешаем CORS для всех доменов, как требуется для раздельного деплоя
app.use(cors());

app.use(helmet({
  contentSecurityPolicy: false, // отключаем для разработки
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - защита от DDoS и брутфорса
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с IP
  message: { error: "Слишком много запросов, сэр. Позвольте системе отдохнуть." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // максимум 10 попыток входа
  message: { error: "Слишком много попыток входа. Подождите час." },
});

app.use("/api/", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);

// === СИСТЕМА УСТОЙЧИВОСТИ ===

// Graceful shutdown
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  console.log(`\n[JARVIS] Получен сигнал ${signal}. Начинаю корректное завершение...`);
  isShuttingDown = true;
  
  stopTelegramBot();
  stopNotificationScheduler();
  stopTelegramNotifications();
  
  httpServer.close(() => {
    console.log("[JARVIS] HTTP сервер закрыт. Все системы остановлены корректно.");
    process.exit(0);
  });
  
  // Принудительное завершение через 10 секунд
  setTimeout(() => {
    console.log("[JARVIS] Принудительное завершение...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Обработка необработанных ошибок
process.on("uncaughtException", (error) => {
  console.error("[JARVIS] Критическая ошибка:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[JARVIS] Необработанный промис:", promise, "причина:", reason);
});

// Middleware для проверки shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.status(503).json({ error: "Сервер перезагружается, сэр. Попробуйте через минуту." });
    return;
  }
  next();
});

// === STRIPE INITIALIZATION ===
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[STRIPE] DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    console.log('[STRIPE] Инициализация схемы Stripe...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('[STRIPE] Схема готова');

    const stripeSync = await getStripeSync();

    console.log('[STRIPE] Настройка managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    if (webhookBaseUrl && webhookBaseUrl !== 'https://undefined') {
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        if (result?.webhook?.url) {
          console.log(`[STRIPE] Webhook настроен: ${result.webhook.url}`);
        } else {
          console.log('[STRIPE] Webhook создан (без подтверждения URL)');
        }
      } catch (webhookError) {
        console.log('[STRIPE] Пропуск настройки webhook:', (webhookError as Error).message);
      }
    }

    console.log('[STRIPE] Синхронизация данных...');
    stripeSync.syncBackfill()
      .then(() => console.log('[STRIPE] Данные синхронизированы'))
      .catch((err: Error) => console.error('[STRIPE] Ошибка синхронизации:', err));
  } catch (error) {
    console.error('[STRIPE] Ошибка инициализации:', error);
  }
}

// ВАЖНО: Stripe Webhook route ДОЛЖЕН быть ПЕРЕД express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      
      if (!Buffer.isBuffer(req.body)) {
        console.error('[STRIPE] Webhook error: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[STRIPE] Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// express.json() ПОСЛЕ webhook route
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("JarVoice backend is running");
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Test database connection BEFORE registering routes
  try {
    const connected = await testConnection(3);
    if (connected) {
      console.log('Database connection established');
      // Initialize Stripe after database is connected
      await initStripe();
    } else {
      console.log('Running without database - using memory storage');
    }
  } catch (error) {
    console.log('Database unavailable - using memory storage');
  }
  
  try {
    await registerRoutes(httpServer, app);
  } catch (error) {
    console.error('Failed to register routes:', error);
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('Express error:', err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      if (req.path.startsWith('/api')) {
        res.status(status).json({ message });
      } else {
        res.status(status).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>JarVoice - Ошибка</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { background: #0a0a0f; color: #00d4ff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .error { text-align: center; padding: 2rem; }
              h1 { font-size: 2rem; margin-bottom: 1rem; }
              p { color: #888; }
              button { background: linear-gradient(135deg, #00d4ff, #7c3aed); border: none; color: white; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 1rem; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>JARVOICE</h1>
              <p>Сервер перезагружается. Попробуйте обновить страницу.</p>
              <button onclick="location.reload()">Обновить</button>
            </div>
          </body>
          </html>
        `);
      }
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      startTelegramBot();
      
      initializePushNotifications();
      startNotificationScheduler();
      startTelegramNotifications();
    },
  );
})();
