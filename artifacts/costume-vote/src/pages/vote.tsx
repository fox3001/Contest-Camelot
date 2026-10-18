import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useListCostumes, useGetActiveSession, getGetActiveSessionQueryKey } from "@workspace/api-client-react";
import { clearStoredVoter, getDeviceId, getStoredVoter } from "@/lib/storage";
import { optimizedImage } from "@/lib/images";
import { useTheme } from "@/lib/theme";
import { OrganizerLink } from "@/components/OrganizerLink";
import { VoterTabs } from "@/components/VoterTabs";
import { QrScanner } from "@/components/QrScanner";
import { CATCH_ERRORS, catchCostume } from "@/lib/hunt";

type SaveState = "saving" | "saved" | "error";

function StarRating({
  score,
  onChange,
  costumeId,
  disabled,
}: {
  score: number;
  onChange: (costumeId: number, score: number) => void;
  costumeId: number;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(costumeId, star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-1 transition-transform hover:scale-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label={`Voto ${star}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-9 h-9 transition-all duration-150"
            fill={star <= (hovered || score) ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: star <= (hovered || score) ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.6)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** Mescolamento deterministico: ogni votante vede un ordine diverso ma stabile. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function Vote() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<Record<number, SaveState>>({});
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  const stored = getStoredVoter();
  const voterToken = stored?.token ?? null;
  const { data: session } = useGetActiveSession({ query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 4000 } });
  // Si aggiorna da sola: i costumi approvati compaiono senza ricaricare la pagina
  const { data: costumes, isLoading } = useListCostumes({ query: { refetchInterval: 10000 } as any });
  const entriesOpen = !!session?.entriesOpen;

  // Il mio costume (iscritto da questo telefono): non si può votare
  const [ownId, setOwnId] = useState<number | null>(null);

  // Modalità caccia: si vota solo dopo aver scansionato il QR del costume
  const [hunt, setHunt] = useState<{ enabled: boolean; name: string; caught: Set<number>; count: number }>({
    enabled: false,
    name: "",
    caught: new Set(),
    count: 0,
  });
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  const loadHunt = useCallback(() => {
    if (!voterToken) return;
    fetch(`/api/hunt/me?token=${encodeURIComponent(voterToken)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHunt({ enabled: !!d.enabled, name: d.name, caught: new Set<number>(d.caught), count: d.count }))
      .catch(() => {});
  }, [voterToken]);

  useEffect(() => {
    loadHunt();
    const t = setInterval(loadHunt, 10000);
    return () => clearInterval(t);
  }, [loadHunt]);

  const focusCostume = useCallback((id: number) => {
    setHighlight(id);
    setTimeout(() => document.getElementById(`costume-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    setTimeout(() => setHighlight(null), 4000);
  }, []);

  // Arrivo da un QR (/vote#costume-12): porto in vista il costume catturato
  useEffect(() => {
    const m = window.location.hash.match(/^#costume-(\d+)$/);
    if (m && costumes?.length) {
      focusCostume(Number(m[1]));
      history.replaceState(null, "", window.location.pathname);
    }
  }, [costumes?.length, focusCostume]);

  const onScanned = useCallback(
    async (code: string) => {
      setScanning(false);
      const r = await catchCostume(code);
      if (r.ok) {
        setNotice({ ok: true, text: r.already ? `${r.name}: già catturato. Puoi votarlo.` : `Catturato: ${r.name}! Ora puoi votarlo.` });
        loadHunt();
        focusCostume(r.costumeId);
      } else {
        setNotice({ ok: false, text: CATCH_ERRORS[r.error] ?? CATCH_ERRORS.server_error });
      }
      setTimeout(() => setNotice(null), 6000);
    },
    [loadHunt, focusCostume],
  );
  const [hasEntry, setHasEntry] = useState(false);
  const costumeCount = costumes?.length ?? 0;
  useEffect(() => {
    fetch(`/api/entries/mine?deviceId=${encodeURIComponent(getDeviceId())}`)
      .then((r) => (r.ok ? r.json() : { entry: null }))
      .then((d) => {
        setHasEntry(!!d.entry);
        setOwnId(d.entry?.status === "approved" ? d.entry.id : null);
      })
      .catch(() => {});
  }, [costumeCount]);

  useEffect(() => {
    if (!voterToken) setLocation("/entra");
  }, [voterToken, setLocation]);

  useEffect(() => {
    if (!session) return;
    if (!session.isOpen) {
      setLocation("/closed");
      return;
    }
    // Token di una sessione diversa: serve registrarsi di nuovo
    if (stored?.sessionId && String(session.id) !== stored.sessionId) {
      clearStoredVoter();
      setLocation("/entra");
    }
  }, [session, stored?.sessionId, setLocation]);

  useEffect(() => {
    if (!voterToken || existingLoaded) return;
    fetch(`/api/votes?token=${encodeURIComponent(voterToken)}`)
      .then((r) => {
        if (r.status === 404) {
          clearStoredVoter();
          setLocation("/entra");
          return [];
        }
        return r.ok ? r.json() : [];
      })
      .then((existing: Array<{ costumeId: number; score: number }>) => {
        const map: Record<number, number> = {};
        const st: Record<number, SaveState> = {};
        for (const v of existing) {
          map[v.costumeId] = v.score;
          st[v.costumeId] = "saved";
        }
        setVotes(map);
        setStatus(st);
        setExistingLoaded(true);
      })
      .catch(() => setExistingLoaded(true));
  }, [voterToken, existingLoaded, setLocation]);

  const ordered = useMemo(
    () => (costumes && voterToken ? seededShuffle(costumes, voterToken) : costumes ?? []),
    [costumes, voterToken],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ordered.filter((c) => c.name.toLowerCase().includes(q)) : ordered;
  }, [ordered, query]);

  const handleVoteChange = async (costumeId: number, score: number) => {
    if (!voterToken) return;
    setVotes((prev) => ({ ...prev, [costumeId]: score }));
    setStatus((prev) => ({ ...prev, [costumeId]: "saving" }));
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterToken, votes: [{ costumeId, score }] }),
      });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "not_caught") {
          setStatus((prev) => ({ ...prev, [costumeId]: "error" }));
          setVotes((prev) => ({ ...prev, [costumeId]: 0 }));
          loadHunt();
          return;
        }
        if (body?.error === "own_costume") {
          setOwnId(costumeId);
          setStatus((prev) => ({ ...prev, [costumeId]: "error" }));
          return;
        }
        setLocation("/closed");
        return;
      }
      setStatus((prev) => ({ ...prev, [costumeId]: res.ok ? "saved" : "error" }));
    } catch {
      setStatus((prev) => ({ ...prev, [costumeId]: "error" }));
    }
  };

  const errorCount = Object.values(status).filter((s) => s === "error").length;
  const votable = (costumes ?? []).filter((c) => c.id !== ownId);
  const allVoted = votable.length > 0 && votable.every((c) => status[c.id] === "saved");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 0.15, 0.3].map((d, i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 0.8, delay: d, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-primary"
            />
          ))}
        </div>
      </div>
    );
  }

  const entryButton = entriesOpen && (
    <button
      onClick={() => setLocation("/iscriviti")}
      className="w-full flex items-center justify-center gap-2 border border-primary/50 text-primary rounded-xl py-3 text-sm font-medium hover:bg-primary/10 transition"
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      {theme.texts.entryButton}
    </button>
  );

  if (!costumes || costumes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center px-6 text-center">
        <div className="w-full max-w-lg pt-4">
          <VoterTabs active="vote" hasEntry={hasEntry} />
        </div>
        <div className="max-w-xs w-full my-auto py-10">
          <p className="text-xs text-muted-foreground mb-1">Ciao, {stored?.nickname || "Votante"}</p>
          <h1 className="text-2xl font-serif text-primary mb-2">Ancora nessun costume in gara</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {entriesOpen
              ? "Sei in costume? Iscriviti per primo! I costumi compaiono qui appena approvati: la pagina si aggiorna da sola."
              : "I costumi compariranno qui appena saranno caricati: la pagina si aggiorna da sola."}
          </p>
          {entryButton}
          <OrganizerLink />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="mb-3">
            <VoterTabs active="vote" hasEntry={hasEntry} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition" aria-label="Indietro">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div>
                <p className="text-xs text-muted-foreground">Ciao, {stored?.nickname || "Votante"}</p>
                <h1 className="text-lg font-serif text-foreground leading-tight">{theme.texts.voteTitle}</h1>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {votable.filter((c) => status[c.id] === "saved").length}/{votable.length} votati
            </p>
          </div>
          {costumes.length > 6 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca un costume per nome o numero"
              className="mt-3 w-full bg-background border border-input rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {hunt.enabled && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-primary/10 border border-primary/30 rounded-xl px-3 py-2">
                <p className="text-[11px] text-muted-foreground truncate">{hunt.name}</p>
                <p className="text-sm text-foreground leading-tight">
                  <span className="font-semibold text-primary">{hunt.count}</span> {hunt.count === 1 ? "costume catturato" : "costumi catturati"}
                </p>
              </div>
              <button
                onClick={() => setScanning(true)}
                className="shrink-0 bg-primary text-primary-foreground font-semibold rounded-xl px-4 py-3 text-sm flex items-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                </svg>
                Scansiona
              </button>
            </div>
          )}
          {notice && (
            <p className={`mt-2 text-xs rounded-lg px-3 py-2 ${notice.ok ? "bg-primary/15 text-foreground" : "bg-destructive/15 text-foreground"}`}>{notice.text}</p>
          )}
          {errorCount > 0 && (
            <p className="mt-2 text-xs text-destructive">
              {errorCount === 1 ? "1 voto non è stato salvato" : `${errorCount} voti non sono stati salvati`}: controlla la connessione e tocca di nuovo le stelle.
            </p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {visible.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun costume trovato.</p>}

        {visible.map((costume, index) => {
          const st = status[costume.id];
          return (
            <motion.div
              key={costume.id}
              id={`costume-${costume.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 4) * 0.06 }}
              className={`bg-card border rounded-2xl overflow-hidden shadow transition-shadow ${
                highlight === costume.id ? "border-primary ring-4 ring-primary/40" : st === "error" ? "border-destructive" : "border-border"
              }`}
            >
              {costume.imagePath && (
                <div
                  className="aspect-video bg-muted overflow-hidden cursor-zoom-in relative group"
                  onClick={() => setLightbox({ src: optimizedImage(costume.imagePath, 1400), name: costume.name })}
                >
                  <img
                    src={optimizedImage(costume.imagePath, 800)}
                    alt={costume.name}
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="text-xl font-serif text-foreground text-center">{costume.name}</h2>
                  <AnimatePresence mode="wait">
                    {st === "saving" && (
                      <motion.div
                        key="saving"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"
                      />
                    )}
                    {st === "saved" && (
                      <motion.div key="saved" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary shrink-0" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {costume.id === ownId ? (
                  <p className="text-center text-sm text-primary py-2">
                    ✦ Il tuo costume <span className="text-muted-foreground">· non puoi votarlo</span>
                  </p>
                ) : hunt.enabled && !hunt.caught.has(costume.id) ? (
                  <button
                    onClick={() => setScanning(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/60 transition"
                  >
                    <span aria-hidden="true">🔒</span> Trovalo e scansiona il suo QR per votarlo
                  </button>
                ) : (
                  <StarRating score={votes[costume.id] ?? 0} onChange={handleVoteChange} costumeId={costume.id} disabled={st === "saving"} />
                )}

                {st === "error" && costume.id !== ownId && (
                  <p className="mt-2 text-center text-xs text-destructive">Voto non salvato. Tocca di nuovo una stella per riprovare.</p>
                )}
              </div>
            </motion.div>
          );
        })}

        <AnimatePresence>
          {allVoted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-primary/10 border border-primary/30 rounded-2xl p-5 text-center"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-primary mx-auto mb-2" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <p className="text-primary font-serif text-lg">{theme.texts.thanksTitle}</p>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{theme.texts.thanksText}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <OrganizerLink />
      </div>

      {scanning && <QrScanner title={hunt.name || "Scansiona"} onCode={onScanned} onClose={() => setScanning(false)} />}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex items-center gap-3 px-4 py-3 shrink-0">
              <button onClick={() => setLightbox(null)} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Indietro
              </button>
              <p className="text-white/80 text-sm font-serif truncate">{lightbox.name}</p>
            </div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex items-center justify-center px-2 pb-4 min-h-0"
              onClick={() => setLightbox(null)}
            >
              <img
                src={lightbox.src}
                alt={lightbox.name}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
