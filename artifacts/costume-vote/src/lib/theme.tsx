import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import defaultLogo from "@assets/logo_ballo_dark_glow_1782294241374-jfuYTOf4.png";
import { optimizedImage } from "@/lib/images";

/**
 * Aspetto grafico modificabile dal pannello admin.
 * Il server salva solo ciò che l'admin cambia; qui ci sono i valori di partenza
 * (quelli originali dell'app) e la logica che li applica a tutte le pagine.
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

export const BG_DIRECTIONS = [
  { id: "su", label: "↑ Su", dx: 0, dy: -1 },
  { id: "giu", label: "↓ Giù", dx: 0, dy: 1 },
  { id: "sinistra", label: "← Sinistra", dx: -1, dy: 0 },
  { id: "destra", label: "→ Destra", dx: 1, dy: 0 },
  { id: "su-sinistra", label: "↖ Su a sinistra", dx: -1, dy: -1 },
  { id: "su-destra", label: "↗ Su a destra", dx: 1, dy: -1 },
  { id: "giu-sinistra", label: "↙ Giù a sinistra", dx: -1, dy: 1 },
  { id: "giu-destra", label: "↘ Giù a destra", dx: 1, dy: 1 },
] as const;

export const TEXT_FIELDS = [
  { key: "appTitle", label: "Nome della pagina (scheda del browser)", max: 60, page: "Generale" },
  { key: "homeTitle", label: "Titolo sotto il logo", max: 80, page: "Pagina iniziale" },
  { key: "homeSubtitle", label: "Sottotitolo sotto il logo", max: 160, page: "Pagina iniziale", multiline: true },
  { key: "voterButton", label: "Pulsante per i votanti", max: 40, page: "Pagina iniziale" },
  { key: "voterHint", label: "Spiegazione sotto il pulsante dei votanti", max: 160, page: "Pagina iniziale", multiline: true },
  { key: "adminButton", label: "Pulsante per gli organizzatori", max: 40, page: "Pagina iniziale" },
  { key: "nicknameLabel", label: "Etichetta del nickname", max: 40, page: "Ingresso votanti" },
  { key: "enterButton", label: "Pulsante per entrare", max: 30, page: "Ingresso votanti" },
  { key: "entryButton", label: "Pulsante iscrizione costume", max: 60, page: "Ingresso votanti" },
  { key: "waitingTitle", label: "Titolo prima dell'apertura", max: 80, page: "Ingresso votanti" },
  { key: "waitingText", label: "Testo prima dell'apertura", max: 200, page: "Ingresso votanti", multiline: true },
  { key: "voteTitle", label: "Titolo della pagina di voto", max: 40, page: "Voto" },
  { key: "thanksTitle", label: "Titolo dopo aver votato tutto", max: 40, page: "Voto" },
  { key: "thanksText", label: "Testo dopo aver votato tutto", max: 200, page: "Voto", multiline: true },
  { key: "closedTitle", label: "Titolo a votazioni chiuse", max: 60, page: "Votazioni chiuse" },
  { key: "closedSubtitle", label: "Sottotitolo a votazioni chiuse", max: 120, page: "Votazioni chiuse" },
  { key: "closedText", label: "Messaggio a votazioni chiuse", max: 240, page: "Votazioni chiuse", multiline: true },
] as const;

export type TextKey = (typeof TEXT_FIELDS)[number]["key"];

export type ThemeColors = { background: string; card: string; primary: string; text: string };

export type Theme = {
  colors: ThemeColors;
  titleFont: string;
  logo: { url: string | null; size: number };
  background: { imageUrl: string | null; size: number; opacity: number; animate: boolean; speed: number; direction: string };
  texts: Record<TextKey, string>;
};

/** Questi valori riproducono l'aspetto originale dell'app. */
export const DEFAULT_THEME: Theme = {
  colors: { background: "#08190f", card: "#0f2a1c", primary: "#ffbf00", text: "#fff6db" },
  titleFont: "Playfair Display",
  logo: { url: null, size: 88 },
  background: { imageUrl: "/pattern%201.2.jpg", size: 327, opacity: 0.07, animate: true, speed: 16, direction: "giu-sinistra" },
  texts: {
    appTitle: "Camelot's Tales – Vota i costumi",
    homeTitle: "",
    homeSubtitle: "",
    voterButton: "Entra come votante",
    voterHint: "Vota i costumi della serata o iscrivi il tuo con una foto.",
    adminButton: "Area organizzatori",
    nicknameLabel: "Il tuo nickname",
    enterButton: "Entra e Vota",
    entryButton: "Sei in costume? Iscriviti al contest",
    waitingTitle: "Le votazioni non sono ancora iniziate",
    waitingText: "Tieni aperta questa pagina: si aggiornerà da sola appena si apre il voto.",
    voteTitle: "Vota i Costumi",
    thanksTitle: "Grazie!",
    thanksText: "Hai votato tutti i costumi. Attendi il verdetto dell'araldo.",
    closedTitle: "Votazioni Chiuse",
    closedSubtitle: "Le votazioni sono terminate.",
    closedText: "Attendi gli annunci dell'araldo: il vincitore del concorso di costumi verrà rivelato a breve.",
  },
};

