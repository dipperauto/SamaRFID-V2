"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<KanbanCard> & { listId: string };
  users: string[]; // usernames disponíveis
  onSave: (data: {
    title: string;
    description?: string;
    assignees: string[];
    dueDate?: string | null;
    color?: string | null;
  }) => void;
};

const COLORS = [
  { key: null, label: "Sem cor" },
  { key: "liquid_glass", label: "Liquid Glass" },
  { key: "#ef4444", label: "Vermelho" },
  { key: "#22c55e", label: "Verde" },
  { key: "#3b82f6", label: "Azul" },
  { key: "#f59e0b", label: "Laranja" },
  { key: "#a855f7", label: "Roxo" },
];

const CardEditDialog: React.FC<Props> = ({ open, onOpenChange, initial, users, onSave }) => {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [assignees, setAssignees] = React.useState<string[]>(initial?.assignees ?? []);
  const [dueDate, setDueDate] = React.useState<string | "">(initial?.dueDate ?? "");
  const [color, setColor] = React.useState<string | null>(initial?.color ?? null);

  React.useEffect(() => {
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setAssignees(initial?.assignees ?? []);
    setDueDate((initial?.dueDate as string) ?? "");
    setColor((initial?.color as string) ?? null);
  }, [initial]);

  const toggleUser = (u: string, checked: boolean) => {
    setAssignees((prev) => {
      const set = new Set(prev);
      if (checked) set.add(u);
      else set.delete(u);
      return Array.from(set);
    });
  };

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      assignees,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      color,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-gradient-to-b from-black/80 to-black/70 border border-white/30 ring-1 ring-white/20 backdrop-blur-3xl backdrop-saturate-200 shadow-2xl text-white">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar Card" : "Novo Card"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do card" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes e texto livre..."
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {users.map((u) => (
                <label key={u} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white">
                  <Checkbox checked={assignees.includes(u)} onCheckedChange={(c) => toggleUser(u, !!c)} />
                  <span className="text-sm">{u}</span>
                </label>
              ))}
              {users.length === 0 && (
                <div className="text-xs text-white/70">Nenhuma lista de usuários disponível.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de conclusão</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={String(c.key)}
                    type="button"
                    onClick={() => setColor(c.key as any)}
                    className={`rounded-md px-3 py-1 text-sm border ${
                      (color ?? null) === c.key ? "bg-white text-black border-white" : "bg-white/10 text-white border-white/20 hover:bg-white/15"
                    }`}
                    style={typeof c.key === "string" && c.key.startsWith("#") ? { borderColor: c.key } : undefined}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/30 bg-white text-black hover:bg-white/90"
            >
              Cancelar
            </Button>
            <Button onClick={submit}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CardEditDialog;