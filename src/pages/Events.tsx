"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EventCreateForm from "@/components/events/EventCreateForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Edit2, Trash2, Images } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EventEditForm from "@/components/events/EventEditForm";

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
  return `${apiUrl.replace('http://localhost:8000', 'https://sama.dipperauto.com')}/${webPath}`;
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
  const API_URL = import.meta.env.VITE_BACKEND_URL || "https://sama.dipperauto.com";
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<EventItem | null>(null);
  const [currentUsername, setCurrentUsername] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<EventItem | null>(null);
  const navigate = useNavigate();

  const loadMe = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUsername(data?.username || null);
    } catch {}
  }, [API_URL]);

  const loadEvents = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/events`, { credentials: "include" });
      const data = await res.json();
      setEvents(data?.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  React.useEffect(() => {
    loadMe();
    loadEvents();
  }, [loadMe, loadEvents]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`${API_URL}/api/events/${deleteTarget.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      // show minimal error
      console.error("Falha ao excluir evento");
    }
    setDeleteTarget(null);
    await loadEvents();
  };

  return (
    <div className="min-h-screen w-full overflow-hidden p-4 text-slate-900 bg-[#efeae3]">
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">Eventos</h1>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="bg-black/80 text-white hover:bg-black">Criar evento</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl rounded-2xl bg-white">
              <DialogHeader>
                <DialogTitle>Novo evento</DialogTitle>
                <DialogDescription>Preencha os dados para criar um novo evento.</DialogDescription>
              </DialogHeader>
              <EventCreateForm onCreated={() => { setOpenCreate(false); loadEvents(); }} />
            </DialogContent>
          </Dialog>
        </div>

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
                const isOwner = currentUsername && ev.owner_username === currentUsername;
                const isMember = (currentUsername && (ev.owner_username === currentUsername || ev.photographers.includes(currentUsername))) || false;
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
                        {isOwner && (
                          <div className="pt-3 flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="text-slate-900"
                              onClick={() => { setSelectedEvent(ev); setOpenEdit(true); }}
                            >
                              <Edit2 className="h-4 w-4 mr-2" /> Editar
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => setDeleteTarget(ev)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </Button>
                          </div>
                        )}
                        {isMember && (
                          <div className="pt-3">
                            <Button
                              variant="default"
                              onClick={() => navigate(`/events/${ev.id}/gallery`)}
                              className="bg-black/80 text-white hover:bg-black"
                            >
                              <Images className="h-4 w-4 mr-2" /> Galeria
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dialog de edição */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="sm:max-w-3xl rounded-2xl bg-white">
            <DialogHeader>
              <DialogTitle>Editar evento</DialogTitle>
              <DialogDescription>Atualize os dados do evento.</DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <EventEditForm
                event={selectedEvent}
                onUpdated={() => { setOpenEdit(false); setSelectedEvent(null); loadEvents(); }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Confirmação de exclusão */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir evento</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Tem certeza que deseja excluir o evento "{deleteTarget?.name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default EventsPage;