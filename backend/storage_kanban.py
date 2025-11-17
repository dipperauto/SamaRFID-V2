import os
import json
import time
from typing import Dict, List, Optional, Tuple

KANBAN_JSON_PATH = os.environ.get(
    "KANBAN_JSON_PATH",
    os.path.join(os.path.dirname(__file__), "kanban.json"),
)

def _ensure_file():
    os.makedirs(os.path.dirname(KANBAN_JSON_PATH), exist_ok=True)
    if not os.path.exists(KANBAN_JSON_PATH):
        with open(KANBAN_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump({"lists": [], "cards": []}, f)

def _load() -> Dict:
    _ensure_file()
    with open(KANBAN_JSON_PATH, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return {"lists": [], "cards": []}

def _save(data: Dict):
    with open(KANBAN_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _gen_id(prefix: str) -> str:
    return f"{prefix}_{int(time.time() * 1000)}"

def get_board() -> Dict:
    return _load()

def create_list(title: str) -> Dict:
    data = _load()
    order = max([l.get("order", 0) for l in data["lists"]] + [0]) + 1
    list_id = _gen_id("list")
    new_list = {"id": list_id, "title": title, "order": order}
    data["lists"].append(new_list)
    _save(data)
    return new_list

def update_list(list_id: str, title: Optional[str] = None, order: Optional[int] = None) -> Optional[Dict]:
    data = _load()
    target = next((l for l in data["lists"] if l["id"] == list_id), None)
    if not target:
        return None
    if title is not None:
        target["title"] = title
    if order is not None:
        target["order"] = order
    _save(data)
    return target

def delete_list(list_id: str) -> bool:
    data = _load()
    before = len(data["lists"])
    data["lists"] = [l for l in data["lists"] if l["id"] != list_id]
    # remove cards da lista
    data["cards"] = [c for c in data["cards"] if c["listId"] != list_id]
    _save(data)
    return len(data["lists"]) < before

def _reindex_positions(data: Dict, list_id: str):
    cards = [c for c in data["cards"] if c["listId"] == list_id]
    cards.sort(key=lambda c: c.get("position", 0))
    for idx, c in enumerate(cards):
        c["position"] = idx

def create_card(
    list_id: str,
    title: str,
    description: Optional[str],
    assignees: Optional[List[str]],
    dueDate: Optional[str],
    color: Optional[str],
) -> Dict:
    data = _load()
    # posição no final da lista
    last_pos = max([c.get("position", 0) for c in data["cards"] if c["listId"] == list_id] + [-1]) + 1
    card_id = _gen_id("card")
    new_card = {
        "id": card_id,
        "listId": list_id,
        "title": title,
        "description": description or "",
        "assignees": assignees or [],
        "dueDate": dueDate or None,
        "color": color or None,
        "position": last_pos,
    }
    data["cards"].append(new_card)
    _save(data)
    return new_card

def update_card(
    card_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    assignees: Optional[List[str]] = None,
    dueDate: Optional[str] = None,
    color: Optional[str] = None,
    listId: Optional[str] = None,
    position: Optional[int] = None,
) -> Optional[Dict]:
    data = _load()
    card = next((c for c in data["cards"] if c["id"] == card_id), None)
    if not card:
        return None

    old_list_id = card["listId"]

    # mover de lista/posição
    if listId is not None:
        card["listId"] = listId
    if position is not None:
        card["position"] = max(0, int(position))

    if title is not None:
        card["title"] = title
    if description is not None:
        card["description"] = description
    if assignees is not None:
        card["assignees"] = assignees
    if dueDate is not None:
        card["dueDate"] = dueDate
    if color is not None:
        card["color"] = color

    # reindex das listas envolvidas
    if listId is not None and old_list_id != listId:
        _reindex_positions(data, old_list_id)
        _reindex_positions(data, listId)
    else:
        _reindex_positions(data, card["listId"])

    _save(data)
    return card

def delete_card(card_id: str) -> bool:
    data = _load()
    target = next((c for c in data["cards"] if c["id"] == card_id), None)
    if not target:
        return False
    list_id = target["listId"]
    before = len(data["cards"])
    data["cards"] = [c for c in data["cards"] if c["id"] != card_id]
    _reindex_positions(data, list_id)
    _save(data)
    return len(data["cards"]) < before