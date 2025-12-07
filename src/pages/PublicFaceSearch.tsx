"use client";

import React from "react";
import { useParams } from "react-router-dom";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Image as ImageIcon, Camera, Loader2, X } from "lucide-react";

type Photographer = { username: string; full_name: string; profile_photo_url?: string };
type PublicEventInfo = { id: number; name: string; description: string; photo_url?: string; photographers: Photographer[] };
type MatchItem = { id: string; url: string; uploader: string; score: number; uploaded_at?: string; meta?: Record<string, any>; price_brl?: number };

const PublicFaceSearchPage: React.FC = () => {
  const { eventId } = useParams();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

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
        const res = await fetch(`${API_URL}/public/events/${eventId}`);
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
      const res = await fetch(`${API_URL}/public/events/${eventId}/face-search`, {
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center py-8 px-4">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="rounded-2xl border border-[#efeae3] ring-1 ring-[#efeae3]/60 bg-[#efeae3]/80 py-6 px-6 shadow-2xl backdrop-blur-xl text-slate-900">
          {/* Header com logo e thumb do evento */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src="/login.png" alt="Logo" className="h-12 w-auto" />
              <div className="text-lg font-semibold">
                {info ? info.name : loadingInfo ? "Carregando..." : "Evento"}
              </div>
            </div>
            {info?.photo_url && (
              <div className="w-20 h-20 rounded-lg overflow-hidden border bg-white">
                <AspectRatio ratio={1}>
                  <img src={`${API_URL}/${info.photo_url}`} alt="Thumb do Evento" className="w-full h-full object-cover" />
                </AspectRatio>
              </div>
            )}
          </div>

          {/* Fotógrafos */}
          {info?.photographers?.length ? (
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Fotógrafos</div>
              <div className="flex flex-wrap items-center gap-3">
                {info.photographers.map((p) => (
                  <div key={p.username} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {p.profile_photo_url ? (
                        <AvatarImage src={`${API_URL}/${p.profile_photo_url}`} alt={p.full_name} />
                      ) : (
                        <AvatarFallback>{(p.full_name || p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="text-sm">{p.full_name || p.username}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="text-sm text-slate-700">
              Faça o reconhecimento facial para verificar se há fotos suas neste evento.
            </div>
            {/* Upload e câmera */}
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
              <Button variant="outline" onClick={startCamera}>
                <Camera className="h-4 w-4 mr-2" /> Tirar foto
              </Button>
              {streamRef.current && (
                <Button variant="ghost" onClick={stopCamera}>
                  <X className="h-4 w-4 mr-2" /> Fechar câmera
                </Button>
              )}
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

            <div className="flex items-center justify-between">
              <Button disabled={!file} onClick={runSearch} className="bg-[#f26716] hover:bg-[#e46014] text-white">
                {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                Buscar minhas fotos
              </Button>
              <div className="w-1/2">
                {searching || progress > 0 ? <Progress value={progress} /> : null}
              </div>
            </div>

            {/* Resultados */}
            <div className="mt-4">
              {!searching && matches.length === 0 && previewUrl && (
                <div className="text-sm text-slate-700">Nenhuma foto correspondente encontrada.</div>
              )}
              {matches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Fotos encontradas ({matches.length})</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {matches.map((m) => (
                      <div key={m.id} className="group relative rounded-lg overflow-hidden border bg-white">
                        <AspectRatio ratio={1}>
                          <img
                            src={`${API_URL}/${m.url}`}
                            alt={m.id}
                            className="w-full h-full object-cover"
                          />
                        </AspectRatio>
                        <div className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded bg-black/60 text-white">
                          R$ {(m.price_brl ?? 0).toFixed(2)} • Score: {m.score.toFixed(2)}
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <div className="text-xs text-slate-700 truncate">{m.uploader}</div>
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
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="text-sm text-slate-700">
                      Selecionadas: {selectedIds.size} • Total: <span className="font-semibold">R$ {totalBRL.toFixed(2)}</span>
                    </div>
                    <Button
                      disabled={!selectedIds.size}
                      onClick={async () => {
                        const buyerName = prompt("Nome completo:");
                        const buyerEmail = prompt("E-mail:");
                        const buyerCPF = prompt("CPF:");
                        if (!buyerName || !buyerEmail || !buyerCPF) return;
                        const payload = {
                          event_id: Number(eventId),
                          items: Array.from(selectedIds),
                          buyer: { name: buyerName, email: buyerEmail, cpf: buyerCPF },
                          total_brl: totalBRL,
                        };
                        const res = await fetch(`${API_URL}/public/purchase`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        if (!res.ok) {
                          alert("Falha ao processar pagamento. Tente novamente.");
                          return;
                        }
                        alert("Pagamento aprovado! As fotos serão enviadas para seu e-mail.");
                        setSelectedIds(new Set());
                      }}
                      className="bg-[#f26716] hover:bg-[#e46014] text-white"
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

      {/* Viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-3xl rounded-2xl bg-white">
          {viewerItem && (
            <div className="space-y-3">
              <img
                src={`${API_URL}/${viewerItem.url}`}
                alt={viewerItem.id}
                className="w-full max-h-[70vh] object-contain rounded-md border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicFaceSearchPage;