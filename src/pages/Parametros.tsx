"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import Cropper from "react-easy-crop";
import PoseOverlay from "@/components/PoseOverlay";

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
      return;
    }
    const out: ProcessOut = await res.json();
    setProcessedUrl(`${API_URL}/${out.processed_url}`);
    setHist(out.histogram);
    setSharp(out.sharpness);
  }, [imageId, brightness, exposure, gamma, shadows, highlights, curves, temperature, saturation, vibrance, vignette, contrast, cropMode, croppedRect, cropAspect, faceScale, faceAnchor, API_URL]);

  // BUSCAR POSE quando imagem carregar ou ao ativar 'face'
  React.useEffect(() => {
    const fetchPose = async () => {
      if (!imageId || cropMode !== "face") return;
      const res = await fetch(`${API_URL}/image-editor/pose/${imageId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setPoseLandmarks(Array.isArray(data.landmarks) ? data.landmarks : []);
    };
    fetchPose();
  }, [imageId, cropMode, API_URL]);

  // reduzir debounce para ~120ms
  React.useEffect(() => {
    const t = setTimeout(() => { process(); }, 120);
    return () => clearTimeout(t);
  }, [process]);

  const uploadRef = React.useRef<HTMLInputElement | null>(null);

  const histData = React.useMemo(() => {
    if (!hist) return [];
    const len = Math.max(hist.r.length, hist.g.length, hist.b.length);
    return Array.from({ length: len }).map((_, i) => ({
      x: i,
      r: hist.r[i] ?? 0,
      g: hist.g[i] ?? 0,
      b: hist.b[i] ?? 0,
    }));
  }, [hist]);

  return (
    <div className="min-h-screen w-full p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <Card className="rounded-2xl border bg-[#efeae3]/85 ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900">
          <CardHeader>
            <CardTitle>Parâmetros • Editor de Fotos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </div>

            {imageId && (
              <Tabs defaultValue="ajustes">
                <TabsList>
                  <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
                  <TabsTrigger value="crop">Crop</TabsTrigger>
                  <TabsTrigger value="hist">Histogramas</TabsTrigger>
                  <TabsTrigger value="meta">Metadados</TabsTrigger>
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
                            <option value={16/9}>16:9</option>
                            <option value={4/3}>4:3</option>
                            <option value={3/2}>3:2</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  {cropMode === "face" && (
                    <div className="space-y-3 max-w-2xl">
                      {/* Overlay do esqueleto com pontos clicáveis */}
                      {originalUrl && poseLandmarks && poseLandmarks.length > 0 && (
                        <PoseOverlay
                          imageSrc={originalUrl}
                          landmarks={poseLandmarks}
                          selectedAnchor={faceAnchor}
                          onSelectAnchor={(name) => setFaceAnchor(name as any)}
                        />
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>Aspect</Label>
                          <select value={cropAspect} onChange={(e) => setCropAspect(Number(e.target.value))} className="border rounded-md px-2 py-1">
                            <option value={1}>1:1</option>
                            <option value={16/9}>16:9</option>
                            <option value={4/3}>4:3</option>
                            <option value={3/2}>3:2</option>
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

                <TabsContent value="hist" className="space-y-3">
                  <ChartContainer
                    config={{
                      r: { label: "R", color: "#ef4444" },
                      g: { label: "G", color: "#22c55e" },
                      b: { label: "B", color: "#3b82f6" },
                    }}
                    className="w-full h-64"
                  >
                    <LineChart data={histData}>
                      <XAxis dataKey="x" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Line type="monotone" dataKey="r" stroke="#ef4444" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="g" stroke="#22c55e" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="b" stroke="#3b82f6" dot={false} strokeWidth={1} />
                    </LineChart>
                  </ChartContainer>
                  <ChartLegendContent payload={[
                    { dataKey: "r", color: "#ef4444", value: "R" },
                    { dataKey: "g", color: "#22c55e", value: "G" },
                    { dataKey: "b", color: "#3b82f6", value: "B" },
                  ]} />
                </TabsContent>

                <TabsContent value="meta" className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {meta && Object.keys(meta).length > 0 ? (
                      Object.entries(meta).map(([k, v]) => (
                        <div key={k} className="rounded-md border bg-white/70 px-3 py-2">
                          <div className="text-xs text-slate-600">{k}</div>
                          <div className="text-sm font-medium text-slate-900">{String(v)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-700">Sem metadados disponíveis.</div>
                    )}
                  </div>
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