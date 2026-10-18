import { useLocation } from "wouter";
import { getStoredVoter } from "@/lib/storage";
import { TargetAlert } from "@/components/TargetAlert";
import { useTheme } from "@/lib/theme";

/** Le due sezioni del votante, sempre visibili: votare o iscrivere il proprio costume. */
export function VoterTabs({ active, hasEntry }: { active: "vote" | "entry"; hasEntry?: boolean }) {
  const [, setLocation] = useLocation();
  const tx = useTheme().theme.texts;
  const tab = (on: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition ${
      on ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <>
    <div className="flex gap-1 bg-card border border-border rounded-2xl p-1" role="tablist">
      <button role="tab" aria-selected={active === "vote"} className={tab(active === "vote")} onClick={() => setLocation(getStoredVoter() ? "/vote" : "/entra")}>
        <span aria-hidden="true">★</span> {tx.tabVote}
      </button>
      <button role="tab" aria-selected={active === "entry"} className={tab(active === "entry")} onClick={() => setLocation("/iscriviti")}>
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        {hasEntry ? tx.tabMyEntry : tx.tabEntry}
      </button>
    </div>
    {getStoredVoter() && <TargetAlert />}
    </>
  );
}
