"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import PoseOverlay from "@/components/PoseOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";

type Hist = { r: number[]; g: number[]; b: number[] };
type ProcessOut = {
  processed_url: string;
  histogram: Hist;
  sharpness: number;
  dimensions: { width: number; height: number };
};

type LutPreset = {
  id: number;
  name: string;
  description?: string | null;
  params: any;
  thumb_url?: string | null;
  created_at: string;
};

const ParametrosPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [imageId, setImageId] = React.useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = React.useState<string | null>(null);

  const [presets, setPresets] = React.useState<LutPreset[]>([]);
  const [lutName, setLutName] = React.useState<string>("");
  const [lutDesc, setLutDesc] = React.useState<string>("");
  const [processedRelPath, setProcessedRelPath] = React.useState<string | null>(null);

  // Ajustes (valores)
  const [brightness, setBrightness] = React.useState(0);
  const [exposure, setExposure] = React.useState(0); // -2..2
  const [gamma, setGamma] = React.useState(1);
  const [shadows, setShadows] = React.useState(0);
  const [highlights, setHighlights] = React.useState(0);
  const [curves, setCurves] = React.useState(0);
  const [temperature, setTemperature] = React.useState(0);
  const [saturation, setSaturation] = React.useState(0);
  const [vibrance, setVibrance] = React.useState(0);
  const [vignette, setVignette] = React.useState(0);
  const [contrast, setContrast] = React.useState(0);

  // Modo ferramenta única
  type ControlKey =
    | "brightness"
    | "exposure"
    | "gamma"
    | "shadows"
    | "highlights"
    | "curves"
    | "temperature"
    | "saturation"
    | "vibrance"
    | "vignette"
    | "contrast";
  const [selectedControl, setSelectedControl] = React.useState<ControlKey>("brightness");

  const controls = [
    { key: "brightness", label: "Brilho", min: -100, max: 100, step: 1, get: () => brightness, set: (v: number) => setBrightness(v) },
    { key: "exposure", label: "Exposição", min: -2, max: 2, step: 0.1, get: () => exposure, set: (v: number) => setExposure(v) },
    { key: "gamma", label: "Gamma", min: 0.5, max: 2, step: 0.05, get: () => gamma, set: (v: number) => setGamma(v) },
    { key: "shadows", label: "Sombras", min: -100, max: 100, step: 1, get: () => shadows, set: (v: number) => setShadows(v) },
    { key: "highlights", label: "Highlights", min: -100, max: 100, step: 1, get: () => highlights, set: (v: number) => setHighlights(v) },
    { key: "curves", label: "Curvas (S-curve)", min: 0, max: 1, step: 0.02, get: () => curves, set: (v: number) => setCurves(v) },
    { key: "temperature", label: "Temperatura", min: -100, max: 100, step: 1, get: () => temperature, set: (v: number) => setTemperature(v) },
    { key: "saturation", label: "Saturação", min: -100, max: 100, step: 1, get: () => saturation, set: (v: number) => setSaturation(v) },
    { key: "vibrance", label: "Vibração", min: -100, max: 100, step: 1, get: () => vibrance, set: (v: number) => setVibrance(v) },
    { key: "vignette", label: "Vinheta", min: 0, max: 1, step: 0.02, get: () => vignette, set: (v: number) => setVignette(v) },
    { key: "contrast", label: "Contraste", min: -100, max: 100, step: 1, get: () => contrast, set: (v: number) => setContrast(v) },
  ] as const;

  // Crop
  const [cropMode, setCropMode] = React.useState<"none" | "normal" | "face">("none");
  const [crop, setCrop] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedRect, setCroppedRect] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropAspect, setCropAspect] = React.useState(16 / 9);
  const [faceAnchor, setFaceAnchor] = React.useState<string>("center");
  const [faceScale, setFaceScale] = React.useState(1.0);
  const [poseLandmarks, setPoseLandmarks] = React.useState<{ name: string; x: number; y: number; visibility?: number }[] | null>(null);

  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [previewMode, setPreviewMode] = React.useState<"original" | "processed">("processed");

  const uploadRef = React.useRef<HTMLInputElement | null>(null);

  const onFile = async (f: File) => {
    const form = new FormData();
    form.append("file", f);
    const res = await fetch(`${API_URL}/image-editor/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      toast.error("Falha ao enviar imagem.");
      return;
    }
    const data = await res.json();
    setImageId(data.image_id);
    setOriginalUrl(`${API_URL}/${data.original_url}`);
    setProcessedUrl(`${API_URL}/${data.original_url}`); // inicial
    setProcessedRelPath(null);
  };

  const onCropComplete = (_area: any, pixels: { width: number; height: number; x: number; y: number }) => {
    setCroppedRect({ x: Math.round(pixels.x), y: Math.round(pixels.y), w: Math.round(pixels.width), h: Math.round(pixels.height) });
  };

  const process = React.useCallback(async () => {
    if (!imageId) return;
    setIsProcessing(true);
    toast("Processando imagem...");
    const payload: any = {
      image_id: imageId,
      params: {
        brightness,
        exposure,
        gamma,
        shadows,
        highlights,
        curves_strength: curves,
        temperature,
        saturation,
        vibrance,
        vignette,
        contrast,
        crop: {
          mode: cropMode,
          rect: cropMode === "normal" ? croppedRect : undefined,
          aspect: cropMode === "face" ? cropAspect : undefined,
          scale: cropMode === "face" ? faceScale : undefined,
          anchor: cropMode === "face" ? faceAnchor : undefined,
        },
      },
    };
    const res = await fetch(`${API_URL}/image-editor/process`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Falha ao processar imagem.");
      setIsProcessing(false);
      return;
    }
    const out: ProcessOut = await res.json();
    setProcessedUrl(`${API_URL}/${out.processed_url}`);
    setProcessedRelPath(out.processed_url); // caminho relativo para thumbnail do LUT
    setIsProcessing(false);
  }, [imageId, brightness, exposure, gamma, shadows, highlights, curves, temperature, saturation, vibrance, vignette, contrast, cropMode, croppedRect, cropAspect, faceScale, faceAnchor, API_URL]);

  React.useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await fetch(`${API_URL}/luts`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setPresets(Array.isArray(data.presets) ? data.presets : []);
      } catch {
        // silencioso
      }
    };
    fetchPresets();
  }, [API_URL]);

  const saveCurrentLUT = async () => {
    if (!lutName.trim()) {
      toast.error("Informe um nome para o LUT.");
      return;
    }
    if (!processedRelPath) {
      toast("Aplicando ajustes antes de salvar...");
      await process();
    }
    const body = {
      name: lutName.trim(),
      description: lutDesc.trim() || undefined,
      params: {
        brightness,
        exposure,
        gamma,
        shadows,
        highlights,
        curves_strength: curves,
        temperature,
        saturation,
        vibrance,
        vignette,
        contrast,
        crop: {
          mode: cropMode,
          rect: cropMode === "normal" ? croppedRect : undefined,
          aspect: cropMode === "face" ? cropAspect : undefined,
          scale: cropMode === "face" ? faceScale : undefined,
          anchor: cropMode === "face" ? faceAnchor : undefined,
        },
      },
      thumb_source_url: processedRelPath,
    };
    const res = await fetch(`${API_URL}/luts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Falha ao salvar LUT.");
      return;
    }
    const data = await res.json();
    if (data?.preset) {
      toast.success("LUT salvo!");
      setPresets((prev) => [data.preset, ...prev]);
      setLutName("");
      setLutDesc("");
    }
  };

  const applyLUT = async (p: LutPreset) => {
    const params = p.params || {};
    setBrightness(Number(params.brightness ?? 0));
    setExposure(Number(params.exposure ?? 0));
    setGamma(Number(params.gamma ?? 1));
    setShadows(Number(params.shadows ?? 0));
    setHighlights(Number(params.highlights ?? 0));
    setCurves(Number(params.curves_strength ?? 0));
    setTemperature(Number(params.temperature ?? 0));
    setSaturation(Number(params.saturation ?? 0));
    setVibrance(Number(params.vibrance ?? 0));
    setVignette(Number(params.vignette ?? 0));
    setContrast(Number(params.contrast ?? 0));
    const cropParams = params.crop || {};
    const mode = cropParams.mode as "none" | "normal" | "face" | undefined;
    if (mode) setCropMode(mode);
    if (mode === "normal") {
      setCropAspect(Number(cropParams.aspect ?? cropAspect));
      // rect aplicado no backend
    } else if (mode === "face") {
      setCropAspect(Number(cropParams.aspect ?? cropAspect));
      setFaceScale(Number(cropParams.scale ?? faceScale));
      if (cropParams.anchor) setFaceAnchor(String(cropParams.anchor));
    }
    await process(); // aplica imediatamente
  };

  const deleteLUT = async (id: number) => {
    const res = await fetch(`${API_URL}/luts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error("Não foi possível excluir o LUT.");
      return;
    }
    toast.success("LUT excluído.");
    setPresets((prev) => prev.filter((x) => x.id !== id));
  };

  React.useEffect(() => {
    const fetchPose = async () => {
      if (!imageId) return;
      const res = await fetch(`${API_URL}/image-editor/pose/${imageId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setPoseLandmarks(Array.isArray(data.landmarks) ? data.landmarks : []);
    };
    fetchPose();
  }, [imageId, API_URL]);

  const currentControl = controls.find((c) => c.key === selectedControl)!;

  return (
    <div className="min-h-screen w-full p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <Card className="rounded-2xl border bg-[#efeae3]/85 ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900">
          <CardHeader>
            <CardTitle>Editor de Fotos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 relative">
            {isProcessing && <LoadingOverlay message="Processando imagem..." />}

            {/* Barra superior: upload */}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="file"
                accept="image/*"
                ref={uploadRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </div>

            {/* Preview sempre em evidência */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm text-slate-700">Visualização</Label>
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={previewMode}
                    onValueChange={(val) => val && setPreviewMode(val as "original" | "processed")}
                    className="bg-white/70 border rounded-md p-1"
                  >
                    <ToggleGroupItem
                      value="processed"
                      aria-label="Ver imagem editada"
                      className="px-3 py-1.5"
                    >
                      Editado
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="original"
                      aria-label="Ver imagem original"
                      className="px-3 py-1.5"
                    >
                      Original
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Button
                    variant="outline"
                    onClick={() => process()}
                    disabled={!imageId || isProcessing}
                  >
                    {isProcessing ? "Processando..." : "Aplicar alterações"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="inline-block p-2 rounded-2xl border bg-white shadow-sm ring-1 ring-black/5">
                  <div className="overflow-hidden rounded-xl border bg-white">
                    {previewMode === "processed" ? (
                      processedUrl ? (
                        <img
                          src={processedUrl}
                          alt="Imagem editada"
                          className="max-h-[60vh] w-auto object-contain"
                        />
                      ) : (
                        <div className="h-64 w-[22rem] flex items-center justify-center text-slate-500">
                          Aguarde o processamento
                        </div>
                      )
                    ) : originalUrl ? (
                      <img
                        src={originalUrl}
                        alt="Imagem original"
                        className="max-h-[60vh] w-auto object-contain"
                      />
                    ) : (
                      <div className="h-64 w-[22rem] flex items-center justify-center text-slate-500">
                        Envie uma imagem para começar
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Área principal: ajustes (ferramenta única) + LUTs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Ferramentas de ajuste (2 colunas) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border bg-white/70 p-4">
                  <div className="flex flex-wrap gap-2">
                    {controls.map((c) => (
                      <Button
                        key={c.key}
                        variant={selectedControl === c.key ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedControl(c.key as ControlKey)}
                        className={selectedControl === c.key ? "" : "text-slate-700"}
                      >
                        {c.label}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base font-medium">{currentControl.label}</Label>
                      <span className="text-sm text-slate-600">
                        {currentControl.get().toFixed(typeof currentControl.step === "number" && currentControl.step < 1 ? 2 : 0)}
                      </span>
                    </div>
                    <Slider
                      value={[currentControl.get()]}
                      min={currentControl.min}
                      max={currentControl.max}
                      step={currentControl.step}
                      onValueChange={(vals) => currentControl.set(vals[0])}
                      onValueCommit={(vals) => {
                        // processa quando solta o slider
                        if (imageId && !isProcessing) {
                          // garante que usamos o valor final já definido por onValueChange
                          process();
                        }
                      }}
                      className="w-full"
                    />
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>{currentControl.min}</span>
                      <span>{currentControl.max}</span>
                    </div>
                  </div>
                </div>

                {/* Seção de Crop */}
                <div className="rounded-xl border bg-white/70 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Button variant={cropMode === "none" ? "default" : "outline"} onClick={() => setCropMode("none")}>Sem crop</Button>
                    <Button variant={cropMode === "normal" ? "default" : "outline"} onClick={() => setCropMode("normal")}>Normal</Button>
                    <Button variant={cropMode === "face" ? "default" : "outline"} onClick={() => setCropMode("face")}>Dinâmico (rosto)</Button>
                  </div>

                  {cropMode === "normal" && (
                    <>
                      <div className="relative w-full h-64 bg-black/5 rounded-md overflow-hidden border">
                        {originalUrl && (
                          <Cropper
                            image={originalUrl}
                            crop={crop}
                            zoom={zoom}
                            aspect={cropAspect}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            showGrid={false}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Zoom (1x–2x)</Label>
                          <Slider
                            value={[zoom]}
                            min={1}
                            max={2}
                            step={0.01}
                            onValueChange={(vals) => setZoom(vals[0])}
                            onValueCommit={() => {
                              if (imageId && !isProcessing) {
                                process();
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Aspect</Label>
                          <select value={cropAspect} onChange={(e) => setCropAspect(Number(e.target.value))} className="border rounded-md px-2 py-1">
                            <option value={1}>1:1</option>
                            <option value={21/9}>21:9 (landscape)</option>
                            <option value={16/9}>16:9 (landscape)</option>
                            <option value={16/10}>16:10 (landscape)</option>
                            <option value={3/2}>3:2 (landscape)</option>
                            <option value={4/3}>4:3 (landscape)</option>
                            <option value={9/16}>9:16 (portrait)</option>
                            <option value={2/3}>2:3 (portrait)</option>
                            <option value={3/4}>3:4 (portrait)</option>
                            <option value={4/5}>4:5 (portrait)</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {cropMode === "face" && (
                    <div className="space-y-3">
                      {originalUrl && (
                        <>
                          {poseLandmarks && poseLandmarks.length > 0 ? (
                            <PoseOverlay
                              imageSrc={originalUrl}
                              landmarks={poseLandmarks}
                              selectedAnchor={faceAnchor}
                              onSelectAnchor={(name) => setFaceAnchor(String(name))}
                            />
                          ) : (
                            <div className="relative w-full">
                              <img src={originalUrl} alt="Imagem" className="w-full h-auto rounded-md border" />
                              <div className="mt-2 text-xs text-slate-700">
                                Nenhuma pose disponível. Selecione uma âncora de rosto abaixo (fallback).
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>Aspect</Label>
                          <select value={cropAspect} onChange={(e) => setCropAspect(Number(e.target.value))} className="border rounded-md px-2 py-1">
                            <option value={1}>1:1</option>
                            <option value={21/9}>21:9 (landscape)</option>
                            <option value={16/9}>16:9 (landscape)</option>
                            <option value={16/10}>16:10 (landscape)</option>
                            <option value={3/2}>3:2 (landscape)</option>
                            <option value={4/3}>4:3 (landscape)</option>
                            <option value={9/16}>9:16 (portrait)</option>
                            <option value={2/3}>2:3 (portrait)</option>
                            <option value={3/4}>3:4 (portrait)</option>
                            <option value={4/5}>4:5 (portrait)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Âncora</Label>
                          <select
                            value={faceAnchor}
                            onChange={(e) => setFaceAnchor(e.target.value)}
                            className="border rounded-md px-2 py-1"
                          >
                            {poseLandmarks && poseLandmarks.length > 0 ? (
                              <>
                                <option value="shoulders_center">Centro dos ombros</option>
                                <option value="hips_center">Centro dos quadris</option>
                                {poseLandmarks.map((lm) => (
                                  <option key={lm.name} value={lm.name}>{lm.name}</option>
                                ))}
                              </>
                            ) : (
                              <>
                                <option value="center">Centro</option>
                                <option value="eyes">Olhos</option>
                                <option value="nose">Nariz</option>
                                <option value="mouth">Boca</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Escala (1x–2x)</Label>
                          <Slider
                            value={[faceScale]}
                            min={1}
                            max={2}
                            step={0.01}
                            onValueChange={(vals) => setFaceScale(vals[0])}
                            onValueCommit={() => {
                              if (imageId && !isProcessing) {
                                process();
                              }
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-700 md:col-span-3">
                          Escala funciona como zoom: 1x usa a área máxima; 2x recorta uma área menor centrada na âncora.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* LUTs: salvar e aplicar separados */}
              <div className="lg:col-span-1 space-y-6">
                <div className="rounded-xl border bg-white/70 p-4 space-y-3">
                  <h3 className="text-lg font-semibold">Salvar LUT</h3>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={lutName} onChange={(e) => setLutName(e.target.value)} placeholder="Ex.: Retrato quente" />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <textarea
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      rows={3}
                      value={lutDesc}
                      onChange={(e) => setLutDesc(e.target.value)}
                      placeholder="Anote detalhes (temperatura, contraste, aspecto, etc.)"
                    />
                  </div>
                  <Button variant="default" disabled={!imageId} onClick={saveCurrentLUT} className="w-full">
                    Salvar LUT
                  </Button>
                </div>

                <div className="rounded-xl border bg-white/70 p-4">
                  <h3 className="text-lg font-semibold mb-3">Meus LUTs</h3>
                  {presets.length === 0 ? (
                    <div className="text-sm text-slate-600">Nenhum LUT salvo ainda.</div>
                  ) : (
                    <div className="space-y-3">
                      {presets.map((p) => (
                        <div key={p.id} className="border rounded-md overflow-hidden bg-white">
                          {p.thumb_url ? (
                            <img
                              src={`${API_URL}/${p.thumb_url}`}
                              alt={p.name}
                              className="w-full h-28 object-cover"
                            />
                          ) : (
                            <div className="w-full h-28 bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
                              Sem thumbnail
                            </div>
                          )}
                          <div className="p-3 space-y-2">
                            <div className="font-medium">{p.name}</div>
                            {p.description && <div className="text-xs text-slate-600 line-clamp-3">{p.description}</div>}
                            <div className="flex items-center gap-2">
                              <Button size="sm" className="flex-1" onClick={() => applyLUT(p)}>Aplicar</Button>
                              <Button size="sm" variant="outline" onClick={() => deleteLUT(p.id)}>Excluir</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParametrosPage;