import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { codeFromText } from "@/lib/hunt";

/** Browser dentro altre app (Instagram, Facebook, TikTok…): spesso bloccano la fotocamera. */
function inAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|TikTok|musical_ly|Snapchat|LinkedInApp|Telegram/i.test(
    ua,
  );
}

/** Cerca un QR in una foto: prova a più dimensioni e al centro dell'immagine. */
async function decodeFromPhoto(file: File): Promise<string | null> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = source.width;
  const h = source.height;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  // [porzione dell'immagine (1 = tutta, 0.6 = centro), lato massimo]
  const attempts: [number, number][] = [
    [1, 1000],
    [0.6, 1000],
    [1, 1600],
    [0.4, 900],
  ];
  for (const [part, side] of attempts) {
    const sw = w * part;
    const sh = h * part;
    const scale = Math.min(1, side / Math.max(sw, sh));
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    ctx.drawImage(
      source,
      (w - sw) / 2,
      (h - sh) / 2,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(img.data, img.width, img.height, {
      inversionAttempts: "attemptBoth",
    });
    const code = found ? codeFromText(found.data) : null;
    if (code) return code;
  }
  return null;
}

/**
 * Scanner QR a tutto schermo con la fotocamera posteriore.
 * Se la fotocamera non è disponibile (permesso negato, computer) resta il campo per scrivere il codice.
 */
export function QrScanner({
  title,
  onCode,
  onClose,
}: {
  title: string;
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camError, setCamError] = useState("");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const inApp = inAppBrowser();

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoMsg("Leggo il QR…");
    try {
      const code = await decodeFromPhoto(file);
      if (!code) {
        setPhotoMsg(
          "Non trovo il QR nella foto: riprova più vicino, con il QR dritto e ben illuminato, o scrivi il codice.",
        );
        return;
      }
      done.current = true;
      setPhotoMsg("");
      if (navigator.vibrate) navigator.vibrate(80);
      onCode(code);
    } catch {
      setPhotoMsg("Non riesco ad aprire la foto: scrivi il codice qui sotto.");
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  };

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
          const found = jsQR(img.data, img.width, img.height, {
            inversionAttempts: "dontInvert",
          });
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

    setCamError("");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current!;
        // iPhone: senza playsinline e muted il video non parte dentro la pagina
        video.setAttribute("playsinline", "true");
        video.muted = true;
        video.srcObject = stream;
        await video.play();
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setCamError(
          e?.name === "NotAllowedError"
            ? "La fotocamera non è stata autorizzata. Su iPhone: quando te lo chiede tocca “Consenti”; se l'hai negata, tocca “aA” nella barra di Safari → Impostazioni sito → Fotocamera → Consenti."
            : "La fotocamera dal vivo non parte su questo telefono.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode, attempt]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeFromText(manual);
    if (!code)
      return setManualError("Il codice è di 5 caratteri, lettere e numeri.");
    done.current = true;
    onCode(code);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-white font-serif">{title}</p>
        <button
          onClick={onClose}
          className="text-white/80 text-sm px-2 py-1"
          aria-label="Chiudi scanner"
        >
          Chiudi ✕
        </button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {!camError ? (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="relative w-64 h-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              aria-hidden="true"
            />
            <p className="absolute bottom-6 inset-x-0 text-center text-white text-sm px-6">
              Inquadra il QR del costume
            </p>
          </>
        ) : (
          <div className="text-center px-8 space-y-4">
            <p className="text-white/85 text-sm">{camError}</p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="text-white underline underline-offset-4 text-sm"
            >
              Riprova con la fotocamera
            </button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="shrink-0 bg-background px-4 pt-4 space-y-2">
        {inApp && (
          <p className="text-xs text-foreground bg-primary/10 border border-primary/30 rounded-xl px-3 py-2">
            Sei dentro un'altra app (Instagram, Facebook…): se la fotocamera non
            va, apri questo sito in Safari o Chrome.
          </p>
        )}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => fromPhoto(e.target.files?.[0])}
          aria-label="Foto del QR"
        />
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className={`w-full rounded-xl py-3 text-sm font-semibold ${camError ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
        >
          📸{" "}
          {camError
            ? "Scatta una foto del QR"
            : "Non legge? Scatta una foto del QR"}
        </button>
        {photoMsg && <p className="text-xs text-foreground">{photoMsg}</p>}
      </div>
      <form
        onSubmit={submitManual}
        className="shrink-0 bg-background px-4 py-4 space-y-2"
      >
        <label
          className="block text-xs text-muted-foreground"
          htmlFor="hunt-code"
        >
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
          <button
            type="submit"
            className="bg-primary text-primary-foreground font-semibold rounded-xl px-5"
          >
            OK
          </button>
        </div>
        {manualError && (
          <p className="text-xs text-destructive">{manualError}</p>
        )}
      </form>
    </div>
  );
}
