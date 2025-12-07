import os
import io
import time
import uuid
from typing import Optional, Dict, Any, Tuple, List

from PIL import Image, ImageOps, ImageEnhance, ExifTags
import numpy as np

try:
    import cv2  # opcional, usado para face e nitidez via Laplaciano
except Exception:
    cv2 = None

MEDIA_ROOT = os.path.join(os.path.dirname(__file__), "media")
EDITOR_DIR = os.path.join(MEDIA_ROOT, "editor")

def _ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def _gen_id() -> str:
    return f"img_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"

def _unique_name(prefix: str, ext: str = "png") -> str:
    return f"{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}.{ext}"

def _to_array(img: Image.Image) -> np.ndarray:
    return np.asarray(img).astype(np.float32)

def _from_array(arr: np.ndarray) -> Image.Image:
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def _apply_adjustments(
    img: Image.Image,
    params: Dict[str, Any],
) -> Image.Image:
    """
    Aplica ajustes básicos:
    brightness [-100..100]
    exposure [-2..2] (multiplicador)
    gamma [0.5..2.0]
    shadows [-100..100] (levanta sombras)
    highlights [-100..100] (baixa altas)
    curves_strength [0..1] (S-curve)
    temperature [-100..100] (balance azul/amarelo)
    saturation [-100..100]
    vibrance [-100..100] (afeta mais os tons menos saturados)
    vignette [0..1]
    contrast [-100..100]
    """
    arr = _to_array(img).copy()
    if arr.ndim == 2:
        # expand grayscale para RGB
        arr = np.stack([arr, arr, arr], axis=-1)
    h, w, c = arr.shape
    arr_norm = arr / 255.0

    # Exposure (multiplicador)
    exposure = float(params.get("exposure", 0.0))
    if exposure != 0.0:
        arr_norm = np.clip(arr_norm * (2.0 ** exposure), 0.0, 1.0)

    # Gamma
    gamma = float(params.get("gamma", 1.0))
    gamma = max(0.1, min(5.0, gamma))
    arr_norm = np.power(arr_norm, 1.0 / gamma)

    # Brightness (offset)
    brightness = float(params.get("brightness", 0.0))  # -100..100
    if brightness != 0.0:
        arr_norm = np.clip(arr_norm + (brightness / 255.0), 0.0, 1.0)

    # Shadows/Highlights
    shadows = float(params.get("shadows", 0.0))  # -100..100
    highlights = float(params.get("highlights", 0.0))  # -100..100
    if shadows != 0.0 or highlights != 0.0:
        # luminância aproximada
        lum = np.dot(arr_norm[..., :3], np.array([0.299, 0.587, 0.114]))
        # sombras: abaixo de 0.5
        shadow_mask = (lum < 0.5).astype(np.float32)
        # highlights: acima de 0.5
        highlight_mask = (lum >= 0.5).astype(np.float32)
        # levanta sombras
        arr_norm += (shadow_mask[..., None] * (shadows / 255.0))
        # baixa highlights
        arr_norm -= (highlight_mask[..., None] * (highlights / 255.0))
        arr_norm = np.clip(arr_norm, 0.0, 1.0)

    # Curves (S-curve)
    curves_strength = float(params.get("curves_strength", 0.0))
    if curves_strength > 0.0:
        # simples S-curve via função logística
        x = arr_norm
        k = 10.0 * curves_strength
        arr_norm = 1.0 / (1.0 + np.exp(-k * (x - 0.5)))

    # Temperature (azul x amarelo)
    temperature = float(params.get("temperature", 0.0))  # -100..100
    if temperature != 0.0:
        t = temperature / 100.0
        # aumenta canal vermelho para quente, aumenta azul para frio
        arr_norm[..., 0] = np.clip(arr_norm[..., 0] + (0.1 * t), 0.0, 1.0)
        arr_norm[..., 2] = np.clip(arr_norm[..., 2] - (0.1 * t), 0.0, 1.0)

    # Saturation / Vibrance (HSV)
    saturation = float(params.get("saturation", 0.0))    # -100..100
    vibrance = float(params.get("vibrance", 0.0))        # -100..100
    # converter para HSV
    import colorsys
    rgb = arr_norm.reshape(-1, 3)
    hsv = np.zeros_like(rgb)
    for i in range(rgb.shape[0]):
        hsv[i] = colorsys.rgb_to_hsv(rgb[i, 0], rgb[i, 1], rgb[i, 2])
    # saturação direta
    if saturation != 0.0:
        s_gain = 1.0 + (saturation / 100.0)
        hsv[:, 1] = np.clip(hsv[:, 1] * s_gain, 0.0, 1.0)
    # vibrance afeta mais os baixos níveis de saturação
    if vibrance != 0.0:
        vib = vibrance / 100.0
        hsv[:, 1] = np.clip(hsv[:, 1] + vib * (1.0 - hsv[:, 1]), 0.0, 1.0)
    # volta para RGB
    for i in range(rgb.shape[0]):
        rgb[i] = colorsys.hsv_to_rgb(hsv[i, 0], hsv[i, 1], hsv[i, 2])
    arr_norm = rgb.reshape(h, w, 3)

    # Contrast (multiplicador em torno de 0.5)
    contrast = float(params.get("contrast", 0.0))  # -100..100
    if contrast != 0.0:
        k = 1.0 + (contrast / 100.0)
        arr_norm = np.clip((arr_norm - 0.5) * k + 0.5, 0.0, 1.0)

    # Vignette (escurece bordas)
    vignette = float(params.get("vignette", 0.0))  # 0..1
    if vignette > 0.0:
        yy, xx = np.mgrid[0:h, 0:w]
        cx, cy = w / 2.0, h / 2.0
        r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        r_norm = r / np.sqrt(cx ** 2 + cy ** 2)
        mask = 1.0 - vignette * (r_norm ** 2)
        arr_norm *= mask[..., None]
        arr_norm = np.clip(arr_norm, 0.0, 1.0)

    return _from_array((arr_norm * 255.0))

