import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetResults,
  getGetResultsQueryKey,
  getGetActiveSessionQueryKey,
  getListAdminCostumesQueryKey,
  closeSession,
  reopenSession,
  createSession,
  type CostumeResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { adminRequest, clearAdminToken, getAdminToken } from "@/lib/storage";
import { optimizedImage } from "@/lib/images";

const MEDAL = ["bg-primary text-primary-foreground", "bg-zinc-300/30 text-zinc-200", "bg-amber-700/30 text-amber-400"];

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-2xl w-full"
      >
        <img
          src={optimizedImage(src, 1400)}
          alt={name}
          className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
        />
        <p className="text-center text-white/80 text-sm mt-3 font-medium">{name}</p>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition text-lg leading-none"
          title="Chiudi"
        >
          ×
        </button>
      </motion.div>
    </motion.div>
  );
}

function CostumeThumbnail({ imagePath, name, onOpen }: { imagePath?: string; name: string; onOpen: () => void }) {
  if (!imagePath) return null;
  return (
    <button
      onClick={onOpen}
      className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/60 hover:border-primary/60 transition focus:outline-none focus:ring-2 focus:ring-primary"
      title={`Vedi immagine: ${name}`}
    >
      <img src={optimizedImage(imagePath, 120)} alt={name} className="w-full h-full object-cover" loading="lazy" />
    </button>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isPending,
  danger = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  danger?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg mb-safe"
      >
        <h2 className="text-lg font-serif text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-muted text-foreground rounded-xl py-3 font-medium hover:opacity-80 transition">
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 rounded-xl py-3 font-semibold hover:opacity-90 transition disabled:opacity-50 ${danger ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewSessionModal({
  onConfirm,
  onCancel,
  isPending,
}: { onConfirm: (name: string) => void; onCancel: () => void; isPending: boolean }) {
  const [name, setName] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg"
      >
        <h2 className="text-xl font-serif text-foreground mb-1">Nuova Sessione</h2>
        <p className="text-xs text-muted-foreground mb-4">Chiude la sessione attuale e ne apre una nuova vuota. Le sessioni precedenti restano in archivio con i loro voti.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome dell'evento"
          className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-muted text-foreground rounded-xl py-3 font-medium hover:opacity-80 transition">
            Annulla
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim() || isPending}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            Crea
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-primary">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
      {value.toFixed(2).replace(".", ",")}
    </span>
  );
}

type Modal = "closeSession" | "reopenSession" | "newSession" | null;

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [modal, setModal] = useState<Modal>(null);
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [lightboxCostume, setLightboxCostume] = useState<{ imagePath: string; name: string } | null>(null);
  const token = getAdminToken();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) setLocation("/admin");
  }, [token, setLocation]);

  const { data: results, isLoading, error } = useGetResults({
    query: { queryKey: getGetResultsQueryKey(), refetchInterval: 5000, enabled: !!token, retry: false },
    request: adminRequest(),
  });

  const status = (error as any)?.status as number | undefined;
  useEffect(() => {
    if (status === 401) {
      clearAdminToken();
      setLocation("/admin");
    }
  }, [status, setLocation]);

  const noSession = status === 404;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActiveSessionQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAdminCostumesQueryKey() });
  };

  const run = async (action: () => Promise<unknown>) => {
    setIsPending(true);
    setActionError("");
    try {
      await action();
      setModal(null);
      refresh();
    } catch {
      setActionError("Operazione non riuscita, riprova.");
    } finally {
      setIsPending(false);
    }
  };

  const all: CostumeResult[] = results?.allCostumes ?? [];
  const top5 = all.slice(0, 5);
  const rest = all.slice(5);

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition" title="Torna alla home">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-serif text-foreground">Pannello Admin</h1>
              {results && <p className="text-xs text-muted-foreground">{results.sessionName}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/gestione")}
              className="text-xs bg-muted text-foreground px-3 py-1.5 rounded-lg hover:opacity-80 transition"
            >
              Gestisci
            </button>
            <button
              onClick={() => setLocation("/admin/aspetto")}
              className="text-xs bg-muted text-foreground px-3 py-1.5 rounded-lg hover:opacity-80 transition"
            >
              Aspetto
            </button>
            <button
              onClick={() => {
                clearAdminToken();
                setLocation("/admin");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Esci
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="flex gap-2">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.div key={i} animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.8, delay: d, repeat: Infinity }} className="w-3 h-3 rounded-full bg-primary" />
              ))}
            </div>
          </div>
        )}

        {noSession && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <h2 className="text-lg font-serif text-foreground mb-1">Nessuna sessione</h2>
            <p className="text-sm text-muted-foreground mb-5">Crea la sessione della serata per iniziare a caricare i costumi.</p>
            <button
              onClick={() => setModal("newSession")}
              className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3 text-sm hover:opacity-90 transition"
            >
              Crea sessione
            </button>
          </div>
        )}

        {results && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Votanti</p>
                <p className="text-3xl font-serif text-primary">{results.totalVoters}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Costumi</p>
                <p className="text-3xl font-serif text-primary">{all.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Stato</p>
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${results.isOpen ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${results.isOpen ? "bg-primary animate-pulse" : "bg-destructive"}`} />
                  {results.isOpen ? "Aperte" : "Chiuse"}
                </div>
              </div>
            </div>

            <button
              onClick={() => setLocation("/admin/target")}
              className="w-full flex items-center justify-between bg-card border border-primary/40 rounded-xl px-4 py-3 text-sm text-foreground hover:border-primary transition"
            >
              <span>🎯 Target Hunt: indovinello a tutti, vince il primo che trova il costume</span>
              <span className="text-primary font-medium shrink-0 ml-2">Apri →</span>
            </button>

            {results.huntEnabled && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">🎯 {results.huntName}</p>
                {results.hunters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ancora nessuna cattura.</p>
                ) : (
                  <ol className="space-y-1">
                    {results.hunters.slice(0, 5).map((h) => (
                      <li key={h.rank} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-muted-foreground">{h.rank}</span>
                        <span className="flex-1 truncate text-foreground">{h.nickname}</span>
                        <span className="text-primary font-medium">{h.count} catture</span>
                        <span className="text-xs text-muted-foreground">{h.minutes} min</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {results.pendingEntries > 0 && (
              <button
                onClick={() => setLocation("/admin/gestione")}
                className="w-full flex items-center justify-between bg-primary/15 border border-primary/40 rounded-xl px-4 py-3 text-sm text-foreground"
              >
                <span>
                  {results.pendingEntries === 1 ? "1 iscrizione da approvare" : `${results.pendingEntries} iscrizioni da approvare`}
                </span>
                <span className="text-primary font-medium">Apri →</span>
              </button>
            )}

            {results.requireCode && (
              <p className="text-xs text-muted-foreground">
                Codici votante obbligatori: {results.codesUsed} usati su {results.codesTotal}.
              </p>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              Classifica per media delle stelle, corretta per il numero di voti: un costume con pochi voti viene avvicinato alla media generale, così non vince per caso.
            </p>

            {/* Top 5 */}
            {top5.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">🏆 Top 5</p>
                <div className="space-y-2">
                  {top5.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="bg-card border border-border rounded-xl p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${MEDAL[i] ?? "bg-muted text-muted-foreground"}`}>
                          {c.rank}
                        </div>
                        <CostumeThumbnail
                          imagePath={c.imagePath}
                          name={c.name}
                          onOpen={() => setLightboxCostume({ imagePath: c.imagePath, name: c.name })}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{c.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{c.totalVotes} voti</span>
                            <span className="text-xs text-muted-foreground">
                              media <Stars value={c.avgScore} />
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-serif text-primary">{c.weightedScore.toFixed(2).replace(".", ",")}</p>
                          <p className="text-[10px] text-muted-foreground">punteggio</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(c.weightedScore / 5) * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Rest of costumes (6+) */}
            {rest.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Tutti gli altri ({rest.length})</p>
                <div className="space-y-1.5">
                  {rest.map((c) => (
                    <div key={c.id} className="bg-card/60 border border-border/60 rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-6 text-center shrink-0">{c.rank}</span>
                      <CostumeThumbnail
                        imagePath={c.imagePath}
                        name={c.name}
                        onOpen={() => setLightboxCostume({ imagePath: c.imagePath, name: c.name })}
                      />
                      <span className="flex-1 text-sm text-foreground truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.totalVotes} voti</span>
                      <span className="text-sm font-medium text-primary shrink-0">{c.weightedScore.toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {all.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nessun costume ancora.{" "}
                <button onClick={() => setLocation("/admin/gestione")} className="text-primary underline underline-offset-4">
                  Aggiungili da Gestisci
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              {results.isOpen ? (
                <button
                  onClick={() => setModal("closeSession")}
                  className="w-full bg-destructive text-destructive-foreground font-bold rounded-xl py-4 text-base hover:opacity-90 active:scale-95 transition-all shadow-md uppercase tracking-wide"
                >
                  Chiudi Votazioni
                </button>
              ) : (
                <button
                  onClick={() => setModal("reopenSession")}
                  className="w-full bg-primary text-primary-foreground font-bold rounded-xl py-4 text-base hover:opacity-90 active:scale-95 transition-all shadow-md uppercase tracking-wide"
                >
                  Riapri Votazioni
                </button>
              )}
              <button
                onClick={() => setModal("newSession")}
                className="w-full bg-muted text-foreground font-medium rounded-xl py-3 text-sm hover:opacity-80 transition"
              >
                Nuova Sessione
              </button>
            </div>
          </>
        )}

        {actionError && <p className="text-sm text-destructive text-center">{actionError}</p>}
      </div>

      <AnimatePresence>
        {modal === "closeSession" && results && (
          <ConfirmModal
            title="Chiudi le votazioni?"
            message="I votanti non potranno più esprimere preferenze. Potrai riaprirle se serve."
            confirmLabel="Chiudi"
            onConfirm={() => run(() => closeSession(results.sessionId, adminRequest()))}
            onCancel={() => setModal(null)}
            isPending={isPending}
            danger
          />
        )}
        {modal === "reopenSession" && results && (
          <ConfirmModal
            title="Riaprire le votazioni?"
            message="I votanti potranno di nuovo votare e modificare i propri voti."
            confirmLabel="Riapri"
            onConfirm={() => run(() => reopenSession(results.sessionId, adminRequest()))}
            onCancel={() => setModal(null)}
            isPending={isPending}
          />
        )}
        {modal === "newSession" && (
          <NewSessionModal
            onConfirm={(name) => run(() => createSession({ name }, adminRequest()))}
            onCancel={() => setModal(null)}
            isPending={isPending}
          />
        )}
        {lightboxCostume && (
          <ImageLightbox src={lightboxCostume.imagePath} name={lightboxCostume.name} onClose={() => setLightboxCostume(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
