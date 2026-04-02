import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./config/database.js";

async function start() {
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Vaacha API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
