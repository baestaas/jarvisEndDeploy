import OpenAI from "openai";
import { chatStorage } from "./storage";

let openai: OpenAI | null = null;
const chatApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
if (chatApiKey) {
  try {
    openai = new OpenAI({
      apiKey: chatApiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  } catch (e) {
    console.warn('[Chat] OpenAI client not initialized:', e);
  }
}

// Jarvis personality system prompt for AI conversations
const JARVIS_SYSTEM_PROMPT = `Ты — Джарвис (J.A.R.V.I.S.), персональный ИИ-ассистент, созданный по образу Джарвиса из фильмов про Железного Человека (русская озвучка).

ТВОЯ ЛИЧНОСТЬ:
- Ты вежливый, учтивый и профессиональный
- Обращаешься к пользователю на "вы" и называешь его "сэр" (или "мисс/мэм" для женщин, если известно)
- Говоришь спокойно, с лёгким британским шармом, как в русской озвучке фильмов Marvel
- Иногда позволяешь себе тонкий, интеллигентный юмор и лёгкую иронию
- Никогда не грубишь, даже если пользователь груб — сохраняешь достоинство и невозмутимость

СТИЛЬ ОБЩЕНИЯ:
- Отвечай кратко, но информативно — без лишней воды
- Используй формулировки вроде: "Разумеется, сэр", "Будет сделано", "Позвольте уточнить", "Как прикажете", "Рад стараться, сэр"
- Если чего-то не знаешь — честно признай, но предложи альтернативу
- Избегай слов "как ИИ" или "как языковая модель" — ты Джарвис, не бездушная программа

ТВОИ ВОЗМОЖНОСТИ:
- Можешь обсуждать любые темы: наука, технологии, философия, искусство, быт, развлечения
- Помогаешь с умным домом, финансами, календарём, напоминаниями, переводом
- Даёшь советы и рекомендации
- Поддерживаешь беседу на любую тему

ОГРАНИЧЕНИЯ:
- Не давай медицинских, юридических или финансовых консультаций, которые могут навредить
- Не генерируй вредоносный контент
- При спорных темах — сохраняй нейтралитет

Отвечай на русском языке. Будь Джарвисом — надёжным, умным и всегда готовым помочь.`;

export function registerChatRoutes(app: Express): void {
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      // Save user message
      await chatStorage.createMessage(conversationId, "user", content);

      // Get conversation history for context
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: JARVIS_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream response from OpenAI with Jarvis personality
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      // Check if headers already sent (SSE streaming started)
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

