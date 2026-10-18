import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAdminCostumes,
  useListVoterCodes,
  useGetResults,
  getListAdminCostumesQueryKey,
  getListVoterCodesQueryKey,
  getGetResultsQueryKey,
  getGetActiveSessionQueryKey,
  useGetActiveSession,
  createCostume,
  updateCostume,
  deleteCostume,
  createVoterCodes,
  deleteUnusedVoterCodes,
  updateSessionSettings,
  setCostumeStatus,
  type Costume,
} from "@workspace/api-client-react";
import { optimizedImage } from "@/lib/images";
import { huntUrl, qrDataUrl } from "@/lib/hunt";
import { useQueryClient } from "@tanstack/react-query";
import { adminRequest, clearAdminToken, getAdminToken, setAdminToken } from "@/lib/storage";

const MAX_COSTUMES = 180;

const inputClass =
  "w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

type FormState = { name: string; imagePath: string; displayOrder: string };
const EMPTY_FORM: FormState = { name: "", imagePath: "", displayOrder: "" };

function ConfirmDelete({
  costume,
  onConfirm,
  onCancel,
  isPending,
}: {
  costume: Costume;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
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
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg"
      >
        <h2 className="text-lg font-serif text-foreground mb-1">Eliminare “{costume.name}”?</h2>
        <p className="text-sm text-muted-foreground mb-5">Verranno cancellati anche tutti i voti ricevuti. Non si può annullare.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-muted text-foreground rounded-xl py-3 font-medium hover:opacity-80 transition">
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl py-3 font-semibold bg-destructive text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
          >
            {isPending ? "..." : "Elimina"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VoterCodesPanel() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: results } = useGetResults({
    query: { queryKey: getGetResultsQueryKey(), retry: false },
    request: adminRequest(),
  });
  const { data: codes } = useListVoterCodes({
    query: { queryKey: getListVoterCodesQueryKey(), retry: false },
    request: adminRequest(),
  });

  if (!results) return null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListVoterCodesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActiveSessionQueryKey() });
  };

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      refresh();
    } catch {
      setError("Operazione non riuscita, riprova.");
    } finally {
      setBusy(false);
    }
  };

  const unused = (codes ?? []).filter((c) => !c.used);

  const downloadCsv = () => {
    const rows = [["codice", "usato", "nickname"], ...(codes ?? []).map((c) => [c.code, c.used ? "si" : "no", c.nickname ?? ""])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `codici-votanti-${results.sessionName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printCodes = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const cells = unused
      .map((c) => `<div class="c"><small>Codice votante</small><b>${c.code}</b></div>`)
      .join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Codici votanti</title>
      <style>body{font-family:Georgia,serif;margin:12mm}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}
      .c{border:1px dashed #888;padding:5mm;text-align:center}.c small{display:block;font-size:9pt;color:#555}
      .c b{font-size:20pt;letter-spacing:3pt}</style></head><body><div class="g">${cells}</div>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-foreground">Codici votante</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Con i codici attivi, per votare serve un codice monouso (da stampare sui biglietti). Senza codici vale un voto per telefono.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={results.requireCode}
          disabled={busy}
          onClick={() => act(() => updateSessionSettings(results.sessionId, { requireCode: !results.requireCode }, adminRequest()))}
          className={`relative shrink-0 w-12 h-7 rounded-full transition ${results.requireCode ? "bg-primary" : "bg-muted"} disabled:opacity-50`}
          aria-label="Codici obbligatori"
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-background transition-all ${results.requireCode ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-24 shrink-0 bg-background border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          aria-label="Quanti codici"
        />
        <button
          disabled={busy || !(Number(count) >= 1 && Number(count) <= 500)}
          onClick={() => act(() => createVoterCodes({ count: Number(count) }, adminRequest()))}
          className="flex-1 bg-primary text-primary-foreground font-semibold rounded-xl py-3 text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          Genera codici
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {codes?.length ?? 0} codici, {(codes?.length ?? 0) - unused.length} usati.
      </p>

      {(codes?.length ?? 0) > 0 && (
        <>
          <div className="flex gap-2">
            <button onClick={printCodes} disabled={unused.length === 0} className="flex-1 bg-muted text-foreground rounded-xl py-2.5 text-sm hover:opacity-80 transition disabled:opacity-50">
              Stampa non usati
            </button>
            <button onClick={downloadCsv} className="flex-1 bg-muted text-foreground rounded-xl py-2.5 text-sm hover:opacity-80 transition">
              Scarica CSV
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
            {codes!.map((c) => (
              <span
                key={c.code}
                title={c.nickname ?? "Non usato"}
                className={`text-center font-mono text-xs py-1.5 rounded-lg border ${c.used ? "border-border/40 text-muted-foreground line-through" : "border-border text-foreground"}`}
              >
                {c.code}
              </span>
            ))}
          </div>
          {unused.length > 0 && (
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Eliminare i ${unused.length} codici non usati?`)) act(() => deleteUnusedVoterCodes(adminRequest()));
              }}
              className="text-xs text-destructive underline underline-offset-4"
            >
              Elimina i codici non usati
            </button>
          )}
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const CHECK_TEXT: Record<string, string> = {
  missing: "Manca la variabile CLOUDINARY_URL su Render (Environment).",
  format: "CLOUDINARY_URL su Render è scritta male: deve essere cloudinary://API_KEY:API_SECRET@NOME_ACCOUNT, senza spazi né < >.",
  secret: "La password segreta (API Secret) in CLOUDINARY_URL è sbagliata: ricopiala dalla console Cloudinary.",
  api_key: "L'API Key in CLOUDINARY_URL è sbagliata: ricopiala dalla console Cloudinary.",
  cloud_name: "Il nome dell'account (dopo la @) in CLOUDINARY_URL è sbagliato.",
  unreachable: "Il server non riesce a contattare Cloudinary in questo momento: riprova tra poco.",
};

