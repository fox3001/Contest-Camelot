import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Pulsante "?" presente in ogni pagina: spiega in poche righe cosa si può fare lì.
 * Il contenuto dipende dalla pagina aperta.
 */

type Item = { icon: string; text: ReactNode };
type Help = { title: string; intro: string; items: Item[]; tip?: string };

const HELP: Record<string, Help> = {
  "/": {
    title: "Benvenuto!",
    intro: "Da qui scegli chi sei.",
    items: [
      {
        icon: "🎭",
        text: (
          <>
            <b>Sei un ospite?</b> Tocca il pulsante grande: potrai votare i
            costumi e iscrivere il tuo.
          </>
        ),
      },
      {
        icon: "🔒",
        text: (
          <>
            <b>Sei dell'organizzazione?</b> Tocca “Area organizzatori” ed entra
            con la password.
          </>
        ),
      },
    ],
    tip: "Non serve registrarsi né scaricare niente: basta questo sito.",
  },
  "/entra": {
    title: "Entra per votare",
    intro:
      "Scegli un nickname: è il nome con cui ti vedranno gli organizzatori.",
    items: [
      {
        icon: "✍️",
        text: "Scrivi un nickname qualsiasi (non serve il tuo nome vero) e tocca il pulsante per entrare.",
      },
      {
        icon: "🎟️",
        text: "Se ti chiede un codice, te l'ha dato l'organizzazione all'ingresso.",
      },
      {
        icon: "📱",
        text: "Il telefono ti ricorda: se chiudi e riapri il sito, rientri da solo.",
      },
      {
        icon: "⏳",
        text: "Se le votazioni non sono ancora iniziate, aspetta: la pagina si aggiorna da sola.",
      },
    ],
    tip: "Un telefono = un votante. Il nickname non si può cambiare dopo.",
  },
  "/vote": {
    title: "Come si vota",
    intro: "Qui ci sono tutti i costumi in gara.",
    items: [
      {
        icon: "⭐",
        text: (
          <>
            Tocca le <b>stelle</b> sotto ogni costume: da 1 (poco) a 5
            (bellissimo). Il voto si salva da solo.
          </>
        ),
      },
      {
        icon: "✏️",
        text: "Hai cambiato idea? Tocca altre stelle: puoi modificare i voti per tutta la serata, fino alla chiusura.",
      },
      {
        icon: "🔢",
        text: "In alto vedi quanti costumi hai già votato. Non serve votarli tutti.",
      },
      {
        icon: "📷",
        text: (
          <>
            Sei in costume? Apri la scheda <b>Iscrivi il tuo costume</b> e
            carica una foto.
          </>
        ),
      },
      {
        icon: "🔒",
        text: (
          <>
            Vedi un lucchetto? È attiva la <b>caccia</b>: trova quella persona
            alla festa, tocca <b>Scansiona</b> e inquadra il QR sul suo
            telefono. Poi puoi votarla.
          </>
        ),
      },
      {
        icon: "🎯",
        text: (
          <>
            Se arriva un <b>indovinello</b>, il primo che trova il costume
            giusto e ne scansiona il QR vince un premio.
          </>
        ),
      },
    ],
    tip: "Il tuo costume non puoi votarlo: ci pensano gli altri!",
  },
  "/iscriviti": {
    title: "Iscrivi il tuo costume",
    intro: "Partecipa al contest con una foto del tuo costume.",
    items: [
      {
        icon: "📸",
        text: "Scatta o scegli una foto a figura intera, con buona luce.",
      },
      {
        icon: "🏷️",
        text: "Dai un nome al costume (es. “Regina dei Ghiacci”).",
      },
      {
        icon: "✅",
        text: "Spunta la casella del consenso e tocca il pulsante per inviare.",
      },
      {
        icon: "⏳",
        text: (
          <>
            L'organizzazione controlla la foto. Finché è <b>in attesa</b> puoi
            cambiarla.
          </>
        ),
      },
      {
        icon: "🎉",
        text: "Quando è approvata, il costume è in gara e tutti possono votarlo.",
      },
      {
        icon: "🔳",
        text: "Se compare un QR, tienilo a portata di mano: chi vuole votarti deve scansionarlo dal tuo telefono.",
      },
    ],
    tip: "Un costume per telefono: per coppie e gruppi lo iscrive una persona sola.",
  },
  "/caccia": {
    title: "Cattura",
    intro: "Hai scansionato il QR di un costume.",
    items: [
      { icon: "✅", text: "Ora quel costume è “catturato”: puoi votarlo." },
      {
        icon: "⭐",
        text: (
          <>
            Tocca <b>Vota ora</b> per tornare alla lista e dargli le stelle.
          </>
        ),
      },
      {
        icon: "🏆",
        text: "Se era il costume dell'indovinello e sei stato il primo, vedi il codice del premio: mostralo all'organizzazione.",
      },
    ],
  },
  "/closed": {
    title: "Votazioni chiuse",
    intro: "Il tempo per votare è finito.",
    items: [
      { icon: "🏆", text: "L'organizzazione annuncerà presto i vincitori." },
      {
        icon: "🔄",
        text: "Se le votazioni vengono riaperte, la pagina se ne accorge da sola e ti fa rientrare.",
      },
    ],
  },
  "/admin": {
    title: "Area organizzatori",
    intro: "Accesso riservato a chi gestisce la serata.",
    items: [
      { icon: "🔑", text: "Scrivi la password del pannello e tocca invio." },
      { icon: "📱", text: "Il telefono resta collegato per 12 ore." },
      {
        icon: "❓",
        text: "Password dimenticata? C'è una copia su Cloudinary: Media Library → cartella contest-camelot → password-admin.txt.",
      },
    ],
  },
  "/admin/dashboard": {
    title: "Pannello admin",
    intro: "La situazione della serata in un colpo d'occhio.",
    items: [
      {
        icon: "🆕",
        text: (
          <>
            Prima volta? Tocca <b>Crea sessione</b> e dai un nome alla serata:
            da lì in poi si può votare.
          </>
        ),
      },
      {
        icon: "📊",
        text: "In alto: quanti votanti, quanti costumi e se le votazioni sono aperte.",
      },
      {
        icon: "🏆",
        text: "Sotto c'è la classifica dal vivo. Chi ha pochi voti viene “avvicinato” alla media, così non vince per caso.",
      },
      {
        icon: "🛠️",
        text: (
          <>
            <b>Gestisci</b>: costumi, iscrizioni da approvare, caccia, codici e
            password.
          </>
        ),
      },
      {
        icon: "🎨",
        text: (
          <>
            <b>Aspetto</b>: colori, caratteri, sfondo, logo e scritte (es. tema
            vichingo).
          </>
        ),
      },
      {
        icon: "🎯",
        text: (
          <>
            <b>Target Hunt</b>: manda a tutti un indovinello con un premio.
          </>
        ),
      },
      {
        icon: "🔴",
        text: (
          <>
            <b>Chiudi votazioni</b> a fine serata: la classifica si blocca. Puoi
            riaprirle quando vuoi.
          </>
        ),
      },
    ],
    tip: "“Nuova sessione” serve solo per un evento nuovo: riparte da zero.",
  },
  "/admin/gestione": {
    title: "Gestione",
    intro: "Tutto quello che serve per far funzionare la serata.",
    items: [
      {
        icon: "📥",
        text: (
          <>
            <b>Iscrizioni</b>: qui arrivano le foto degli ospiti. Tocca{" "}
            <b>Approva</b> per metterle in gara o <b>Rifiuta</b>.
          </>
        ),
      },
      {
        icon: "🔍",
        text: (
          <>
            <b>Modalità caccia</b>: se la accendi, per votare un costume bisogna
            scansionarne il QR. Puoi cambiarle nome e stampare i QR.
          </>
        ),
      },
      {
        icon: "🎟️",
        text: (
          <>
            <b>Codici votante</b>: se vuoi che entri solo chi ha un codice,
            attivali e stampali da distribuire.
          </>
        ),
      },
      {
        icon: "👥",
        text: (
          <>
            <b>Utenti di prova</b>: 5 persone finte per vedere l'app piena.
            Cancellale prima della serata!
          </>
        ),
      },
      {
        icon: "🔑",
        text: (
          <>
            <b>Password</b>: la vedi e la cambi qui.
          </>
        ),
      },
      {
        icon: "➕",
        text: (
          <>
            In fondo puoi <b>aggiungere</b> un costume a mano,{" "}
            <b>modificarlo</b> o <b>eliminarlo</b>.
          </>
        ),
      },
    ],
  },
  "/admin/aspetto": {
    title: "Aspetto",
    intro: "Cambia la grafica dell'app per ogni evento.",
    items: [
      {
        icon: "🪄",
        text: (
          <>
            <b>Temi</b>: un tocco su “Vichinghi” (o un altro) cambia tutto
            insieme. Poi ritocchi quello che vuoi.
          </>
        ),
      },
      {
        icon: "💾",
        text: (
          <>
            <b>I miei temi</b>: salva l'aspetto con un nome e ricaricalo a un
            altro evento.
          </>
        ),
      },
      {
        icon: "🎨",
        text: "Colori, sfondo (motivo o foto intera), logo e caratteri di titoli e testi.",
      },
      {
        icon: "✍️",
        text: (
          <>
            <b>Titoli e messaggi</b>: cambia le scritte che vedono gli ospiti.
            Lascia vuoto per il testo originale.
          </>
        ),
      },
      { icon: "👀", text: "Le modifiche le vedi subito qui come anteprima." },
      {
        icon: "✅",
        text: (
          <>
            Gli ospiti le vedono solo dopo che premi <b>Salva</b> in basso.
          </>
        ),
      },
    ],
  },
  "/admin/target": {
    title: "Target Hunt",
    intro: "Una sfida a premi per tutti gli ospiti.",
    items: [
      { icon: "1️⃣", text: "Scegli il costume da trovare (lo sai solo tu)." },
      {
        icon: "2️⃣",
        text: "Scrivi un indovinello che lo descriva senza dirne il nome.",
      },
      {
        icon: "3️⃣",
        text: "Scrivi il premio e, se vuoi, dove e quando ritirarlo.",
      },
      {
        icon: "🚀",
        text: (
          <>
            Tocca <b>Lancia a tutti i votanti</b>: l'indovinello compare sui
            loro telefoni.
          </>
        ),
      },
      {
        icon: "🏆",
        text: "Vince il primo che scansiona il QR di quel costume. Qui vedi chi ha vinto e il suo codice premio: controllalo quando viene a ritirare.",
      },
    ],
    tip: "Il pulsante resta grigio finché non hai scelto costume, indovinello e premio.",
  },
};

