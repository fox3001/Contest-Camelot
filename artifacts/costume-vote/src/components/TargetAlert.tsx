import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getStoredVoter } from "@/lib/storage";
import { CATCH_ERRORS, catchCostume, type TargetWin } from "@/lib/hunt";
import { QrScanner } from "@/components/QrScanner";

type Target = {
  id: number;
  title: string;
  riddle: string;
  prize: string;
  status: "active" | "won";
  createdAt: string;
  wonAt: string | null;
  winnerNickname: string | null;
  iWon: boolean;
  claimCode: string | null;
};

const SEEN_KEY = "targetSeen";
const readSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || 0);
  } catch {
    return 0;
  }
};
const writeSeen = (id: number) => {
  try {
    localStorage.setItem(SEEN_KEY, String(id));
  } catch {
    // ignorato
  }
};

/**
 * Target Hunt lato votante: annuncio a tutto schermo quando l'admin lancia un target,
 * riquadro con indovinello e pulsante per scansionare, schermata del premio per chi vince.
 */
export function TargetAlert() {
  const [target, setTarget] = useState<Target | null>(null);
  const [announce, setAnnounce] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [win, setWin] = useState<TargetWin | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    const voter = getStoredVoter();
    if (!voter) return;
    fetch(`/api/hunt/target?token=${encodeURIComponent(voter.token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const t: Target | null = d.target;
        setTarget(t);
        if (t && t.status === "active" && t.id > readSeen()) {
          writeSeen(t.id);
          setAnnounce(true);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    const onWin = (e: Event) => {
      setWin((e as CustomEvent<TargetWin>).detail);
      if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
      load();
    };
    window.addEventListener("target-win", onWin);
    return () => {
      clearInterval(t);
      window.removeEventListener("target-win", onWin);
    };
  }, [load]);

  const onCode = useCallback(
    async (code: string) => {
      setScanning(false);
      const r = await catchCostume(code);
      if (r.ok && !r.targetWin) {
        setNotice(
          target?.status === "won"
            ? `Hai catturato ${r.name}, ma il target è già stato trovato.`
            : `Hai catturato ${r.name}… ma non è il target. Rileggi l'indovinello!`,
        );
      } else if (!r.ok) {
        setNotice(CATCH_ERRORS[r.error] ?? CATCH_ERRORS.server_error);
      }
      setTimeout(() => setNotice(""), 6000);
    },
    [target?.status],
  );

  // Il messaggio "trovato da…" resta visibile per 15 minuti
  const recentWin = target?.status === "won" && target.wonAt && Date.now() - Date.parse(target.wonAt) < 15 * 60 * 1000;
  const showBanner = target && (target.status === "active" || target.iWon || recentWin);

  return (
    <>
      {showBanner && (
        <div
          className={`mt-3 rounded-2xl border p-3 text-left ${
            target!.status === "active" ? "border-primary bg-primary/15" : target!.iWon ? "border-primary bg-primary/25" : "border-border bg-card"
          }`}
        >
          {target!.status === "active" ? (
            <>
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold">🎯 {target!.title} · premio: {target!.prize}</p>
              <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-snug">{target!.riddle}</p>
              <button onClick={() => setScanning(true)} className="mt-2 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-2.5 text-sm">
                L'ho trovato: scansiona il QR
              </button>
            </>
          ) : target!.iWon ? (
            <button onClick={() => setWin({ targetId: target!.id, title: target!.title, prize: target!.prize, claimCode: target!.claimCode ?? "" })} className="w-full text-left">
              <p className="text-sm text-foreground">🏆 Hai vinto la {target!.title}! Tocca qui per il codice del premio.</p>
            </button>
          ) : (
            <p className="text-sm text-foreground">
              🏆 {target!.title}: il target è stato trovato da <strong>{target!.winnerNickname ?? "un cacciatore"}</strong>. Resta pronto per il prossimo!
            </p>
          )}
          {notice && <p className="mt-2 text-xs text-foreground bg-background/60 rounded-lg px-3 py-2">{notice}</p>}
        </div>
      )}

      {/* Gli overlay vanno sul body: dentro la barra in alto (backdrop-blur) non coprirebbero lo schermo */}
      {createPortal(
        <>
      <AnimatePresence>
        {announce && target?.status === "active" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-full max-w-sm bg-card border-2 border-primary rounded-3xl p-6 text-center shadow-2xl">
              <p className="text-5xl mb-2" aria-hidden="true">🎯</p>
              <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold">{target.title}</p>
              <p className="font-serif text-xl text-foreground mt-3 whitespace-pre-line leading-snug">{target.riddle}</p>
              <p className="text-sm text-muted-foreground mt-4">
                Il primo che trova questo costume e ne scansiona il QR vince: <strong className="text-primary">{target.prize}</strong>
              </p>
              <button
                onClick={() => {
                  setAnnounce(false);
                  setScanning(true);
                }}
                className="mt-5 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3.5"
              >
                L'ho trovato: scansiona
              </button>
              <button onClick={() => setAnnounce(false)} className="mt-2 w-full text-sm text-muted-foreground py-2">
                Vado a cercarlo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {win && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-primary flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.7, rotate: -3 }} animate={{ scale: 1, rotate: 0 }} className="w-full max-w-sm text-center text-primary-foreground">
              <p className="text-7xl" aria-hidden="true">🏆</p>
              <p className="text-sm uppercase tracking-[0.3em] mt-3 font-semibold">{win.title}</p>
              <p className="text-4xl font-serif mt-2">Hai vinto!</p>
              <p className="text-lg mt-3">{win.prize}</p>
              <p className="text-sm mt-6 opacity-80">Mostra questo schermo all'organizzazione. Codice premio:</p>
              <p className="font-mono text-6xl tracking-[0.2em] mt-1">{win.claimCode}</p>
              <button onClick={() => setWin(null)} className="mt-8 bg-primary-foreground text-primary font-semibold rounded-xl px-6 py-3">
                Chiudi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {scanning && <QrScanner title={target?.title ?? "Target Hunt"} onCode={onCode} onClose={() => setScanning(false)} />}
        </>,
        document.body,
      )}
    </>
  );
}
