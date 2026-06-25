import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetResults,
  useCloseSession,
  getGetResultsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const MEDAL = ["bg-primary text-primary-foreground", "bg-zinc-300/30 text-zinc-200", "bg-amber-700/30 text-amber-400"];

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
        <p className="text-xs text-destructive mb-4">Cancella tutto: voti, votanti, costumi e sessione precedente.</p>
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

type Modal = "closeSession" | "newSession" | null;

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [modal, setModal] = useState<Modal>(null);
  const [isResetting, setIsResetting] = useState(false);
  const token = localStorage.getItem("adminToken") ?? "";
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) setLocation("/admin");
  }, [token, setLocation]);

  const { data: results, isLoading, error } = useGetResults({
    query: { queryKey: getGetResultsQueryKey(), refetchInterval: 5000, enabled: !!token },
    request: { headers: { "x-admin-token": token } },
  });

  const { mutate: closeSession, isPending: isClosing } = useCloseSession({
    request: { headers: { "x-admin-token": token } },
  });

  if (error) {
    if ((error as any)?.status === 401) {
      localStorage.removeItem("adminToken");
      setLocation("/admin");
      return null;
    }
  }

  const handleClose = () => {
    if (!results) return;
    closeSession(
      { id: results.sessionId },
      {
        onSuccess: () => {
          setModal(null);
          queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
        },
      }
    );
  };

  const handleNewSession = async (name: string) => {
    setIsResetting(true);
    try {
      await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ name }),
      });
      setModal(null);
      queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
    } catch {
      // ignore
    } finally {
      setIsResetting(false);
    }
  };

  // allCostumes comes from server; rest = positions 6+
  const all: any[] = (results as any)?.allCostumes ?? results?.top5 ?? [];
  const top5 = all.slice(0, 5);
  const rest = all.slice(5);

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground transition"
              title="Torna alla home"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-serif text-foreground">Pannello Admin</h1>
              {results && (
                <p className="text-xs text-muted-foreground">{results.sessionName}</p>
              )}
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
              onClick={() => { localStorage.removeItem("adminToken"); setLocation("/admin"); }}
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

        {results && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Votanti totali</p>
                <p className="text-3xl font-serif text-primary">{results.totalVoters}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Stato</p>
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${results.isOpen ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${results.isOpen ? "bg-primary animate-pulse" : "bg-destructive"}`} />
                  {results.isOpen ? "Aperte" : "Chiuse"}
                </div>
              </div>
            </div>

            {/* Top 5 */}
            {top5.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">🏆 Top 5</p>
                <div className="space-y-2">
                  {top5.map((c: any, i: number) => (
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
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{c.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{c.totalVotes} voti</span>
                            <span className="text-xs text-muted-foreground">somma: {c.sumScores}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-serif text-primary">{c.percentage}%</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${c.percentage}%` }}
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
                  {rest.map((c: any) => (
                    <div key={c.id} className="bg-card/60 border border-border/60 rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-6 text-center shrink-0">{c.rank}</span>
                      <span className="flex-1 text-sm text-foreground truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.totalVotes} voti</span>
                      <span className="text-sm font-medium text-primary shrink-0">{c.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {all.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nessun costume o voto ancora.
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              {results.isOpen && (
                <button
                  onClick={() => setModal("closeSession")}
                  className="w-full bg-destructive text-destructive-foreground font-bold rounded-xl py-4 text-base hover:opacity-90 active:scale-95 transition-all shadow-md uppercase tracking-wide"
                >
                  Chiudi Votazioni
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
      </div>

      <AnimatePresence>
        {modal === "closeSession" && (
          <ConfirmModal
            title="Chiudi le votazioni?"
            message="I votanti non potranno più esprimere preferenze."
            confirmLabel="Chiudi"
            onConfirm={handleClose}
            onCancel={() => setModal(null)}
            isPending={isClosing}
            danger
          />
        )}
        {modal === "newSession" && (
          <NewSessionModal
            onConfirm={handleNewSession}
            onCancel={() => setModal(null)}
            isPending={isResetting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