export const PRESETS: { name: string; colors: ThemeColors }[] = [
  { name: "Camelot (originale)", colors: DEFAULT_THEME.colors },
  { name: "Notte reale", colors: { background: "#0a0f24", card: "#141c3a", primary: "#d8b45a", text: "#eef1ff" } },
  { name: "Bordeaux", colors: { background: "#1c0a10", card: "#2e1119", primary: "#e8b04a", text: "#fbeee6" } },
  { name: "Carnevale", colors: { background: "#16092a", card: "#251242", primary: "#ff5fa2", text: "#f8efff" } },
  { name: "Pergamena", colors: { background: "#efe4c8", card: "#fbf5e6", primary: "#8b1a1a", text: "#2a1a0a" } },
  { name: "Ghiaccio", colors: { background: "#0b1d26", card: "#12303d", primary: "#7fe3ff", text: "#eafaff" } },
];

/** Unisce il tema salvato (parziale) con i valori di partenza. */
export function mergeTheme(saved: any): Theme {
  const s = saved && typeof saved === "object" ? saved : {};
  return {
    colors: { ...DEFAULT_THEME.colors, ...(s.colors ?? {}) },
    titleFont: s.titleFont ?? DEFAULT_THEME.titleFont,
    logo: { ...DEFAULT_THEME.logo, ...(s.logo ?? {}) },
    background: { ...DEFAULT_THEME.background, ...(s.background ?? {}) },
    texts: { ...DEFAULT_THEME.texts, ...Object.fromEntries(Object.entries(s.texts ?? {}).filter(([, v]) => !!v)) } as Theme["texts"],
  };
}

/** Salva solo le differenze rispetto ai valori di partenza. */
export function diffTheme(t: Theme) {
  const out: any = {};
  const colors = Object.fromEntries(Object.entries(t.colors).filter(([k, v]) => v !== (DEFAULT_THEME.colors as any)[k]));
  if (Object.keys(colors).length) out.colors = colors;
  if (t.titleFont !== DEFAULT_THEME.titleFont) out.titleFont = t.titleFont;
  const logo = Object.fromEntries(Object.entries(t.logo).filter(([k, v]) => v !== (DEFAULT_THEME.logo as any)[k]));
  if (Object.keys(logo).length) out.logo = logo;
  const bg = Object.fromEntries(Object.entries(t.background).filter(([k, v]) => v !== (DEFAULT_THEME.background as any)[k]));
  if (Object.keys(bg).length) out.background = bg;
  const texts = Object.fromEntries(Object.entries(t.texts).filter(([k, v]) => v.trim() !== (DEFAULT_THEME.texts as any)[k]));
  if (Object.keys(texts).length) out.texts = texts;
  return out;
}

