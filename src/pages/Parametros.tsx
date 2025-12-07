"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

type Meta = Record<string, any>;

const ParametrosPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [imageId, setImageId] = React.useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = React.useState<string | null>(null);

  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [hist, setHist] = React.useState<Hist | null>(null);
  const [sharp, setSharp] = React.useState<number | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Ajustes
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

  // Crop
  const [cropMode, setCropMode] = React.useState<"none" | "normal" | "face">("none");
  const [crop, setCrop] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedRect, setCroppedRect] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropAspect, setCropAspect] = React.useState(16 / 9);
  const [faceAnchor, setFaceAnchor] = React.useState<"center" | "eyes" | "nose" | "mouth">("center");
  const [faceScale, setFaceScale] = React.useState(1.0);
  const [poseLandmarks, setPoseLandmarks] = React.useState<{ name: string; x: number; y: number; visibility?: number }[] | null>(null);

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
    setMeta(data.meta || {});
    // hist inicial
    const hres = await fetch(`${API_URL}/image-editor/histogram/${data.image_id}`, { credentials: "include" });
    const hjson = await hres.json();
    setHist(hjson.histogram || null);
    setSharp(hjson.sharpness ?? null);
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
    setHist(out.histogram);
    setSharp(out.sharpness);
    setIsProcessing(false);
  }, [imageId, brightness, exposure, gamma, shadows, highlights, curves, temperature, saturation, vibrance, vignette, contrast, cropMode, croppedRect, cropAspect, faceScale, faceAnchor, API_URL]);

  // Atualizar busca da pose: buscar assim que houver imageId (independente do modo de crop)
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

  const uploadRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="min-h-screen w-full p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <Card className="rounded-2xl border bg-[#efeae3]/85 ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900">
          <CardHeader>
            <CardTitle>Parâmetros • Editor de Fotos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 relative">
            {isProcessing && <LoadingOverlay message="Processando imagem..." />}
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
              {processedUrl && (
                <Badge variant="outline" className="bg-black/5 text-slate-900">
                  Nitidez: {sharp != null ? sharp.toFixed(2) : "—"}
                </Badge>
              )}
              <Button
                variant="default"
                onClick={() => process()}
                disabled={!imageId || isProcessing}
                className="ml-auto"
              >
                {isProcessing ? "Processando..." : "Aplicar alterações"}
              </Button>
            </div>

            {imageId && (
              <Tabs defaultValue="ajustes">
                <TabsList>
                  <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
                  <TabsTrigger value="crop">Crop</TabsTrigger>
                </TabsList>

                <TabsContent value="ajustes" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brilho</Label>
                      <input type="range" min={-100} max={100} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Exposição</Label>
                      <input type="range" min={-2} max={2} step={0.1} value={exposure} onChange={(e) => setExposure(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Gamma</Label>
                      <input type="range" min={0.5} max={2} step={0.05} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sombras</Label>
                      <input type="range" min={-100} max={100} value={shadows} onChange={(e) => setShadows(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Highlights</Label>
                      <input type="range" min={-100} max={100} value={highlights} onChange={(e) => setHighlights(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Curvas (S-curve)</Label>
                      <input type="range" min={0} max={1} step={0.02} value={curves} onChange={(e) => setCurves(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Temperatura</Label>
                      <input type="range" min={-100} max={100} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Saturação</Label>
                      <input type="range" min={-100} max={100} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Vibração</Label>
                      <input type="range" min={-100} max={100} value={vibrance} onChange={(e) => setVibrance(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Vinheta</Label>
                      <input type="range" min={0} max={1} step={0.02} value={vignette} onChange={(e) => setVignette(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contraste</Label>
                      <input type="range" min={-100} max={100} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="crop" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant={cropMode === "none" ? "default" : "outline"} onClick={() => setCropMode("none")}>Sem crop</Button>
                    <Button variant={cropMode === "normal" ? "default" : "outline"} onClick={() => setCropMode("normal")}>Normal</Button>
                    <Button variant={cropMode === "face" ? "default" : "outline"} onClick={() => setCropMode("face")}>Dinâmico (rosto)</Button>
                  </div>

                  {cropMode === "normal" && (
                    <>
                      <div className="relative w-full max-w-2xl h-64 bg-black/5 rounded-md overflow-hidden border">
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
                      <div className="grid grid-cols-2 gap-3 max-w-2xl">
                        <div className="space-y-1">
                          <Label>Zoom</Label>
                          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
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
                    <div className="space-y-3 max-w-2xl">
                      {/* Overlay do esqueleto com pontos clicáveis (com fallback quando não há pose) */}
                      {originalUrl && (
                        <>
                          {poseLandmarks && poseLandmarks.length > 0 ? (
                            <PoseOverlay
                              imageSrc={originalUrl}
                              landmarks={poseLandmarks}
                              selectedAnchor={faceAnchor}
                              onSelectAnchor={(name) => setFaceAnchor(name as any)}
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
                            onChange={(e) => setFaceAnchor(e.target.value as any)}
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
                          <Label>Escala</Label>
                          <input type="range" min={0.6} max={1.8} step={0.02} value={faceScale} onChange={(e) => setFaceScale(Number(e.target.value))} />
                        </div>
                        <p className="text-xs text-slate-700 md:col-span-3">
                          O crop dinâmico ancora no ponto selecionado do esqueleto. Clique nos pontos para escolher a âncora. Se não houver pose disponível, usa detecção facial como fallback.
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Preview lado a lado */}
            {originalUrl && processedUrl && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-700 mb-1">Original</div>
                  <div className="rounded-md overflow-hidden border bg-white">
                    <img src={originalUrl} alt="Original" className="w-full h-auto" />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-700 mb-1">Processado</div>
                  <div className="rounded-md overflow-hidden border bg-white">
                    <img src={processedUrl} alt="Processado" className="w-full h-auto" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParametrosPage;