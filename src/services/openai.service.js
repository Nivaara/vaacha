import axios from "axios";
import { env } from "../config/env.js";

const MODEL = "gpt-4o-mini";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBED_BATCH_SIZE = 100;

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

/**
 * @param {string[]} inputs
 * @returns {Promise<number[][]>} One embedding vector per input (1536 dimensions each)
 */
export async function embedTexts(inputs) {
  const apiKey = env.openaiApiKey.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const list = Array.isArray(inputs) ? inputs.map((s) => String(s ?? "")) : [];
  if (list.length === 0) {
    return [];
  }

  const out = [];

  for (let i = 0; i < list.length; i += EMBED_BATCH_SIZE) {
    const batch = list.slice(i, i + EMBED_BATCH_SIZE);
    const { data } = await axios.post(
      EMBEDDINGS_URL,
      {
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      },
    );

    const items = Array.isArray(data?.data) ? data.data : [];
    if (items.length !== batch.length) {
      throw new Error("OpenAI embedding batch size mismatch");
    }
    items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const item of items) {
      const emb = item.embedding;
      if (!Array.isArray(emb)) {
        throw new Error("OpenAI returned invalid embedding");
      }
      out.push(emb);
    }
  }

  return out;
}
