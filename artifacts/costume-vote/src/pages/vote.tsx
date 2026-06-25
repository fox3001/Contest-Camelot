import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useListCostumes, useGetActiveSession, getGetActiveSessionQueryKey } from "@workspace/api-client-react";

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
            style={{
              color:
                star <= (hovered || score)
                  ? "hsl(45 100% 50%)"
                  : "hsl(270 40% 40%)",
            }}
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

export default function Vote() {
  const [, setLocation] = useLocation();
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  const voterToken = localStorage.getItem("voterToken");
  const storedSessionId = localStorage.getItem("sessionId");
  const { data: session } = useGetActiveSession({ query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 4000 } });
  const { data: costumes, isLoading } = useListCostumes();

  useEffect(() => {
    if (!voterToken) { setLocation("/"); return; }
  }, [voterToken, setLocation]);

  useEffect(() => {
    if (!session) return;
    if (!session.isOpen) { setLocation("/closed"); return; }
    // Token appartiene a sessione diversa: forza re-registrazione
    if (storedSessionId && String(session.id) !== storedSessionId) {
      localStorage.removeItem("voterToken");
      localStorage.removeItem("voterId");
      localStorage.removeItem("voterNickname");
      localStorage.removeItem("sessionId");
      setLocation("/");
    }
  }, [session, storedSessionId, setLocation]);

  useEffect(() => {
    if (!voterToken || existingLoaded) return;
    fetch(`/api/votes?token=${encodeURIComponent(voterToken)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((existing: Array<{ costumeId: number; score: number }>) => {
        if (existing.length > 0) {
          const map: Record<number, number> = {};
          const savedMap: Record<number, boolean> = {};
          for (const v of existing) {
            map[v.costumeId] = v.score;
            savedMap[v.costumeId] = true;
          }
          setVotes(map);
          setSaved(savedMap);
        }
        setExistingLoaded(true);
      })
      .catch(() => setExistingLoaded(true));
  }, [voterToken, existingLoaded]);

  const handleVoteChange = async (costumeId: number, score: number) => {
    if (!voterToken) return;
    setVotes((prev) => ({ ...prev, [costumeId]: score }));
    setSaving((prev) => ({ ...prev, [costumeId]: true }));
    setSaved((prev) => ({ ...prev, [costumeId]: false }));
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
      if (res.ok) {
        setSaved((prev) => ({ ...prev, [costumeId]: true }));
      }
    } catch {
      // silently ignore network errors
    } finally {
      setSaving((prev) => ({ ...prev, [costumeId]: false }));
    }
  };

  const allVoted = costumes && costumes.length > 0 && costumes.every((c) => votes[c.id]);

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

  const nickname = localStorage.getItem("voterNickname") ?? "Votante";

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground transition"
              aria-label="Indietro"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <p className="text-xs text-muted-foreground">Ciao, {nickname}</p>
              <h1 className="text-lg font-serif text-foreground leading-tight">Vota i Costumi</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {Object.keys(votes).length}/{costumes.length} votati
            </p>
            <button
              onClick={() => setLocation("/admin")}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition px-2 py-1 rounded-lg"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Admin
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {costumes.map((costume, index) => (
          <motion.div
            key={costume.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow"
          >
            {costume.imagePath && (
              <div
                className="aspect-video bg-muted overflow-hidden cursor-zoom-in relative group"
                onClick={() => setLightbox({ src: costume.imagePath!, name: costume.name })}
              >
                <img
                  src={costume.imagePath}
                  alt={costume.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="bg-black/50 rounded-full p-2">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-xl font-serif text-foreground text-center">{costume.name}</h2>
                <AnimatePresence mode="wait">
                  {saving[costume.id] && (
                    <motion.div
                      key="saving"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"
                    />
                  )}
                  {!saving[costume.id] && saved[costume.id] && (
                    <motion.div
                      key="saved"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary shrink-0" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <StarRating
                score={votes[costume.id] ?? 0}
                onChange={handleVoteChange}
                costumeId={costume.id}
                disabled={saving[costume.id]}
              />
            </div>
          </motion.div>
        ))}

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
              <button
                onClick={() => setLightbox(null)}
                className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
              >
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
