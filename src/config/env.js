import "dotenv/config";

function required(name, value) {
  if (!value || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  ragKnowledgeBaseId: (process.env.RAG_KNOWLEDGE_BASE_ID ?? "").trim(),
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  },
};