def _compute_histogram_rgb(img: Image.Image) -> Dict[str, List[int]]:
    if img.mode != "RGB":
        img = img.convert("RGB")
    arr = np.asarray(img)
    hist_r, _ = np.histogram(arr[..., 0].flatten(), bins=256, range=(0, 255))
    hist_g, _ = np.histogram(arr[..., 1].flatten(), bins=256, range=(0, 255))
    hist_b, _ = np.histogram(arr[..., 2].flatten(), bins=256, range=(0, 255))
    return {
        "r": hist_r.tolist(),
        "g": hist_g.tolist(),
        "b": hist_b.tolist(),
    }

def _compute_sharpness(img: Image.Image) -> float:
    # nitidez aproximada pela variância do Laplaciano (OpenCV) ou gradiente
    if cv2 is not None:
        arr = np.asarray(img.convert("L"))
        lap = cv2.Laplacian(arr, cv2.CV_64F)
        return float(lap.var())
    # fallback: var da magnitude do gradiente
    arr = np.asarray(img.convert("L")).astype(np.float32)
    gy, gx = np.gradient(arr)
    grad_mag = np.sqrt(gx**2 + gy**2)
    return float(np.var(grad_mag))

def _read_metadata(img: Image.Image) -> Dict[str, Any]:
    meta = {}
    try:
        exif = getattr(img, "_getexif", lambda: None)()
        if exif:
            tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
            interesting = [
                "DateTimeOriginal", "Model", "Make", "LensModel",
                "FNumber", "ExposureTime", "ISOSpeedRatings", "FocalLength",
            ]
            for k in interesting:
                v = tag_map.get(k)
                if v is not None:
                    meta[k] = v
    except Exception:
        pass
    meta["Dimensions"] = f"{img.width}x{img.height}"
    return meta

