import os
import json
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

LUTS_JSON_PATH = os.path.join(os.path.dirname(__file__), "luts.json")
MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
MEDIA_LUTS_DIR = os.path.join(MEDIA_DIR, "luts")

def _ensure_json():
    os.makedirs(os.path.dirname(LUTS_JSON_PATH), exist_ok=True)
    os.makedirs(MEDIA_LUTS_DIR, exist_ok=True)
    if not os.path.exists(LUTS_JSON_PATH):
        with open(LUTS_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump({"presets": []}, f)

def _load() -> Dict[str, Any]:
    _ensure_json()
    with open(LUTS_JSON_PATH, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception:
            data = {"presets": []}
    if "presets" not in data or not isinstance(data["presets"], list):
        data["presets"] = []
    return data

def _save(data: Dict[str, Any]):
    with open(LUTS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)

def _copy_thumb_from_static(static_url: Optional[str], username: str, lut_id: int) -> Optional[str]:
    """
    Recebe uma URL relativa servida em /static/... e copia o arquivo para media/luts como thumbnail.
    Retorna a URL servida (ex.: 'static/luts/arquivo.png').
    """
    if not static_url:
        return None
    rel = static_url.strip().lstrip("/")
    # static/... -> media/...
    disk_path = os.path.join(os.path.dirname(__file__), rel.replace("static/", "media/"))
    if not os.path.isfile(disk_path):
        return None
    _, ext = os.path.splitext(disk_path)
    ext = ext.lower() or ".png"
    fname = f"lut_{lut_id}_{_safe_filename(username)}{ext}"
    dest_path = os.path.join(MEDIA_LUTS_DIR, fname)
    with open(disk_path, "rb") as fr, open(dest_path, "wb") as fw:
        fw.write(fr.read())
    # URL servida
    return f"static/luts/{fname}"

def get_luts_for_user(username: str) -> List[Dict[str, Any]]:
    data = _load()
    out: List[Dict[str, Any]] = []
    for p in data["presets"]:
        if p.get("username") == username:
            out.append(p)
    # ordena por mais recente
    out.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return out

def _next_id(presets: List[Dict[str, Any]]) -> int:
    max_id = 0
    for p in presets:
        try:
            pid = int(p.get("id") or 0)
            if pid > max_id:
                max_id = pid
        except Exception:
            continue
    return max_id + 1

def add_lut(username: str, name: str, description: Optional[str], params: Dict[str, Any], thumb_source_url: Optional[str]) -> Dict[str, Any]:
    data = _load()
    pid = _next_id(data["presets"])
    created = datetime.utcnow().isoformat()
    thumb_url = _copy_thumb_from_static(thumb_source_url, username, pid)
    preset = {
        "id": pid,
        "username": username,
        "name": name.strip(),
        "description": (description or "").strip() or None,
        "params": params or {},
        "thumb_url": thumb_url or "",
        "created_at": created,
    }
    data["presets"].append(preset)
    _save(data)
    return preset

def get_lut_by_id(lut_id: int) -> Optional[Dict[str, Any]]:
    data = _load()
    for p in data["presets"]:
        try:
            if int(p.get("id") or 0) == int(lut_id):
                return p
        except Exception:
            continue
    return None

def delete_lut(lut_id: int, username: str) -> bool:
    data = _load()
    new_list: List[Dict[str, Any]] = []
    deleted = False
    thumb_to_delete: Optional[str] = None
    for p in data["presets"]:
        ok = False
        try:
            ok = int(p.get("id") or 0) == int(lut_id) and p.get("username") == username
        except Exception:
            ok = False
        if ok:
            deleted = True
            # coletar thumb para remover
            tu = p.get("thumb_url") or ""
            if tu:
                rel = tu.strip().lstrip("/").replace("static/", "media/")
                thumb_to_delete = os.path.join(os.path.dirname(__file__), rel)
            continue
        new_list.append(p)
    if deleted:
        data["presets"] = new_list
        _save(data)
        if thumb_to_delete and os.path.isfile(thumb_to_delete):
            try:
                os.remove(thumb_to_delete)
            except Exception:
                pass
    return deleted