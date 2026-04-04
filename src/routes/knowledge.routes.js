import { Router } from "express";
import multer from "multer";
import { pool } from "../config/database.js";
import { ingestDocument } from "../services/rag.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const knowledgeRouter = Router();

/** In production, protect these routes (e.g. API key, VPN). */
knowledgeRouter.post("/bases", async (req, res) => {
  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const { rows } = await pool.query(
    "INSERT INTO knowledge_bases (name) VALUES ($1) RETURNING id, name, created_at",
    [name.trim()],
  );
  res.status(201).json(rows[0]);
});

knowledgeRouter.post(
  "/bases/:id/documents",
  upload.single("file"),
  async (req, res) => {
    const knowledgeBaseId = req.params.id;
    const file = req.file;

    if (!file?.buffer) {
      res.status(400).json({ error: "file is required (multipart field: file)" });
      return;
    }

    try {
      const result = await ingestDocument({
        knowledgeBaseId,
        filename: file.originalname ?? "upload",
        mimeType: file.mimetype ?? "application/octet-stream",
        buffer: file.buffer,
      });
      res.status(201).json(result);
    } catch (err) {
      console.error("Ingest error:", err);
      const message = err instanceof Error ? err.message : "Ingest failed";
      if (message === "Knowledge base not found") {
        res.status(404).json({ error: message });
        return;
      }
      if (message.includes("Unsupported file type")) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  },
);
