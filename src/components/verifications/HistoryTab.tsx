"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Session = {
  id: string;
  name: string;
  user: string;
  status: string;
  start_time: string;
  end_time?: string;
};

export const HistoryTab: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [userFilter, setUserFilter] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/verifications/sessions`, { credentials: "include" });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      toast.error("Falha ao carregar histórico.");
    }
  }, [API_URL]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = sessions.filter(s => 
    (s.user.includes(userFilter) || userFilter === "") &&
    (s.start_time.includes(dateFilter) || dateFilter === "")
  );

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Filtrar por usuário..." value={userFilter} onChange={e => setUserFilter(e.target.value)} />
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
      </div>
      <div className="space-y-2">
        {filtered.map(session => (
          <div key={session.id} className="flex items-center justify-between p-2 rounded-md bg-white/10">
            <div>
              <div className="font-semibold">{session.name}</div>
              <div className="text-xs text-white/80">por {session.user} em {new Date(session.start_time).toLocaleString()}</div>
            </div>
            <Badge>{session.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};