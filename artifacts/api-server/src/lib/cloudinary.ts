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
  const m = url.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  if (!m) {
    logger.error("CLOUDINARY_URL non valida: formato atteso cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
    return null;
  }
  return { apiKey: decodeURIComponent(m[1]), apiSecret: decodeURIComponent(m[2]), cloudName: m[3] };
}

const config = parse(process.env.CLOUDINARY_URL);
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

/** Verifica che un upload arrivi davvero dal nostro account e dalla cartella della sessione. */
export function isOwnUpload(imageUrl: string, publicId: string, sessionId: number): boolean {
  if (!config) return false;
  const folder = folderFor(sessionId) + "/";
  return (
    imageUrl.startsWith(`https://res.cloudinary.com/${config.cloudName}/image/upload/`) &&
    publicId.startsWith(folder) &&
    /^[\w\-/]+$/.test(publicId) &&
    imageUrl.includes(publicId)
  );
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