function helpFor(path: string): Help | null {
  if (HELP[path]) return HELP[path];
  if (path.startsWith("/caccia/")) return HELP["/caccia"];
  return null;
}

export function HelpButton() {
  const [path] = useLocation();
  const [open, setOpen] = useState(false);
  const help = helpFor(path);

  // Chiude la guida quando si cambia pagina
  useEffect(() => setOpen(false), [path]);

  if (!help) return null;
  // Nella pagina Aspetto c'è la barra di salvataggio in basso
  const bottom = path === "/admin/aspetto" ? "6.5rem" : "1rem";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Aiuto: cosa posso fare qui?"
        className="fixed right-4 z-40 w-11 h-11 rounded-full bg-card/90 backdrop-blur border border-primary/60 text-primary text-lg font-semibold shadow-lg flex items-center justify-center active:scale-95 transition"
        style={{ bottom: `calc(${bottom} + env(safe-area-inset-bottom))` }}
      >
        ?
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
              onClick={() => setOpen(false)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={help.title}
                initial={{ y: 80 }}
                animate={{ y: 0 }}
                exit={{ y: 80 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md max-h-[85dvh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl"
              >
                <div className="flex items-start gap-3 mb-1">
                  <h2 className="flex-1 text-2xl font-serif text-primary">
                    {help.title}
                  </h2>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Chiudi aiuto"
                    className="text-muted-foreground text-2xl leading-none px-1"
                  >
                    ×
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {help.intro}
                </p>
                <ul className="space-y-3">
                  {help.items.map((it, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span
                        className="text-xl leading-6 w-7 text-center shrink-0"
                        aria-hidden="true"
                      >
                        {it.icon}
                      </span>
                      <span className="text-sm text-foreground leading-relaxed">
                        {it.text}
                      </span>
                    </li>
                  ))}
                </ul>
                {help.tip && (
                  <p className="mt-5 text-xs text-foreground bg-primary/10 border border-primary/30 rounded-xl px-3 py-2">
                    💡 {help.tip}
                  </p>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="mt-5 w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3"
                >
                  Ho capito
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
