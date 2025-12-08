"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import KanbanColumn from "@/components/kanban/KanbanColumn";
import CardEditDialog from "@/components/kanban/CardEditDialog";
import { KanbanBoard, KanbanList, KanbanCard } from "@/components/kanban/types";
import { Search, Plus } from "lucide-react";

const KanbanPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery<KanbanBoard>({
    queryKey: ["kanban"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/kanban`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const { data: usersData } = useQuery<{ count: number; users: { username: string }[] }>({
    queryKey: ["kanban-users"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/users`, { credentials: "include" });
      // se acesso negado para não-admin, retorna lista vazia
      if (!res.ok) return { count: 0, users: [] };
      return res.json();
    },
  });

  const users = (usersData?.users ?? []).map((u) => u.username);

  const [search, setSearch] = React.useState("");
  const [openNewList, setOpenNewList] = React.useState(false);
  const [newListTitle, setNewListTitle] = React.useState("");

  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<KanbanCard | null>(null);
  const [newCardListId, setNewCardListId] = React.useState<string | null>(null);

  const board = data ?? { lists: [], cards: [] };

  const filteredCards = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return board.cards;
    return board.cards.filter((c) => {
      const fields = [
        c.title,
        c.description || "",
        (c.assignees || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return fields.includes(term);
    });
  }, [board.cards, search]);

  const listCards = (listId: string) =>
    filteredCards.filter((c) => c.listId === listId);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const toListId = destination.droppableId;
    const toIndex = destination.index;

    // Atualização otimista para evitar flicker
    queryClient.setQueryData<KanbanBoard>(["kanban"], (prev) => {
      if (!prev) return prev;
      const cards = [...prev.cards];
      const movingIndex = cards.findIndex((c) => c.id === draggableId);
      if (movingIndex === -1) return prev;
      const sourceListId = source.droppableId;
      const moving = { ...cards[movingIndex], listId: toListId };

      const sourceCards = cards
        .filter((c) => c.listId === sourceListId && c.id !== draggableId)
        .sort((a, b) => a.position - b.position);

      const destCards = cards
        .filter((c) => c.listId === toListId && c.id !== draggableId)
        .sort((a, b) => a.position - b.position);

      destCards.splice(toIndex, 0, { ...moving });

      sourceCards.forEach((c, i) => (c.position = i));
      destCards.forEach((c, i) => {
        c.position = i;
        if (c.id === moving.id) c.listId = toListId;
      });

      const updated = cards.map((c) => {
        if (c.id === draggableId) {
          const placed = destCards.find((dc) => dc.id === c.id);
          return placed ?? c;
        }
        if (c.listId === sourceListId) {
          const s = sourceCards.find((sc) => sc.id === c.id);
          return s ?? c;
        }
        if (c.listId === toListId) {
          const d = destCards.find((dc) => dc.id === c.id);
          return d ?? c;
        }
        return c;
      });

      return { ...prev, cards: updated };
    });

    const res = await fetch(`${API_URL}/api/kanban/cards/${encodeURIComponent(draggableId)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: toListId, position: toIndex }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao mover card.");
      await refetch(); // reverte caso o backend falhe
      return;
    }
    // sucesso: não refetch/invalidate aqui para evitar flicker
  };

  const createList = async () => {
    const title = newListTitle.trim();
    if (!title) return;
    const res = await fetch(`${API_URL}/api/kanban/lists`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao criar lista.");
      return;
    }
    toast.success("Lista criada!");
    setOpenNewList(false);
    setNewListTitle("");
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["kanban"] });
  };

  const deleteList = async (listId: string) => {
    const res = await fetch(`${API_URL}/api/kanban/lists/${encodeURIComponent(listId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao excluir lista.");
      return;
    }
    toast.success("Lista excluída!");
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["kanban"] });
  };

  const deleteCard = async (cardId: string) => {
    const res = await fetch(`${API_URL}/api/kanban/cards/${encodeURIComponent(cardId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao excluir card.");
      return;
    }
    toast.success("Card excluído!");
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["kanban"] });
  };

  const openNewCard = (listId: string) => {
    setNewCardListId(listId);
    setEditingCard(null);
    setEditDialogOpen(true);
  };

  const openEditCard = (card: KanbanCard) => {
    setEditingCard(card);
    setNewCardListId(null);
    setEditDialogOpen(true);
  };

  const saveCard = async (payload: {
    title: string;
    description?: string;
    assignees: string[];
    dueDate?: string | null;
    color?: string | null;
  }) => {
    if (editingCard) {
      const res = await fetch(`${API_URL}/api/kanban/cards/${encodeURIComponent(editingCard.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        toast.error(detail?.detail ?? "Falha ao atualizar card.");
        return;
      }
      toast.success("Card atualizado!");
    } else if (newCardListId) {
      const res = await fetch(`${API_URL}/api/kanban/cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: newCardListId, ...payload }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        toast.error(detail?.detail ?? "Falha ao criar card.");
        return;
      }
      toast.success("Card criado!");
    }
    setEditDialogOpen(false);
    setEditingCard(null);
    setNewCardListId(null);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["kanban"] });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden p-4 text-black">
      {/* Backdrop global herdado do app (AnimatedBackground já está montado) */}

      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/25 bg-black/40 shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75 text-white">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-xl md:text-2xl">Kanban</CardTitle>

              <div className="flex w-full md:w-auto items-center gap-3 md:justify-end">
                {/* Busca desktop */}
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar por título, descrição, responsáveis..."
                    className="w-64 pl-9 bg-white/20 text-white placeholder:text-white/70 border-white/25 focus-visible:ring-white/50"
                  />
                </div>

                {/* Nova lista */}
                <Dialog open={openNewList} onOpenChange={setOpenNewList}>
                  <DialogTrigger asChild>
                    <Button className="w-full md:w-auto bg-white/20 text-white hover:bg-white/25">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Lista
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl bg-black/35 border border-white/25 ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 shadow-2xl text-white">
                    <DialogHeader>
                      <DialogTitle>Criar Lista</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        value={newListTitle}
                        onChange={(e) => setNewListTitle(e.target.value)}
                        placeholder="Título da lista"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          className="border-white/30 bg-white text-black hover:bg-white/90"
                          onClick={() => setOpenNewList(false)}
                        >
                          Cancelar
                        </Button>
                        <Button onClick={createList}>Criar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Busca mobile */}
              <div className="relative md:hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por título, descrição, responsáveis..."
                  className="w-full pl-9 bg-white/20 text-white placeholder:text-white/70 border-white/25 focus-visible:ring-white/50"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-white/80">
              Listas: {board.lists.length} • Cards: {board.cards.length}
            </div>
          </CardContent>
        </Card>

        {/* Board com scroll horizontal no mobile */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.lists
              .sort((a, b) => a.order - b.order)
              .map((list) => (
                <KanbanColumn
                  key={list.id}
                  list={list as KanbanList}
                  cards={listCards(list.id)}
                  onNewCard={openNewCard}
                  onCardClick={openEditCard}
                  onDeleteList={deleteList}
                  onDeleteCard={deleteCard}
                />
              ))}
          </div>
        </DragDropContext>
      </div>

      {/* Dialog de card */}
      <CardEditDialog
        open={editDialogOpen}
        onOpenChange={(o) => setEditDialogOpen(o)}
        initial={
          editingCard
            ? editingCard
            : newCardListId
              ? { listId: newCardListId }
              : undefined
        }
        users={users}
        onSave={saveCard}
      />
    </div>
  );
};

export default KanbanPage;