// ---------------------------------------------------------------------------
// Colori
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** "H S% L%" come lo vogliono le variabili CSS dell'app. */
function hsl(hex: string): string {
  let [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function luminance(hex: string) {
  const c = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Testo sui pulsanti: lo sfondo o il testo dell'app, quello che si legge meglio. */
function onPrimary(c: ThemeColors) {
  return contrast(c.primary, c.background) >= contrast(c.primary, c.text) ? c.background : c.text;
}

export function cssVariables(c: ThemeColors): Record<string, string> {
  const border = mix(c.card, c.text, 0.16);
  const muted = mix(c.card, c.text, 0.07);
  const mutedFg = mix(c.text, c.background, 0.38);
  return {
    "--background": hsl(c.background),
    "--foreground": hsl(c.text),
    "--card": hsl(c.card),
    "--card-foreground": hsl(c.text),
    "--card-border": hsl(border),
    "--popover": hsl(c.card),
    "--popover-foreground": hsl(c.text),
    "--popover-border": hsl(border),
    "--border": hsl(border),
    "--input": hsl(border),
    "--ring": hsl(c.primary),
    "--primary": hsl(c.primary),
    "--primary-foreground": hsl(onPrimary(c)),
    "--muted": hsl(muted),
    "--muted-foreground": hsl(mutedFg),
  };
}

// ---------------------------------------------------------------------------
// Applicazione alla pagina
// ---------------------------------------------------------------------------

const loadedFonts = new Set<string>(["Playfair Display", "DM Sans"]);

export function loadFont(name: string) {
  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(cssVariables(t.colors))) root.style.setProperty(k, v);
  loadFont(t.titleFont);
  root.style.setProperty("--app-font-serif", `'${t.titleFont}', serif`);
  document.title = t.texts.appTitle || DEFAULT_THEME.texts.appTitle;
}

const CACHE_KEY = "themeCache";

function readCache(): Theme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? mergeTheme(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(saved: unknown) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
  } catch {
    // ignorato
  }
}

type Ctx = {
  theme: Theme;
  /** Tema salvato sul server (senza modifiche in anteprima). */
  saved: Theme;
  /** Anteprima dal vivo nel pannello admin (null = nessuna anteprima). */
  setPreview: (t: Theme | null) => void;
  /** Dopo un salvataggio: aggiorna il tema per tutta l'app. */
  setSaved: (savedPartial: unknown) => void;
  logoSrc: string;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [saved, setSavedState] = useState<Theme>(() => readCache() ?? DEFAULT_THEME);
  const [preview, setPreview] = useState<Theme | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/theme")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        writeCache(d.theme);
        setSavedState(mergeTheme(d.theme));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const theme = preview ?? saved;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setSaved = useCallback((partial: unknown) => {
    writeCache(partial);
    setSavedState(mergeTheme(partial));
  }, []);

  const value = useMemo<Ctx>(
    () => ({ theme, saved, setPreview, setSaved, logoSrc: theme.logo.url ? optimizedImage(theme.logo.url, 900) : defaultLogo }),
    [theme, saved, setSaved],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme fuori da ThemeProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Sfondo a motivo con movimento
// ---------------------------------------------------------------------------

export function BackgroundPattern({ fixed = true }: { fixed?: boolean }) {
  const { theme } = useTheme();
  const bg = theme.background;
  if (!bg.imageUrl || bg.opacity <= 0) return null;
  const dir = BG_DIRECTIONS.find((d) => d.id === bg.direction) ?? BG_DIRECTIONS[6];
  const name = `bgmove-${dir.id}-${bg.size}`;
  // Spostamento di esattamente una piastrella: il movimento si ripete senza scatti
  const keyframes = `@keyframes ${name} { from { background-position: 0px 0px; } to { background-position: ${dir.dx * bg.size}px ${dir.dy * bg.size}px; } }`;
  return (
    <>
      {bg.animate && <style>{keyframes}</style>}
      <div
        aria-hidden="true"
        style={{
          position: fixed ? "fixed" : "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url("${optimizedImage(bg.imageUrl, Math.min(1600, bg.size * 2))}")`,
          backgroundSize: `${bg.size}px ${bg.size}px`,
          backgroundRepeat: "repeat",
          // su sfondi chiari "screen" schiarirebbe tutto: si usa "multiply"
          mixBlendMode: luminance(theme.colors.background) > 0.4 ? "multiply" : "screen",
          opacity: bg.opacity,
          animation: bg.animate ? `${name} ${bg.speed}s linear infinite` : undefined,
        }}
      />
    </>
  );
}
