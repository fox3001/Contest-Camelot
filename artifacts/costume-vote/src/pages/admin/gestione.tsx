import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useListAdminCostumes,
  useCreateCostume,
  useDeleteCostume,
  getListAdminCostumesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminGestione() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("adminToken") ?? "";
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: "", imagePath: "", displayOrder: "" });
  const [formError, setFormError] = useState("");

  const { data: costumes, isLoading } = useListAdminCostumes({
    query: { queryKey: getListAdminCostumesQueryKey(), enabled: !!token },
    request: { headers: { "x-admin-token": token } },
  });

  const { mutate: createCostume, isPending: isCreating } = useCreateCostume({
    request: { headers: { "x-admin-token": token } },
  });

  const { mutate: deleteCostume } = useDeleteCostume({
    request: { headers: { "x-admin-token": token } },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.imagePath.trim()) {
      setFormError("Nome e URL immagine sono obbligatori");
      return;
    }
    if ((costumes?.length ?? 0) >= 180) {
      setFormError("Limite massimo di 180 costumi raggiunto");
      return;
    }
    setFormError("");
    createCostume(
      {
        data: {
          name: form.name.trim(),
          imagePath: form.imagePath.trim(),
          displayOrder: Number(form.displayOrder) || 0,
        },
      },
      {
        onSuccess: () => {
          setForm({ name: "", imagePath: "", displayOrder: "" });
          queryClient.invalidateQueries({ queryKey: getListAdminCostumesQueryKey() });
        },
        onError: () => setFormError("Errore durante il salvataggio"),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCostume(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminCostumesQueryKey() });
        },
      }
    );
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => setLocation("/admin/dashboard")}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-serif text-foreground">Gestione Costumi</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        <form
          onSubmit={handleAdd}
          className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow"
        >
          <h2 className="text-base font-medium text-foreground">Aggiungi Costume</h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome costume</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="es. Arlecchino"
              className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">URL immagine</label>
            <input
              type="text"
              value={form.imagePath}
              onChange={(e) => setForm((p) => ({ ...p, imagePath: e.target.value }))}
              placeholder="https://... oppure /grafiche/costume.png"
              className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ordine di visualizzazione</label>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))}
              placeholder="0"
              className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <button
            type="submit"
            disabled={isCreating}
            className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-3 text-sm hover:opacity-90 active:scale-95 transition disabled:opacity-50"
          >
            {isCreating ? "Salvataggio..." : "Aggiungi Costume"}
          </button>
        </form>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Costumi in gara
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

          {costumes && costumes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nessun costume ancora. Aggiungine uno sopra.
            </div>
          )}

          <div className="space-y-2">
            {costumes?.map((costume, i) => (
              <motion.div
                key={costume.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
              >
                {costume.imagePath && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                    <img
                      src={costume.imagePath}
                      alt={costume.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{costume.name}</p>
                  <p className="text-xs text-muted-foreground">Ordine: {costume.displayOrder}</p>
                </div>
                <button
                  onClick={() => handleDelete(costume.id)}
                  className="text-destructive hover:text-destructive/70 transition p-1"
                  aria-label="Elimina"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
