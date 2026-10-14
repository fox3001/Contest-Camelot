import { pool, ensureSchema } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"] ?? 8080);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

async function main() {
  // Aggiorna lo schema del database (idempotente, non cancella dati)
  await ensureSchema(pool, (msg, err) => logger.warn({ err }, msg));
  logger.info("Database schema ok");

  const server = app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
  });

  server.on("error", (err) => {
    logger.error({ err }, "Server error");
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});
