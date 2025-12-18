"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type ControlItem = {
  type: "expense" | "service";
  ref_id: number;
  name: string;
  description?: string;
  client_name?: string;
  due_date: string; // YYYY-MM-DD
  amount_due: number;
  amount_paid: number;
  percent_paid: number;
  status: "unpaid" | "partial" | "paid";
  overdue: boolean;
  dueSoon: boolean;
};

type Summary = {
  month: string;
  expenses: { due: number; paid: number };
  services: { due: number; paid: number };
};

const ControlePage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [month, setMonth] = React.useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}`;
  });
  const [view, setView] = React.useState<"expenses" | "services">("expenses");
  const [items, setItems] = React.useState<ControlItem[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [search, setSearch] = React.useState<string>("");

  const loadData = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/control?month=${encodeURIComponent(month)}&view=${view}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems((data?.items ?? []) as ControlItem[]);
      const sres = await fetch(`${API_URL}/api/control/summary?month=${encodeURIComponent(month)}`, { credentials: "include" });
      if (sres.ok) {
        const sdata = await sres.json();
        setSummary(sdata as Summary);
      }
    } catch {
      toast.error("Falha ao carregar controle financeiro.");
    }
  }, [API_URL, month, view]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    setMonth(`${d.getFullYear()}-${mm}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    setMonth(`${d.getFullYear()}-${mm}`);
  };

  const filtered = React.useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter(i => [i.name, i.description || "", i.client_name || ""].join(" ").toLowerCase().includes(t));
  }, [items, search]);

  const [payTarget, setPayTarget] = React.useState<ControlItem | null>(null);
  const [payAmount, setPayAmount] = React.useState<number>(0);

  const registerPayment = async () => {
    if (!payTarget || payAmount <= 0) return;
    try {
      const res = await fetch(`${API_URL}/api/control/pay`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: payTarget.type, ref_id: payTarget.ref_id, due_date: payTarget.due_date, amount: payAmount }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        toast.error(detail?.detail ?? "Falha ao registrar pagamento.");
        return;
      }
      toast.success("Pagamento registrado.");
      setPayTarget(null);
      setPayAmount(0);
      await loadData();
    } catch {
      toast.error("Falha ao registrar pagamento.");
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-xl md:text-2xl">Controle Financeiro</CardTitle>
              <div className="flex items-center gap-2">
                <Button className="bg-white/20 text-white hover:bg-white/25" onClick={prevMonth}>Mês anterior</Button>
                <Input value={month} onChange={(e) => setMonth(e.target.value)} className="w-28 bg-white/20 text-white" placeholder="YYYY-MM" />
                <Button className="bg-white/20 text-white hover:bg-white/25" onClick={nextMonth}>Próximo mês</Button>
              </div>
            </div>

            {/* Mini dashboard */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <div className="text-xs text-white/80">Gastos (mês)</div>
                <div className="text-lg font-semibold">R$ {summary ? summary.expenses.due.toFixed(2) : "0.00"}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <div className="text-xs text-white/80">Receitas (mês)</div>
                <div className="text-lg font-semibold">R$ {summary ? summary.services.due.toFixed(2) : "0.00"}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <div className="text-xs text-white/80">Gastos pagos</div>
                <div className="text-lg font-semibold">R$ {summary ? summary.expenses.paid.toFixed(2) : "0.00"}</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <div className="text-xs text-white/80">Receitas pagas</div>
                <div className="text-lg font-semibold">R$ {summary ? summary.services.paid.toFixed(2) : "0.00"}</div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={view} onValueChange={(v) => setView(v as "expenses" | "services")}>
              <TabsList className="bg-white/10">
                <TabsTrigger value="expenses" className="text-white">Gastos</TabsTrigger>
                <TabsTrigger value="services" className="text-white">Receitas</TabsTrigger>
              </TabsList>

              <div className="mt-4 flex items-center gap-2">
                <Input
                  placeholder="Pesquisar por nome, cliente, descrição..."
                  className="w-64 bg-white/20 text-white placeholder:text-white/70 border-white/25"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button className="bg-white/20 text-white hover:bg-white/25" onClick={loadData}>Atualizar</Button>
              </div>

              <TabsContent value="expenses" className="mt-4 space-y-2">
                {filtered.map((i) => (
                  <div key={`${i.type}-${i.ref_id}-${i.due_date}`} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{i.name}</div>
                        <div className="text-xs text-white/80 truncate">
                          Venc.: {i.due_date} • Valor: R$ {i.amount_due.toFixed(2)} • Pago: R$ {i.amount_paid.toFixed(2)} ({i.percent_paid.toFixed(1)}%)
                        </div>
                        {i.description && <div className="text-xs text-white/80">Desc: {i.description}</div>}
                        <div className="mt-1 flex items-center gap-2">
                          {i.overdue && <Badge className="bg-red-500/30 text-white">Vencido</Badge>}
                          {!i.overdue && i.dueSoon && <Badge className="bg-yellow-500/30 text-white">A vencer</Badge>}
                          {i.status === "paid" && <Badge className="bg-green-500/30 text-white">Pago</Badge>}
                          {i.status === "partial" && <Badge className="bg-blue-500/30 text-white">Parcial</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => { setPayTarget(i); setPayAmount(Math.max(0, i.amount_due - i.amount_paid)); }}>
                          Registrar pagamento
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-sm text-white/80">Sem itens para este mês.</div>}
              </TabsContent>

              <TabsContent value="services" className="mt-4 space-y-2">
                {filtered.map((i) => (
                  <div key={`${i.type}-${i.ref_id}-${i.due_date}`} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{i.name}</div>
                        <div className="text-xs text-white/80 truncate">Cliente: {i.client_name || "—"}</div>
                        <div className="text-xs text-white/80 truncate">
                          Venc.: {i.due_date} • Valor: R$ {i.amount_due.toFixed(2)} • Pago: R$ {i.amount_paid.toFixed(2)} ({i.percent_paid.toFixed(1)}%)
                        </div>
                        {i.description && <div className="text-xs text-white/80">Obs: {i.description}</div>}
                        <div className="mt-1 flex items-center gap-2">
                          {i.overdue && <Badge className="bg-red-500/30 text-white">Vencido</Badge>}
                          {!i.overdue && i.dueSoon && <Badge className="bg-yellow-500/30 text-white">A vencer</Badge>}
                          {i.status === "paid" && <Badge className="bg-green-500/30 text-white">Pago</Badge>}
                          {i.status === "partial" && <Badge className="bg-blue-500/30 text-white">Parcial</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => { setPayTarget(i); setPayAmount(Math.max(0, i.amount_due - i.amount_paid)); }}>
                          Registrar pagamento
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-sm text-white/80">Sem itens para este mês.</div>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modal de pagamento */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) { setPayTarget(null); setPayAmount(0); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <div className="space-y-3">
            <div className="text-sm">Item: {payTarget?.name}</div>
            <div className="text-xs text-white/80">Venc.: {payTarget?.due_date} • Valor: R$ {payTarget?.amount_due.toFixed(2)} • Pago: R$ {payTarget?.amount_paid.toFixed(2)}</div>
            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input type="number" min={0.01} step={0.01} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value || 0))} className="bg-white text-black" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => { setPayTarget(null); setPayAmount(0); }}>
                Cancelar
              </Button>
              <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={registerPayment}>
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ControlePage;