function CloudinaryCheck() {
  const [state, setState] = useState<{ loading: boolean; ok?: boolean; text?: string }>({ loading: false });
  const run = async () => {
    setState({ loading: true });
    try {
      const r = await fetch("/api/admin/cloudinary/check", adminRequest());
      const d = await r.json();
      setState({
        loading: false,
        ok: !!d.ok,
        text: d.ok ? `Collegamento a Cloudinary corretto (account ${d.cloudName}).` : CHECK_TEXT[d.problem] ?? `Problema: ${d.problem}`,
      });
    } catch {
      setState({ loading: false, ok: false, text: "Verifica non riuscita, riprova." });
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" onClick={run} disabled={state.loading} className="text-xs text-primary underline underline-offset-4 disabled:opacity-50">
        {state.loading ? "Verifica in corso..." : "Verifica collegamento Cloudinary"}
      </button>
      {state.text && (
        <p className={`text-xs rounded-lg px-3 py-2 ${state.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-foreground border border-destructive/40"}`}>
          {state.ok ? "✓ " : "⚠ "}
          {state.text}
        </p>
      )}
    </div>
  );
}

function EntriesPanel({ costumes, onChanged }: { costumes: Costume[] | undefined; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<number | "toggle" | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<Costume | null>(null);

  const { data: results } = useGetResults({
    query: { queryKey: getGetResultsQueryKey(), retry: false },
    request: adminRequest(),
  });
  const { data: session } = useGetActiveSession({ query: { queryKey: getGetActiveSessionQueryKey(), retry: false } });

  if (!results) return null;
  const pending = (costumes ?? []).filter((c) => c.status === "pending");
  const available = session?.entriesAvailable ?? false;

  const act = async (key: number | "toggle", fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      onChanged();
      queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetActiveSessionQueryKey() });
    } catch {
      setError("Operazione non riuscita, riprova.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-foreground">Iscrizioni dei partecipanti</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {available
              ? "Con le iscrizioni aperte, chi è in costume carica la propria foto dal telefono. Entra in gara solo dopo la tua approvazione."
              : "Per attivarle serve la variabile CLOUDINARY_URL sul server (Render → Environment)."}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={results.entriesOpen}
          aria-label="Iscrizioni aperte"
          disabled={!available || busy === "toggle"}
          onClick={() => act("toggle", () => updateSessionSettings(results.sessionId, { entriesOpen: !results.entriesOpen }, adminRequest()))}
          className={`relative shrink-0 w-12 h-7 rounded-full transition ${results.entriesOpen && available ? "bg-primary" : "bg-muted"} disabled:opacity-50`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-background transition-all ${results.entriesOpen && available ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <CloudinaryCheck />

      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna iscrizione da approvare.</p>
      ) : (
        <div>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2">Da approvare ({pending.length})</p>
          <div className="space-y-2">
            {pending.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-background/60 border border-border rounded-xl p-3">
                <button onClick={() => setZoom(c)} className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-muted" aria-label={`Ingrandisci ${c.name}`}>
                  <img src={optimizedImage(c.imagePath, 200)} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  {c.submittedBy && <p className="text-xs text-muted-foreground truncate">da {c.submittedBy}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    disabled={busy === c.id}
                    onClick={() => act(c.id, () => setCostumeStatus(c.id, { status: "approved" }, adminRequest()))}
                    className="bg-primary text-primary-foreground text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    Approva
                  </button>
                  <button
                    disabled={busy === c.id}
                    onClick={() => act(c.id, () => setCostumeStatus(c.id, { status: "rejected" }, adminRequest()))}
                    className="bg-muted text-foreground text-xs rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
            onClick={() => setZoom(null)}
          >
            <img src={optimizedImage(zoom.imagePath, 1400)} alt={zoom.name} className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <p className="text-white/80 text-sm mt-3">{zoom.name}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HuntPanel({ costumes }: { costumes: Costume[] | undefined }) {
  const queryClient = useQueryClient();
  const { data: results } = useGetResults({ query: { queryKey: getGetResultsQueryKey(), retry: false, refetchInterval: 10000 }, request: adminRequest() });
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!results) return null;
  const shownName = name ?? results.huntName;

  const save = async (patch: { huntEnabled?: boolean; huntName?: string }) => {
    setBusy(true);
    setError("");
    try {
      await updateSessionSettings(results.sessionId, patch, adminRequest());
      queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetActiveSessionQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAdminCostumesQueryKey() });
      if (patch.huntName) setName(null);
    } catch {
      setError("Operazione non riuscita, riprova.");
    } finally {
      setBusy(false);
    }
  };

  const printQr = async () => {
    const list = (costumes ?? []).filter((c) => c.status === "approved" && c.huntCode);
    const w = window.open("", "_blank");
    if (!w) return;
    const cards = await Promise.all(
      list.map(async (c) => {
        const qr = await qrDataUrl(huntUrl(c.huntCode!), 400);
        const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
        return `<div class="c"><img class="q" src="${qr}"/><b>${esc(c.name)}</b><span>${c.huntCode}</span></div>`;
      }),
    );
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${results.huntName}</title>
      <style>body{font-family:Georgia,serif;margin:10mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
      .c{border:1px dashed #888;padding:4mm;text-align:center;break-inside:avoid}.q{width:100%;height:auto}
      .c b{display:block;font-size:11pt;margin-top:2mm}.c span{font-family:monospace;font-size:14pt;letter-spacing:3pt}</style></head>
      <body><div class="g">${cards.join("")}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const hunters = results.hunters ?? [];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-foreground">Modalità caccia: {results.huntName}</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Quando è attiva, per votare un costume bisogna trovarlo e scansionarne il QR. Chi è in costume trova il suo QR nella scheda "Il tuo costume". Puoi accenderla e spegnerla quando vuoi.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={results.huntEnabled}
          aria-label="Modalità caccia"
          disabled={busy}
          onClick={() => save({ huntEnabled: !results.huntEnabled })}
          className={`relative shrink-0 w-12 h-7 rounded-full transition ${results.huntEnabled ? "bg-primary" : "bg-muted"} disabled:opacity-50`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-background transition-all ${results.huntEnabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={shownName}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label="Nome della modalità"
          className="flex-1 bg-background border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        <button
          disabled={busy || !shownName.trim() || shownName.trim() === results.huntName}
          onClick={() => save({ huntName: shownName.trim() })}
          className="bg-muted text-foreground text-sm rounded-xl px-4 disabled:opacity-40"
        >
          Rinomina
        </button>
      </div>

      <button onClick={printQr} className="w-full bg-muted text-foreground rounded-xl py-2.5 text-sm hover:opacity-80 transition">
        Stampa i QR dei costumi in gara
      </button>

      <div>
        <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2">Classifica cacciatori (solo admin)</p>
        {hunters.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ancora nessuna cattura.</p>
        ) : (
          <ol className="space-y-1">
            {hunters.slice(0, 10).map((h) => (
              <li key={h.rank} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center text-muted-foreground">{h.rank}</span>
                <span className="flex-1 truncate text-foreground">{h.nickname}</span>
                <span className="text-primary font-medium">{h.count}</span>
                <span className="text-xs text-muted-foreground w-16 text-right">{h.minutes} min</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function PasswordPanel() {
  const [current, setCurrent] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/password", adminRequest())
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCurrent(d.password))
      .catch(() => {});
  }, []);

  const save = async () => {
    setMsg(null);
    if (next.trim().length < 4) return setMsg({ ok: false, text: "Almeno 4 caratteri." });
    setBusy(true);
    try {
      const r = await fetch("/api/admin/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(adminRequest().headers as Record<string, string>) },
        body: JSON.stringify({ password: next.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error);
      setAdminToken(d.token);
      setCurrent(next.trim());
      setNext("");
      setShow(true);
      setMsg({
        ok: true,
        text: d.backup
          ? "Password cambiata. Copia aggiornata su Cloudinary: Media Library → cartella contest-camelot → password-admin.txt."
          : "Password cambiata. La copia su Cloudinary non è riuscita (controlla il collegamento Cloudinary): segnatela.",
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Cambio non riuscito, riprova." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow">
      <div>
        <h2 className="text-base font-medium text-foreground">Password del pannello</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Cambiandola, gli altri dispositivi entrati come admin dovranno rifare l'accesso.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-sm bg-background border border-input rounded-xl px-4 py-3 text-foreground truncate">
          {current === null ? "…" : show ? current : "•".repeat(Math.min(12, current.length || 8))}
        </span>
        <button type="button" onClick={() => setShow((v) => !v)} className="bg-muted text-foreground text-xs rounded-lg px-3 py-3 shrink-0">
          {show ? "Nascondi" : "Mostra"}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Nuova password"
          maxLength={100}
          autoComplete="off"
          className="flex-1 bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          aria-label="Nuova password"
        />
        <button type="button" onClick={save} disabled={busy || !next.trim()} className="bg-primary text-primary-foreground text-sm font-semibold rounded-xl px-4 disabled:opacity-50 shrink-0">
          {busy ? "..." : "Cambia"}
        </button>
      </div>
      {msg && <p className={`text-xs rounded-lg px-3 py-2 ${msg.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-foreground"}`}>{msg.text}</p>}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Se la dimentichi: Cloudinary → Media Library → contest-camelot → password-admin.txt, oppure nel database Neon (SQL Editor:{" "}
        <span className="font-mono">select value from app_settings where key = 'admin_password'</span>).
      </p>
    </div>
  );
}

export default function AdminGestione() {
  const [, setLocation] = useLocation();
  const token = getAdminToken();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Costume | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token) setLocation("/admin");
  }, [token, setLocation]);

  const { data: costumes, isLoading, error } = useListAdminCostumes({
    query: { queryKey: getListAdminCostumesQueryKey(), enabled: !!token, retry: false, refetchInterval: 10000 },
    request: adminRequest(),
  });

  const status = (error as any)?.status as number | undefined;
  useEffect(() => {
    if (status === 401) {
      clearAdminToken();
      setLocation("/admin");
    }
  }, [status, setLocation]);

  const inGara = (costumes ?? []).filter((c) => c.status === "approved");
  const rejected = (costumes ?? []).filter((c) => c.status === "rejected");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminCostumesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResultsQueryKey() });
  };

  const startEdit = (c: Costume) => {
    setEditingId(c.id);
    setForm({ name: c.name, imagePath: c.imagePath, displayOrder: String(c.displayOrder) });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.imagePath.trim()) {
      setFormError("Nome e URL immagine sono obbligatori");
      return;
    }
    if (editingId === null && (costumes?.length ?? 0) >= MAX_COSTUMES) {
      setFormError(`Limite massimo di ${MAX_COSTUMES} costumi raggiunto`);
      return;
    }
    const data = {
      name: form.name.trim(),
      imagePath: form.imagePath.trim(),
      displayOrder: Number(form.displayOrder) || 0,
    };
    setSaving(true);
    setFormError("");
    try {
      if (editingId === null) await createCostume(data, adminRequest());
      else await updateCostume(editingId, data, adminRequest());
      setEditingId(null);
      setForm(EMPTY_FORM);
      refresh();
    } catch (err: any) {
      setFormError(err?.status === 404 ? "Crea prima una sessione dal pannello admin" : "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteCostume(toDelete.id, adminRequest());
      if (editingId === toDelete.id) cancelEdit();
      setToDelete(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => setLocation("/admin/dashboard")} className="text-muted-foreground hover:text-foreground transition" aria-label="Indietro">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-serif text-foreground">Gestione</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow">
          <h2 className="text-base font-medium text-foreground">{editingId === null ? "Aggiungi costume" : "Modifica costume"}</h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block" htmlFor="c-name">Nome costume</label>
            <input
              id="c-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="es. #042 Arlecchino"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block" htmlFor="c-img">URL immagine</label>
            <input
              id="c-img"
              type="text"
              value={form.imagePath}
              onChange={(e) => setForm((p) => ({ ...p, imagePath: e.target.value }))}
              placeholder="https://... oppure /grafiche/costume.png"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block" htmlFor="c-order">Ordine (solo per la lista admin: i votanti vedono un ordine casuale)</label>
            <input
              id="c-order"
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))}
              placeholder="0"
              className={inputClass}
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex gap-2">
            {editingId !== null && (
              <button type="button" onClick={cancelEdit} className="flex-1 bg-muted text-foreground rounded-xl py-3 text-sm font-medium hover:opacity-80 transition">
                Annulla
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-primary-foreground font-semibold rounded-xl py-3 text-sm hover:opacity-90 active:scale-95 transition disabled:opacity-50"
            >
              {saving ? "Salvataggio..." : editingId === null ? "Aggiungi costume" : "Salva modifiche"}
            </button>
          </div>
        </form>

        <EntriesPanel costumes={costumes} onChanged={refresh} />

        <HuntPanel costumes={costumes} />

        <VoterCodesPanel />

        <PasswordPanel />

        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Costumi in gara {costumes ? `(${inGara.length}/${MAX_COSTUMES})` : ""}
          </h2>

          {isLoading && (
            <div className="flex justify-center py-6">
              <div className="flex gap-2">
                {[0, 0.15, 0.3].map((d, i) => (
                  <motion.div key={i} animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.8, delay: d, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-primary" />
                ))}
              </div>
            </div>
          )}

          {costumes && inGara.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nessun costume ancora. Aggiungine uno sopra.</div>
          )}

          <div className="space-y-2">
            {[...inGara, ...rejected].map((costume) => (
              <div
                key={costume.id}
                className={`bg-card border rounded-xl p-4 flex items-center gap-3 ${editingId === costume.id ? "border-primary" : "border-border"}`}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                  <img
                    src={optimizedImage(costume.imagePath, 120)}
                    alt={costume.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{costume.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {costume.status === "rejected" ? (
                      <span className="text-destructive">Rifiutato</span>
                    ) : (
                      <>Ordine: {costume.displayOrder}</>
                    )}
                    {costume.submittedBy ? ` · da ${costume.submittedBy}` : ""}
                  </p>
                </div>
                <button onClick={() => startEdit(costume)} className="text-muted-foreground hover:text-foreground transition p-1" aria-label={`Modifica ${costume.name}`}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
                <button onClick={() => setToDelete(costume)} className="text-destructive hover:text-destructive/70 transition p-1" aria-label={`Elimina ${costume.name}`}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toDelete && <ConfirmDelete costume={toDelete} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} isPending={deleting} />}
      </AnimatePresence>
    </div>
  );
}
