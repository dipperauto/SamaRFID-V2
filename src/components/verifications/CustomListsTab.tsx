"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
// ... (Modal de criação/edição será adicionado)

type CustomList = {
  id: string;
  name: string;
  description: string;
  asset_ids: number[];
};

export const CustomListsTab: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "https://sama.dipperauto.com";
  const [lists, setLists] = React.useState<CustomList[]>([]);

  const loadLists = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/verifications/custom-lists`, { credentials: "include" });
      const data = await res.json();
      setLists(data.lists || []);
    } catch {
      toast.error("Falha ao carregar listas.");
    }
  }, [API_URL]);

  React.useEffect(() => {
    loadLists();
  }, [loadLists]);

  const deleteList = async (id: string) => {
    await fetch(`${API_URL}/api/verifications/custom-lists/${id}`, { method: "DELETE", credentials: "include" });
    toast.success("Lista excluída.");
    loadLists();
  };

  return (
    <div>
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Criar Lista Personalizada
      </Button>
      <div className="mt-4 space-y-2">
        {lists.map(list => (
          <div key={list.id} className="flex items-center justify-between p-2 rounded-md bg-white/10">
            <div>
              <div className="font-semibold">{list.name}</div>
              <div className="text-xs text-white/80">{list.description}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">Iniciar</Button>
              <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="destructive" onClick={() => deleteList(list.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};