import { logger } from "./logger";

/**
 * Render (piano gratuito) spegne il sito dopo 15 minuti senza visite e il primo
 * ospite aspetta circa un minuto. Il server allora visita sé stesso ogni 10 minuti
 * dal suo indirizzo pubblico, così resta sempre sveglio.
 * Si disattiva con KEEP_AWAKE=0. Fuori da Render (nessun RENDER_EXTERNAL_URL) non fa niente.
 */
export function startKeepAwake() {
  const base = process.env["RENDER_EXTERNAL_URL"];
  if (!base || process.env["KEEP_AWAKE"] === "0") return;
  const url = `${base.replace(/\/$/, "")}/api/healthz`;
  const ping = () =>
    fetch(url, { signal: AbortSignal.timeout(30_000) })
      .then((r) => {
        if (!r.ok) logger.warn({ status: r.status }, "Keep-awake: risposta inattesa");
      })
      .catch((err) => logger.warn({ err }, "Keep-awake: visita non riuscita"));
  setInterval(ping, 10 * 60 * 1000).unref();
  logger.info({ url }, "Keep-awake attivo: il sito resta sveglio");
}
