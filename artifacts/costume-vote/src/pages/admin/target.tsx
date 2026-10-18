import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  useListAdminCostumes,
  getListAdminCostumesQueryKey,
} from "@workspace/api-client-react";
import { adminRequest, clearAdminToken, getAdminToken } from "@/lib/storage";
import { optimizedImage } from "@/lib/images";

type TargetRow = {
  id: number;
  costumeId: number;
  costumeName: string;
  costumeImage: string;
  title: string;
  riddle: string;
  prize: string;
  prizeInfo: string;
  status: "active" | "won" | "cancelled";
  winnerNickname: string | null;
  claimCode: string | null;
  createdAt: string;
  wonAt: string | null;
};

const inputClass =
  "w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

function minutesBetween(a: string, b: string | number) {
  const ms = (typeof b === "number" ? b : Date.parse(b)) - Date.parse(a);
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 1 ? "meno di un minuto" : m === 1 ? "1 minuto" : `${m} minuti`;
}

export default function AdminTarget() {
  const [, setLocation] = useLocation();
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [costumeId, setCostumeId] = useState<number | null>(null);
  const [title, setTitle] = useState("Target Hunt");
  const [riddle, setRiddle] = useState("");
  const [prize, setPrize] = useState("Una consumazione");
  const [prizeInfo, setPrizeInfo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, tick] = useState(0);

  useEffect(() => {
    if (!getAdminToken()) setLocation("/admin");
  }, [setLocation]);

  const { data: costumes } = useListAdminCostumes({
    query: { queryKey: getListAdminCostumesQueryKey(), retry: false },
    request: adminRequest(),
  });
  const inGara = (costumes ?? []).filter((c) => c.status === "approved");

  const load = useCallback(() => {
    fetch("/api/admin/targets", adminRequest())
      .then((r) => {
        if (r.status === 401) {
          clearAdminToken();
          setLocation("/admin");
          return [];
        }
        return r.ok ? r.json() : [];
      })
      .then((d) => Array.isArray(d) && setTargets(d))
      .catch(() => {});
  }, [setLocation]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      load();
      tick((n) => n + 1);
    }, 5000);
    return () => clearInterval(t);
  }, [load]);

  const active = targets.find((t) => t.status === "active");
  const lastWon = targets.find((t) => t.status === "won");

  const launch = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminRequest().headers as Record<string, string>),
        },
        body: JSON.stringify({ costumeId, riddle, prize, prizeInfo, title }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error);
      setConfirm(false);
      setRiddle("");
      setCostumeId(null);
      load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e?.message || "Lancio non riuscito, riprova.");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: number) => {
    if (
      !window.confirm(
        "Annullare il target in corso? I votanti non vedranno più l'indovinello.",
      )
    )
      return;
    await fetch(`/api/admin/targets/${id}/cancel`, {
      method: "PUT",
      ...adminRequest(),
    });
    load();
  };

  const chosen = inGara.find((c) => c.id === costumeId);
  const canLaunch =
    !!costumeId && riddle.trim().length > 0 && prize.trim().length > 0;

  return (
    <div className="min-h-screen pb-12">
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
            <h1 className="text-lg font-serif text-foreground">
              🎯 Target Hunt
            </h1>
            <p className="text-xs text-muted-foreground">
              Un indovinello a tutti: vince il primo che scansiona il QR del
              costume scelto.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {active && (
          <div className="bg-primary/15 border-2 border-primary rounded-2xl p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">
              In corso da {minutesBetween(active.createdAt, Date.now())}
            </p>
            <div className="flex gap-3 items-center">
              <img
                src={optimizedImage(active.costumeImage, 200)}
                alt=""
                className="w-16 h-20 object-cover rounded-lg bg-muted shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Target (solo tu lo sai)
                </p>
                <p className="font-serif text-lg text-foreground truncate">
                  {active.costumeName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Premio: {active.prize}
                </p>
                {active.prizeInfo && (
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {active.prizeInfo}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground bg-background/50 rounded-xl p-3 whitespace-pre-line">
              “{active.riddle}”
            </p>
            <button
              onClick={() => cancel(active.id)}
              className="w-full bg-muted text-foreground rounded-xl py-2.5 text-sm"
            >
              Annulla target
            </button>
          </div>
        )}

        {lastWon && (!active || lastWon.id > active.id) && (
          <div className="bg-card border border-primary/60 rounded-2xl p-5 text-center">
            <p className="text-3xl" aria-hidden="true">
              🏆
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {lastWon.title}: {lastWon.costumeName}
            </p>
            <p className="font-serif text-2xl text-foreground mt-1">
              Vinto da {lastWon.winnerNickname ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              trovato in{" "}
              {lastWon.wonAt
                ? minutesBetween(lastWon.createdAt, lastWon.wonAt)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Il vincitore deve mostrarti questo codice:
            </p>
            <p className="font-mono text-4xl tracking-[0.2em] text-primary">
              {lastWon.claimCode}
            </p>
            <p className="text-sm text-foreground mt-2">
              Premio: {lastWon.prize}
            </p>
            {lastWon.prizeInfo && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                {lastWon.prizeInfo}
              </p>
            )}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow">
          <h2 className="text-base font-medium text-foreground">
            {active ? "Prepara il prossimo target" : "Nuovo target"}
          </h2>
          {active && (
            <p className="text-xs text-muted-foreground">
              Lanciandolo, il target in corso verrà annullato.
            </p>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              1. Scegli il costume da trovare
            </p>
            {inGara.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nessun costume in gara.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                {inGara.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCostumeId(c.id)}
                    aria-pressed={costumeId === c.id}
                    className={`rounded-xl overflow-hidden border-2 text-left transition ${costumeId === c.id ? "border-primary" : "border-transparent"}`}
                  >
                    <img
                      src={optimizedImage(c.imagePath, 240)}
                      alt=""
                      className="w-full aspect-[4/5] object-cover bg-muted"
                      loading="lazy"
                    />
                    <p className="text-[11px] text-foreground truncate px-1 py-1">
                      {c.name}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              className="block text-xs text-muted-foreground mb-1.5"
              htmlFor="t-riddle"
            >
              2. Scrivi l'indovinello{chosen ? ` su “${chosen.name}”` : ""}
            </label>
            <textarea
              id="t-riddle"
              value={riddle}
              onChange={(e) => setRiddle(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="es. Ho una corona ma non regno, e il mio mantello ha il colore del vino. Chi sono?"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-muted-foreground mb-1.5">
                3. Premio
              </span>
              <input
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                maxLength={80}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground mb-1.5">
                Titolo dell'avviso
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={40}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block" htmlFor="t-prize-info">
            <span className="block text-xs text-muted-foreground mb-1.5">
              Info sul premio (facoltativo: la vedono tutti nell'avviso)
            </span>
            <textarea
              id="t-prize-info"
              value={prizeInfo}
              onChange={(e) => setPrizeInfo(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="es. Uno shot di idromele offerto dalla casa: ritiralo al bancone entro mezzanotte."
              className={inputClass}
            />
          </label>

          <p className="text-[11px] text-muted-foreground">
            Chi vince vede il premio, il codice e la coppa 🏆 (o l'immagine che
            scegli in{" "}
            <button
              type="button"
              onClick={() => setLocation("/admin/aspetto")}
              className="underline text-primary"
            >
              Aspetto → Premio della Target Hunt
            </button>
            ). Gli altri vedono solo “Caccia chiusa”.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            disabled={!canLaunch || busy}
            onClick={() => setConfirm(true)}
            className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3.5 disabled:opacity-40"
          >
            Lancia a tutti i votanti
          </button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            L'avviso compare entro pochi secondi a chi ha l'app aperta (chi ha
            il telefono bloccato lo vede appena la riapre). Non serve che la
            modalità caccia sia attiva: il QR di ogni costume è nella sua scheda
            “Il tuo costume” e nella stampa dei QR.
          </p>
        </div>

        {targets.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
              Storico della serata
            </p>
            <div className="space-y-2">
              {targets.map((t) => (
                <div
                  key={t.id}
                  className="bg-card/60 border border-border/60 rounded-xl px-4 py-3 text-sm flex items-center gap-3"
                >
                  <span className="w-5 text-center">
                    {t.status === "won"
                      ? "🏆"
                      : t.status === "active"
                        ? "🎯"
                        : "✕"}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-foreground">
                    {t.costumeName}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t.status === "won"
                      ? `${t.winnerNickname ?? "—"} · ${t.claimCode}`
                      : t.status === "active"
                        ? "in corso"
                        : "annullato"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {confirm && chosen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setConfirm(false)}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg"
            >
              <h2 className="text-lg font-serif text-foreground mb-1">
                Lanciare il target?
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                Tutti i votanti riceveranno l'indovinello. Vince il primo che
                scansiona il QR di{" "}
                <strong className="text-foreground">{chosen.name}</strong>.
              </p>
              <p className="text-sm text-foreground bg-background/60 rounded-xl p-3 mb-2 whitespace-pre-line">
                “{riddle.trim()}”
              </p>
              <p className="text-xs text-muted-foreground mb-5 whitespace-pre-line">
                Premio: {prize.trim()}
                {prizeInfo.trim() ? `\n${prizeInfo.trim()}` : ""}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(false)}
                  className="flex-1 bg-muted text-foreground rounded-xl py-3 font-medium"
                >
                  Annulla
                </button>
                <button
                  onClick={launch}
                  disabled={busy}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold disabled:opacity-50"
                >
                  {busy ? "..." : "Lancia"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
