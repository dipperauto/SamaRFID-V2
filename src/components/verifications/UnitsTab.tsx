"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCancel } from "@/components/ui/dialog";
import { AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type LocationNode = {
  id: string;
  name: string;
  children: LocationNode[];
  parentId?: string | null;
};

export const UnitsTab: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const [nodes, setNodes] = React.useState<LocationNode[]>([]);
  const [openStart, setOpenStart] = React.useState(false);
  const [selectedUnit, setSelectedUnit] = React.useState<LocationNode | null>(null);
  const [includeSubUnits, setIncludeSubUnits] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/hierarchy`, { credentials: "include" });
        const data = await res.json();
        setNodes(data.nodes || []);
      } catch {
        toast.error("Falha ao carregar unidades.");
      }
    };
    load();
  }, [API_URL]);

  const handleStart = async () => {
    if (!selectedUnit) return;

    // Lógica para buscar ativos (similar a UnitAssets.tsx)
    // ...
    
    // Por simplicidade, vamos assumir que o backend lida com a busca de ativos
    const payload = {
      type: "unit",
      name: `Verificação de ${selectedUnit.name}${includeSubUnits ? " e filiais" : ""}`,
      target_id: selectedUnit.id,
      include_sub_units: includeSubUnits,
      assets_to_verify: [], // O backend deve preencher isso
    };

    try {
      const res = await fetch(`${API_URL}/api/verifications/sessions/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.session) {
        navigate(`/verifications/session/${data.session.id}`);
      }
    } catch {
      toast.error("Falha ao iniciar verificação.");
    }
  };

  const renderNode = (node: LocationNode) => (
    <div key={node.id} className="ml-4 pl-4 border-l border-white/20">
      <div className="flex items-center justify-between p-2 rounded-md hover:bg-white/10">
        <span>{node.name}</span>
        <Button size="sm" onClick={() => { setSelectedUnit(node); setOpenStart(true); }}>
          Iniciar Verificação
        </Button>
      </div>
      {node.children.map(renderNode)}
    </div>
  );

  return (
    <div>
      {nodes.map(renderNode)}
      <Dialog open={openStart} onOpenChange={setOpenStart}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Iniciar Verificação</DialogTitle>
            <DialogDescription>
              Verificar ativos para a unidade "{selectedUnit?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <Switch id="include-sub-units" checked={includeSubUnits} onCheckedChange={setIncludeSubUnits} />
            <Label htmlFor="include-sub-units">Incluir filiais</Label>
          </div>
          <DialogFooter>
            <DialogCancel>Cancelar</DialogCancel>
            <Button onClick={handleStart}>Iniciar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};