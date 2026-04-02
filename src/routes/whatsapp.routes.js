import { Router } from "express";
import { env } from "../config/env.js";

const HUB_MODE = "hub.mode";
const HUB_VERIFY_TOKEN = "hub.verify_token";
const HUB_CHALLENGE = "hub.challenge";

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
  console.log("WhatsApp webhook payload:", JSON.stringify(req.body));
  res.sendStatus(200);
});
