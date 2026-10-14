import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useListCostumes, useGetActiveSession, getGetActiveSessionQueryKey } from "@workspace/api-client-react";
import { clearStoredVoter, getStoredVoter } from "@/lib/storage";

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
            style={{ color: star <= (hovered || score) ? "hsl(45 100% 50%)" : "hsl(270 40% 40%)" }}
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
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<Record<number, SaveState>>({});
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  const stored = getStoredVoter();
  const voterToken = stored?.token ?? null;
  const { data: session } = useGetActiveSession({ query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 4000 } });
  const { data: costumes, isLoading } = useListCostumes();

  useEffect(() => {
    if (!voterToken) setLocation("/");
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
      setLocation("/");
    }
  }, [session, stored?.sessionId, setLocation]);

  useEffect(() => {
    if (!voterToken || existingLoaded) return;
    fetch(`/api/votes?token=${encodeURIComponent(voterToken)}`)
      .then((r) => {
        if (r.status === 404) {
          clearStoredVoter();
          setLocation("/");
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
        setLocation("/closed");
        return;
      }
      setStatus((prev) => ({ ...prev, [costumeId]: res.ok ? "saved" : "error" }));
    } catch {
      setStatus((prev) => ({ ...prev, [costumeId]: "error" }));
    }
  };

  const savedCount = Object.values(status).filter((s) => s === "saved").length;
  const errorCount = Object.values(status).filter((s) => s === "error").length;
  const allVoted = costumes && costumes.length > 0 && costumes.every((c) => status[c.id] === "saved");

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

  if (!costumes || costumes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-serif text-primary mb-2">Nessun costume</h1>
        <p className="text-muted-foreground">I costumi non sono ancora stati caricati.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition" aria-label="Indietro">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div>
                <p className="text-xs text-muted-foreground">Ciao, {stored?.nickname || "Votante"}</p>
                <h1 className="text-lg font-serif text-foreground leading-tight">Vota i Costumi</h1>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {savedCount}/{costumes.length} votati
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 4) * 0.06 }}
              className={`bg-card border rounded-2xl overflow-hidden shadow ${st === "error" ? "border-destructive" : "border-border"}`}
            >
              {costume.imagePath && (
                <div
                  className="aspect-video bg-muted overflow-hidden cursor-zoom-in relative group"
                  onClick={() => setLightbox({ src: costume.imagePath!, name: costume.name })}
                >
                  <img
                    src={costume.imagePath}
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

                <StarRating score={votes[costume.id] ?? 0} onChange={handleVoteChange} costumeId={costume.id} disabled={st === "saving"} />

                {st === "error" && (
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
              <p className="text-primary font-serif text-lg">Grazie!</p>
              <p className="text-sm text-muted-foreground mt-1">Hai votato tutti i costumi. Attendi il verdetto dell'araldo.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
