import os
import io
import json
import uuid
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from PIL import Image
import numpy as np
try:
    import cv2  # detector de face via Haar (se disponível)
except Exception:
    cv2 = None

# Reutiliza os ajustes do editor
from storage_image_editor import _apply_adjustments
# ADD: importar funções de crop para reutilizar a mesma lógica do editor
from storage_image_editor import _crop_normal, _crop_face
# ADD: importar cálculo de nitidez do sujeito
from storage_image_editor import _compute_subject_sharpness
# ADD: importar auto-crop por pose/face
from storage_image_editor import _auto_crop_by_pose

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
EVENTS_BASE = os.path.join(MEDIA_DIR, "events")

def _ensure_event_dirs(event_id: int):
    base = os.path.join(EVENTS_BASE, str(event_id), "gallery")
    raw_dir = os.path.join(base, "raw")
    edited_dir = os.path.join(base, "edited")
    wm_dir = os.path.join(base, "wm")
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(edited_dir, exist_ok=True)
    os.makedirs(wm_dir, exist_ok=True)
    return base, raw_dir, edited_dir, wm_dir

def _watermark_path() -> str:
    return os.path.join(os.path.dirname(__file__), "media", "watermark", "watermark.png")

def _apply_center_watermark(img: Image.Image) -> Image.Image:
    """
    Aplica PNG de marca d'água central, escalando para ~50% da largura da imagem (com limites).
    """
    wm_file = _watermark_path()
    if not os.path.isfile(wm_file):
        return img
    wm = Image.open(wm_file).convert("RGBA")
    W, H = img.width, img.height
    # Escala alvo: 50% da largura da imagem (máx 80%, mín 20%)
    target_w = max(int(W * 0.2), min(int(W * 0.5), int(W * 0.8)))
    scale = target_w / wm.width
    target_h = max(1, int(wm.height * scale))
    wm_resized = wm.resize((target_w, target_h), Image.LANCZOS)
    # Centro
    x = (W - target_w) // 2
    y = (H - target_h) // 2
    # Composição
    base = img.convert("RGBA")
    base.alpha_composite(wm_resized, (x, y))
    return base.convert("RGB")

def _index_path(event_id: int) -> str:
    base, _, _, _ = _ensure_event_dirs(event_id)
    return os.path.join(base, "index.json")

def _load_index(event_id: int) -> Dict[str, Any]:
    path = _index_path(event_id)
    if not os.path.isfile(path):
        return {"images": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"images": []}

def _save_index(event_id: int, data: Dict[str, Any]):
    path = _index_path(event_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_", ".", " ") else "_" for ch in name)

def _gen_image_id() -> str:
    return f"evimg_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"

def _read_basic_meta(img: Image.Image) -> Dict[str, Any]:
    # Metadados básicos (dimensões) e alguns EXIF principais
    meta: Dict[str, Any] = {
        "Dimensions": f"{img.width}x{img.height}",
        "width": img.width,
        "height": img.height,
    }
    try:
        exif = getattr(img, "_getexif", lambda: None)()
        if exif:
            # alguns campos úteis
            from PIL import ExifTags
            tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
            for k in ["DateTimeOriginal", "Model", "Make", "LensModel", "FNumber", "ExposureTime", "ISOSpeedRatings", "FocalLength"]:
                v = tag_map.get(k)
                if v is not None:
                    meta[k] = v
    except Exception:
        pass
    return meta

def _detect_largest_face_bbox(img: Image.Image) -> Optional[Tuple[int, int, int, int]]:
    """
    Detecta a maior face via Haar (se OpenCV estiver disponível).
    Retorna (x, y, w, h) ou None se não houver.
    """
    if cv2 is None:
        return None
    arr = np.asarray(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.2, 6)
    if len(faces) == 0:
        return None
    x, y, w, h = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
    return (int(x), int(y), int(w), int(h))

def _extract_face_vector(img: Image.Image) -> Optional[np.ndarray]:
    """
    Extrai um vetor de características do rosto (maior rosto da imagem).
    Preferência: OpenCV Haar para detectar; vetor = patch cinza 64x64 normalizado.
    Retorna None se não detectar rosto.
    """
    bbox = _detect_largest_face_bbox(img)
    if bbox is None:
        return None
    x, y, w, h = bbox
    roi = img.crop((x, y, x + w, y + h)).convert("L")
    roi = roi.resize((64, 64))
    arr = np.asarray(roi).astype(np.float32)
    # normaliza iluminação
    arr = (arr - arr.mean()) / (arr.std() + 1e-6)
    vec = arr.flatten()
    # normalização final para simetria de escala
    norm = np.linalg.norm(vec) + 1e-6
    return vec / norm

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) + 1e-6) * (np.linalg.norm(b) + 1e-6)))

