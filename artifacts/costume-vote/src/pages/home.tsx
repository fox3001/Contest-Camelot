import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetActiveSession, getGetActiveSessionQueryKey, useRegisterVoter } from "@workspace/api-client-react";
import logo from "@assets/Logo1.png";

function NoSessionScreen({ onSessionCreated }: { onSessionCreated: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !sessionName.trim()) {
      setError("Compila tutti i campi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, sessionName: sessionName.trim() }),
      });
      if (res.status === 401) {
        setError("Password errata");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Errore del server. Riprova.");
        setLoading(false);
        return;
      }
      onSessionCreated();
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <img src={logo} alt="Camelot's Tales" className="w-48 h-48 object-contain mb-6" />
      <h1 className="text-xl font-serif text-primary mb-3">Nessuna sessione attiva</h1>
      <p className="text-muted-foreground text-sm mb-8">Le votazioni non sono ancora iniziate.</p>

      <button
        onClick={() => setShowModal(true)}
        className="bg-primary text-primary-foreground font-semibold rounded-xl px-6 py-3 text-sm hover:opacity-90 active:scale-[0.97] transition-all shadow"
      >
        Nuova Sessione
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6 z-50"
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-xl"
            >
              <h2 className="text-lg font-serif text-primary mb-1">Nuova Sessione</h2>
              <p className="text-xs text-muted-foreground mb-5">Resetta tutto e avvia una nuova votazione.</p>

              <form onSubmit={handleReset} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Nome sessione</label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => { setSessionName(e.target.value); setError(""); }}
                    placeholder="es. Malacontest 2026"
                    maxLength={60}
                    className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Password di reset</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition"
                    autoComplete="current-password"
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setError(""); setPassword(""); setSessionName(""); }}
                    className="flex-1 bg-muted text-muted-foreground font-medium rounded-xl py-3 text-sm hover:opacity-80 transition"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground font-semibold rounded-xl py-3 text-sm hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    {loading ? "..." : "Avvia"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  const [nickname, setNickname] = useState(() => localStorage.getItem("voterNickname") ?? "");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const { data: session, isLoading: sessionLoading } = useGetActiveSession({ query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 4000 } });
  const { mutate: registerVoter, isPending } = useRegisterVoter();

  useEffect(() => {
    if (!session) return;
    if (!session.isOpen) { setLocation("/closed"); return; }
  }, [session, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Inserisci un nickname");
      return;
    }
    if (!session) return;
    if (!session.isOpen) {
      setLocation("/closed");
      return;
    }
    setError("");
    registerVoter(
      { data: { nickname: nickname.trim(), sessionId: session.id } },
      {
        onSuccess: (data) => {
          localStorage.setItem("voterToken", data.token);
          localStorage.setItem("voterId", String(data.id));
          localStorage.setItem("voterNickname", data.nickname);
          localStorage.setItem("sessionId", String(data.sessionId));
          setLocation("/vote");
        },
        onError: (err: any) => {
          if (err?.status === 403) {
            setLocation("/closed");
          } else {
            setError("Errore di connessione. Riprova.");
          }
        },
      }
    );
  };

  if (sessionLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
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

  if (!session) {
    return <NoSessionScreen onSessionCreated={() => window.location.reload()} />;
  }

  if (!session.isOpen) {
    return null;
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 py-8 safe-area-inset">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-xs"
      >
        {/* Logo grande */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex justify-center mb-3"
        >
          <img
            src={logo}
            alt="Camelot's Tales – A Fantasy Ball Night"
            className="w-[88vw] max-w-sm h-auto object-contain drop-shadow-[0_0_32px_rgba(180,210,255,0.4)]"
          />
        </motion.div>

        {/* Form nickname */}
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl p-5 shadow-md"
        >
          <label className="block text-sm font-medium text-foreground mb-2">
            Il tuo nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError("");
            }}
            placeholder="es. Veneziano23"
            maxLength={30}
            className="w-full bg-background border border-input rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base transition"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-sm text-destructive"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isPending || !nickname.trim()}
            className="mt-4 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-4 text-base hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow"
          >
            {isPending ? "Connessione..." : "Entra e Vota"}
          </button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-4"
        >
          Nessun account richiesto. Solo il tuo nickname.
        </motion.p>

        {/* Admin button — discreto in fondo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="flex justify-center mt-10"
        >
          <button
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors px-3 py-1.5 rounded-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Admin
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
