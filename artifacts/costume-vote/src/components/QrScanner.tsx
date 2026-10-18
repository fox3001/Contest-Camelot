import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { codeFromText } from "@/lib/hunt";

/**
 * Scanner QR a tutto schermo con la fotocamera posteriore.
 * Se la fotocamera non è disponibile (permesso negato, computer) resta il campo per scrivere il codice.
 */
export function QrScanner({ title, onCode, onClose }: { title: string; onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camError, setCamError] = useState("");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const tick = () => {
      if (stopped || done.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const scale = Math.min(1, 640 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          const code = found ? codeFromText(found.data) : null;
          if (code) {
            done.current = true;
            if (navigator.vibrate) navigator.vibrate(80);
            onCode(code);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setCamError(
          e?.name === "NotAllowedError"
            ? "Fotocamera non autorizzata: consenti l'accesso nelle impostazioni del browser, oppure scrivi il codice qui sotto."
            : "Fotocamera non disponibile: scrivi il codice di 5 caratteri che trovi sotto il QR.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeFromText(manual);
    if (!code) return setManualError("Il codice è di 5 caratteri, lettere e numeri.");
    done.current = true;
    onCode(code);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-white font-serif">{title}</p>
        <button onClick={onClose} className="text-white/80 text-sm px-2 py-1" aria-label="Chiudi scanner">
          Chiudi ✕
        </button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {!camError ? (
          <>
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
            <div className="relative w-64 h-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" aria-hidden="true" />
            <p className="absolute bottom-6 inset-x-0 text-center text-white text-sm px-6">Inquadra il QR del costume</p>
          </>
        ) : (
          <p className="text-white/80 text-sm text-center px-8">{camError}</p>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <form onSubmit={submitManual} className="shrink-0 bg-background px-4 py-4 space-y-2">
        <label className="block text-xs text-muted-foreground" htmlFor="hunt-code">
          Oppure scrivi il codice sotto il QR
        </label>
        <div className="flex gap-2">
          <input
            id="hunt-code"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value.toUpperCase());
              setManualError("");
            }}
            maxLength={5}
            placeholder="es. K7M2Q"
            autoCapitalize="characters"
            autoComplete="off"
            className="flex-1 bg-card border border-input rounded-xl px-4 py-3 text-foreground tracking-[0.3em] uppercase text-center focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" className="bg-primary text-primary-foreground font-semibold rounded-xl px-5">
            OK
          </button>
        </div>
        {manualError && <p className="text-xs text-destructive">{manualError}</p>}
      </form>
    </div>
  );
}
