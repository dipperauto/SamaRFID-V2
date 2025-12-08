"use client";

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import UploaderChip from "@/components/UploaderChip";
import { Image as ImageIcon, Camera, Loader2, X } from "lucide-react";

type Photographer = { username: string; full_name: string; profile_photo_url?: string };
type PublicEventInfo = { id: number; name: string; description: string; photo_url?: string; photographers: Photographer[]; owner_username?: string };
type MatchItem = { id: string; url: string; uploader: string; score: number; uploaded_at?: string; meta?: Record<string, any>; price_brl?: number };

const PublicFaceSearchPage: React.FC = () => {
  const { eventId } = useParams();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const navigate = useNavigate();

  const [info, setInfo] = React.useState<PublicEventInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = React.useState(false);

  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [matches, setMatches] = React.useState<MatchItem[]>([]);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerItem, setViewerItem] = React.useState<MatchItem | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalBRL = React.useMemo(() => {
    return matches
      .filter((m) => selectedIds.has(m.id))
      .reduce((sum, m) => sum + (Number(m.price_brl || 0) || 0), 0);
  }, [matches, selectedIds]);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    const load = async () => {
      if (!eventId) return;
      setLoadingInfo(true);
      try {
        const res = await fetch(`${API_URL}/api/public/events/${eventId}`);
        if (!res.ok) {
          setInfo(null);
          return;
        }
        const data = await res.json();
        setInfo(data as PublicEventInfo);
      } finally {
        setLoadingInfo(false);
      }
    };
    load();
  }, [API_URL, eventId]);

  const onPickFile = (f: File | null) => {
    setFile(f);
    setMatches([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const startCamera = async () => {
    setMatches([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // silencioso
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], "captured.png", { type: "image/png" });
      onPickFile(f);
      stopCamera();
    }, "image/png", 0.95);
  };

  const runSearch = async () => {
    if (!file || !eventId) return;
    setSearching(true);
    setProgress(0);
    setMatches([]);
    // simular progresso enquanto o backend processa
    const timer = setInterval(() => {
      setProgress((p) => Math.min(95, p + 5));
    }, 200);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/public/events/${eventId}/face-search`, {
        method: "POST",
        body: form,
      });
      clearInterval(timer);
      if (!res.ok) {
        setProgress(0);
        setSearching(false);
        return;
      }
      setProgress(100);
      const data = await res.json();
      setMatches((data?.matches ?? []) as MatchItem[]);
    } finally {
      setSearching(false);
      setTimeout(() => setProgress(0), 400);
    }
  };

  // Derivar lista de fotógrafos incluindo owner (sem duplicar)
  const photographersWithOwner = React.useMemo(() => {
    const base = info?.photographers || [];
    const owner = info?.owner_username;
    if (owner && !base.find((p) => p.username === owner)) {
      return [...base, { username: owner, full_name: owner }];
    }
    return base;
  }, [info]);

  // Nome amigável para fotógrafos (quando vier só e-mail)
  const formatName = React.useCallback((fullName?: string, username?: string) => {
    if (fullName && fullName.trim().length) return fullName;
    const raw = username || "";
    let base = raw.includes("@") ? raw.split("@")[0] : raw;
    base = base.replace(/[\.\_\-]/g, " ").trim().replace(/\s+/g, " ");
    return base
      .split(" ")
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ""))
      .join(" ") || raw;
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center py-10 px-4">
      <AnimatedBackground />
      {/* BACKGROUND: foto do evento desfocada e esbranquiçada */}
      {info?.photo_url && (
        <div className="absolute inset-0">
          <img
            src={`${API_URL}/${info.photo_url}`}
            alt="Background do Evento"
            className="w-full h-full object-cover"
            style={{ filter: "blur(12px)", transform: "scale(1.08)" }}
          />
          <div className="absolute inset-0 bg-white/65" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-4xl">
        <div className="rounded-2xl border border-[#efeae3] ring-1 ring-[#efeae3]/60 bg-[#efeae3]/85 py-8 px-6 shadow-2xl backdrop-blur-xl text-slate-900">
          {/* Header: apenas logo + título centralizados */}
          <div className="mb-8">
            <div className="flex items-center justify-center">
              <img src="/login.png" alt="Logo" className="h-14 md:h-16 w-auto" />
            </div>
            <div className="mt-5 flex flex-col items-center justify-center gap-2 text-center">
              <div className="text-2xl md:text-3xl font-semibold">
                {info ? info.name : loadingInfo ? "Carregando..." : "Evento"}
              </div>
            </div>
          </div>

          {/* Fotógrafos (inclui owner) */}
          {photographersWithOwner.length ? (
            <div className="mb-6">
              <div className="text-sm font-medium mb-2 text-center md:text-left">Fotógrafos</div>
              <div className="flex flex-wrap items-center gap-3">
                {photographersWithOwner.map((p) => (
                  <div key={p.username} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {p.profile_photo_url ? (
                        <AvatarImage src={`${API_URL}/${p.profile_photo_url}`} alt={p.full_name} />
                      ) : (
                        <AvatarFallback>{(p.full_name || p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="text-sm">{formatName(p.full_name, p.username)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-6">
            <div className="text-sm text-slate-700">
              Faça o reconhecimento facial para verificar se há fotos suas neste evento.
            </div>

            {/* Upload e câmera (grid responsivo) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  className="w-full"
                />
              </div>
              <div className="sm:col-span-1 flex items-center gap-2">
                <Button variant="outline" onClick={startCamera} className="w-full">
                  <Camera className="h-4 w-4 mr-2" /> Tirar foto
                </Button>
                {streamRef.current && (
                  <Button variant="ghost" onClick={stopCamera} className="w-auto">
                    <X className="h-4 w-4 mr-2" /> Fechar
                  </Button>
                )}
              </div>
            </div>

            {/* Pré-visualização */}
            {previewUrl && (
              <div className="w-full rounded-lg overflow-hidden border bg-white">
                <AspectRatio ratio={16/9}>
                  <img src={previewUrl} alt="Prévia" className="w-full h-full object-contain" />
                </AspectRatio>
              </div>
            )}
            {/* Vídeo da câmera */}
            {streamRef.current && (
              <div className="w-full rounded-lg overflow-hidden border bg-white">
                <AspectRatio ratio={16/9}>
                  <video ref={videoRef} className="w-full h-full object-cover" />
                </AspectRatio>
                <div className="flex items-center justify-end p-2">
                  <Button onClick={capturePhoto} className="bg-black/80 text-white hover:bg-black">
                    <ImageIcon className="h-4 w-4 mr-2" /> Capturar
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <Button disabled={!file} onClick={runSearch} className="bg-[#f26716] hover:bg-[#e46014] text-white">
                {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                Buscar minhas fotos
              </Button>
              <div className="w-full md:w-1/2">
                {searching || progress > 0 ? <Progress value={progress} /> : null}
              </div>
            </div>

            {/* Resultados com visualizações maiores */}
            <div className="mt-2">
              {!searching && matches.length === 0 && previewUrl && (
                <div className="text-sm text-slate-700">Nenhuma foto correspondente encontrada.</div>
              )}
              {matches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Fotos encontradas ({matches.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-2 gap-5">
                    {matches.map((m) => (
                      <div key={m.id} className="group relative rounded-xl overflow-hidden border bg-white shadow-sm">
                        <AspectRatio ratio={16/10}>
                          <img
                            src={`${API_URL}/${m.url}`}
                            alt={m.id}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => { setViewerItem(m); setViewerOpen(true); }}
                          />
                        </AspectRatio>
                        <div className="absolute bottom-2 left-2 px-3 py-1.5 rounded-lg bg-black/70 text-white shadow-md">
                          <div className="text-base md:text-lg font-semibold">
                            R$ {(m.price_brl ?? 0).toFixed(2)}
                          </div>
                          <div className="text-[11px] md:text-xs opacity-85">Score: {m.score.toFixed(2)}</div>
                        </div>
                        <div className="p-3 flex items-center justify-between">
                          <UploaderChip uploader={m.uploader} photographers={photographersWithOwner} apiBase={API_URL} />
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(m.id)}
                              onChange={() => toggleSelect(m.id)}
                            />
                            Selecionar
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total e checkout */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t pt-3">
                    <div className="text-sm text-slate-700">
                      Selecionadas: {selectedIds.size} • Total: <span className="font-semibold">R$ {totalBRL.toFixed(2)}</span>
                    </div>
                    <Button
                      disabled={!selectedIds.size}
                      onClick={() => {
                        const ids = Array.from(selectedIds);
                        const qs = new URLSearchParams({
                          eventId: String(eventId),
                          items: ids.join(","),
                          total: String(totalBRL.toFixed(2)),
                        });
                        navigate(`/public/checkout?${qs.toString()}`);
                      }}
                      className="bg-[#f26716] hover:bg-[#e46014] text-white self-end md:self-auto"
                    >
                      Finalizar compra
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Viewer em tela cheia */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] h-[95vh] p-0 rounded-2xl bg-black">
          {viewerItem && (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={`${API_URL}/${viewerItem.url}`}
                alt={viewerItem.id}
                style={{ maxWidth: "100vw", maxHeight: "100vh" }}
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicFaceSearchPage;