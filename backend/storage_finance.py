import os
import json
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

from storage_events import get_event_by_id

FINANCE_DIR = os.path.join(os.path.dirname(__file__), "media", "finance")
FINANCE_JSON_PATH = os.path.join(FINANCE_DIR, "finance.json")

def _ensure_store():
    os.makedirs(FINANCE_DIR, exist_ok=True)
    if not os.path.isfile(FINANCE_JSON_PATH):
        with open(FINANCE_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump({"balances": {}, "purchases": []}, f, ensure_ascii=False, indent=2)

def _load() -> Dict[str, Any]:
    _ensure_store()
    try:
        with open(FINANCE_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                return {"balances": {}, "purchases": []}
            data.setdefault("balances", {})
            data.setdefault("purchases", [])
            return data
    except Exception:
        return {"balances": {}, "purchases": []}

def _save(data: Dict[str, Any]):
    with open(FINANCE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def record_purchase(event_id: int, owner_username: str, items: List[str], buyer: Dict[str, Any], total_brl: float) -> Dict[str, Any]:
    """
    Registra compra e acumula saldo para o dono do evento.
    """
    data = _load()
    ts = datetime.now(timezone.utc).isoformat()
    rec = {
        "id": uuid.uuid4().hex,
        "event_id": int(event_id),
        "owner": owner_username,
        "items": list(items),
        "buyer": buyer,
        "total_brl": float(total_brl or 0),
        "timestamp": ts,
    }
    # append
    data["purchases"].append(rec)
    # accumulate balance
    balances: Dict[str, float] = data.get("balances") or {}
    balances[owner_username] = float(balances.get(owner_username, 0.0)) + float(total_brl or 0)
    data["balances"] = balances
    _save(data)
    return rec

def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        # aceita somente data (YYYY-MM-DD) ou ISO completo
        if len(s) == 10:
            return datetime.fromisoformat(s + "T00:00:00+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

def _in_range(ts_iso: str, start: Optional[datetime], end: Optional[datetime]) -> bool:
    try:
        ts = datetime.fromisoformat(ts_iso)
    except Exception:
        return False
    if start and ts < start:
        return False
    if end and ts > end:
        return False
    return True

def list_finance_purchases(owner_username: str, start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Lista compras do owner dentro do período.
    """
    data = _load()
    start_dt = _parse_date(start)
    end_dt = _parse_date(end)
    out: List[Dict[str, Any]] = []
    for rec in data.get("purchases", []):
        if rec.get("owner") != owner_username:
            continue
        if not _in_range(rec.get("timestamp") or "", start_dt, end_dt):
            continue
        ev = get_event_by_id(int(rec.get("event_id") or 0)) or {}
        out.append({
            "id": rec.get("id"),
            "event_id": rec.get("event_id"),
            "event_name": ev.get("name") or f"Evento #{rec.get('event_id')}",
            "items_count": len(rec.get("items") or []),
            "total_brl": float(rec.get("total_brl") or 0),
            "buyer": rec.get("buyer") or {},
            "timestamp": rec.get("timestamp"),
        })
    # ordena mais recente primeiro
    out.sort(key=lambda r: r.get("timestamp") or "", reverse=True)
    return out

def get_finance_summary(owner_username: str, start: Optional[str] = None, end: Optional[str] = None) -> Dict[str, Any]:
    """
    Sumário financeiro para o owner: total, contagem, série diária e eventos mais rentáveis.
    """
    purchases = list_finance_purchases(owner_username, start, end)
    total = sum(float(p.get("total_brl") or 0) for p in purchases)
    count = len(purchases)
    # série por dia
    by_day: Dict[str, float] = {}
    for p in purchases:
        day = (p.get("timestamp") or "")[:10]  # YYYY-MM-DD
        by_day[day] = by_day.get(day, 0.0) + float(p.get("total_brl") or 0)
    series = [{"date": d, "total": v} for d, v in sorted(by_day.items(), key=lambda kv: kv[0])]
    # eventos
    by_event: Dict[int, float] = {}
    names: Dict[int, str] = {}
    for p in purchases:
        eid = int(p.get("event_id") or 0)
        by_event[eid] = by_event.get(eid, 0.0) + float(p.get("total_brl") or 0)
    top_events = []
    for eid, tot in by_event.items():
        ev = get_event_by_id(eid) or {}
        names[eid] = ev.get("name") or f"Evento #{eid}"
        top_events.append({"event_id": eid, "event_name": names[eid], "total": tot})
    top_events.sort(key=lambda e: e.get("total", 0.0), reverse=True)
    # saldo atual
    balances = _load().get("balances") or {}
    current_balance = float(balances.get(owner_username, 0.0))
    avg_ticket = float(total / count) if count else 0.0
    return {
        "total_earned": total,
        "purchases_count": count,
        "average_ticket": avg_ticket,
        "current_balance": current_balance,
        "series": series,
        "top_events": top_events,
    }