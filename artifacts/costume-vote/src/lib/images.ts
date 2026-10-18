/**
 * Immagini ottimizzate: per le foto su Cloudinary chiede una versione già
 * ridimensionata e nel formato migliore per il telefono (WebP/AVIF).
 * Gli altri link restano invariati.
 */
export function optimizedImage(url: string | null | undefined, width: number): string {
  if (!url) return "";
  const marker = "/image/upload/";
  if (!url.startsWith("https://res.cloudinary.com/") || !url.includes(marker)) return url;
  const [before, after] = url.split(marker);
  return `${before}${marker}f_auto,q_auto,c_limit,w_${width}/${after}`;
}

const MAX_SIDE = 1600;

/**
 * Riduce la foto sul telefono prima dell'upload (da qualche MB a ~200-400 KB).
 * Se il browser non riesce a leggerla (es. alcuni HEIC) restituisce il file originale.
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    let source: ImageBitmap | HTMLImageElement;
    if ("createImageBitmap" in window) {
      source = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } else {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    const w = source.width;
    const h = source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Upload con avanzamento (fetch non dà la percentuale). */
export function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new UploadError(data?.error?.message ?? `HTTP ${xhr.status}`));
      } catch {
        reject(new UploadError(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.send(form);
  });
}

/** Errore restituito da Cloudinary durante il caricamento. */
export class UploadError extends Error {}

/** Traduce gli errori di Cloudinary in italiano, con cosa fare. */
export function explainUploadError(err: unknown, forAdmin = false): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const who = forAdmin ? "" : " Avvisa l'organizzazione.";
  if (msg === "network") return "Connessione assente o troppo lenta: riprova.";
  if (!(err instanceof UploadError)) return "";
  if (/signature/i.test(msg))
    return forAdmin
      ? "Cloudinary rifiuta la chiave: la password segreta (API Secret) in CLOUDINARY_URL su Render è sbagliata."
      : "Il caricamento delle foto non è configurato correttamente." + who;
  if (/api_key/i.test(msg))
    return forAdmin ? "Cloudinary rifiuta la chiave: l'API Key in CLOUDINARY_URL su Render è sbagliata." : "Il caricamento delle foto non è configurato correttamente." + who;
  if (/cloud_name|cloud name/i.test(msg))
    return forAdmin ? "Cloudinary non trova l'account: il nome dopo la @ in CLOUDINARY_URL è sbagliato." : "Il caricamento delle foto non è configurato correttamente." + who;
  if (/file size|too large/i.test(msg)) return "La foto è troppo grande: scegline una più piccola.";
  if (/invalid image|unsupported|format/i.test(msg)) return "Formato della foto non supportato: prova con una foto JPG o PNG.";
  return `Caricamento non riuscito (${msg.slice(0, 120)}).`;
}
