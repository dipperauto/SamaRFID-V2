import os
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date

from storage_expenses import get_all_expenses
from storage_client_services import list_assignments

LEDGER_PATH = os.path.join(os.path.dirname(__file__), "media", "finance", "control_payments.json")

def _ensure_ledger():
    os.makedirs(os.path.dirname(LEDGER_PATH), exist_ok=True)
    if not os.path.isfile(LEDGER_PATH):
        with open(LEDGER_PATH, "w", encoding="utf-8") as f:
            json.dump({"payments": []}, f, ensure_ascii=False, indent=2)

def _load() -> Dict[str, Any]:
    _ensure_ledger()
    try:
        with open(LEDGER_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                return {"payments": []}
            data.setdefault("payments", [])
            return data
    except Exception:
        return {"payments": []}

def _save(data: Dict[str, Any]):
    with open(LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _parse_date(s: str) -> Optional[date]:
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return None

def _add_months(d: date, m: int) -> date:
    y = d.year + (d.month - 1 + m) // 12
    mn = (d.month - 1 + m) % 12 + 1
    # clamp day within month
    day = min(d.day, [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mn-1])
    return date(y, mn, day)

def _record_key(tp: str, ref_id: int, due_iso: str) -> str:
    return f"{tp}:{ref_id}:{due_iso}"

def list_month_items(month_iso: str, view: str) -> List[Dict[str, Any]]:
    """
    month_iso: 'YYYY-MM'
    view: 'expenses' or 'services'
    Returns items with fields:
    { type, ref_id, name, description, due_date, amount_due, amount_paid, percent_paid, status, overdue, dueSoon }
    """
    today = datetime.utcnow().date()
    # compute month boundaries
    y, m = map(int, month_iso.split("-"))
    start = date(y, m, 1)
    end = _add_months(start, 1)

    ledger = _load()
    payments: List[Dict[str, Any]] = ledger.get("payments", [])

    out: List[Dict[str, Any]] = []

    if view == "expenses":
        for e in get_all_expenses():
            due_s = (e.get("due_date") or "").strip()
            if not due_s:
                continue
            start_due = _parse_date(due_s)
            if not start_due:
                continue
            tp = e.get("payment_type", "avista")
            price = float(e.get("price_brl") or 0)
            months = int(e.get("installments_months") or 0)
            down = float(e.get("down_payment") or 0)
            # build due dates for this month
            if tp == "avista":
                dues = [start_due]
            elif tp == "recorrente":
                # every month same day
                # compute occurrence for current month
                occ = date(start.year, start.month, min(start_due.day, 28))  # safe day
                dues = [occ]
            else:  # parcelado
                dues = []
                # optional down payment at first due date
                if down > 0:
                    dues.append(start_due)
                # monthly installments after start_due
                inst_amount = max(0.0, (price - down)) / max(1, months)
                for i in range(months):
                    inst_date = _add_months(start_due, i)
                    dues.append(inst_date)
            # normalize amounts per due date
            for due in dues:
                if not (start <= due < end):
                    continue
                amount_due = price
                if tp == "recorrente":
                    amount_due = price
                elif tp == "avista":
                    amount_due = price
                else:
                    # parcelado: if it's the first entry and down>0 treat as down, else installment
                    if down > 0 and due == start_due:
                        amount_due = down
                    else:
                        amount_due = max(0.0, (price - down)) / max(1, months)
                due_iso = due.isoformat()
                key = _record_key("expense", int(e["id"]), due_iso)
                paid_sum = sum(p.get("amount") or 0 for p in payments if p.get("key") == key)
                percent = 0.0
                if amount_due > 0:
                    percent = min(100.0, (paid_sum / amount_due) * 100.0)
                status = "unpaid"
                if paid_sum <= 0:
                    status = "unpaid"
                elif paid_sum < amount_due:
                    status = "partial"
                else:
                    status = "paid"
                overdue = (due < today and status != "paid")
                dueSoon = ((due - today).days >= 0 and (due - today).days <= 5 and status != "paid")
                out.append({
                    "type": "expense",
                    "ref_id": int(e["id"]),
                    "name": e.get("name"),
                    "description": e.get("description") or "",
                    "due_date": due_iso,
                    "amount_due": round(amount_due, 2),
                    "amount_paid": round(paid_sum, 2),
                    "percent_paid": round(percent, 1),
                    "status": status,
                    "overdue": overdue,
                    "dueSoon": dueSoon,
                })
    else:  # services
        for a in list_assignments():
            start_s = (a.get("start_due_date") or "").strip()
            if not start_s:
                continue
            start_due = _parse_date(start_s)
            if not start_due:
                continue
            tp = a.get("payment_type", "avista")
            base = float(a.get("base_price") or 0)
            months = int(a.get("installments_months") or 0)
            down = float(a.get("down_payment") or 0)
            # build due dates similar
            if tp == "avista":
                dues = [start_due]
            elif tp == "recorrente":
                occ = date(start.year, start.month, min(start_due.day, 28))
                dues = [occ]
            else:
                dues = []
                if down > 0:
                    dues.append(start_due)
                for i in range(months):
                    dues.append(_add_months(start_due, i))
            for due in dues:
                if not (start <= due < end):
                    continue
                amount_due = base
                if tp == "recorrente":
                    amount_due = base
                elif tp == "avista":
                    amount_due = base
                else:
                    if down > 0 and due == start_due:
                        amount_due = down
                    else:
                        amount_due = max(0.0, (base - down)) / max(1, months)
                due_iso = due.isoformat()
                key = _record_key("service", int(a["id"]), due_iso)
                paid_sum = sum(p.get("amount") or 0 for p in payments if p.get("key") == key)
                percent = 0.0
                if amount_due > 0:
                    percent = min(100.0, (paid_sum / amount_due) * 100.0)
                status = "unpaid"
                if paid_sum <= 0:
                    status = "unpaid"
                elif paid_sum < amount_due:
                    status = "partial"
                else:
                    status = "paid"
                overdue = (due < today and status != "paid")
                dueSoon = ((due - today).days >= 0 and (due - today).days <= 5 and status != "paid")
                out.append({
                    "type": "service",
                    "ref_id": int(a["id"]),
                    "name": a.get("service_name"),
                    "description": a.get("notes") or "",
                    "client_name": a.get("client_name"),
                    "due_date": due_iso,
                    "amount_due": round(amount_due, 2),
                    "amount_paid": round(paid_sum, 2),
                    "percent_paid": round(percent, 1),
                    "status": status,
                    "overdue": overdue,
                    "dueSoon": dueSoon,
                })
    # sort by due_date then name
    out.sort(key=lambda x: (x["due_date"], x.get("name") or ""))
    return out

def record_payment(tp: str, ref_id: int, due_date_iso: str, amount: float) -> Dict[str, Any]:
    """
    tp: 'expense'|'service'
    due_date_iso: 'YYYY-MM-DD'
    amount: positive number
    """
    if tp not in ("expense", "service"):
        raise ValueError("Tipo inválido.")
    if amount <= 0:
        raise ValueError("Valor do pagamento deve ser positivo.")
    data = _load()
    ts = datetime.utcnow().isoformat()
    key = _record_key(tp, int(ref_id), due_date_iso)
    data["payments"].append({"key": key, "amount": float(amount), "timestamp": ts})
    _save(data)
    return {"success": True, "timestamp": ts}

def month_summary(month_iso: str) -> Dict[str, Any]:
    items_exp = list_month_items(month_iso, "expenses")
    items_srv = list_month_items(month_iso, "services")
    total_exp_due = sum(i["amount_due"] for i in items_exp)
    total_exp_paid = sum(i["amount_paid"] for i in items_exp)
    total_srv_due = sum(i["amount_due"] for i in items_srv)
    total_srv_paid = sum(i["amount_paid"] for i in items_srv)
    return {
        "month": month_iso,
        "expenses": {"due": round(total_exp_due, 2), "paid": round(total_exp_paid, 2)},
        "services": {"due": round(total_srv_due, 2), "paid": round(total_srv_paid, 2)},
    }