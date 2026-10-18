import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { adminRequest, clearAdminToken, getAdminToken } from "@/lib/storage";
import {
  compressImage,
  explainUploadError,
  optimizedImage,
  uploadWithProgress,
} from "@/lib/images";
import {
  BG_DIRECTIONS,
  BODY_FONTS,
  DEFAULT_THEME,
  FONT_NAME,
  THEME_PRESETS,
  PRESETS,
  TEXT_FIELDS,
  TITLE_FONTS,
  contrast,
  diffTheme,
  loadFont,
  mergeTheme,
  useTheme,
  type Theme,
  type ThemeColors,
} from "@/lib/theme";
import defaultLogo from "@assets/logo_ballo_dark_glow_1782294241374-jfuYTOf4.png";

const inputClass =
  "w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const COLOR_LABELS: { key: keyof ThemeColors; label: string; hint: string }[] =
  [
    {
      key: "background",
      label: "Sfondo",
      hint: "Il colore di fondo di tutte le pagine",
    },
    {
      key: "card",
      label: "Riquadri",
      hint: "Schede dei costumi, moduli, finestre",
    },
    {
      key: "primary",
      label: "Colore principale",
      hint: "Pulsanti, stelle, titoli evidenziati",
    },
    { key: "text", label: "Testo", hint: "Il colore delle scritte" },
    {
      key: "glow",
      label: "Bagliore",
      hint: "La luce sfumata in cima alle pagine",
    },
  ];

// Velocità: il cursore va da lento a veloce, il tema salva i secondi per un passo del motivo
const SPEED_MIN = 4;
const SPEED_MAX = 80;
const toSlider = (seconds: number) =>
  Math.round(((SPEED_MAX - seconds) / (SPEED_MAX - SPEED_MIN)) * 100);
const fromSlider = (v: number) =>
  Math.round(SPEED_MAX - (v / 100) * (SPEED_MAX - SPEED_MIN));

