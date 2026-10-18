import { pool, ensureSchema, db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { useAdminPassword } from "./lib/adminAuth";
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

  // Password admin cambiata dal pannello (se c'è, ha la precedenza su ADMIN_PASSWORD)
  const [pw] = await db.select().from(settingsTable).where(eq(settingsTable.key, "admin_password")).limit(1);
  const saved = (pw?.value as any)?.password;
  if (typeof saved === "string" && saved.length > 0) {
    useAdminPassword(saved);
    logger.info("Password admin: quella impostata dal pannello");
  }

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
