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
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ProgressOverlay from "@/components/ProgressOverlay";
import { showError, showSuccess } from "@/utils/toast";
import { Image as ImageIcon, Trash2, Wand2 } from "lucide-react";

type GalleryItem = {
  id: string;
  url: string;
  uploader: string;
  meta?: Record<string, any>;
  lut_id?: number | null;
  sharpness?: number;
  discarded?: boolean;
  uploaded_at?: string;
};

const EventGalleryPage: React.FC = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [raw, setRaw] = React.useState<GalleryItem[]>([]);
  const [edited, setEdited] = React.useState<GalleryItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [eventName, setEventName] = React.useState<string>("");
  const [eventThumbUrl, setEventThumbUrl] = React.useState<string>("");
  const [photographers, setPhotographers] = React.useState<{ username: string; full_name: string; profile_photo_url?: string }[]>([]);
  const [ownerUsername, setOwnerUsername] = React.useState<string>("");

  // Tabs, busca, ordenação e paginação
  const [activeTab, setActiveTab] = React.useState<"raw" | "edited">("raw");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortBy, setSortBy] = React.useState<"sharpness" | "date" | "uploader">("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const PAGE_SIZE = 50;
  const [rawPage, setRawPage] = React.useState<number>(1);
  const [editedPage, setEditedPage] = React.useState<number>(1);

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
  const [sharpnessThreshold, setSharpnessThreshold] = React.useState<number>(39);

  const [progressPhase, setProgressPhase] = React.useState<"upload" | "processing" | null>(null);
  const [progressPercent, setProgressPercent] = React.useState<number>(0);
  const [priceBRL, setPriceBRL] = React.useState<number>(() => {
    const raw = localStorage.getItem("lastPriceBRL");
    return raw ? Number(raw) : 10;
  });

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
      // reset páginas se necessário
      setRawPage(1);
      setEditedPage(1);
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
        if (data?.owner_username) setOwnerUsername(String(data.owner_username));
      } catch {}
    };
    loadEventName();
  }, [API_URL, eventId]);

  // Carregar dados públicos para pegar thumb e fotógrafos
  React.useEffect(() => {
    const loadPublicInfo = async () => {
      if (!eventId) return;
      try {
        const res = await fetch(`${API_URL}/public/events/${eventId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.photo_url) setEventThumbUrl(String(data.photo_url));
        setPhotographers((data?.photographers ?? []) as any);
      } catch {}
    };
    loadPublicInfo();
  }, [API_URL, eventId]);

  // Derivar lista de fotógrafos incluindo owner (sem duplicar)
  const displayPhotographers = React.useMemo(() => {
    const base = photographers || [];
    if (ownerUsername && !base.find((p) => p.username === ownerUsername)) {
      return [...base, { username: ownerUsername, full_name: ownerUsername }];
    }
    return base;
  }, [photographers, ownerUsername]);

  // Deriva itens filtrados/ordenados/paginados para o tab atual
  const applySearch = React.useCallback((items: GalleryItem[]) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const fields = [
        it.uploader || "",
        String(it.sharpness ?? ""),
        String(it.lut_id ?? ""),
        String(it.uploaded_at ?? ""),
        it.meta?.Dimensions || "",
      ].map((s) => s.toLowerCase());
      return fields.some((f) => f.includes(q));
    });
  }, [searchQuery]);

  const applySort = React.useCallback((items: GalleryItem[]) => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortBy === "sharpness") {
        va = Number(a.sharpness ?? 0);
        vb = Number(b.sharpness ?? 0);
      } else if (sortBy === "uploader") {
        va = (a.uploader || "").toLowerCase();
        vb = (b.uploader || "").toLowerCase();
      } else {
        // date
        va = new Date(a.uploaded_at || 0).getTime();
        vb = new Date(b.uploaded_at || 0).getTime();
      }
      const cmp = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [sortBy, sortDir]);

  const getPaged = React.useCallback((items: GalleryItem[], page: number) => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const start = (clampedPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return { pageItems: items.slice(start, end), totalPages, currentPage: clampedPage };
  }, []);

  const rawDisplay = React.useMemo(() => {
    const filtered = applySearch(raw);
    const sorted = applySort(filtered);
    return getPaged(sorted, rawPage);
  }, [raw, applySearch, applySort, getPaged, rawPage]);

  const editedDisplay = React.useMemo(() => {
    const filtered = applySearch(edited);
    const sorted = applySort(filtered);
    return getPaged(sorted, editedPage);
  }, [edited, applySearch, applySort, getPaged, editedPage]);

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
      form.append("sharpness_threshold", String(sharpnessThreshold));
      form.append("price_brl", String(priceBRL));
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

  // Selecionar todas as fotos visíveis na aba atual
  const selectAllVisible = () => {
    const ids =
      activeTab === "raw"
        ? rawDisplay.pageItems.map((it) => it.id)
        : editedDisplay.pageItems.map((it) => it.id);
    setSelectedIds(new Set(ids));
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
            {/* Busca e ordenação */}
            <div className="hidden md:flex items-center gap-2">
              <Input
                placeholder="Pesquisar por nitidez, data, fotógrafo..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setRawPage(1);
                  setEditedPage(1);
                }}
                className="w-64"
              />
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  setSortBy(v as any);
                  setRawPage(1);
                  setEditedPage(1);
                }}
              >
                <SelectTrigger className="w-40"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="uploader">Fotógrafo</SelectItem>
                  <SelectItem value="sharpness">Nitidez</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
                {sortDir === "asc" ? "Asc" : "Desc"}
              </Button>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
            <Button variant="outline" onClick={() => window.open(`/public/events/${eventId}/face`, "_blank")}>
              Reconhecimento (link público)
            </Button>
            <Button onClick={onPickFiles} className="bg-black/80 text-white hover:bg-black">
              <ImageIcon className="h-4 w-4 mr-2" /> Upload de imagens
            </Button>
            {/* input oculto para arquivos e pastas */}
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              // @ts-expect-error non-standard attribute
              webkitdirectory="true"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
        </div>

        {/* Preço base lembrado para uploads */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700">Preço por imagem (R$)</span>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={priceBRL}
            onChange={(e) => {
              const v = Number(e.target.value || 0);
              setPriceBRL(v);
              localStorage.setItem("lastPriceBRL", String(v));
            }}
            className="w-32"
          />
        </div>

        {/* Info do evento e fotógrafos */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-700">
              Evento: <span className="font-medium">{eventName || `#${eventId}`}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayPhotographers.map((p) => (
              <div key={p.username} className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {p.profile_photo_url ? (
                    <AvatarImage src={`${API_URL}/${p.profile_photo_url}`} alt={p.full_name} />
                  ) : (
                    <AvatarFallback>{(p.full_name || p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                <span className="text-sm">{p.full_name || p.username}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barra de ações em massa */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-700">
            Selecionadas: {selectedIds.size}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={selectAllVisible}>
              Selecionar todas (página)
            </Button>
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
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v as any);
            }} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="raw">Brutas</TabsTrigger>
                <TabsTrigger value="edited">Editadas</TabsTrigger>
              </TabsList>

              <TabsContent value="raw" className="space-y-4">
                {loading && <div className="text-sm text-slate-700">Carregando...</div>}
                {!loading && rawDisplay.pageItems.length === 0 && (
                  <div className="text-sm text-slate-700">Nenhuma imagem bruta.</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {rawDisplay.pageItems.map((it) => (
                    <div key={it.id} className="group relative rounded-lg overflow-hidden border bg-white">
                      <AspectRatio ratio={1}>
                        <img
                          src={`${API_URL}/${it.url}`}
                          alt={it.id}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => { setViewerItem(it); setViewerOpen(true); }}
                        />
                      </AspectRatio>
                      {it.discarded && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="destructive">Descartada</Badge>
                        </div>
                      )}
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
                {/* Paginação RAW */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" disabled={rawPage <= 1} onClick={() => setRawPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                  <div className="text-sm">Página {rawDisplay.currentPage} de {rawDisplay.totalPages}</div>
                  <Button variant="outline" disabled={rawPage >= rawDisplay.totalPages} onClick={() => setRawPage((p) => Math.min(rawDisplay.totalPages, p + 1))}>Próxima</Button>
                </div>
              </TabsContent>

              <TabsContent value="edited" className="space-y-4">
                {loading && <div className="text-sm text-slate-700">Carregando...</div>}
                {!loading && editedDisplay.pageItems.length === 0 && (
                  <div className="text-sm text-slate-700">Nenhuma imagem editada.</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {editedDisplay.pageItems.map((it) => (
                    <div key={it.id} className="group relative rounded-lg overflow-hidden border bg-white">
                      <AspectRatio ratio={1}>
                        <img
                          src={`${API_URL}/${it.url}`}
                          alt={it.id}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => { setViewerItem(it); setViewerOpen(true); }}
                        />
                      </AspectRatio>
                      {it.discarded && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="destructive">Descartada</Badge>
                        </div>
                      )}
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
                {/* Paginação EDITED */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" disabled={editedPage <= 1} onClick={() => setEditedPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                  <div className="text-sm">Página {editedDisplay.currentPage} de {editedDisplay.totalPages}</div>
                  <Button variant="outline" disabled={editedPage >= editedDisplay.totalPages} onClick={() => setEditedPage((p) => Math.min(editedDisplay.totalPages, p + 1))}>Próxima</Button>
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
              <div className="space-y-1">
                <div className="text-sm font-medium">Limite de nitidez para descarte</div>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={sharpnessThreshold}
                  onChange={(e) => setSharpnessThreshold(Number(e.target.value || 0))}
                />
                <div className="text-xs text-slate-600">Fotos com nitidez do sujeito abaixo deste valor serão marcadas como descartadas. Padrão: 39.</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Preço por imagem (R$)</div>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={priceBRL}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setPriceBRL(v);
                    localStorage.setItem("lastPriceBRL", String(v));
                  }}
                />
                <div className="text-xs text-slate-600">Este valor será salvo nas imagens enviadas. Lembramos automaticamente o último valor usado.</div>
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