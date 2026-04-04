import { Router } from "express";
import { env } from "../config/env.js";
import { chat } from "../services/openai.service.js";
import {
  buildRagSystemPrompt,
  retrieveTopChunks,
} from "../services/rag.service.js";
import { sendMessage } from "../services/whatsapp.service.js";

const HUB_MODE = "hub.mode";
const HUB_VERIFY_TOKEN = "hub.verify_token";
const HUB_CHALLENGE = "hub.challenge";

const SYSTEM_PROMPT = "You are a helpful assistant.";

/**
 * Pull inbound user text messages from a Meta WhatsApp webhook body.
 * Skips status-only notifications (no messages). Skips non-text message types.
 * @param {unknown} payload
 * @returns {{ from: string, text: string }[]}
 */
function extractInboundTextMessages(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const out = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      if (!value || typeof value !== "object") {
        continue;
      }

      const messages = value.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        continue;
      }

      for (const msg of messages) {
        if (!msg || typeof msg !== "object") {
          continue;
        }
        if (msg.type !== "text") {
          continue;
        }

        const from = msg.from;
        const body = msg.text?.body;
        if (from == null || body == null) {
          continue;
        }

        const text = String(body).trim();
        if (!text) {
          continue;
        }

        out.push({ from: String(from), text });
      }
    }
  }

  return out;
}

async function processIncomingWebhook(payload) {
  const items = extractInboundTextMessages(payload);

  for (const { from, text } of items) {
    try {
      let systemPrompt = SYSTEM_PROMPT;
      if (env.ragKnowledgeBaseId) {
        const chunks = await retrieveTopChunks({
          knowledgeBaseId: env.ragKnowledgeBaseId,
          queryText: text,
          k: 5,
        });
        systemPrompt = buildRagSystemPrompt(SYSTEM_PROMPT, chunks);
      }

      const reply = await chat(text, systemPrompt);
      await sendMessage(from, reply);
    } catch (err) {
      console.error("WhatsApp reply pipeline error:", err);
    }
  }
}

export const whatsappRouter = Router();

whatsappRouter.get("/webhook", (req, res) => {
  const mode = req.query[HUB_MODE];
  const verifyToken = req.query[HUB_VERIFY_TOKEN];
  const challenge = req.query[HUB_CHALLENGE];

  if (
    mode === "subscribe" &&
    verifyToken === env.whatsapp.webhookVerifyToken &&
    env.whatsapp.webhookVerifyToken !== "" &&
    challenge != null &&
    String(challenge).length > 0
  ) {
    res.status(200).type("text/plain").send(String(challenge));
    return;
  }

  res.sendStatus(403);
});

whatsappRouter.post("/webhook", (req, res) => {
  res.sendStatus(200);

  processIncomingWebhook(req.body).catch((err) => {
    console.error("WhatsApp webhook processing error:", err);
  });
});
