"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";

type SeriesPoint = { date: string; total: number };
type TopEvent = { event_id: number; event_name: string; total: number };
type PurchaseItem = { id: string; event_id: number; event_name: string; items_count: number; total_brl: number; buyer: any; timestamp: string };
type Summary = {
  total_earned: number;
  purchases_count: number;
  average_ticket: number;
  current_balance: number;
  series: SeriesPoint[];
  top_events: TopEvent[];
};

const BalancoPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [period, setPeriod] = React.useState<"7" | "30" | "90" | "all">("30");
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [purchases, setPurchases] = React.useState<PurchaseItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const dateRange = React.useMemo(() => {
    if (period === "all") return { start: "", end: "" };
    const days = Number(period);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
    return { start: fmt(start), end: fmt(end) };
  }, [period]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (dateRange.start) qs.set("start", dateRange.start);
      if (dateRange.end) qs.set("end", dateRange.end);
      const [sumRes, purRes] = await Promise.all([
        fetch(`${API_URL}/api/finance/summary?${qs.toString()}`, { credentials: "include" }),
        fetch(`${API_URL}/api/finance/purchases?${qs.toString()}`, { credentials: "include" }),
      ]);
      const sumJson = await sumRes.json();
      const purJson = await purRes.json();
      setSummary(sumJson as Summary);
      setPurchases((purJson?.purchases ?? []) as PurchaseItem[]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, dateRange]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const currency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <div className="p-4 md:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Balanço</h1>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="7">7 dias</TabsTrigger>
            <TabsTrigger value="30">30 dias</TabsTrigger>
            <TabsTrigger value="90">90 dias</TabsTrigger>
            <TabsTrigger value="all">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>Total ganho</CardTitle></CardHeader>
          <CardContent>{loading || !summary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{currency(summary.total_earned)}</div>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total de compras</CardTitle></CardHeader>
          <CardContent>{loading || !summary ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.purchases_count}</div>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ticket médio</CardTitle></CardHeader>
          <CardContent>{loading || !summary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{currency(summary.average_ticket)}</div>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Saldo atual</CardTitle></CardHeader>
          <CardContent>{loading || !summary ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{currency(summary.current_balance)}</div>}</CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="h-[360px]">
          <CardHeader><CardTitle>Evolução diária</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {loading || !summary ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#f26716" strokeWidth={2} dot={false} name="Ganhos (R$)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="h-[360px]">
          <CardHeader><CardTitle>Eventos mais rentáveis</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            {loading || !summary ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.top_events}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="event_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Total (R$)" fill="#111827" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimas compras */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Últimas compras</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-sm text-slate-700">Nenhuma compra nesse período.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {purchases.map((p) => (
                <div key={p.id} className="rounded-lg border bg-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-medium">{p.event_name}</div>
                    <div className="text-slate-600">Itens: {p.items_count} • {new Date(p.timestamp).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="text-base font-semibold">{currency(p.total_brl)}</div>
                  <div className="text-xs text-slate-600">
                    {p.buyer?.name ? `${p.buyer.name} • ${p.buyer.email || ""}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BalancoPage;