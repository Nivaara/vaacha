import axios from "axios";
import { env } from "../config/env.js";

const GRAPH_API_VERSION = "v21.0";

/**
 * @param {string} to E.164-style recipient (with or without leading +)
 * @param {string} message Plain-text body
 * @returns {Promise<object>} Meta API JSON response (e.g. messages[].id)
 */
export async function sendMessage(to, message) {
  const phoneNumberId = env.whatsapp.phoneNumberId.trim();
  const accessToken = env.whatsapp.accessToken.trim();

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "WhatsApp Cloud API is not configured (WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN required)",
    );
  }

  const toNormalized = String(to).replace(/\D/g, "");
  if (!toNormalized) {
    throw new Error("Invalid recipient phone number");
  }

  const body = String(message ?? "");
  if (!body.trim()) {
    throw new Error("Message body is required");
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const { data } = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNormalized,
      type: "text",
      text: { preview_url: false, body: body },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    },
  );

  return data;
}