def save_original(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    _ensure_dir(EDITOR_DIR)
    image_id = _gen_id()
    img_dir = os.path.join(EDITOR_DIR, image_id)
    _ensure_dir(img_dir)
    # salva original como PNG
    img = Image.open(io.BytesIO(file_bytes))
    orig_name = _unique_name("original", "png")
    orig_path = os.path.join(img_dir, orig_name)
    img.convert("RGB").save(orig_path, format="PNG")
    rel = os.path.relpath(orig_path, MEDIA_ROOT).replace(os.sep, "/")
    return {
        "image_id": image_id,
        "original_rel": rel,
        "original_url": f"static/{rel}",
        "meta": _read_metadata(img),
    }

def _detect_face_anchor(img: Image.Image, anchor: str = "center") -> Optional[Tuple[int, int]]:
    if cv2 is None:
        return None
    arr = np.asarray(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.2, 6)
    if len(faces) == 0:
        return None
    # pega a maior face
    x, y, w, h = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
    cx, cy = x + w // 2, y + h // 2
    if anchor == "eyes":
        cy = y + int(h * 0.36)
    elif anchor == "nose":
        cy = y + int(h * 0.55)
    elif anchor == "mouth":
        cy = y + int(h * 0.75)
    return (cx, cy)

def _crop_normal(img: Image.Image, rect: Optional[Dict[str, int]]) -> Image.Image:
    if not rect:
        return img
    x = int(rect.get("x", 0))
    y = int(rect.get("y", 0))
    w = int(rect.get("w", img.width))
    h = int(rect.get("h", img.height))
    x = max(0, min(x, img.width - 1))
    y = max(0, min(y, img.height - 1))
    w = max(1, min(w, img.width - x))
    h = max(1, min(h, img.height - y))
    return img.crop((x, y, x + w, y + h))

def _crop_face(img: Image.Image, aspect: float = 1.0, scale: float = 1.0, anchor: str = "center") -> Image.Image:
    if cv2 is None:
        return img
    pt = _detect_face_anchor(img, anchor=anchor)
    if not pt:
        return img
    cx, cy = pt
    # cria janela centrada no anchor com aspect e scale
    base = min(img.width, img.height) * 0.5 * scale
    # calcula largura/altura respeitando aspect (w/h = aspect)
    if aspect <= 0:
        aspect = 1.0
    h = int(base)
    w = int(base * aspect)
    # define box centrado
    x = max(0, cx - w // 2)
    y = max(0, cy - h // 2)
    x2 = min(img.width, x + w)
    y2 = min(img.height, y + h)
    return img.crop((x, y, x2, y2))

def process_image(
    image_id: str,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    img_dir = os.path.join(EDITOR_DIR, image_id)
    if not os.path.isdir(img_dir):
        raise FileNotFoundError("Imagem não encontrada.")
    # encontra último original
    candidates = [f for f in os.listdir(img_dir) if f.startswith("original_") and f.endswith(".png")]
    if not candidates:
        raise FileNotFoundError("Arquivo original não encontrado.")
    candidates.sort()
    orig_path = os.path.join(img_dir, candidates[-1])
    img = Image.open(orig_path)

    # Crop
    crop_mode = params.get("crop", {}).get("mode", "none")
    if crop_mode == "normal":
        rect = params.get("crop", {}).get("rect")
        img = _crop_normal(img, rect)
    elif crop_mode == "face":
        aspect = float(params.get("crop", {}).get("aspect", 1.0))
        scale = float(params.get("crop", {}).get("scale", 1.0))
        anchor = str(params.get("crop", {}).get("anchor", "center"))
        img = _crop_face(img, aspect=aspect, scale=scale, anchor=anchor)

    # Ajustes
    out = _apply_adjustments(img, params)

    # salva preview único
    out_name = _unique_name("preview", "png")
    out_path = os.path.join(img_dir, out_name)
    out.save(out_path, format="PNG")

    rel = os.path.relpath(out_path, MEDIA_ROOT).replace(os.sep, "/")
    hist = _compute_histogram_rgb(out)
    sharp = _compute_sharpness(out)

    return {
        "processed_rel": rel,
        "processed_url": f"static/{rel}",
        "histogram": hist,
        "sharpness": sharp,
        "dimensions": {"width": out.width, "height": out.height},
    }

def get_metadata(image_id: str) -> Dict[str, Any]:
    img_dir = os.path.join(EDITOR_DIR, image_id)
    candidates = [f for f in os.listdir(img_dir) if f.startswith("original_") and f.endswith(".png")]
    if not candidates:
        return {}
    candidates.sort()
    orig_path = os.path.join(img_dir, candidates[-1])
    img = Image.open(orig_path)
    return _read_metadata(img)

def get_histogram_and_sharpness(image_id: str) -> Dict[str, Any]:
    img_dir = os.path.join(EDITOR_DIR, image_id)
    # pega a última preview, se houver; caso contrário, original
    previews = [f for f in os.listdir(img_dir) if f.startswith("preview_") and f.endswith(".png")]
    if previews:
        previews.sort()
        path = os.path.join(img_dir, previews[-1])
    else:
        originals = [f for f in os.listdir(img_dir) if f.startswith("original_") and f.endswith(".png")]
        originals.sort()
        path = os.path.join(img_dir, originals[-1]) if originals else None
    if not path or not os.path.isfile(path):
        return {"histogram": {"r": [], "g": [], "b": []}, "sharpness": 0.0}
    img = Image.open(path)
    return {"histogram": _compute_histogram_rgb(img), "sharpness": _compute_sharpness(img)}