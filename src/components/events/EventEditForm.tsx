"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import PhotoCropper from "@/components/PhotoCropper";

type PublicUser = {
  username: string;
  full_name: string;
  role: string;
  profile_photo_path?: string | null;
};

type EventItem = {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  owner_username: string;
  photo_path?: string | null;
  photographers: string[];
};

type Props = {
  event: EventItem;
  onUpdated: () => void;
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

const EventEditForm: React.FC<Props> = ({ event, onUpdated }) => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [name, setName] = React.useState(event.name);
  const [description, setDescription] = React.useState(event.description);
  const [startDate, setStartDate] = React.useState(event.start_date);
  const [endDate, setEndDate] = React.useState(event.end_date);
  const [photoBase64, setPhotoBase64] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<PublicUser[]>([]);
  const [selected, setSelected] = React.useState<PublicUser[]>(
    event.photographers.map((username) => ({
      username,
      full_name: username,
      role: "fotógrafo",
      profile_photo_path: null,
    }))
  );

  const searchUsers = React.useCallback(async (term: string) => {
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/users/search-public?q=${encodeURIComponent(term)}`, {
        credentials: "include",
      });
      const data = await res.json();
      setResults(data?.users ?? []);
    } finally {
      setSearching(false);
    }
  }, [API_URL]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      searchUsers(query);
    }, 250);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  const addUser = (u: PublicUser) => {
    if (selected.find(s => s.username === u.username)) return;
    if (selected.length >= 5) {
      toast.error("Você pode adicionar no máximo 5 fotógrafos.");
      return;
    }
    setSelected(prev => [...prev, u]);
  };

  const removeUser = (uname: string) => {
    setSelected(prev => prev.filter(u => u.username !== uname));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do evento.");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe a descrição do evento.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Informe as datas de início e fim.");
      return;
    }
    const payload = {
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      photographers: selected.map(s => s.username),
      photo_base64: photoBase64 ?? undefined, // só envia se recortou nova foto
    };
    const res = await fetch(`${API_URL}/events/${event.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Falha ao atualizar o evento.");
      return;
    }
    toast.success("Evento atualizado com sucesso!");
    onUpdated();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome do evento</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Aniversário João" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Datas</label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descrição</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o evento..." />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Fotógrafos (máx. 5)</label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar fotógrafos por nome ou e-mail..."
        />
        <div className="flex flex-wrap gap-2">
          {selected.map((u) => (
            <Badge key={u.username} variant="outline" className="flex items-center gap-2 bg-black/5 text-slate-900">
              <span className="inline-flex items-center gap-2">
                <img
                  src={normalizeStatic(u.profile_photo_path || undefined, API_URL)}
                  alt={u.full_name}
                  className="h-5 w-5 rounded-full object-cover"
                />
                {u.full_name} ({u.username})
              </span>
              <button type="button" onClick={() => removeUser(u.username)} className="ml-2 text-xs text-red-600">remover</button>
            </Badge>
          ))}
          {selected.length === 0 && <span className="text-sm text-slate-700">Nenhum fotógrafo selecionado.</span>}
        </div>
        <div className="space-y-2">
          <div className="text-xs text-slate-700">Resultados {searching ? "(buscando...)" : ""}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {results.map((u) => (
              <button
                key={u.username}
                type="button"
                onClick={() => addUser(u)}
                className="flex items-center gap-3 rounded-lg border border-[#efeae3] bg-white/60 hover:bg-white/80 px-3 py-2 text-left"
              >
                <Avatar className="h-8 w-8">
                  {u.profile_photo_path ? (
                    <AvatarImage src={normalizeStatic(u.profile_photo_path, API_URL)} alt={u.full_name} />
                  ) : (
                    <AvatarFallback>📷</AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.full_name}</div>
                  <div className="text-xs text-slate-700 truncate">{u.username}</div>
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="text-sm text-slate-700">Sem resultados.</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Foto de capa do evento</label>
        <PhotoCropper onChange={(d) => setPhotoBase64(d)} initialImage={null} />
        {event.photo_path && (
          <div className="text-xs text-slate-700">
            Capa atual:
            <div className="mt-2 w-full h-32 rounded-md overflow-hidden border">
              <img src={normalizeStatic(event.photo_path, API_URL)} alt={event.name} className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="bg-black/80 text-white hover:bg-black">Salvar alterações</Button>
      </div>
    </form>
  );
};

export default EventEditForm;