def face_search_in_event(event_id: int, query_bytes: bytes, similarity_threshold: float = 0.90) -> List[Dict[str, Any]]:
    """
    Compara o rosto da imagem de consulta contra as fotos RAW do evento e retorna
    matches com URL de versão COM MARCA D'ÁGUA.
    """
    index = _load_index(event_id)
    if not index.get("images"):
        return []
    try:
        qimg = Image.open(io.BytesIO(query_bytes)).convert("RGB")
    except Exception:
        return []
    qvec = _extract_face_vector(qimg)
    if qvec is None:
        return []

    matches: List[Dict[str, Any]] = []
    for item in index.get("images", []):
        original_rel = item.get("original_rel") or ""
        if not original_rel:
            continue
        abs_path = os.path.join(os.path.dirname(__file__), original_rel)
        if not os.path.isfile(abs_path):
            continue
        try:
            img = Image.open(abs_path).convert("RGB")
        except Exception:
            continue
        vec = _extract_face_vector(img)
        if vec is None:
            continue
        sim = _cosine_similarity(qvec, vec)
        if sim >= similarity_threshold:
            uploader = item.get("uploader") or "unknown"
            wm_rel = _ensure_watermarked(event_id, original_rel, uploader, item.get("id") or "img")
            url = f"static/{(wm_rel or original_rel).replace('media/', '')}"
            matches.append({
                "id": item.get("id"),
                "url": url,
                "uploader": uploader,
                "score": sim,
                "uploaded_at": item.get("uploaded_at"),
                "meta": item.get("meta") or {},
                "price_brl": item.get("price_brl"),
            })
    matches.sort(key=lambda m: m.get("score", 0.0), reverse=True)
    return matches

def add_images_to_event(event_id: int, uploader: str, files: List[Tuple[str, bytes]], sharpness_threshold: Optional[float] = None, price_brl: Optional[float] = None) -> List[Dict[str, Any]]:
    """
    Salva originais organizados em: media/events/{event_id}/gallery/raw/{uploader}/<id>_<original_name.ext>
    Atualiza index.json com metadados e retorna os registros criados.
    """
    base, raw_dir, _, wm_dir = _ensure_event_dirs(event_id)
    user_raw_dir = os.path.join(raw_dir, uploader)
    os.makedirs(user_raw_dir, exist_ok=True)

    index = _load_index(event_id)
    created_records: List[Dict[str, Any]] = []
    threshold = float(sharpness_threshold) if sharpness_threshold is not None else 39.0

    for filename, content in files:
        image_id = _gen_image_id()
        name = _safe_filename(filename)
        _, ext = os.path.splitext(name)
        ext = ext.lower() or ".jpg"
        stored_name = f"{image_id}_{name}"
        abs_path = os.path.join(user_raw_dir, stored_name)
        with open(abs_path, "wb") as fw:
            fw.write(content)
        # metadados e nitidez do sujeito no RAW
        try:
            img = Image.open(io.BytesIO(content)).convert("RGB")
            meta = _read_basic_meta(img)
            sharp_raw = float(_compute_subject_sharpness(img))
        except Exception:
            meta = {"Dimensions": "", "width": 0, "height": 0}
            sharp_raw = 0.0
        rel = os.path.relpath(abs_path, os.path.dirname(__file__)).replace(os.sep, "/")
        # valor financeiro
        price_val = None
        try:
            if price_brl is not None:
                price_val = float(price_brl)
        except Exception:
            price_val = None
        record = {
            "id": image_id,
            "uploader": uploader,
            "original_rel": rel,
            "edited_rel": "",
            "applied_lut_id": None,
            "uploaded_at": datetime.utcnow().isoformat(),
            "meta": meta,
            # marca descarte baseado no threshold do upload
            "sharpness": sharp_raw,
            "discarded": bool(sharp_raw < threshold),
            "price_brl": price_val if price_val is not None else None,
        }
        index["images"].append(record)
        created_records.append(record)

    _save_index(event_id, index)
    return created_records

def _ensure_watermarked(event_id: int, original_rel: str, uploader: str, image_id: str) -> Optional[str]:
    """
    Gera e retorna caminho relativo para a versão com marca d'água, salvando em gallery/wm/{uploader}/{id}_wm.png.
    """
    try:
        base, _, _, wm_dir = _ensure_event_dirs(event_id)
        user_wm_dir = os.path.join(wm_dir, uploader)
        os.makedirs(user_wm_dir, exist_ok=True)
        abs_original = os.path.join(os.path.dirname(__file__), original_rel)
        if not os.path.isfile(abs_original):
            return None
        out_name = f"{image_id}_wm.png"
        abs_out = os.path.join(user_wm_dir, out_name)
        if os.path.isfile(abs_out):
            return os.path.relpath(abs_out, os.path.dirname(__file__)).replace(os.sep, "/")
        # gerar
        img = Image.open(abs_original).convert("RGB")
        wm_img = _apply_center_watermark(img)
        wm_img.save(abs_out, format="PNG", compress_level=1)
        return os.path.relpath(abs_out, os.path.dirname(__file__)).replace(os.sep, "/")
    except Exception:
        return None

