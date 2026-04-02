import { Router } from "express";

export const rootRouter = Router();

rootRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "vaacha-api" });
});
