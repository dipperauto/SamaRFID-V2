"use client";

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import ProgressOverlay from "@/components/ProgressOverlay";
import { showError, showSuccess } from "@/utils/toast";
import { Image as ImageIcon, Trash2, Wand2 } from "lucide-react";

type GalleryItem = {
  id: string;
  url: string;
  uploader: string;
  meta?: Record<string, any>;
  lut_id?: number | null;
  // ADD: nitidez
  sharpness?: number;
};

const EventGalleryPage: React.FC = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [raw, setRaw] = React.useState<GalleryItem[]>([]);
  const [edited, setEdited] = React.useState<GalleryItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [eventName, setEventName] = React.useState<string>("");

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const [lutDialogOpen, setLutDialogOpen] = React.useState(false);
  const [luts, setLuts] = React.useState<{ id: number; name: string }[]>([]);
  const [selectedLutId, setSelectedLutId] = React.useState<number | null>(null);

  const [progressPhase, setProgressPhase] = React.useState<"upload" | "processing" | null>(null);
  const [progressPercent, setProgressPercent] = React.useState<number>(0);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadLUTs = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/luts`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data?.presets ?? []).map((p: any) => ({ id: Number(p.id), name: p.name || `LUT ${p.id}` }));
      setLuts(list);
    } catch {}
  }, [API_URL]);

  const loadGallery = React.useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/gallery`, { credentials: "include" });
      if (!res.ok) {
        showError("Falha ao carregar galeria.");
        return;
      }
      const data = await res.json();
      setRaw((data?.raw ?? []) as GalleryItem[]);
      setEdited((data?.edited ?? []) as GalleryItem[]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, eventId]);

  React.useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // ADD: carregar nome do evento
  React.useEffect(() => {
    const loadEventName = async () => {
      if (!eventId) return;
      try {
        const res = await fetch(`${API_URL}/events/${eventId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.name) setEventName(String(data.name));
      } catch {}
    };
    loadEventName();
  }, [API_URL, eventId]);

  // Upload handler
  const onPickFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || !eventId) return;
    // pedir LUT (opcional)
    await loadLUTs();
    setSelectedLutId(null);
    setLutDialogOpen(true);

    // guardamos os arquivos para upload após confirmar LUT
    pendingFiles.current = Array.from(files);
  };

  const pendingFiles = React.useRef<File[] | null>(null);

  const startUpload = async () => {
    if (!pendingFiles.current || !pendingFiles.current.length || !eventId) {
      setLutDialogOpen(false);
      return;
    }
    const files = pendingFiles.current;
    pendingFiles.current = null;
    setLutDialogOpen(false);

    // Upload com progresso (aproximado pelo número de arquivos concluídos)
    setProgressPhase("upload");
    setProgressPercent(0);
    const total = files.length;
    let uploadedCount = 0;
    const imageIds: string[] = [];

    // Enviar em lotes para reduzir overhead
    const chunkSize = 5;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      const form = new FormData();
      chunk.forEach((f) => form.append("files", f));
      const res = await fetch(`${API_URL}/events/${eventId}/gallery/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        showError("Falha ao enviar arquivos.");
        setProgressPhase(null);
        return;
      }
      const data = await res.json();
      const ids = (data?.image_ids ?? []) as string[];
      imageIds.push(...ids);
      uploadedCount += chunk.length;
      setProgressPercent(Math.min(100, Math.round((uploadedCount / total) * 100)));
    }

    setProgressPhase(null);
    showSuccess(`Upload concluído (${uploadedCount} imagem(ns)).`);
    await loadGallery();

    // Aplicar LUT se selecionado
    if (selectedLutId !== null) {
      setProgressPhase("processing");
      setProgressPercent(0);
      let processed = 0;
      // processar uma por uma para mostrar progresso
      for (const iid of imageIds) {
        const resp = await fetch(`${API_URL}/events/${eventId}/gallery/apply-lut`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_ids: [iid], lut_id: selectedLutId }),
        });
        if (!resp.ok) {
          showError("Falha ao aplicar LUT em algumas imagens.");
          continue;
        }
        processed += 1;
        setProgressPercent(Math.min(100, Math.round((processed / imageIds.length) * 100)));
      }
      setProgressPhase(null);
      showSuccess("LUT aplicado.");
      await loadGallery();
    }
  };

  const massDelete = async () => {
    if (!selectedIds.size || !eventId) return;
    const ids = Array.from(selectedIds);
    const res = await fetch(`${API_URL}/events/${eventId}/gallery`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_ids: ids }),
    });
    if (!res.ok) {
      showError("Falha ao excluir imagens.");
      return;
    }
    clearSelection();
    showSuccess("Imagens excluídas.");
    await loadGallery();
  };

  const massChangeLUT = async () => {
    if (!selectedIds.size || !eventId) return;
    await loadLUTs();
    setSelectedLutId(null);
    setLutDialogOpen(true);
    pendingChangeIds.current = Array.from(selectedIds);
  };

  const pendingChangeIds = React.useRef<string[] | null>(null);

  const startMassChange = async () => {
    const ids = pendingChangeIds.current || [];
    pendingChangeIds.current = null;
    setLutDialogOpen(false);
    if (!ids.length || selectedLutId === null || !eventId) return;

    setProgressPhase("processing");
    setProgressPercent(0);
    let processed = 0;
    for (const iid of ids) {
      const resp = await fetch(`${API_URL}/events/${eventId}/gallery/change-lut`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_ids: [iid], lut_id: selectedLutId }),
      });
      if (!resp.ok) {
        showError("Falha ao trocar LUT em algumas imagens.");
        continue;
      }
      processed += 1;
      setProgressPercent(Math.min(100, Math.round((processed / ids.length) * 100)));
    }
    setProgressPhase(null);
    clearSelection();
    showSuccess("LUT trocado.");
    await loadGallery();
  };

  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerItem, setViewerItem] = React.useState<GalleryItem | null>(null);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4 text-slate-900 bg-[#efeae3]">
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">
            {eventName ? `Galeria — ${eventName}` : `Galeria do Evento #${eventId}`}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
            <Button onClick={onPickFiles} className="bg-black/80 text-white hover:bg-black">
              <ImageIcon className="h-4 w-4 mr-2" /> Upload de imagens
            </Button>
            {/* input oculto para arquivos e pastas */}
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              // pasta inteira (suportado em Chrome/Edge)
              // @ts-expect-error non-standard attribute
              webkitdirectory="true"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
        </div>

        {/* Barra de ações em massa */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-700">
            Selecionadas: {selectedIds.size}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={massDelete} disabled={!selectedIds.size}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </Button>
            <Button variant="default" onClick={massChangeLUT} disabled={!selectedIds.size}>
              <Wand2 className="h-4 w-4 mr-2" /> Trocar LUT
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl bg-[#efeae3]/80 border border-[#efeae3] ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900">
          <CardHeader>
            <CardTitle className="text-lg">Imagens do evento</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="raw" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="raw">Brutas</TabsTrigger>
                <TabsTrigger value="edited">Editadas</TabsTrigger>
              </TabsList>

              <TabsContent value="raw" className="space-y-4">
                {loading && <div className="text-sm text-slate-700">Carregando...</div>}
                {!loading && raw.length === 0 && (
                  <div className="text-sm text-slate-700">Nenhuma imagem bruta.</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {raw.map((it) => (
                    <div key={it.id} className="group relative rounded-lg overflow-hidden border bg-white">
                      <img
                        src={`${API_URL}/${it.url}`}
                        alt={it.id}
                        className="w-full h-40 object-cover cursor-pointer"
                        onClick={() => { setViewerItem(it); setViewerOpen(true); }}
                      />
                      <div className="p-2 flex items-center justify-between">
                        <Badge variant="outline" className="bg-black/5">{it.uploader}</Badge>
                        <Checkbox
                          checked={selectedIds.has(it.id)}
                          onCheckedChange={() => toggleSelect(it.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="edited" className="space-y-4">
                {loading && <div className="text-sm text-slate-700">Carregando...</div>}
                {!loading && edited.length === 0 && (
                  <div className="text-sm text-slate-700">Nenhuma imagem editada.</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {edited.map((it) => (
                    <div key={it.id} className="group relative rounded-lg overflow-hidden border bg-white">
                      <img
                        src={`${API_URL}/${it.url}`}
                        alt={it.id}
                        className="w-full h-40 object-cover cursor-pointer"
                        onClick={() => { setViewerItem(it); setViewerOpen(true); }}
                      />
                      <div className="p-2 flex items-center justify-between">
                        <Badge variant="outline" className="bg-black/5">{it.uploader}</Badge>
                        <div className="flex items-center gap-2">
                          {it.lut_id != null && <Badge variant="outline">LUT #{it.lut_id}</Badge>}
                          {typeof it.sharpness === "number" && (
                            <Badge variant="outline" title="Quanto maior, mais nítida">
                              Nitidez do sujeito: {Math.round(it.sharpness)}
                            </Badge>
                          )}
                          <Checkbox
                            checked={selectedIds.has(it.id)}
                            onCheckedChange={() => toggleSelect(it.id)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Viewer de imagem com metadados */}
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="sm:max-w-3xl rounded-2xl bg-white">
            <DialogHeader>
              <DialogTitle>Visualização</DialogTitle>
              <DialogDescription>Metadados da imagem</DialogDescription>
            </DialogHeader>
            {viewerItem && (
              <div className="space-y-3">
                <img
                  src={`${API_URL}/${viewerItem.url}`}
                  alt={viewerItem.id}
                  className="w-full max-h-[60vh] object-contain rounded-md border"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="font-medium">Fotógrafo</div>
                    <div className="text-slate-700">{viewerItem.uploader}</div>
                  </div>
                  <div>
                    <div className="font-medium">Dimensões</div>
                    <div className="text-slate-700">{viewerItem.meta?.Dimensions || "-"}</div>
                  </div>
                  <div>
                    <div className="font-medium">Câmera</div>
                    <div className="text-slate-700">{viewerItem.meta?.Model || "-"}</div>
                  </div>
                  <div>
                    <div className="font-medium">Data de captura</div>
                    <div className="text-slate-700">{viewerItem.meta?.DateTimeOriginal || "-"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="font-medium">Nitidez do sujeito (quanto maior, mais nítida)</div>
                    <div className="text-slate-700">
                      {typeof viewerItem.sharpness === "number" ? Math.round(viewerItem.sharpness) : "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Diálogo de seleção de LUT */}
        <Dialog open={lutDialogOpen} onOpenChange={setLutDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl bg-white">
            <DialogHeader>
              <DialogTitle>Aplicar LUT opcional</DialogTitle>
              <DialogDescription>Escolha um LUT salvo para aplicar nas imagens.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedLutId === null ? "default" : "outline"}
                  onClick={() => setSelectedLutId(null)}
                >
                  Nenhum
                </Button>
                {luts.map((l) => (
                  <Button
                    key={l.id}
                    variant={selectedLutId === l.id ? "default" : "outline"}
                    onClick={() => setSelectedLutId(l.id)}
                  >
                    LUT #{l.id} — {l.name}
                  </Button>
                ))}
              </div>
              {/* Rodapé dependente do contexto (upload vs troca) */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {pendingFiles.current ? (
                  <Button className="bg-black/80 text-white hover:bg-black" onClick={startUpload}>
                    Continuar
                  </Button>
                ) : (
                  <Button className="bg-black/80 text-white hover:bg-black" onClick={startMassChange}>
                    Aplicar
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLutDialogOpen(false)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {progressPhase && (
          <ProgressOverlay
            phase={progressPhase}
            percent={progressPercent}
            onCancel={() => setProgressPhase(null)}
          />
        )}
      </div>
    </div>
  );
};

export default EventGalleryPage;