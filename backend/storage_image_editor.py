import os
import io
import time
import uuid
from typing import Optional, Dict, Any, Tuple, List

from PIL import Image, ExifTags
import numpy as np

try:
    import cv2  # opcional, usado para face e nitidez via Laplaciano
except Exception:
    cv2 = None

try:
    import mediapipe as mp  # opcional, para detecção de esqueleto (pose)
except Exception:
    mp = None

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
    shadows [-100..100] (ajuste em áreas escuras)
    highlights [-100..100] (ajuste em áreas claras)
    curves_strength [0..1] (S-curve)
    temperature [-100..100]
    saturation [-100..100]
    vibrance [-100..100]
    vignette [0..1]
    contrast [-100..100]
    """
    arr = _to_array(img).copy()
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], axis=-1)
    h, w, _ = arr.shape
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

    # Shadows/Highlights — compressão em direção aos médios (melhor resposta visual)
    shadows = float(params.get("shadows", 0.0))  # -100..100
    highlights = float(params.get("highlights", 0.0))  # -100..100
    if shadows != 0.0 or highlights != 0.0:
        lum = np.dot(arr_norm[..., :3], np.array([0.299, 0.587, 0.114], dtype=np.float32))
        shadow_mask = (lum < 0.5).astype(np.float32)
        highlight_mask = (lum >= 0.5).astype(np.float32)
        s_gain = shadows / 100.0
        h_gain = highlights / 100.0
        # Levanta/abaixa sombras aproximando de 0.5
        arr_norm = np.clip(arr_norm + shadow_mask[..., None] * s_gain * (0.5 - arr_norm), 0.0, 1.0)
        # Reduz/aumenta highlights aproximando de 0.5
        arr_norm = np.clip(arr_norm - highlight_mask[..., None] * h_gain * (arr_norm - 0.5), 0.0, 1.0)

    # Curves (S-curve)
    curves_strength = float(params.get("curves_strength", 0.0))
    if curves_strength > 0.0:
        x = arr_norm
        k = 10.0 * curves_strength
        arr_norm = 1.0 / (1.0 + np.exp(-k * (x - 0.5)))

    # Temperature
    temperature = float(params.get("temperature", 0.0))
    if temperature != 0.0:
        t = temperature / 100.0
        arr_norm[..., 0] = np.clip(arr_norm[..., 0] + (0.1 * t), 0.0, 1.0)  # R
        arr_norm[..., 2] = np.clip(arr_norm[..., 2] - (0.1 * t), 0.0, 1.0)  # B

    # Saturation / Vibrance (HSV) — vetorizado com OpenCV se disponível
    saturation = float(params.get("saturation", 0.0))
    vibrance = float(params.get("vibrance", 0.0))
    if (saturation != 0.0 or vibrance != 0.0) and cv2 is not None:
        rgb_uint8 = np.clip(arr_norm * 255.0, 0.0, 255.0).astype(np.uint8)
        bgr = rgb_uint8[..., ::-1]  # RGB -> BGR
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        s = hsv[..., 1].astype(np.float32)
        if saturation != 0.0:
            s *= (1.0 + (saturation / 100.0))
        if vibrance != 0.0:
            s += (vibrance / 100.0) * (255.0 - s)
        s = np.clip(s, 0.0, 255.0).astype(np.uint8)
        hsv[..., 1] = s
        bgr_out = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        rgb_out = bgr_out[..., ::-1].astype(np.float32) / 255.0
        arr_norm = np.clip(rgb_out, 0.0, 1.0)
    elif saturation != 0.0 or vibrance != 0.0:
        # Fallback: conversão por colorsys (mais lenta)
        import colorsys
        rgb = arr_norm.reshape(-1, 3)
        hsv = np.zeros_like(rgb)
        for i in range(rgb.shape[0]):
            hsv[i] = colorsys.rgb_to_hsv(rgb[i, 0], rgb[i, 1], rgb[i, 2])
        if saturation != 0.0:
            s_gain = 1.0 + (saturation / 100.0)
            hsv[:, 1] = np.clip(hsv[:, 1] * s_gain, 0.0, 1.0)
        if vibrance != 0.0:
            vib = vibrance / 100.0
            hsv[:, 1] = np.clip(hsv[:, 1] + vib * (1.0 - hsv[:, 1]), 0.0, 1.0)
        for i in range(rgb.shape[0]):
            rgb[i] = colorsys.hsv_to_rgb(hsv[i, 0], hsv[i, 1], hsv[i, 2])
        arr_norm = rgb.reshape(h, w, 3)

    # Contrast
    contrast = float(params.get("contrast", 0.0))
    if contrast != 0.0:
        k = 1.0 + (contrast / 100.0)
        arr_norm = np.clip((arr_norm - 0.5) * k + 0.5, 0.0, 1.0)

    # Vignette — máscara elíptica que respeita proporção da imagem
    vignette = float(params.get("vignette", 0.0))
    if vignette > 0.0:
        yy, xx = np.mgrid[0:h, 0:w]
        cx, cy = w / 2.0, h / 2.0
        rx = (xx - cx) / max(cx, 1e-6)
        ry = (yy - cy) / max(cy, 1e-6)
        dist = np.sqrt(rx**2 + ry**2)
        dist = np.clip(dist, 0.0, 1.0)
        # força e suavização com potência 2
        mask = 1.0 - vignette * (dist ** 2)
        mask = np.clip(mask, 0.0, 1.0)
        arr_norm *= mask[..., None]

    return _from_array((arr_norm * 255.0))

def _compute_histogram_rgb(img: Image.Image) -> Dict[str, List[int]]:
    if img.mode != "RGB":
        img = img.convert("RGB")
    arr = np.asarray(img)
    hist_r, _ = np.histogram(arr[..., 0].flatten(), bins=256, range=(0, 255))
    hist_g, _ = np.histogram(arr[..., 1].flatten(), bins=256, range=(0, 255))
    hist_b, _ = np.histogram(arr[..., 2].flatten(), bins=256, range=(0, 255))
    return {"r": hist_r.tolist(), "g": hist_g.tolist(), "b": hist_b.tolist()}

def _compute_sharpness(img: Image.Image) -> float:
    if cv2 is not None:
        arr = np.asarray(img.convert("L"))
        lap = cv2.Laplacian(arr, cv2.CV_64F)
        return float(lap.var())
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
            for k in [
                "DateTimeOriginal", "Model", "Make", "LensModel",
                "FNumber", "ExposureTime", "ISOSpeedRatings", "FocalLength",
            ]:
                v = tag_map.get(k)
                if v is not None:
                    meta[k] = v
    except Exception:
        pass
    meta["Dimensions"] = f"{img.width}x{img.height}"
    return meta

# --------- Pose (esqueleto) via MediaPipe ---------
_POSE_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
    "left_pinky", "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
    "left_heel", "right_heel", "left_foot_index", "right_foot_index",
]

def _detect_pose_landmarks(img: Image.Image) -> List[Dict[str, Any]]:
    if mp is None:
        return []
    arr = np.asarray(img.convert("RGB"))
    mp_pose = mp.solutions.pose
    with mp_pose.Pose(static_image_mode=True, model_complexity=1, enable_segmentation=False) as pose:
        res = pose.process(arr)
        if not res.pose_landmarks:
            return []
        landmarks = []
        for i, lm in enumerate(res.pose_landmarks.landmark):
            name = _POSE_NAMES[i] if i < len(_POSE_NAMES) else f"lm_{i}"
            landmarks.append({"name": name, "x": float(lm.x), "y": float(lm.y), "visibility": float(getattr(lm, "visibility", 0.0))})
        return landmarks

def _max_aspect_rect(w: int, h: int, aspect: float) -> Tuple[int, int]:
    if aspect <= 0:
        aspect = 1.0
    # tenta usar toda a largura, ajustando altura
    height_from_width = int(round(w / aspect))
    if height_from_width <= h:
        return w, height_from_width
    # senão usa toda a altura, ajustando largura
    width_from_height = int(round(h * aspect))
    return width_from_height, h

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
    """
    Recorta um retângulo com aspecto 'aspect' centrado na âncora.
    Escala funciona como zoom: 1.0 = área máxima, 2.0 = área metade (zoom-in).
    """
    # Primeiro tenta âncora da pose; se não houver, tenta face; senão, centro
    pt = _detect_pose_anchor(img, anchor) if anchor else None
    if pt is None:
        pt = _detect_face_anchor(img, anchor=anchor)
    if pt is None:
        pt = (img.width // 2, img.height // 2)
    cx, cy = pt

    w, h = img.width, img.height
    aspect = float(aspect) if aspect > 0 else 1.0
    # rect máximo que respeita aspecto
    max_w, max_h = _max_aspect_rect(w, h, aspect)

    # escala como zoom (1..2): maior escala -> menor retângulo
    s = max(1.0, min(float(scale), 2.0))
    final_w = max(1, int(round(max_w / s)))
    final_h = max(1, int(round(max_h / s)))

    # centraliza na âncora
    x = int(round(cx - final_w / 2))
    y = int(round(cy - final_h / 2))
    # clamp dentro da imagem
    x = max(0, min(x, w - final_w))
    y = max(0, min(y, h - final_h))

    return img.crop((x, y, x + final_w, y + final_h))

def save_original(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    _ensure_dir(EDITOR_DIR)
    image_id = _gen_id()
    img_dir = os.path.join(EDITOR_DIR, image_id)
    _ensure_dir(img_dir)
    img = Image.open(io.BytesIO(file_bytes))

    # RESIZE: limitar a imagem a um bounding box de 1920x1080 mantendo proporção
    if hasattr(Image, "Resampling"):
        resample = Image.Resampling.LANCZOS
    else:
        resample = getattr(Image, "LANCZOS", Image.ANTIALIAS)
    max_w, max_h = 1920, 1080
    img = img.convert("RGB")
    img.thumbnail((max_w, max_h), resample)

    orig_name = _unique_name("original", "png")
    orig_path = os.path.join(img_dir, orig_name)
    # salvar com compressão leve para velocidade
    img.save(orig_path, format="PNG", compress_level=1)

    rel = os.path.relpath(orig_path, MEDIA_ROOT).replace(os.sep, "/")
    return {"image_id": image_id, "original_rel": rel, "original_url": f"static/{rel}", "meta": _read_metadata(img)}

def _detect_face_anchor(img: Image.Image, anchor: str = "center") -> Optional[Tuple[int, int]]:
    if cv2 is None:
        return None
    arr = np.asarray(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.2, 6)
    if len(faces) == 0:
        return None
    x, y, w, h = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
    cx, cy = x + w // 2, y + h // 2
    if anchor == "eyes":
        cy = y + int(h * 0.36)
    elif anchor == "nose":
        cy = y + int(h * 0.55)
    elif anchor == "mouth":
        cy = y + int(h * 0.75)
    return (cx, cy)

def _detect_face_bbox(img: Image.Image) -> Optional[Tuple[int, int, int, int]]:
    if cv2 is None:
        return None
    arr = np.asarray(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.2, 6)
    if len(faces) == 0:
        return None
    # maior rosto
    x, y, w, h = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
    return (int(x), int(y), int(w), int(h))

def _detect_pose_anchor(img: Image.Image, anchor: str) -> Optional[Tuple[int, int]]:
    """Usa landmarks da pose para obter a âncora. Coordenadas normalizadas -> pixels."""
    if mp is None:
        return None
    lms = _detect_pose_landmarks(img)
    if not lms:
        return None
    # Se pedirem 'center', usa o centro entre quadris; caso contrário, usa ponto específico
    w, h = img.width, img.height
    name_map = {lm["name"]: lm for lm in lms}
    if anchor in name_map:
        lm = name_map[anchor]
        return (int(lm["x"] * w), int(lm["y"] * h))
    # anchors compostos
    if anchor == "hips_center":
        left = name_map.get("left_hip")
        right = name_map.get("right_hip")
        if left and right:
            return (int((left["x"] + right["x"]) * 0.5 * w), int((left["y"] + right["y"]) * 0.5 * h))
    if anchor == "shoulders_center":
        left = name_map.get("left_shoulder")
        right = name_map.get("right_shoulder")
        if left and right:
            return (int((left["x"] + right["x"]) * 0.5 * w), int((left["y"] + right["y"]) * 0.5 * h))
    return None

def _compute_subject_sharpness(img: Image.Image) -> float:
    """
    Calcula a nitidez do SUJEITO:
    - Se pose disponível: ROI ao redor do tronco (ombros).
    - Se face disponível: ROI ao redor da face ampliada.
    - Fallback: ROI central.
    Métrica: variância do Laplaciano (OpenCV) na ROI, ou gradiente (fallback).
    """
    w, h = img.width, img.height

    # 1) Tenta pose: usa distância entre ombros para dimensionar ROI
    roi = None
    if mp is not None:
        lms = _detect_pose_landmarks(img)
        if lms:
            name_map = {lm["name"]: lm for lm in lms}
            ls, rs = name_map.get("left_shoulder"), name_map.get("right_shoulder")
            if ls and rs:
                cx = int((ls["x"] + rs["x"]) * 0.5 * w)
                cy = int((ls["y"] + rs["y"]) * 0.5 * h)
                dist = int(np.hypot((ls["x"] - rs["x"]) * w, (ls["y"] - rs["y"]) * h))
                roi_w = max(80, min(w, int(dist * 1.2)))
                roi_h = max(80, min(h, int(dist * 1.6)))
                # desce um pouco para pegar o tórax
                cy_offset = int(0.4 * dist)
                x = max(0, min(w - roi_w, cx - roi_w // 2))
                y = max(0, min(h - roi_h, cy + cy_offset - roi_h // 2))
                roi = img.crop((x, y, x + roi_w, y + roi_h))

    # 2) Tenta face
    if roi is None:
        bbox = _detect_face_bbox(img)
        if bbox:
            x, y, fw, fh = bbox
            cx, cy = x + fw // 2, y + fh // 2
            roi_w = max(80, int(fw * 1.6))
            roi_h = max(80, int(fh * 2.0))
            x = max(0, min(w - roi_w, cx - roi_w // 2))
            y = max(0, min(h - roi_h, cy - roi_h // 2))
            roi = img.crop((x, y, x + roi_w, y + roi_h))

    # 3) Fallback central
    if roi is None:
        roi_w = int(w * 0.4)
        roi_h = int(h * 0.6)
        x = (w - roi_w) // 2
        y = (h - roi_h) // 2
        roi = img.crop((x, y, x + roi_w, y + roi_h))

    # Métrica na ROI
    if cv2 is not None:
        gray = np.asarray(roi.convert("L"))
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        return float(lap.var())

    arr = np.asarray(roi.convert("L")).astype(np.float32)
    gy, gx = np.gradient(arr)
    grad_mag = np.sqrt(gx**2 + gy**2)
    return float(np.var(grad_mag))

def process_image(image_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
    img_dir = os.path.join(EDITOR_DIR, image_id)
    if not os.path.isdir(img_dir):
        raise FileNotFoundError("Imagem não encontrada.")
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

    out_name = _unique_name("preview", "png")
    out_path = os.path.join(img_dir, out_name)
    # salvar preview com compressão leve para reduzir latência
    out.save(out_path, format="PNG", compress_level=1)

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

def get_pose_landmarks(image_id: str) -> Dict[str, Any]:
    """Retorna landmarks da pose e dimensões da imagem original."""
    img_dir = os.path.join(EDITOR_DIR, image_id)
    candidates = [f for f in os.listdir(img_dir) if f.startswith("original_") and f.endswith(".png")]
    if not candidates:
        return {"landmarks": [], "dimensions": {"width": 0, "height": 0}}
    candidates.sort()
    orig_path = os.path.join(img_dir, candidates[-1])
    img = Image.open(orig_path)
    lms = _detect_pose_landmarks(img)
    return {"landmarks": lms, "dimensions": {"width": img.width, "height": img.height}}