import { createHash } from "crypto";
import { logger } from "./logger";

/**
 * Upload firmati verso Cloudinary, senza SDK.
 * Configurazione: variabile CLOUDINARY_URL nel formato
 *   cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 * (la trovi nella console Cloudinary, "API environment variable").
 * Il segreto resta sul server: il telefono riceve solo una firma valida
 * per un singolo upload in una cartella precisa.
 */

type Config = { cloudName: string; apiKey: string; apiSecret: string };

function parse(url: string | undefined): Config | null {
  if (!url) return null;
  // Tollera gli errori di copia più comuni: "CLOUDINARY_URL=" davanti, simboli < >, spazi, virgolette
  const cleaned = url.trim().replace(/^CLOUDINARY_URL\s*=\s*/i, "").replace(/[<>\s"']/g, "");
  const m = cleaned.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  if (!m) {
    logger.error("CLOUDINARY_URL non valida: formato atteso cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
    return null;
  }
  return { apiKey: decodeURIComponent(m[1]), apiSecret: decodeURIComponent(m[2]), cloudName: m[3] };
}

const config = parse(process.env.CLOUDINARY_URL);
export const cloudinaryParseError = !!process.env.CLOUDINARY_URL && !config;
if (!config) logger.warn("CLOUDINARY_URL non impostata: le iscrizioni con foto sono disattivate.");

export function cloudinaryEnabled(): boolean {
  return config !== null;
}

/** Firma Cloudinary: SHA-1 dei parametri ordinati "a=1&b=2" seguiti dal segreto. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export function folderFor(sessionId: number): string {
  return `contest-camelot/sessione-${sessionId}`;
}

export function uploadSignature(sessionId: number) {
  return signedUpload(folderFor(sessionId));
}

/** Firma per caricare un'immagine nella cartella indicata (es. grafica dell'admin). */
export function signedUpload(folder: string) {
  if (!config) throw new Error("Cloudinary non configurato");
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ folder, timestamp }, config.apiSecret);
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
  };
}

/**
 * Verifica che la foto sia davvero sul nostro account Cloudinary.
 * Negli account recenti ("dynamic folders") l'id della foto può non contenere
 * la cartella, quindi la cartella non è obbligatoria: conta che sia il nostro account.
 */
export function isOwnUpload(imageUrl: string, publicId: string, _sessionId: number): boolean {
  if (!config) return false;
  return (
    imageUrl.startsWith(`https://res.cloudinary.com/${config.cloudName}/image/upload/`) &&
    publicId.length > 0 &&
    publicId.length <= 200 &&
    /^[\w\-/.]+$/.test(publicId) &&
    imageUrl.includes(publicId)
  );
}

/**
 * Controlla che nome account, chiave e password segreta siano giusti
 * chiamando l'API "ping" di Cloudinary.
 */
export async function checkConnection(): Promise<{ ok: boolean; problem?: string; cloudName?: string }> {
  if (!config) return { ok: false, problem: "missing" };
  try {
    const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/ping`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, cloudName: config.cloudName };
    const body: any = await res.json().catch(() => ({}));
    const msg: string = body?.error?.message ?? "";
    if (res.status === 401 && /api_key/i.test(msg)) return { ok: false, problem: "api_key", cloudName: config.cloudName };
    if (res.status === 401) return { ok: false, problem: "secret", cloudName: config.cloudName };
    if (res.status === 404 || /cloud_name/i.test(msg)) return { ok: false, problem: "cloud_name", cloudName: config.cloudName };
    return { ok: false, problem: `http_${res.status}: ${msg}`.slice(0, 200), cloudName: config.cloudName };
  } catch (err) {
    logger.warn({ err }, "Verifica Cloudinary non riuscita");
    return { ok: false, problem: "unreachable", cloudName: config.cloudName };
  }
}

/** Cancella una foto da Cloudinary (best effort: un errore non blocca l'operazione). */
export async function destroyImage(publicId: string | null | undefined): Promise<void> {
  if (!config || !publicId) return;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({ public_id: publicId, timestamp }, config.apiSecret);
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: config.apiKey,
      signature,
    });
    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logger.warn({ status: res.status, publicId }, "Cancellazione foto Cloudinary non riuscita");
  } catch (err) {
    logger.warn({ err, publicId }, "Cancellazione foto Cloudinary non riuscita");
  }
}
