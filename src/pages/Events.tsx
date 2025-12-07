"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EventCreateForm from "@/components/events/EventCreateForm";

type EventItem = {
  id: number;
  name: string;
  description: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  owner_username: string;
  photo_path?: string | null;
  photographers: string[];
};

const normalizeStatic = (path?: string | null, apiUrl?: string): string | undefined => {
  if (!path || !apiUrl) return undefined;
  const p = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const webPath =
    p.startsWith("static/") ? p :
    p.startsWith("media/") ? p.replace(/^media\//, "static/") :
    `static/${p}`;
  return `${apiUrl}/${webPath}`;
};

const statusForEvent = (ev: EventItem) => {
  const now = new Date();
  const s = new Date(ev.start_date);
  const e = new Date(ev.end_date);
  if (now < s) {
    const diffMs = s.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { label: `Faltam ${days} dia${days > 1 ? "s" : ""}`, variant: "outline" as const };
  }
  if (now >= s && now <= e) {
    return { label: "Evento ativo", variant: "default" as const };
  }
  return { label: "Finalizado", variant: "secondary" as const };
};

const EventsPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  const loadEvents = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/events`, { credentials: "include" });
      const data = await res.json();
      setEvents(data?.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4 text-slate-900 bg-[#efeae3]">
      <div className="relative z-10 space-y-4">
        <h1 className="text-xl md:text-2xl font-semibold">Eventos</h1>

        {/* Formulário de criação */}
        <EventCreateForm onCreated={loadEvents} />

        {/* Lista de eventos */}
        <Card className="rounded-2xl bg-[#efeae3]/80 border border-[#efeae3] ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900">
          <CardHeader>
            <CardTitle className="text-lg">Meus eventos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-sm text-slate-700">Carregando eventos...</div>}
            {!loading && events.length === 0 && <div className="text-sm text-slate-700">Nenhum evento encontrado.</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {events.map((ev) => {
                const s = statusForEvent(ev);
                const cover = normalizeStatic(ev.photo_path || undefined, API_URL);
                return (
                  <Card key={ev.id} className="rounded-xl bg-white/70 border border-[#efeae3]">
                    <CardContent className="p-0">
                      {cover && (
                        <div className="w-full h-36 md:h-44 rounded-t-xl overflow-hidden">
                          <img src={cover} alt={ev.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold truncate">{ev.name}</div>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </div>
                        <div className="text-xs text-slate-700">
                          {ev.start_date} — {ev.end_date}
                        </div>
                        <div className="text-sm text-slate-800 line-clamp-3">{ev.description}</div>
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <Badge variant="outline" className="bg-black/5 text-slate-900">
                            {ev.photographers.length} fotógrafo{ev.photographers.length !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="bg-black/5 text-slate-900">Owner: {ev.owner_username}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EventsPage;