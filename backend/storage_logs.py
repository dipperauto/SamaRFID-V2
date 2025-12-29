import os
import csv
from typing import Dict, Any, List, Optional
from datetime import datetime

LOG_DIR = os.path.join(os.path.dirname(__file__), "media", "logs")
LOG_CSV = os.path.join(LOG_DIR, "actions.csv")

LOG_FIELDS = ["timestamp", "username", "action", "unit_id", "asset_id", "details"]

def _ensure():
    os.makedirs(LOG_DIR, exist_ok=True)
    if not os.path.isfile(LOG_CSV):
        with open(LOG_CSV, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=LOG_FIELDS).writeheader()

def append_log(username: str, action: str, unit_id: Optional[str], asset_id: Optional[int], details: str = ""):
    _ensure()
    ts = datetime.utcnow().isoformat()
    with open(LOG_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        w.writerow({
            "timestamp": ts,
            "username": username or "",
            "action": action or "",
            "unit_id": str(unit_id or ""),
            "asset_id": str(asset_id or ""),
            "details": details or "",
        })

def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        if len(s) == 10:
            return datetime.fromisoformat(s + "T00:00:00+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

def list_logs(start: Optional[str] = None, end: Optional[str] = None, user: Optional[str] = None, action: Optional[str] = None, q: Optional[str] = None) -> List[Dict[str, Any]]:
    _ensure()
    sdt = _parse_date(start)
    edt = _parse_date(end)
    out: List[Dict[str, Any]] = []
    with open(LOG_CSV, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            ts = row.get("timestamp") or ""
            try:
                tsdt = datetime.fromisoformat(ts)
            except Exception:
                tsdt = None
            if sdt and tsdt and tsdt < sdt:
                continue
            if edt and tsdt and tsdt > edt:
                continue
            if user and (row.get("username") or "").lower() != user.lower():
                continue
            if action and (row.get("action") or "").lower() != action.lower():
                continue
            text = " ".join([
                row.get("username") or "",
                row.get("action") or "",
                row.get("unit_id") or "",
                row.get("asset_id") or "",
                row.get("details") or "",
            ]).lower()
            if (q or "").strip() and (q or "").strip().lower() not in text:
                continue
            out.append({
                "timestamp": ts,
                "username": row.get("username") or "",
                "action": row.get("action") or "",
                "unit_id": row.get("unit_id") or "",
                "asset_id": row.get("asset_id") or "",
                "details": row.get("details") or "",
            })
    out.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return out