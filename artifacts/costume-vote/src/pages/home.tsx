import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetActiveSession, getGetActiveSessionQueryKey, useRegisterVoter } from "@workspace/api-client-react";
import logo from "@assets/logo_ballo_dark_glow_1782294241374-jfuYTOf4.png";
import { getDeviceId, getLastNickname, getStoredVoter, setStoredVoter } from "@/lib/storage";

const ERROR_MESSAGES: Record<string, string> = {
  nickname_taken: "Nickname già in uso, scegline un altro.",
  code_required: "Serve il codice votante che trovi sul tuo biglietto.",
  code_invalid: "Codice non valido. Controlla di averlo scritto bene.",
  code_used: "Questo codice è già stato usato.",
  invalid_input: "Nickname non valido (massimo 30 caratteri).",
  invalid_device: "Ricarica la pagina e riprova.",
};

function WaitingScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <img src={logo} alt="Camelot's Tales" className="w-48 h-48 object-contain mb-6" />
      <h1 className="text-xl font-serif text-primary mb-3">Le votazioni non sono ancora iniziate</h1>
      <p className="text-muted-foreground text-sm">Tieni aperta questa pagina: si aggiornerà da sola appena si apre il voto.</p>
    </div>
  );
}

export default function Home() {
  const [nickname, setNickname] = useState(() => getLastNickname());
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();

  const { data: session, isLoading: sessionLoading } = useGetActiveSession({
    query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 4000, retry: false },
  });
  const { mutate: registerVoter, isPending } = useRegisterVoter();

  const stored = getStoredVoter();
  const alreadyRegistered = !!(session && stored && stored.sessionId === String(session.id));

  useEffect(() => {
    if (session && !session.isOpen) setLocation("/closed");
  }, [session, setLocation]);

  const submit = (attempt = 0) => {
    if (!session) return;
    registerVoter(
      {
        data: {
          nickname: nickname.trim(),
          sessionId: session.id,
          deviceId: getDeviceId(),
          ...(session.requireCode ? { code: code.trim().toUpperCase() } : {}),
        },
      },
      {
        onSuccess: (data) => {
          setStoredVoter(data);
          setLocation("/vote");
        },
        onError: (err: any) => {
          const key = err?.data?.error as string | undefined;
          if (err?.status === 403 && key === "voting_closed") {
            setLocation("/closed");
          } else if (key === "retry" && attempt < 1) {
            submit(attempt + 1);
          } else if (key && ERROR_MESSAGES[key]) {
            setError(ERROR_MESSAGES[key]);
          } else {
            setError("Errore di connessione. Riprova.");
          }
        },
      },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Inserisci un nickname");
      return;
    }
    if (session?.requireCode && !code.trim()) {
      setError("Inserisci il codice votante");
      return;
    }
    setError("");
    submit();
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

  if (!session) return <WaitingScreen />;
  if (!session.isOpen) return null;

  const inputClass =
    "w-full bg-background border border-input rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base transition";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 py-8 safe-area-inset">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-xs"
      >
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

        {alreadyRegistered ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="bg-card border border-border rounded-2xl p-5 shadow-md text-center"
          >
            <p className="text-sm text-muted-foreground mb-1">Bentornato</p>
            <p className="text-xl font-serif text-foreground mb-4">{stored!.nickname}</p>
            <button
              onClick={() => setLocation("/vote")}
              className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-4 text-base hover:opacity-90 active:scale-[0.97] transition-all shadow"
            >
              Continua a votare
            </button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-2xl p-5 shadow-md"
          >
            <label className="block text-sm font-medium text-foreground mb-2" htmlFor="nickname">
              Il tuo nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
              placeholder="es. Veneziano23"
              maxLength={30}
              className={inputClass}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {session.requireCode && (
              <>
                <label className="block text-sm font-medium text-foreground mt-4 mb-2" htmlFor="code">
                  Codice votante
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="es. K7M2Q"
                  maxLength={8}
                  className={`${inputClass} tracking-[0.3em] uppercase text-center`}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </>
            )}

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-destructive">
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
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-4"
        >
          {session.requireCode ? "Un codice, un voto. Nessun account richiesto." : "Nessun account richiesto. Un voto per telefono."}
        </motion.p>
      </motion.div>
    </div>
  );
}
