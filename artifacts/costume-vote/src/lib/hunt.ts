import QRCode from "qrcode";
import { getStoredVoter } from "@/lib/storage";

/** Link contenuto nel QR di un costume: aprendolo, il costume viene "catturato". */
export function huntUrl(code: string) {
  return `${window.location.origin}/caccia/${code}`;
}

/** Estrae il codice da un QR letto o da un testo scritto a mano. */
export function codeFromText(text: string): string | null {
  const fromUrl = text.match(/caccia\/([A-Za-z0-9]{5})/)?.[1];
  const code = (fromUrl ?? text).trim().toUpperCase();
  return /^[A-Z0-9]{5}$/.test(code) ? code : null;
}

export async function qrDataUrl(text: string, size = 600) {
  return QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: "M" });
}

export type TargetWin = { targetId: number; title: string; prize: string; claimCode: string };

export type CatchResult =
  | { ok: true; costumeId: number; name: string; imagePath: string; already: boolean; count: number; targetWin: TargetWin | null }
  | { ok: false; error: string; costumeId?: number; name?: string };

const PENDING_KEY = "pendingHuntCode";

export function setPendingCode(code: string | null) {
  try {
    if (code) localStorage.setItem(PENDING_KEY, code);
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignorato
  }
}

export function takePendingCode(): string | null {
  try {
    const c = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    return c;
  } catch {
    return null;
  }
}

export async function catchCostume(code: string): Promise<CatchResult> {
  const voter = getStoredVoter();
  if (!voter) return { ok: false, error: "not_registered" };
  try {
    const r = await fetch("/api/hunt/catch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterToken: voter.token, code }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: d?.error ?? "server_error", costumeId: d?.costumeId, name: d?.name };
    // Avvisa la Target Hunt: chi ha vinto vede subito la schermata del premio
    if (d.targetWin) window.dispatchEvent(new CustomEvent("target-win", { detail: d.targetWin }));
    return { ok: true, ...d };
  } catch {
    return { ok: false, error: "network" };
  }
}

export const CATCH_ERRORS: Record<string, string> = {
  unknown_code: "Questo codice non corrisponde a nessun costume in gara.",
  invalid_code: "Codice non valido: sono 5 caratteri, lettere e numeri.",
  own_costume: "È il tuo costume: non puoi catturarlo né votarlo.",
  hunt_off: "Nessuna caccia attiva in questo momento.",
  not_registered: "Prima entra come votante.",
  network: "Connessione assente: riprova.",
  server_error: "Qualcosa è andato storto, riprova.",
};
