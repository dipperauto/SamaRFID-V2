"use client";

import React from "react";
import Cropper from "react-easy-crop";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { AspectRatio } from "./ui/aspect-ratio";

type Props = {
  onChange: (dataUrl: string | null) => void;
  initialImage?: string | null;
  // NEW: permitir configurar formato e proporção do recorte
  cropShape?: "rect" | "round";
  aspect?: number;
};

type AreaPixels = { width: number; height: number; x: number; y: number };

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: AreaPixels): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return canvas.toDataURL("image/png");
}

const PhotoCropper: React.FC<Props> = ({ onChange, initialImage = null, cropShape = "round", aspect = 1 }) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [imageSrc, setImageSrc] = React.useState<string | null>(initialImage ?? null);
  const [crop, setCrop] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<AreaPixels | null>(null);
  const [preview, setPreview] = React.useState<string | null>(initialImage ?? null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() || null;
      setImageSrc(result);
      setPreview(null);
      onChange(null);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = (_croppedArea: any, croppedAreaPixelsParam: AreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixelsParam);
  };

  const confirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
    setPreview(dataUrl);
    onChange(dataUrl);
  };

  const clearImage = () => {
    setImageSrc(null);
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="text-black bg-white hover:bg-white/90"
        >
          Carregar foto
        </Button>
        {preview && (
          <Button
            type="button"
            variant="secondary"
            onClick={clearImage}
            className="text-black"
          >
            Remover
          </Button>
        )}
      </div>

      {imageSrc && (
        <div className="space-y-3">
          <div className="relative w-full h-64 bg-gray-100 rounded-md overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape={cropShape}
              showGrid={false}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Zoom</div>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={confirmCrop}>Confirmar corte</Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearImage}
              className="text-black bg-white hover:bg-white/90"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {preview && (
        <div className="flex items-center gap-3">
          {cropShape === "round" ? (
            <div className="w-16 h-16 rounded-full overflow-hidden border">
              <img src={preview} alt="Prévia" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full max-w-xs">
              <AspectRatio ratio={aspect || 16 / 9}>
                <div className="w-full h-full rounded-md overflow-hidden border">
                  <img src={preview} alt="Prévia" className="w-full h-full object-cover" />
                </div>
              </AspectRatio>
            </div>
          )}
          <div className="text-sm text-gray-600">Prévia da foto recortada</div>
        </div>
      )}
    </div>
  );
};

export default PhotoCropper;