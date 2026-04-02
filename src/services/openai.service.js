import axios from "axios";
import { env } from "../config/env.js";

const MODEL = "gpt-4o-mini";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * @param {string} userMessage
 * @param {string} systemPrompt
 * @returns {Promise<string>} Assistant message content
 */
export async function chat(userMessage, systemPrompt) {
  const apiKey = env.openaiApiKey.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const user = String(userMessage ?? "").trim();
  if (!user) {
    throw new Error("userMessage is required");
  }

  const system = String(systemPrompt ?? "");

  const { data } = await axios.post(
    CHAT_URL,
    {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120_000,
    },
  );

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI returned no assistant message");
  }

  return content;
}
