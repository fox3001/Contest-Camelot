/**
 * Aspetto grafico modificabile dall'admin.
 * Il server salva solo i valori che l'admin ha cambiato; i default stanno nel frontend.
 * Qui si valida tutto ciò che arriva, scartando i campi sconosciuti o non validi.
 */

export const TITLE_FONTS = [
  "Playfair Display",
  "Cinzel",
  "Cinzel Decorative",
  "IM Fell English",
  "Cormorant Garamond",
  "Uncial Antiqua",
  "MedievalSharp",
  "Almendra",
  "DM Sans",
] as const;

export const BG_DIRECTIONS = ["su", "giu", "sinistra", "destra", "su-sinistra", "su-destra", "giu-sinistra", "giu-destra"] as const;

export const TEXT_KEYS = {
  appTitle: 60,
  homeTitle: 80,
  homeSubtitle: 160,
  nicknameLabel: 40,
  enterButton: 30,
  waitingTitle: 80,
  waitingText: 200,
  entryButton: 60,
  voteTitle: 40,
  thanksTitle: 40,
  thanksText: 200,
  closedTitle: 60,
  closedSubtitle: 120,
  closedText: 240,
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS = ["background", "card", "primary", "text"] as const;

function cleanUrl(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  if (s.length > 500) return undefined;
  if (/^https:\/\/[^\s"'()<>]+$/.test(s) || /^\/[\w\-./%]+$/.test(s)) return s;
  return undefined;
}

function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function cleanText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

export type Theme = {
  colors?: Partial<Record<(typeof COLOR_KEYS)[number], string>>;
  titleFont?: string;
  logo?: { url?: string | null; size?: number };
  background?: {
    imageUrl?: string | null;
    size?: number;
    opacity?: number;
    animate?: boolean;
    speed?: number;
    direction?: string;
  };
  texts?: Partial<Record<keyof typeof TEXT_KEYS, string>>;
};

/** Ritorna un tema pulito: solo campi noti e valori validi. */
export function sanitizeTheme(input: any): Theme {
  const out: Theme = {};
  if (input && typeof input === "object") {
    if (input.colors && typeof input.colors === "object") {
      const colors: Theme["colors"] = {};
      for (const k of COLOR_KEYS) {
        const v = input.colors[k];
        if (typeof v === "string" && HEX.test(v)) colors[k] = v.toLowerCase();
      }
      if (Object.keys(colors).length) out.colors = colors;
    }
    if (typeof input.titleFont === "string" && (TITLE_FONTS as readonly string[]).includes(input.titleFont)) {
      out.titleFont = input.titleFont;
    }
    if (input.logo && typeof input.logo === "object") {
      const logo: NonNullable<Theme["logo"]> = {};
      const url = cleanUrl(input.logo.url);
      if (url !== undefined) logo.url = url;
      const size = num(input.logo.size, 30, 100);
      if (size !== undefined) logo.size = size;
      if (Object.keys(logo).length) out.logo = logo;
    }
    if (input.background && typeof input.background === "object") {
      const b = input.background;
      const bg: NonNullable<Theme["background"]> = {};
      const url = cleanUrl(b.imageUrl);
      if (url !== undefined) bg.imageUrl = url;
      const size = num(b.size, 60, 1200);
      if (size !== undefined) bg.size = Math.round(size);
      const opacity = num(b.opacity, 0, 1);
      if (opacity !== undefined) bg.opacity = Math.round(opacity * 100) / 100;
      if (typeof b.animate === "boolean") bg.animate = b.animate;
      const speed = num(b.speed, 3, 300);
      if (speed !== undefined) bg.speed = Math.round(speed);
      if (typeof b.direction === "string" && (BG_DIRECTIONS as readonly string[]).includes(b.direction)) bg.direction = b.direction;
      if (Object.keys(bg).length) out.background = bg;
    }
    if (input.texts && typeof input.texts === "object") {
      const texts: Theme["texts"] = {};
      for (const [k, max] of Object.entries(TEXT_KEYS)) {
        const v = cleanText(input.texts[k], max);
        if (v) texts[k as keyof typeof TEXT_KEYS] = v;
      }
      if (Object.keys(texts).length) out.texts = texts;
    }
  }
  return out;
}
