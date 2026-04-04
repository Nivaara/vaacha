import { createRequire } from "module";
import { pool } from "../config/database.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { embedTexts } from "./openai.service.js";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

/**
 * @param {string} text
 * @returns {string[]}
 */
export function chunkText(text) {
  const normalized = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const slice = normalized.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push(slice);
    }
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

function vectorLiteral(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Invalid embedding");
  }
  return `[${embedding.join(",")}]`;
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} filename
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(buffer, mimeType, filename) {
  const lower = (filename ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    return String(parsed.text ?? "");
  }

  if (
    mime.includes("text/plain") ||
    mime.includes("text/") ||
    lower.endsWith(".txt")
  ) {
    return buffer.toString("utf8");
  }

  throw new Error("Unsupported file type; use PDF or plain text");
}

/**
 * @param {{ knowledgeBaseId: string, filename: string, mimeType: string, buffer: Buffer }} params
 */
export async function ingestDocument({
  knowledgeBaseId,
  filename,
  mimeType,
  buffer,
}) {
  const kbRes = await pool.query(
    "SELECT id FROM knowledge_bases WHERE id = $1::uuid",
    [knowledgeBaseId],
  );
  if (kbRes.rows.length === 0) {
    throw new Error("Knowledge base not found");
  }

  const raw = await extractTextFromFile(buffer, mimeType, filename);
  const chunks = chunkText(raw);
  if (chunks.length === 0) {
    return { chunksInserted: 0 };
  }

  const embeddings = await embedTexts(chunks);
  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count mismatch");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO document_chunks
          (knowledge_base_id, source_filename, mime_type, chunk_index, content, embedding)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::vector)`,
        [
          knowledgeBaseId,
          filename,
          mimeType,
          i,
          chunks[i],
          vectorLiteral(embeddings[i]),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { chunksInserted: chunks.length };
}

/**
 * @param {{ knowledgeBaseId: string, queryText: string, k?: number }} params
 * @returns {Promise<string[]>} Chunk text bodies
 */
export async function retrieveTopChunks({
  knowledgeBaseId,
  queryText,
  k = 5,
}) {
  const kb = String(knowledgeBaseId ?? "").trim();
  if (!kb) {
    return [];
  }

  const query = String(queryText ?? "").trim();
  if (!query) {
    return [];
  }

  try {
    const [queryEmbedding] = await embedTexts([query]);
    if (!queryEmbedding) {
      return [];
    }

    const vec = vectorLiteral(queryEmbedding);

    const { rows } = await pool.query(
      `SELECT content FROM document_chunks
       WHERE knowledge_base_id = $1::uuid
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      [kb, vec, k],
    );

    return rows.map((r) => r.content);
  } catch (err) {
    console.error("RAG retrieve error:", err);
    return [];
  }
}

/**
 * @param {string} basePrompt
 * @param {string[]} chunks
 * @returns {string}
 */
export function buildRagSystemPrompt(basePrompt, chunks) {
  const base =
    String(basePrompt ?? "").trim() || "You are a helpful assistant.";
  if (!chunks.length) {
    return base;
  }
  const context = chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");
  return `${base}\n\nUse the following context when relevant to answer. If the answer is not in the context, say so.\n\n${context}`;
}
