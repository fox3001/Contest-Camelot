import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useGetActiveSession, getGetActiveSessionQueryKey } from "@workspace/api-client-react";

export default function Closed() {
  const [, setLocation] = useLocation();
  const { data: session } = useGetActiveSession({ query: { queryKey: getGetActiveSessionQueryKey(), refetchInterval: 4000 } });

  useEffect(() => {
    if (session?.isOpen) setLocation("/");
  }, [session, setLocation]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Indietro
        </button>
        <button
          onClick={() => setLocation("/admin")}
          className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition px-2 py-1 rounded-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Admin
        </button>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="max-w-sm w-full"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
          transition={{ duration: 2, delay: 0.8, ease: "easeInOut" }}
          className="text-8xl mb-6"
          style={{ fontSize: "5rem" }}
        >
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-primary" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-3xl font-serif text-primary mb-3"
        >
          Votazioni Chiuse
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg text-foreground/80 leading-relaxed mb-6"
        >
          Le votazioni sono terminate.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <p className="text-muted-foreground text-sm leading-relaxed">
            Attendi gli annunci dell'araldo: il vincitore del concorso di costumi verra' rivelato a breve.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-8 flex justify-center gap-2"
        >
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, delay, repeat: Infinity, ease: "easeInOut" }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
