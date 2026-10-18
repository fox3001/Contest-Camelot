import { useLocation } from "wouter";

export function OrganizerLink() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex justify-center pt-10 pb-4">
      <button
        onClick={() => setLocation("/admin")}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition px-3 py-1.5"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Area organizzatori
      </button>
    </div>
  );
}
