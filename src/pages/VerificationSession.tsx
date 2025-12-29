"use client";

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

type VerificationAsset = {
  id: number;
  name: string;
  item_code: string;
  unit_id: string;
  unit_path: string;
  expected_quantity: number;
  verified_quantity: number;
  verified: boolean;
};

type VerificationSession = {
  id: string;
  name: string;
  status: string;
  assets: VerificationAsset[];
};

const VerificationSessionPage: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [session, setSession] = React.useState<VerificationSession | null>(null);
  const [itemCode, setItemCode] = React.useState("");
  const [useCustomQty, setUseCustomQty] = React.useState(false);
  const [customQty, setCustomQty] = React.useState(1);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [confirmFinish, setConfirmFinish] = React.useState(false);

  const loadSession = React.useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/api/verifications/sessions/${sessionId}`, { credentials: "include" });
      if (!res.ok) {
        toast.error("Sessão de verificação não encontrada.");
        navigate("/verifications");
        return;
      }
      const data = await res.json();
      setSession(data.session);
    } catch {
      toast.error("Falha ao carregar sessão.");
    }
  }, [API_URL, sessionId, navigate]);

  React.useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleVerify = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !itemCode.trim()) return;
    const code = itemCode.trim();
    const quantity = useCustomQty ? customQty : 1;

    try {
      const res = await fetch(`${API_URL}/api/verifications/sessions/${sessionId}/verify-item`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_code: code, quantity }),
      });
      if (!res.ok) {
        toast.error("Item não encontrado nesta lista.");
        return;
      }
      const data = await res.json();
      toast.success(`Item "${data.item.name}" verificado.`);
      setItemCode("");
      await loadSession();
    } catch {
      toast.error("Falha ao verificar item.");
    }
  };

  const handleFinish = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_URL}/api/verifications/sessions/${sessionId}/finish`, { method: "POST", credentials: "include" });
      toast.success("Verificação finalizada.");
      navigate("/verifications");
    } catch {
      toast.error("Falha ao finalizar verificação.");
    }
  };

  const handleCancel = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_URL}/api/verifications/sessions/${sessionId}/cancel`, { method: "POST", credentials: "include" });
      toast.warning("Verificação cancelada.");
      navigate("/verifications");
    } catch {
      toast.error("Falha ao cancelar verificação.");
    }
  };

  const notVerifiedCount = session?.assets.filter(a => !a.verified).length || 0;

  return (
    <div className="min-h-screen w-full p-4">
      <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
        <CardHeader>
          <CardTitle>{session?.name || "Carregando..."}</CardTitle>
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/80">Itens restantes: {notVerifiedCount}</div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={() => setConfirmCancel(true)}>Cancelar</Button>
              <Button onClick={() => setConfirmFinish(true)}>Finalizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-4">
              <Input
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                onKeyDown={handleVerify}
                placeholder="Ler código e pressionar Enter"
                className="bg-white text-black"
              />
              <div className="flex items-center gap-2">
                <Switch checked={useCustomQty} onCheckedChange={setUseCustomQty} />
                <Label>Especificar quantidade</Label>
                {useCustomQty && (
                  <Input
                    type="number"
                    value={customQty}
                    onChange={(e) => setCustomQty(Number(e.target.value))}
                    className="w-24 bg-white text-black"
                  />
                )}
              </div>
            </div>
            <div className="md:col-span-2 max-h-96 overflow-y-auto space-y-2">
              {session?.assets.map(asset => (
                <div key={asset.id} className={`p-2 rounded-md ${asset.verified ? 'bg-green-500/20' : 'bg-white/10'}`}>
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-xs text-white/80">
                    {asset.unit_path} | Verificado: {asset.verified_quantity}/{asset.expected_quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Verificação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Verificação?</AlertDialogTitle>
            <AlertDialogDescription>
              {notVerifiedCount > 0
                ? `Ainda há ${notVerifiedCount} itens não verificados. Deseja finalizar mesmo assim?`
                : "Todos os itens foram verificados. Deseja finalizar?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinish}>Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VerificationSessionPage;