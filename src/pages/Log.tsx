"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type LogItem = {
  timestamp: string;
  username: string;
  action: string;
  unit_id?: string;
  asset_id?: string;
  details?: string;
};

const LogPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [logs, setLogs] = React.useState<LogItem[]>([]);
  const [user, setUser] = React.useState<string>("");
  const [action, setAction] = React.useState<string>("");
  const [start, setStart] = React.useState<string>("");
  const [end, setEnd] = React.useState<string>("");
  const [q, setQ] = React.useState<string>("");

  const loadLogs = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (user) params.set("user", user);
    if (action) params.set("action", action);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (q) params.set("q", q);
    try {
      const res = await fetch(`${API_URL}/api/logs?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs((data?.logs ?? []) as LogItem[]);
    } catch {
      toast.error("Falha ao carregar logs.");
    }
  }, [API_URL, user, action, start, end, q]);

  React.useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <div className="min-h-screen w-full p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Log de Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
              <Input value={user} onChange={(e)=>setUser(e.target.value)} placeholder="Usuário" className="bg-white/20 text-white" />
              <Input value={action} onChange={(e)=>setAction(e.target.value)} placeholder="Ação (ex.: asset:create)" className="bg:white/20 text:white" />
              <Input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="bg-white/20 text-white" />
              <Input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="bg-white/20 text-white" />
              <div className="flex gap-2">
                <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Pesquisa..." className="bg-white/20 text-white flex-1" />
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={loadLogs}>Aplicar</Button>
              </div>
            </div>

            <Separator className="my-2 bg-white/20" />

            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-sm text-white/80">Nenhum log encontrado.</div>
              ) : (
                logs.map((l, idx) => (
                  <div key={idx} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{new Date(l.timestamp).toLocaleString()}</div>
                      <div className="text-white/80">Usuário: {l.username} • Ação: {l.action}</div>
                      <div className="text-white/70">Unidade: {l.unit_id || "—"} • Ativo: {l.asset_id || "—"}</div>
                      {l.details && <div className="text-white/70">Detalhes: {l.details}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LogPage;