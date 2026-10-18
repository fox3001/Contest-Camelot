import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getStoredVoter } from "@/lib/storage";
import { CATCH_ERRORS, catchCostume, type TargetWin } from "@/lib/hunt";
import { QrScanner } from "@/components/QrScanner";
import { fill, useTheme } from "@/lib/theme";

type Target = {
  id: number;
  title: string;
  riddle: string;
  prize: string;
  prizeInfo?: string;
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

// Vibrazione una volta sola per target, anche se il componente viene rimontato
let vibratedFor = 0;

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
  const tx = useTheme().theme.texts;

  const load = useCallback(() => {
    const voter = getStoredVoter();
    if (!voter) return;
    fetch(`/api/hunt/target?token=${encodeURIComponent(voter.token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const t: Target | null = d.target;
        setTarget(t);
        // L'annuncio resta finché il votante non lo chiude (anche se la pagina cambia vista)
        if (t && t.status === "active" && t.id > readSeen()) {
          setAnnounce(true);
          if (vibratedFor !== t.id && navigator.vibrate)
            navigator.vibrate([200, 100, 200]);
          vibratedFor = t.id;
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
            : fill(tx.targetWrong, { nome: r.name }),
        );
      } else if (!r.ok) {
        setNotice(CATCH_ERRORS[r.error] ?? CATCH_ERRORS.server_error);
      }
      setTimeout(() => setNotice(""), 6000);
    },
    [target?.status, tx.targetWrong],
  );

  // Il messaggio "trovato da…" resta visibile per 15 minuti
  const recentWin =
    target?.status === "won" &&
    target.wonAt &&
    Date.now() - Date.parse(target.wonAt) < 15 * 60 * 1000;
  const showBanner =
    target && (target.status === "active" || target.iWon || recentWin);

  return (
    <>
      {showBanner && (
        <div
          className={`mt-3 rounded-2xl border p-3 text-left ${
            target!.status === "active"
              ? "border-primary bg-primary/15"
              : target!.iWon
                ? "border-primary bg-primary/25"
                : "border-border bg-card"
          }`}
        >
          {target!.status === "active" ? (
            <>
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold">
                🎯 {target!.title} · premio: {target!.prize}
              </p>
              <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-snug">
                {target!.riddle}
              </p>
              {target!.prizeInfo && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  🎁 {target!.prizeInfo}
                </p>
              )}
              <button
                onClick={() => setScanning(true)}
                className="mt-2 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-2.5 text-sm"
              >
                {tx.targetScanButton}
              </button>
            </>
          ) : target!.iWon ? (
            <button
              onClick={() =>
                setWin({
                  targetId: target!.id,
                  title: target!.title,
                  prize: target!.prize,
                  prizeInfo: target!.prizeInfo,
                  claimCode: target!.claimCode ?? "",
                })
              }
              className="w-full text-left"
            >
              <p className="text-sm text-foreground">
                🏆 Hai vinto la {target!.title}! Tocca qui per il codice del
                premio.
              </p>
            </button>
          ) : (
            <p className="text-sm text-foreground">
              🏆 {target!.title}:{" "}
              {fill(tx.targetFoundBy, {
                vincitore: target!.winnerNickname ?? "—",
              })}
            </p>
          )}
          {notice && (
            <p className="mt-2 text-xs text-foreground bg-background/60 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}
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
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="w-full max-w-sm bg-card border-2 border-primary rounded-3xl p-6 text-center shadow-2xl"
                >
                  <p className="text-5xl mb-2" aria-hidden="true">
                    🎯
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold">
                    {target.title}
                  </p>
                  <p className="font-serif text-xl text-foreground mt-3 whitespace-pre-line leading-snug">
                    {target.riddle}
                  </p>
                  <p className="text-sm text-muted-foreground mt-4">
                    {tx.targetIntro}{" "}
                    <strong className="text-primary">{target.prize}</strong>
                  </p>
                  {target.prizeInfo && (
                    <p className="text-sm text-foreground mt-2 bg-background/50 rounded-xl px-3 py-2 whitespace-pre-line">
                      🎁 {target.prizeInfo}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      writeSeen(target.id);
                      setAnnounce(false);
                      setScanning(true);
                    }}
                    className="mt-5 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3.5"
                  >
                    {tx.targetScanButton}
                  </button>
                  <button
                    onClick={() => {
                      writeSeen(target.id);
                      setAnnounce(false);
                    }}
                    className="mt-2 w-full text-sm text-muted-foreground py-2"
                  >
                    {tx.targetLater}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {win && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-primary flex items-center justify-center p-6"
              >
                <motion.div
                  initial={{ scale: 0.7, rotate: -3 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="w-full max-w-sm text-center text-primary-foreground"
                >
                  <p className="text-7xl" aria-hidden="true">
                    🏆
                  </p>
                  <p className="text-sm uppercase tracking-[0.3em] mt-3 font-semibold">
                    {win.title}
                  </p>
                  <p className="text-4xl font-serif mt-2">{tx.winTitle}</p>
                  <p className="text-lg mt-3">{win.prize}</p>
                  {win.prizeInfo && (
                    <p className="text-sm mt-2 whitespace-pre-line opacity-90">
                      {win.prizeInfo}
                    </p>
                  )}
                  <p className="text-sm mt-6 opacity-80">{tx.winText}</p>
                  <p className="font-mono text-6xl tracking-[0.2em] mt-1">
                    {win.claimCode}
                  </p>
                  <button
                    onClick={() => setWin(null)}
                    className="mt-8 bg-primary-foreground text-primary font-semibold rounded-xl px-6 py-3"
                  >
                    Chiudi
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {scanning && (
            <QrScanner
              title={target?.title ?? "Target Hunt"}
              onCode={onCode}
              onClose={() => setScanning(false)}
            />
          )}
        </>,
        document.body,
      )}
    </>
  );
}
