import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetActiveSession, getGetActiveSessionQueryKey } from "@workspace/api-client-react";
import { getDeviceId, getLastNickname, getStoredVoter } from "@/lib/storage";
import { compressImage, explainUploadError, optimizedImage, uploadWithProgress } from "@/lib/images";
import { VoterTabs } from "@/components/VoterTabs";
import { huntUrl, qrDataUrl } from "@/lib/hunt";
import { useTheme } from "@/lib/theme";

type Entry = {
  id: number;
  name: string;
  submittedBy: string | null;
  imagePath: string;
  status: "pending" | "approved" | "rejected";
  huntCode?: string | null;
};

/** QR personale del costume (modalità caccia): lo si mostra a chi vuole votarlo. */
function HuntQr({ code, huntName, costumeName }: { code: string; huntName: string; costumeName: string }) {
  const [src, setSrc] = useState("");
  const tx = useTheme().theme.texts;
  useEffect(() => {
    qrDataUrl(huntUrl(code), 700).then(setSrc).catch(() => {});
  }, [code]);
  return (
    <div className="bg-card border border-primary/50 rounded-2xl p-5 text-center shadow-md">
      <p className="text-xs uppercase tracking-widest text-primary">{huntName}</p>
      <p className="text-sm text-foreground mt-1">{tx.huntQrText}</p>
      <div className="mt-4 mx-auto w-full max-w-[280px] bg-white rounded-2xl p-3">
        {src ? <img src={src} alt={`QR di ${costumeName}`} className="w-full h-auto" /> : <div className="aspect-square" />}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Oppure detta il codice</p>
      <p className="font-mono text-3xl tracking-[0.35em] text-foreground">{code}</p>
      {src && (
        <a href={src} download={`qr-${costumeName.replace(/\s+/g, "-").toLowerCase()}.png`} className="mt-3 inline-block text-xs text-primary underline underline-offset-4">
          Salva il QR nelle foto
        </a>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  entries_closed: "Le iscrizioni sono chiuse.",
  entries_unavailable: "Le iscrizioni con foto non sono attive.",
  no_session: "Nessuna serata attiva.",
  already_approved: "Il tuo costume è già in gara.",
  invalid_name: "Scrivi il nome del costume (massimo 60 caratteri).",
  invalid_image: "Foto non valida, caricala di nuovo.",
  full: "È stato raggiunto il numero massimo di costumi.",
};

const STATUS_CLS: Record<Entry["status"], string> = {
  pending: "border-primary/40 bg-primary/10",
  approved: "border-primary bg-primary/15",
  rejected: "border-destructive/50 bg-destructive/10",
};

export default function Iscriviti() {
  const [, setLocation] = useLocation();
  // Indietro: alla lista dei costumi se sei già entrato come votante, altrimenti alla home
  const back = () => setLocation(getStoredVoter() ? "/vote" : "/");
  const tx = useTheme().theme.texts;
  const { data: session, isLoading } = useGetActiveSession({
    query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 10000, retry: false },
  });

  const [entry, setEntry] = useState<Entry | null>(null);
  const [huntName, setHuntName] = useState("Photo Hunters");
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [author, setAuthor] = useState(() => getLastNickname());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // La mia iscrizione (aggiornata ogni 10 s per vedere l'approvazione)
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/entries/mine?deviceId=${encodeURIComponent(getDeviceId())}`)
        .then((r) => (r.ok ? r.json() : { entry: null }))
        .then((d: { entry: Entry | null; huntName?: string }) => {
          if (!alive) return;
          setEntry(d.entry);
          if (d.huntName) setHuntName(d.huntName);
          setLoaded(true);
        })
        .catch(() => alive && setLoaded(true));
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (entry && !name) {
      setName(entry.name);
      if (entry.submittedBy) setAuthor(entry.submittedBy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickFile = (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/") && !/\.(heic|heif)$/i.test(f.name)) {
      setError("Scegli una foto.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("La foto è troppo grande (massimo 25 MB).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Scrivi il nome del costume.");
    if (!file) return setError("Scatta o scegli una foto del costume.");
    if (!consent) return setError("Conferma di poter pubblicare la foto.");

    const deviceId = getDeviceId();
    try {
      setProgress(0);
      const signRes = await fetch("/api/entries/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign?.error ?? "server");

      const blob = await compressImage(file);
      const form = new FormData();
      form.append("file", blob, "costume.jpg");
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("folder", sign.folder);
      form.append("signature", sign.signature);
      const uploaded = await uploadWithProgress(sign.uploadUrl, form, (p) => setProgress(Math.min(0.95, p)));

      const saveRes = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          name: name.trim(),
          submittedBy: author.trim(),
          imageUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
        }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) throw new Error(saved?.error ?? "server");
      setProgress(1);
      setEntry(saved.entry);
      setFile(null);
      setPreview(null);
      setConsent(false);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      const key = err?.message as string;
      setError(ERRORS[key] ?? (explainUploadError(err) || "Caricamento non riuscito, riprova."));
    } finally {
      setProgress(null);
    }
  };

  if (isLoading || !loaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 0.15, 0.3].map((d, i) => (
            <motion.div key={i} animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.8, delay: d, repeat: Infinity }} className="w-3 h-3 rounded-full bg-primary" />
          ))}
        </div>
      </div>
    );
  }

  const closed = !session?.entriesOpen;
  const canEdit = !closed && entry?.status !== "approved";
  const showForm = canEdit && (!entry || entry.status === "rejected" || editing);
  const inputClass =
    "w-full bg-background border border-input rounded-xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base transition";

  return (
    <div className="min-h-dvh pb-10">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={back} className="text-muted-foreground hover:text-foreground transition" aria-label="Indietro">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-serif text-foreground">{entry ? tx.tabMyEntry : tx.tabEntry}</h1>
        </div>
        <div className="max-w-lg mx-auto mt-3">
          <VoterTabs active="entry" hasEntry={!!entry} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {entry && (
          <div className={`rounded-2xl border p-4 flex gap-4 items-center ${STATUS_CLS[entry.status]}`}>
            <img src={optimizedImage(entry.imagePath, 240)} alt={entry.name} className="w-20 h-20 rounded-xl object-cover shrink-0 bg-muted" />
            <div className="min-w-0">
              <p className="font-serif text-lg text-foreground truncate">{entry.name}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{tx[`${entry.status}Title` as const]}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tx[`${entry.status}Text` as const]}</p>
            </div>
          </div>
        )}

        {entry?.status === "approved" && entry.huntCode && <HuntQr code={entry.huntCode} huntName={huntName} costumeName={entry.name} />}

        {closed && !entry && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="font-serif text-lg text-foreground mb-1">Iscrizioni chiuse</p>
            <p className="text-sm text-muted-foreground">Al momento non si possono iscrivere nuovi costumi.</p>
          </div>
        )}

        {canEdit && !showForm && (
          <button
            onClick={() => setEditing(true)}
            className="w-full border border-border text-foreground rounded-xl py-3 text-sm hover:bg-card transition"
          >
            Cambia foto o nome
          </button>
        )}

        {showForm && (
          <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-md">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {entry
                ? "Vuoi cambiare foto o nome? Carica di nuovo qui sotto."
                : tx.entryIntro}
            </p>

            <div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
                aria-label="Foto del costume"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full aspect-[4/5] max-h-[60vh] rounded-2xl border-2 border-dashed border-border bg-background/60 overflow-hidden flex items-center justify-center hover:border-primary/60 transition"
              >
                {preview ? (
                  <img src={preview} alt="Anteprima" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-muted-foreground">
                    <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <span className="text-sm">Scatta o scegli una foto</span>
                  </span>
                )}
              </button>
              {preview && (
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 text-xs text-primary underline underline-offset-4">
                  Cambia foto
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2" htmlFor="e-name">
                Nome del costume
              </label>
              <input id="e-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="es. La Dama del Lago" className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2" htmlFor="e-author">
                Il tuo nome o nickname <span className="text-muted-foreground font-normal">(facoltativo, lo vede solo l'organizzazione)</span>
              </label>
              <input id="e-author" type="text" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={40} placeholder="es. Veneziano23" className={inputClass} />
            </div>

            <label className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-4 h-4 accent-primary shrink-0" />
              {tx.consentText}
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {progress !== null ? (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary" animate={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="text-xs text-center text-muted-foreground">Caricamento… {Math.round(progress * 100)}%</p>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-4 text-base hover:opacity-90 active:scale-[0.97] transition-all shadow"
              >
                {entry ? "Invia la nuova foto" : tx.entrySubmit}
              </button>
            )}
          </form>
        )}

        {session?.isOpen && (
          <button onClick={() => setLocation(getStoredVoter() ? "/vote" : "/")} className="w-full text-sm text-muted-foreground underline underline-offset-4">
            Vai ai costumi da votare
          </button>
        )}
      </div>
    </div>
  );
}