def list_gallery_for_event(event_id: int) -> Dict[str, Any]:
    """
    Retorna duas listas: raw (originais) e edited (processadas).
    """
    index = _load_index(event_id)
    raw_list: List[Dict[str, Any]] = []
    edited_list: List[Dict[str, Any]] = []

    for item in index.get("images", []):
        original_rel = item.get("original_rel") or ""
        edited_rel = item.get("edited_rel") or ""
        # URL para servir via /static
        original_url = f"static/{original_rel.replace('media/', '')}" if original_rel else ""
        edited_url = f"static/{edited_rel.replace('media/', '')}" if edited_rel else ""
        common = {
            "id": item.get("id"),
            "uploader": item.get("uploader"),
            "meta": item.get("meta") or {},
            "uploaded_at": item.get("uploaded_at"),
            "price_brl": item.get("price_brl"),
        }
        if original_rel:
            raw_list.append({
                **common,
                "url": original_url,
                "discarded": bool(item.get("discarded", False)),
                "sharpness": float(item.get("sharpness", 0.0)),
            })
        if edited_rel:
            edited_list.append({
                **common,
                "url": edited_url,
                "lut_id": item.get("applied_lut_id"),
                "discarded": bool(item.get("discarded", False)),
                # nitidez (após LUT, se calculada; senão mantém a do raw)
                "sharpness": float(item.get("sharpness", 0.0)),
            })
    return {"raw": raw_list, "edited": edited_list}

def apply_lut_for_event_images(event_id: int, image_ids: List[str], lut_params: Dict[str, Any], lut_id: Optional[int]) -> int:
    """
    Aplica ajustes (LUT) sobre as originais e grava PNG em: edited/{uploader}/<id>_<timestamp>.png
    Substitui a versão anterior se existir.
    """
    base, _, edited_dir, _ = _ensure_event_dirs(event_id)
    index = _load_index(event_id)
    count = 0
    now_tag = datetime.utcnow().strftime("%Y%m%d%H%M%S")

    for iid in image_ids:
        item = next((x for x in index.get("images", []) if x.get("id") == iid), None)
        if not item:
            continue
        original_rel = item.get("original_rel") or ""
        abs_original = os.path.join(os.path.dirname(__file__), original_rel)
        if not os.path.isfile(abs_original):
            continue
        uploader = item.get("uploader") or "unknown"
        user_edited_dir = os.path.join(edited_dir, uploader)
        os.makedirs(user_edited_dir, exist_ok=True)

        # processar imagem
        try:
            img = Image.open(abs_original).convert("RGB")
            # AUTO-CROP por imagem:
            crop_cfg = (lut_params or {}).get("crop") or {}
            aspect = float(crop_cfg.get("aspect", 1.0))
            scale = float(crop_cfg.get("scale", 1.0))
            auto_cropped = _auto_crop_by_pose(img, aspect=aspect, scale=scale)
            if auto_cropped is not None:
                img = auto_cropped
            # aplica ajustes do LUT
            out_img = _apply_adjustments(img, lut_params or {})
            # calcular nitidez do SUJEITO na imagem já ajustada
            subject_sharpness = _compute_subject_sharpness(out_img)
        except Exception:
            continue

        out_name = f"{iid}_{now_tag}.png"
        abs_out = os.path.join(user_edited_dir, out_name)
        # salvar PNG leve
        try:
            out_img.save(abs_out, format="PNG", compress_level=1)
        except Exception:
            continue

        # remover editada anterior se desejado (mantendo só última)
        prev_rel = item.get("edited_rel") or ""
        if prev_rel:
            try:
                abs_prev = os.path.join(os.path.dirname(__file__), prev_rel)
                if os.path.isfile(abs_prev):
                    os.remove(abs_prev)
            except Exception:
                pass

        rel_out = os.path.relpath(abs_out, os.path.dirname(__file__)).replace(os.sep, "/")
        item["edited_rel"] = rel_out
        item["applied_lut_id"] = lut_id
        item["sharpness"] = subject_sharpness
        count += 1

    _save_index(event_id, index)
    return count

def delete_event_images(event_id: int, image_ids: List[str]) -> int:
    """
    Exclui imagens do índice e arquivos originais/editados.
    """
    index = _load_index(event_id)
    remaining: List[Dict[str, Any]] = []
    deleted = 0
    for item in index.get("images", []):
        if item.get("id") in image_ids:
            # remover arquivos
            for key in ("original_rel", "edited_rel"):
                rel = (item.get(key) or "").strip()
                if not rel:
                    continue
                abs_path = os.path.join(os.path.dirname(__file__), rel)
                try:
                    if os.path.isfile(abs_path):
                        os.remove(abs_path)
                except Exception:
                    pass
            deleted += 1
        else:
            remaining.append(item)
    index["images"] = remaining
    _save_index(event_id, index)
    return deleted

# NOVO: marcar imagens como descartadas ou não descartadas
def set_event_images_discarded(event_id: int, image_ids: List[str], discarded: bool) -> int:
    """
    Atualiza a flag 'discarded' das imagens listadas no index.json do evento.
    Retorna a quantidade de registros atualizados.
    """
    index = _load_index(event_id)
    ids = set(image_ids or [])
    updated = 0
    for item in index.get("images", []):
        if item.get("id") in ids:
            item["discarded"] = bool(discarded)
            updated += 1
    _save_index(event_id, index)
    return updated