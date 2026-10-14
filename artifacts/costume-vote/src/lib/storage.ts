/**
 * Unico punto di accesso al localStorage dell'app.
 * Avvolto in try/catch: in navigazione privata o con storage bloccato
 * l'app continua a funzionare (con un id dispositivo temporaneo).
 */

const KEYS = {
  DEVICE_ID: "deviceId",
  VOTER_TOKEN: "voterToken",
  VOTER_ID: "voterId",
  VOTER_NICKNAME: "voterNickname",
  SESSION_ID: "sessionId",
  ADMIN_TOKEN: "adminToken",
} as const;

let memoryDeviceId: string | null = null;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage non disponibile: ignoriamo
  }
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Id casuale e stabile del dispositivo: un votante per dispositivo per sessione. */
export function getDeviceId(): string {
  let id = read(KEYS.DEVICE_ID);
  if (!id || id.length < 16) {
    id = memoryDeviceId ?? randomId();
    memoryDeviceId = id;
    write(KEYS.DEVICE_ID, id);
  }
  return id;
}

export type StoredVoter = { token: string; id: string; nickname: string; sessionId: string };

export function getStoredVoter(): StoredVoter | null {
  const token = read(KEYS.VOTER_TOKEN);
  if (!token) return null;
  return {
    token,
    id: read(KEYS.VOTER_ID) ?? "",
    nickname: read(KEYS.VOTER_NICKNAME) ?? "",
    sessionId: read(KEYS.SESSION_ID) ?? "",
  };
}

export function setStoredVoter(v: { token: string; id: number; nickname: string; sessionId: number }) {
  write(KEYS.VOTER_TOKEN, v.token);
  write(KEYS.VOTER_ID, String(v.id));
  write(KEYS.VOTER_NICKNAME, v.nickname);
  write(KEYS.SESSION_ID, String(v.sessionId));
}

export function clearStoredVoter() {
  write(KEYS.VOTER_TOKEN, null);
  write(KEYS.VOTER_ID, null);
  write(KEYS.SESSION_ID, null);
  // il nickname resta per precompilare il campo la prossima volta
}

export function getLastNickname(): string {
  return read(KEYS.VOTER_NICKNAME) ?? "";
}

export function getAdminToken(): string {
  return read(KEYS.ADMIN_TOKEN) ?? "";
}

export function setAdminToken(token: string) {
  write(KEYS.ADMIN_TOKEN, token);
}

export function clearAdminToken() {
  write(KEYS.ADMIN_TOKEN, null);
}

/** Header per le chiamate admin. */
export function adminRequest(): RequestInit {
  return { headers: { "x-admin-token": getAdminToken() } };
}
