import express from "express";
import { rootRouter } from "./routes/index.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/", rootRouter);
  app.use("/whatsapp", whatsappRouter);

  return app;
}
