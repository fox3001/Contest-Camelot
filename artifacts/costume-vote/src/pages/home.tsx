import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetActiveSession, getGetActiveSessionQueryKey } from "@workspace/api-client-react";
import { getAdminToken, getStoredVoter } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

/**
 * Pagina iniziale: si sceglie se entrare come votante o come organizzatore.
 */
export default function Home() {
  const [, setLocation] = useLocation();
  const { theme, logoSrc } = useTheme();
  const { data: session } = useGetActiveSession({
    query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 10000, retry: false },
  });

  const stored = getStoredVoter();
  const registered = !!(session && stored && stored.sessionId === String(session.id));

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 py-8 safe-area-inset">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-xs flex flex-col items-center"
      >
        <motion.img
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          src={logoSrc}
          alt={theme.texts.appTitle}
          style={{ width: `${theme.logo.size}vw`, maxWidth: `${Math.round((384 * theme.logo.size) / 88)}px` }}
          className="h-auto object-contain mb-3 drop-shadow-[0_0_32px_rgba(180,210,255,0.4)]"
        />

        {(theme.texts.homeTitle || theme.texts.homeSubtitle) && (
          <div className="text-center mb-6">
            {theme.texts.homeTitle && <h1 className="text-2xl font-serif text-primary leading-tight">{theme.texts.homeTitle}</h1>}
            {theme.texts.homeSubtitle && <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">{theme.texts.homeSubtitle}</p>}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full space-y-3 mt-2"
        >
          <button
            onClick={() => setLocation(registered ? "/vote" : "/entra")}
            className="w-full bg-primary text-primary-foreground font-semibold rounded-2xl py-4 text-base hover:opacity-90 active:scale-[0.97] transition-all shadow"
          >
            {registered ? `Continua come ${stored!.nickname}` : theme.texts.voterButton}
          </button>
          <p className="text-xs text-center text-muted-foreground leading-relaxed px-2">{theme.texts.voterHint}</p>

          <button
            onClick={() => setLocation(getAdminToken() ? "/admin/dashboard" : "/admin")}
            className="w-full mt-4 bg-card border border-border text-foreground font-medium rounded-2xl py-3.5 text-sm hover:border-primary/60 active:scale-[0.97] transition-all"
          >
            {theme.texts.adminButton}
          </button>
        </motion.div>

        {session && !session.isOpen && (
          <p className="mt-6 text-xs text-center text-muted-foreground">Le votazioni di "{session.name}" sono chiuse.</p>
        )}
      </motion.div>
    </div>
  );
}
