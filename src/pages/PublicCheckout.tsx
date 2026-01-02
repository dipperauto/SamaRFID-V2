"use client";

import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { showError, showSuccess } from "@/utils/toast";

const PublicCheckoutPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "https://sama.dipperauto.com";

  const eventId = Number(params.get("eventId") || "0");
  const itemsParam = (params.get("items") || "").trim();
  const totalParam = Number(params.get("total") || "0");
  const items = React.useMemo(() => itemsParam ? itemsParam.split(",").filter(Boolean) : [], [itemsParam]);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [cardNumber, setCardNumber] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const onPay = async () => {
    if (!eventId || items.length === 0) {
      showError("Nenhum item selecionado.");
      return;
    }
    if (!name || !email || !cpf || !cardNumber) {
      showError("Preencha todos os campos.");
      return;
    }
    setProcessing(true);
    setProgress(0);
    const timer = setInterval(() => setProgress((p) => Math.min(95, p + 5)), 150);
    try {
      const payload = {
        event_id: eventId,
        items,
        buyer: { name, email, cpf, card_number: cardNumber },
        total_brl: totalParam,
      };
      const res = await fetch(`${API_URL}/api/public/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      clearInterval(timer);
      if (!res.ok) {
        showError("Falha ao processar pagamento. Tente novamente.");
        setProcessing(false);
        setProgress(0);
        return;
      }
      setProgress(100);
      showSuccess("Pagamento aprovado! As fotos serão enviadas para seu e-mail.");
      setTimeout(() => {
        navigate(`/public/events/${eventId}/face`);
      }, 600);
    } finally {
      setProcessing(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-lg rounded-2xl bg-white">
        <CardHeader>
          <CardTitle>Finalizar compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-slate-700">Itens selecionados: {items.length} • Total: R$ {totalParam.toFixed(2)}</div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="space-y-1">
              <Label>Número do cartão</Label>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
            <Button onClick={onPay} className="bg-[#f26716] hover:bg-[#e46014] text-white" disabled={processing}>
              Pagar
            </Button>
          </div>

          {processing ? <Progress value={progress} /> : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicCheckoutPage;