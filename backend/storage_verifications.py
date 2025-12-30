import os
import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

VERIFICATIONS_DIR = os.path.join(os.path.dirname(__file__), "media", "verifications")
LISTS_PATH = os.path.join(VERIFICATIONS_DIR, "lists.json")
SESSIONS_PATH = os.path.join(VERIFICATIONS_DIR, "sessions.json")

def _ensure_store():
    os.makedirs(VERIFICATIONS_DIR, exist_ok=True)
    if not os.path.isfile(LISTS_PATH):
        with open(LISTS_PATH, "w", encoding="utf-8") as f:
            json.dump({"lists": []}, f)
    if not os.path.isfile(SESSIONS_PATH):
        with open(SESSIONS_PATH, "w", encoding="utf-8") as f:
            json.dump({"sessions": []}, f)

def _load_lists() -> Dict[str, Any]:
    _ensure_store()
    try:
        with open(LISTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"lists": []}

def _save_lists(data: Dict[str, Any]):
    with open(LISTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _load_sessions() -> Dict[str, Any]:
    _ensure_store()
    try:
        with open(SESSIONS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"sessions": []}

def _save_sessions(data: Dict[str, Any]):
    with open(SESSIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# --- Listas de Verificação Personalizadas ---

def get_custom_lists() -> List[Dict[str, Any]]:
    return _load_lists().get("lists", [])

def add_custom_list(name: str, description: str, asset_ids: List[int]) -> Dict[str, Any]:
    data = _load_lists()
    new_list = {
        "id": f"custom_{uuid.uuid4().hex[:8]}",
        "name": name,
        "description": description,
        "asset_ids": asset_ids,
        "created_at": datetime.utcnow().isoformat(),
    }
    data["lists"].append(new_list)
    _save_lists(data)
    return new_list

def delete_custom_list(list_id: str) -> bool:
    data = _load_lists()
    initial_len = len(data["lists"])
    data["lists"] = [l for l in data["lists"] if l.get("id") != list_id]
    if len(data["lists"]) < initial_len:
        _save_lists(data)
        return True
    return False

# --- Sessões de Verificação ---

def get_sessions() -> List[Dict[str, Any]]:
    return _load_sessions().get("sessions", [])

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    sessions = get_sessions()
    return next((s for s in sessions if s.get("id") == session_id), None)

def start_session(
    user: str,
    type: str, # "unit" or "custom"
    name: str,
    include_sub_units: Optional[bool],
    target_id: str, # unit_id or custom_list_id
    assets_to_verify: List[Dict[str, Any]]
) -> Dict[str, Any]:
    data = _load_sessions()
    session = {
        "id": f"session_{uuid.uuid4().hex[:8]}",
        "user": user,
        "type": type,
        "name": name,
        "target_id": target_id,
        "include_sub_units": include_sub_units,
        "status": "active", # active, finished, canceled
        "start_time": datetime.utcnow().isoformat(),
        "end_time": None,
        "assets": [
            {
                "id": asset["id"],
                "name": asset["name"],
                "item_code": asset["item_code"],
                "unit_id": asset["unit_id"],
                "unit_path": asset.get("unit_path", ""),
                "expected_quantity": asset.get("quantity", 1),
                "verified_quantity": 0,
                "verified": False,
            }
            for asset in assets_to_verify
        ],
    }
    data["sessions"].append(session)
    _save_sessions(data)
    return session

def update_session_status(session_id: str, status: str) -> Optional[Dict[str, Any]]:
    data = _load_sessions()
    session = next((s for s in data["sessions"] if s.get("id") == session_id), None)
    if not session:
        return None
    session["status"] = status
    session["end_time"] = datetime.utcnow().isoformat()
    _save_sessions(data)
    return session

def verify_item_in_session(session_id: str, item_code: str, quantity: float) -> Optional[Dict[str, Any]]:
    data = _load_sessions()
    session = next((s for s in data["sessions"] if s.get("id") == session_id), None)
    if not session or session["status"] != "active":
        return None
    
    found_item = None
    code_lower = item_code.lower()
    for asset in session["assets"]:
        item_c = (asset.get("item_code") or "").lower()
        qr_c = (asset.get("qr_code") or "").lower()
        rfid_c = (asset.get("rfid_code") or "").lower()

        if code_lower in [item_c, qr_c, rfid_c] and code_lower != "":
            asset["verified_quantity"] += quantity
            if asset["verified_quantity"] >= asset.get("expected_quantity", 1):
                asset["verified"] = True
            found_item = asset
            break
            
    if found_item:
        _save_sessions(data)
        return found_item
    return None