import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { getStoredVoter } from "@/lib/storage";
import { CATCH_ERRORS, catchCostume, setPendingCode, type CatchResult } from "@/lib/hunt";
import { optimizedImage } from "@/lib/images";
import { useTheme } from "@/lib/theme";
import { WinImage } from "@/components/WinImage";

/**
 * Pagina aperta dal QR di un costume (fotocamera del telefono o scanner dell'app).
 * Se il visitatore non è ancora entrato come votante, si ricorda il codice e lo manda a entrare.
 */
export default function Caccia() {
  const params = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<CatchResult | null>(null);
  const tx = useTheme().theme.texts;

  useEffect(() => {
    const code = (params.code ?? "").toUpperCase();
    if (!getStoredVoter()) {
      setPendingCode(code);
      setLocation("/entra");
      return;
    }
    catchCostume(code).then(setResult);
  }, [params.code, setLocation]);

  if (!result) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Cattura in corso…</p>
      </div>
    );
  }

  const goVote = (id?: number) => setLocation(id ? `/vote#costume-${id}` : "/vote");

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xs w-full bg-card border border-border rounded-2xl p-6 shadow-lg">
        {result.ok ? (
          <>
            <img src={optimizedImage(result.imagePath, 500)} alt={result.name} className="w-full aspect-[4/5] object-cover rounded-xl mb-4 bg-muted" />
            {result.targetWin && (
              <div className="mb-4 rounded-xl bg-primary text-primary-foreground p-4">
                <WinImage small />
                <p className="font-serif text-xl">{tx.winTitle}</p>
                <p className="text-xs opacity-80">{result.targetWin.title}</p>
                <p className="text-sm mt-1">{result.targetWin.prize}</p>
                {result.targetWin.prizeInfo && <p className="text-xs mt-1 whitespace-pre-line">{result.targetWin.prizeInfo}</p>}
                <p className="text-xs mt-3 opacity-80">{tx.winText}</p>
                <p className="font-mono text-4xl tracking-[0.2em]">{result.targetWin.claimCode}</p>
              </div>
            )}
            <p className="text-sm text-primary font-medium">{result.already ? "Già catturato" : "Catturato!"}</p>
            <h1 className="text-2xl font-serif text-foreground mt-1">{result.name}</h1>
            <p className="text-sm text-muted-foreground mt-2">Hai catturato {result.count} {result.count === 1 ? "costume" : "costumi"}. Ora puoi votarlo.</p>
            <button onClick={() => goVote(result.costumeId)} className="mt-5 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3.5">
              Vota ora
            </button>
          </>
        ) : (
          <>
            <p className="text-lg font-serif text-foreground mb-2">{result.name ?? "Ops"}</p>
            <p className="text-sm text-muted-foreground">{CATCH_ERRORS[result.error] ?? CATCH_ERRORS.server_error}</p>
            <button onClick={() => goVote()} className="mt-5 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3.5">
              Torna ai costumi
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
