import os
import io
import json
import uuid
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from PIL import Image

# Reutiliza os ajustes do editor
from storage_image_editor import _apply_adjustments
# ADD: importar funções de crop para reutilizar a mesma lógica do editor
from storage_image_editor import _crop_normal, _crop_face
# ADD: importar cálculo de nitidez do sujeito
from storage_image_editor import _compute_subject_sharpness

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
EVENTS_BASE = os.path.join(MEDIA_DIR, "events")

def _ensure_event_dirs(event_id: int):
    base = os.path.join(EVENTS_BASE, str(event_id), "gallery")
    raw_dir = os.path.join(base, "raw")
    edited_dir = os.path.join(base, "edited")
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(edited_dir, exist_ok=True)
    return base, raw_dir, edited_dir

def _index_path(event_id: int) -> str:
    base, _, _ = _ensure_event_dirs(event_id)
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

def add_images_to_event(event_id: int, uploader: str, files: List[Tuple[str, bytes]], sharpness_threshold: Optional[float] = None) -> List[Dict[str, Any]]:
    """
    Salva originais organizados em: media/events/{event_id}/gallery/raw/{uploader}/<id>_<original_name.ext>
    Atualiza index.json com metadados e retorna os registros criados.
    """
    base, raw_dir, _ = _ensure_event_dirs(event_id)
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
        }
        index["images"].append(record)
        created_records.append(record)

    _save_index(event_id, index)
    return created_records

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
    base, _, edited_dir = _ensure_event_dirs(event_id)
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
            # APPLY CROP SE DEFINIDO NO LUT
            crop_cfg = (lut_params or {}).get("crop") or {}
            mode = str(crop_cfg.get("mode", "none"))
            if mode == "normal":
                rect = crop_cfg.get("rect")
                img = _crop_normal(img, rect)
            elif mode == "face":
                aspect = float(crop_cfg.get("aspect", 1.0))
                scale = float(crop_cfg.get("scale", 1.0))
                anchor = str(crop_cfg.get("anchor", "center"))
                img = _crop_face(img, aspect=aspect, scale=scale, anchor=anchor)

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
        # salvar nitidez do sujeito
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