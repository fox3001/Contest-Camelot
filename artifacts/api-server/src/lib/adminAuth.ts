import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

/**
 * Autenticazione admin.
 * - La password arriva SOLO da ADMIN_PASSWORD (nessun valore di default nel codice).
 * - Il token restituito al login è firmato (HMAC) e scade dopo TOKEN_TTL_MS.
 *   La chiave di firma è ADMIN_TOKEN se impostata, altrimenti una chiave casuale
 *   generata all'avvio (i login scadono a ogni riavvio del server).
 * - I tentativi di login sbagliati sono limitati per IP.
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 ore
const MAX_FAILED_ATTEMPTS = 8;
const FAILED_WINDOW_MS = 10 * 60 * 1000; // 10 minuti

const ENV_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || "";
// Password in uso: quella cambiata dal pannello (salvata nel database) oppure quella di Render
let currentPassword = ENV_PASSWORD;
const SIGNING_SECRET = process.env.ADMIN_TOKEN?.trim() || randomBytes(32).toString("hex");

if (!ENV_PASSWORD) {
  logger.warn("ADMIN_PASSWORD non impostata: serve una password salvata dal pannello per entrare.");
}
if (!process.env.ADMIN_TOKEN) {
  logger.warn("ADMIN_TOKEN non impostata: uso una chiave casuale, i login admin scadono a ogni riavvio.");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sign(payload: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
}

export function isLoginConfigured(): boolean {
  return currentPassword.length > 0;
}

export function getCurrentPassword(): string {
  return currentPassword;
}

/** Imposta la password in uso (chiamata all'avvio e dopo un cambio dal pannello). */
export function useAdminPassword(password: string) {
  currentPassword = password;
}

export function checkPassword(password: unknown): boolean {
  if (!currentPassword || typeof password !== "string") return false;
  return safeEqual(password, currentPassword);
}

// Il token porta un'impronta della password: cambiandola, i vecchi accessi scadono
function passwordTag(): string {
  return createHmac("sha256", SIGNING_SECRET).update("pw:" + currentPassword).digest("hex").slice(0, 12);
}

export function issueToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `admin.${exp}.${passwordTag()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "admin") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  if (parts[2] !== passwordTag()) return false;
  return safeEqual(parts[3], sign(`${parts[0]}.${parts[1]}.${parts[2]}`));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!verifyToken(req.headers["x-admin-token"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// --- limite tentativi di login per IP -------------------------------------
const failed = new Map<string, { count: number; resetAt: number }>();

export function loginBlocked(ip: string): boolean {
  const entry = failed.get(ip);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failed.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const entry = failed.get(ip);
  if (!entry || entry.resetAt < now) {
    failed.set(ip, { count: 1, resetAt: now + FAILED_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailedLogins(ip: string) {
  failed.delete(ip);
}