function Section({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-2xl shadow overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-base font-medium text-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`w-5 h-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>{label}</span>
        <span className="text-foreground">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[hsl(var(--primary))]"
      />
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-12 h-7 rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-background transition-all ${checked ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

/** Carica un'immagine su Cloudinary (firma dal server) oppure accetta un link. */
function ImagePicker({
  label,
  value,
  defaultValue,
  defaultLabel,
  onChange,
  allowNone,
}: {
  label: string;
  value: string | null;
  defaultValue: string | null;
  defaultLabel: string;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/"))
      return setError("Scegli un'immagine (PNG, JPG, WebP o SVG).");
    if (file.size > 30 * 1024 * 1024)
      return setError("Immagine troppo grande (massimo 30 MB).");
    try {
      setProgress(0);
      // Le foto grandi (es. sfondo a tutto schermo scattato col telefono) vengono rimpicciolite;
      // PNG e SVG restano come sono per non perdere la trasparenza
      let data: Blob = file;
      if (file.size > 4 * 1024 * 1024 && !/png|svg|gif/.test(file.type))
        data = await compressImage(file);
      if (data.size > 10 * 1024 * 1024) throw new Error("big");
      const r = await fetch("/api/admin/uploads/sign", {
        method: "POST",
        ...adminRequest(),
      });
      if (r.status === 503) throw new Error("cloudinary");
      const sign = await r.json();
      if (!r.ok) throw new Error("sign");
      const form = new FormData();
      form.append("file", data);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("folder", sign.folder);
      form.append("signature", sign.signature);
      const res = await uploadWithProgress(sign.uploadUrl, form, setProgress);
      onChange(res.secure_url);
    } catch (e: any) {
      setError(
        e?.message === "cloudinary"
          ? "Caricamento non disponibile (Cloudinary non configurato): usa un link."
          : e?.message === "big"
            ? "Immagine troppo grande (massimo 10 MB): prova un PNG più leggero."
            : explainUploadError(e, true) ||
              "Caricamento non riuscito, riprova.",
      );
    } finally {
      setProgress(null);
    }
  };

  const isDefault = value === defaultValue;
  const shown = value ? optimizedImage(value, 400) : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-xl border border-border bg-background/60 overflow-hidden flex items-center justify-center shrink-0">
          {shown ? (
            <img
              src={shown}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">nessuna</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
            aria-label={`Carica ${label}`}
          />
          <button
            type="button"
            disabled={progress !== null}
            onClick={() => inputRef.current?.click()}
            className="bg-primary text-primary-foreground text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50"
          >
            {progress !== null
              ? `Caricamento ${Math.round(progress * 100)}%`
              : "Carica immagine"}
          </button>
          <button
            type="button"
            onClick={() => setShowLink((v) => !v)}
            className="bg-muted text-foreground text-xs rounded-lg px-3 py-2"
          >
            Incolla link
          </button>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="bg-muted text-foreground text-xs rounded-lg px-3 py-2"
            >
              {defaultLabel}
            </button>
          )}
          {allowNone && value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="bg-muted text-foreground text-xs rounded-lg px-3 py-2"
            >
              Nessuna
            </button>
          )}
        </div>
      </div>
      {showLink && (
        <div className="flex gap-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => {
              if (/^https:\/\/\S+$/.test(link.trim())) {
                onChange(link.trim());
                setShowLink(false);
                setLink("");
                setError("");
              } else setError("Il link deve iniziare con https://");
            }}
            className="bg-primary text-primary-foreground text-xs font-semibold rounded-lg px-4"
          >
            Usa
          </button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Anteprima di come appare la home al telefono, con i colori in modifica. */
function FontPicker({
  fonts,
  value,
  sample,
  fallback,
  onChange,
}: {
  fonts: readonly string[];
  value: string;
  sample: string;
  fallback: string;
  onChange: (f: string) => void;
}) {
  const custom = !fonts.includes(value);
  const [name, setName] = useState(custom ? value : "");
  const valid = FONT_NAME.test(name.trim());
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {fonts.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={`rounded-xl border px-4 py-3 text-left transition ${value === f ? "border-primary bg-primary/10" : "border-border"}`}
            aria-pressed={value === f}
          >
            <span
              className="block text-xl text-foreground"
              style={{ fontFamily: `'${f}', ${fallback}` }}
            >
              {sample}
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {f}
            </span>
          </button>
        ))}
      </div>
      <div
        className={`rounded-xl border p-3 space-y-2 ${custom ? "border-primary bg-primary/10" : "border-border"}`}
      >
        <p className="text-xs text-muted-foreground">
          Oppure scrivi il nome esatto di un carattere di{" "}
          <a
            href="https://fonts.google.com"
            target="_blank"
            rel="noreferrer"
            className="underline text-primary"
          >
            Google Fonts
          </a>
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="es. Norse, Jacquard 24…"
            className={inputClass}
            aria-label="Nome del carattere"
          />
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              const f = name.trim().replace(/\s+/g, " ");
              loadFont(f);
              onChange(f);
            }}
            className="shrink-0 bg-primary text-primary-foreground rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
          >
            Usa
          </button>
        </div>
        {custom && (
          <p
            className="text-lg text-foreground"
            style={{ fontFamily: `'${value}', ${fallback}` }}
          >
            {sample}{" "}
            <span className="text-[11px] text-muted-foreground font-sans">
              ({value})
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

type SavedTheme = { name: string; theme: any; savedAt: string };

function Preview({ draft, logoSrc }: { draft: Theme; logoSrc: string }) {
  return (
    <div
      className="rounded-2xl border border-border overflow-hidden relative"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="relative z-[1] px-5 pt-5 pb-6 flex flex-col items-center">
        <img
          src={logoSrc}
          alt=""
          style={{ width: `${draft.logo.size * 0.6}%` }}
          className="h-auto object-contain mb-2"
        />
        {draft.texts.homeTitle && (
          <p className="font-serif text-primary text-lg text-center leading-tight">
            {draft.texts.homeTitle}
          </p>
        )}
        {draft.texts.homeSubtitle && (
          <p className="text-[11px] text-muted-foreground text-center mt-1 whitespace-pre-line">
            {draft.texts.homeSubtitle}
          </p>
        )}
        <div className="w-full bg-card border border-border rounded-xl p-3 mt-3">
          <p className="text-xs text-foreground mb-1.5">
            {draft.texts.nicknameLabel}
          </p>
          <div className="bg-background border border-input rounded-lg px-3 py-2 text-xs text-muted-foreground">
            es. Veneziano23
          </div>
          <div className="mt-2 bg-primary text-primary-foreground rounded-lg py-2 text-center text-xs font-semibold">
            {draft.texts.enterButton}
          </div>
        </div>
        <div className="w-full bg-card border border-border rounded-xl p-3 mt-3 text-center">
          <p className="font-serif text-foreground text-sm">
            Costume di esempio
          </p>
          <p className="text-primary text-lg leading-none mt-1 tracking-widest">
            ★★★★<span className="text-muted-foreground/60">★</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminAspetto() {
  const [, setLocation] = useLocation();
  const { saved, setPreview, setSaved } = useTheme();
  const [draft, setDraft] = useState<Theme>(saved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const loadedSaved = useRef(saved);
  const [myThemes, setMyThemes] = useState<SavedTheme[]>([]);
  const [themeName, setThemeName] = useState("");
  const [themeMsg, setThemeMsg] = useState("");

  const themesRequest = async (method: string, body?: unknown) => {
    const r = await fetch("/api/admin/themes", {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(adminRequest().headers as Record<string, string>),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401) {
      clearAdminToken();
      setLocation("/admin");
      throw new Error("401");
    }
    if (!r.ok) throw new Error();
    const d = await r.json();
    setMyThemes(d.themes ?? []);
  };

  useEffect(() => {
    themesRequest("GET").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!getAdminToken()) setLocation("/admin");
  }, [setLocation]);

  // Se il tema salvato arriva dal server dopo l'apertura, riparto da quello
  useEffect(() => {
    if (
      loadedSaved.current !== saved &&
      JSON.stringify(diffTheme(draft)) ===
        JSON.stringify(diffTheme(loadedSaved.current))
    ) {
      setDraft(saved);
    }
    loadedSaved.current = saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  // Font dell'elenco caricati per mostrarne l'anteprima
  useEffect(() => {
    TITLE_FONTS.forEach(loadFont);
    BODY_FONTS.forEach(loadFont);
    THEME_PRESETS.forEach((p) => {
      if (p.theme.titleFont) loadFont(p.theme.titleFont);
    });
  }, []);

  const normalized = useMemo(() => mergeTheme(diffTheme(draft)), [draft]);
  const dirty =
    JSON.stringify(diffTheme(draft)) !== JSON.stringify(diffTheme(saved));

  // Anteprima dal vivo su tutta l'app mentre si modifica
  useEffect(() => {
    setPreview(normalized);
  }, [normalized, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Theme>(key: K, value: Partial<Theme[K]>) =>
    setDraft((d) => ({
      ...d,
      [key]: { ...(d[key] as object), ...(value as object) } as Theme[K],
    }));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/theme", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(adminRequest().headers as Record<string, string>),
        },
        body: JSON.stringify({ theme: diffTheme(draft) }),
      });
      if (r.status === 401) {
        clearAdminToken();
        setLocation("/admin");
        return;
      }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSaved(d.theme);
      setDraft(mergeTheme(d.theme));
      setMessage({
        ok: true,
        text: "Salvato: tutti i votanti vedranno il nuovo aspetto al prossimo caricamento della pagina.",
      });
    } catch {
      setMessage({ ok: false, text: "Salvataggio non riuscito, riprova." });
    } finally {
      setSaving(false);
    }
  };

  const textContrast = contrast(
    normalized.colors.text,
    normalized.colors.background,
  );
  const cardContrast = contrast(normalized.colors.text, normalized.colors.card);
  const primaryContrast = contrast(
    normalized.colors.primary,
    normalized.colors.background,
  );
  const warnings = [
    textContrast < 4.5 && "Il testo si legge male sullo sfondo.",
    cardContrast < 4.5 && "Il testo si legge male dentro i riquadri.",
    primaryContrast < 2.5 &&
      "Il colore principale si distingue poco dallo sfondo.",
  ].filter(Boolean) as string[];

  const groups = TEXT_FIELDS.reduce<
    Record<string, (typeof TEXT_FIELDS)[number][]>
  >((acc, f) => {
    (acc[f.page] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="min-h-screen pb-32">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => setLocation("/admin/dashboard")}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Indietro"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-serif text-foreground">Aspetto</h1>
            <p className="text-xs text-muted-foreground">
              Le modifiche si vedono subito qui; i votanti le vedono dopo il
              salvataggio.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <Preview
          draft={normalized}
          logoSrc={
            normalized.logo.url
              ? optimizedImage(normalized.logo.url, 600)
              : defaultLogo
          }
        />

        <Section
          title="Temi"
          subtitle="Cambia tutto in un colpo: colori, caratteri, sfondo e testi"
          defaultOpen
        >
          <p className="text-xs text-muted-foreground">
            Temi pronti (poi puoi ritoccare tutto qui sotto):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((p) => {
              const t = mergeTheme(p.theme);
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setDraft(mergeTheme(p.theme))}
                  className="rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary/60 transition"
                  style={{ background: t.colors.background }}
                >
                  <span
                    className="block text-base truncate"
                    style={{
                      fontFamily: `'${t.titleFont}', serif`,
                      color: t.colors.primary,
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="block text-[10px] truncate"
                    style={{
                      color: t.colors.text,
                      fontFamily: `'${t.bodyFont}', sans-serif`,
                    }}
                  >
                    {t.titleFont} · {t.bodyFont}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              I miei temi: salva l'aspetto che vedi ora (anche senza applicarlo)
              per riusarlo a un altro evento.
            </p>
            <div className="flex gap-2">
              <input
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                maxLength={40}
                placeholder="Nome, es. Serata vichinga"
                className={inputClass}
                aria-label="Nome del tema"
              />
              <button
                type="button"
                disabled={!themeName.trim()}
                onClick={async () => {
                  try {
                    await themesRequest("POST", {
                      name: themeName.trim(),
                      theme: diffTheme(draft),
                    });
                    setThemeMsg(
                      `Tema "${themeName.trim()}" salvato tra i tuoi temi.`,
                    );
                    setThemeName("");
                  } catch {
                    setThemeMsg("Non è stato possibile salvare il tema.");
                  }
                }}
                className="shrink-0 bg-primary text-primary-foreground rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
              >
                Salva tema
              </button>
            </div>
            {themeMsg && <p className="text-xs text-primary">{themeMsg}</p>}
            {myThemes.length > 0 && (
              <ul className="space-y-1.5">
                {myThemes.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <span className="text-sm text-foreground truncate flex-1">
                      {t.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft(mergeTheme(t.theme))}
                      className="text-xs text-primary font-medium px-2 py-1"
                      aria-label={`Carica ${t.name}`}
                    >
                      Carica
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        themesRequest("DELETE", { name: t.name }).catch(
                          () => {},
                        )
                      }
                      className="text-xs text-muted-foreground px-2 py-1"
                      aria-label={`Elimina ${t.name}`}
                    >
                      Elimina
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              Caricare un tema cambia l'anteprima: per mostrarlo ai votanti
              premi Salva in basso.
            </p>
          </div>
        </Section>

        <Section
          title="Colori"
          subtitle="Combinazioni pronte o colori a scelta"
        >
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => set("colors", p.colors)}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-left hover:border-primary/60 transition"
              >
                <span className="flex -space-x-1 shrink-0">
                  {(["background", "card", "primary", "text"] as const).map(
                    (k) => (
                      <span
                        key={k}
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ background: p.colors[k] }}
                      />
                    ),
                  )}
                </span>
                <span className="text-xs text-foreground truncate">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {COLOR_LABELS.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={draft.colors[key]}
                  onChange={(e) =>
                    set("colors", {
                      [key]: e.target.value,
                    } as Partial<ThemeColors>)
                  }
                  className="w-12 h-12 rounded-xl border border-border bg-transparent cursor-pointer shrink-0"
                  aria-label={label}
                />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {draft.colors[key]}
                </span>
              </div>
            ))}
          </div>
          {warnings.length > 0 && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-foreground space-y-1">
              {warnings.map((w) => (
                <p key={w}>⚠ {w}</p>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Sfondo"
          subtitle="Motivo ripetuto o immagine intera dietro le pagine"
        >
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["tile", "Motivo ripetuto"],
                ["cover", "Immagine intera"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => set("background", { mode: id })}
                className={`rounded-lg py-2 text-xs border transition ${draft.background.mode === id ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground"}`}
                aria-pressed={draft.background.mode === id}
              >
                {label}
              </button>
            ))}
          </div>
          <ImagePicker
            label={
              draft.background.mode === "cover"
                ? "Immagine di sfondo"
                : "Immagine del motivo"
            }
            value={draft.background.imageUrl}
            defaultValue={DEFAULT_THEME.background.imageUrl}
            defaultLabel="Motivo originale"
            onChange={(v) => set("background", { imageUrl: v })}
            allowNone
          />
          {draft.background.mode !== "cover" && (
            <Slider
              label="Dimensione del motivo"
              value={draft.background.size}
              min={60}
              max={800}
              step={10}
              onChange={(v) => set("background", { size: v })}
              display={`${draft.background.size} px`}
            />
          )}
          <Slider
            label="Intensità"
            value={Math.round(draft.background.opacity * 100)}
            min={0}
            max={60}
            onChange={(v) => set("background", { opacity: v / 100 })}
            display={`${Math.round(draft.background.opacity * 100)}%`}
          />
          {draft.background.mode !== "cover" && (
            <>
              <Toggle
                label="Movimento"
                checked={draft.background.animate}
                onChange={(v) => set("background", { animate: v })}
              />
              {draft.background.animate && (
                <>
                  <Slider
                    label="Velocità"
                    value={toSlider(draft.background.speed)}
                    min={0}
                    max={100}
                    onChange={(v) =>
                      set("background", { speed: fromSlider(v) })
                    }
                    display={
                      toSlider(draft.background.speed) < 34
                        ? "lenta"
                        : toSlider(draft.background.speed) < 67
                          ? "media"
                          : "veloce"
                    }
                  />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Direzione
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BG_DIRECTIONS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => set("background", { direction: d.id })}
                          className={`rounded-lg py-2 text-xs border transition ${draft.background.direction === d.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground"}`}
                          title={d.label}
                          aria-label={`Direzione ${d.label}`}
                          aria-pressed={draft.background.direction === d.id}
                        >
                          {d.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </Section>

        <Section title="Logo" subtitle="Immagine in cima alla home">
          <ImagePicker
            label="Logo"
            value={draft.logo.url}
            defaultValue={DEFAULT_THEME.logo.url}
            defaultLabel="Logo originale"
            onChange={(v) => set("logo", { url: v })}
          />
          <Slider
            label="Dimensione"
            value={draft.logo.size}
            min={30}
            max={100}
            onChange={(v) => set("logo", { size: v })}
            display={`${draft.logo.size}%`}
          />
        </Section>

        <Section title="Carattere dei titoli" subtitle={draft.titleFont}>
          <FontPicker
            fonts={TITLE_FONTS}
            value={draft.titleFont}
            sample="Vota i Costumi"
            fallback="serif"
            onChange={(f) => setDraft((d) => ({ ...d, titleFont: f }))}
          />
        </Section>

        <Section title="Carattere dei testi" subtitle={draft.bodyFont}>
          <FontPicker
            fonts={BODY_FONTS}
            value={draft.bodyFont}
            sample="Tocca le stelle per votare"
            fallback="sans-serif"
            onChange={(f) => setDraft((d) => ({ ...d, bodyFont: f }))}
          />
        </Section>

        <Section
          title="Titoli e messaggi"
          subtitle="Tutte le scritte che compaiono sullo schermo"
        >
          <p className="text-xs text-muted-foreground">
            Lascia vuoto per usare il testo originale. Le parole tra graffe,
            come {"{nome}"} o {"{vincitore}"}, vengono sostituite in automatico.
          </p>
          {Object.entries(groups).map(([page, fields]) => (
            <div key={page} className="space-y-3">
              <p className="text-xs font-medium text-primary uppercase tracking-widest pt-1">
                {page}
              </p>
              {fields.map((f) => {
                const common = {
                  id: `t-${f.key}`,
                  value: draft.texts[f.key],
                  maxLength: f.max,
                  placeholder: DEFAULT_THEME.texts[f.key] || "(vuoto)",
                  className: inputClass,
                };
                return (
                  <label key={f.key} className="block" htmlFor={common.id}>
                    <span className="block text-xs text-muted-foreground mb-1">
                      {f.label}
                    </span>
                    {"multiline" in f && f.multiline ? (
                      <textarea
                        {...common}
                        rows={2}
                        onChange={(e) =>
                          set("texts", { [f.key]: e.target.value } as any)
                        }
                      />
                    ) : (
                      <input
                        {...common}
                        type="text"
                        onChange={(e) =>
                          set("texts", { [f.key]: e.target.value } as any)
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
          ))}
        </Section>

        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="w-full text-xs text-muted-foreground underline underline-offset-4 py-2"
        >
          Ripristina l'aspetto originale
        </button>
      </div>

      {/* Barra di salvataggio */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-background/90 backdrop-blur-md border-t border-border px-4 py-3">
        <div className="max-w-lg mx-auto space-y-2">
          {message && (
            <p
              className={`text-xs ${message.ok ? "text-primary" : "text-destructive"}`}
            >
              {message.text}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(saved);
                setMessage(null);
              }}
              className="flex-1 bg-muted text-foreground rounded-xl py-3 text-sm font-medium disabled:opacity-40"
            >
              Annulla modifiche
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
            >
              {saving ? "Salvataggio..." : dirty ? "Salva" : "Salvato"}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setConfirmReset(false)}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg"
            >
              <h2 className="text-lg font-serif text-foreground mb-1">
                Tornare all'aspetto originale?
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Colori, caratteri, sfondo, logo e testi tornano quelli di
                partenza. Diventa definitivo solo quando premi Salva.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 bg-muted text-foreground rounded-xl py-3 font-medium"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    setDraft(DEFAULT_THEME);
                    setConfirmReset(false);
                  }}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold"
                >
                  Ripristina
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
