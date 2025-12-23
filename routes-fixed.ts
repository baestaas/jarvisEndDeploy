import { Router } from "express";
import OpenAI from "openai";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set",
      });
    }

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: req.body.messages,
    });

    res.json(completion);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || "OpenAI request failed",
    });
  }
});

export default router;

