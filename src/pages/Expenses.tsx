"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Expense = {
  id: number;
  name: string;
  description: string;
  price_brl: number;
  payment_type: "avista" | "parcelado" | "recorrente";
  installments_months: number;
  down_payment: number;
  status: "ativo" | "inativo";
  created_at: string;
};

type FileItem = { name: string; url: string; size_bytes: number };

const ExpensesPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  // filtros
  const [start, setStart] = React.useState<string>("");
  const [end, setEnd] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [sort, setSort] = React.useState<string>("date_desc");
  const [search, setSearch] = React.useState<string>("");

  const loadExpenses = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      const res = await fetch(`${API_URL}/api/expenses?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExpenses((data?.expenses ?? []) as Expense[]);
    } catch {
      toast.error("Falha ao carregar gastos.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, start, end, status, sort]);

  React.useEffect(() => { loadExpenses(); }, [loadExpenses]);

  // cadastro
  const [openNew, setOpenNew] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState<number>(0);
  const [ptype, setPtype] = React.useState<"avista" | "parcelado" | "recorrente">("avista");
  const [months, setMonths] = React.useState<number>(0);
  const [down, setDown] = React.useState<number>(0);

  const saveExpense = async () => {
    if (!name.trim() || price <= 0) {
      toast.error("Informe nome e valor.");
      return;
    }
    const payload = { name, description, price_brl: price, payment_type: ptype, installments_months: months, down_payment: down, status: "ativo" };
    const res = await fetch(`${API_URL}/api/expenses`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao salvar gasto.");
      return;
    }
    toast.success("Gasto cadastrado.");
    setOpenNew(false);
    setName(""); setDescription(""); setPrice(0); setPtype("avista"); setMonths(0); setDown(0);
    await loadExpenses();
  };

  // edição
  const [editExp, setEditExp] = React.useState<Expense | null>(null);
  const saveEdits = async () => {
    if (!editExp) return;
    const res = await fetch(`${API_URL}/api/expenses/${editExp.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editExp),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao atualizar gasto.");
      return;
    }
    toast.success("Gasto atualizado.");
    setEditExp(null);
    await loadExpenses();
  };

  // excluir
  const [delExp, setDelExp] = React.useState<Expense | null>(null);
  const confirmDelete = async () => {
    if (!delExp) return;
    const res = await fetch(`${API_URL}/api/expenses/${delExp.id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao excluir gasto.");
      return;
    }
    toast.success("Gasto excluído.");
    setDelExp(null);
    await loadExpenses();
  };

  // anexos
  const [filesMap, setFilesMap] = React.useState<Record<number, FileItem[]>>({});
  const fetchFiles = async (id: number) => {
    const res = await fetch(`${API_URL}/api/expenses/${id}/files`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setFilesMap((prev) => ({ ...prev, [id]: (data?.files ?? []) as FileItem[] }));
  };
  const uploadFile = async (id: number, f: File) => {
    const form = new FormData();
    form.append("file", f);
    const res = await fetch(`${API_URL}/api/expenses/${id}/files`, { method: "POST", credentials: "include", body: form });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao anexar.");
      return;
    }
    toast.success("Anexo salvo.");
    await fetchFiles(id);
  };
  const deleteFile = async (id: number, name: string) => {
    const res = await fetch(`${API_URL}/api/expenses/${id}/files/${encodeURIComponent(name)}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao remover anexo.");
      return;
    }
    toast.success("Anexo removido.");
    await fetchFiles(id);
  };

  const filtered = React.useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return expenses;
    return expenses.filter(e => [e.name, e.description, e.payment_type].join(" ").toLowerCase().includes(t));
  }, [expenses, search]);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-xl md:text-2xl">Gastos</CardTitle>
              <div className="flex items-center gap-2">
                <Dialog open={openNew} onOpenChange={setOpenNew}>
                  <DialogTrigger asChild>
                    <Button className="bg-white/20 text-white hover:bg-white/25">Cadastrar Gasto</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
                    <DialogHeader>
                      <DialogTitle>Novo Gasto</DialogTitle>
                      <DialogDescription className="text-white/80">Preencha os dados do gasto.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Internet, Energia..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do gasto" />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value || 0))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Forma de pagamento</Label>
                        <Select value={ptype} onValueChange={(v) => setPtype(v as any)}>
                          <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="bg-white text-black">
                            <SelectItem value="avista">À vista</SelectItem>
                            <SelectItem value="parcelado">Parcelado</SelectItem>
                            <SelectItem value="recorrente">Recorrente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {ptype === "parcelado" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Parcelas (meses)</Label>
                            <Input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value || 1))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Entrada (R$)</Label>
                            <Input type="number" min={0} step={0.01} value={down} onChange={(e) => setDown(Number(e.target.value || 0))} />
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <Button onClick={saveExpense} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">Salvar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {/* Filtros e indicadores */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-white/10 text-white">Total: {expenses.length}</Badge>
                <Badge className="bg-white/20 text-white">Ativos: {expenses.filter(e => e.status === "ativo").length}</Badge>
                <div className="flex items-center gap-2 ml-auto">
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-white/20 text-white" title="Início" />
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-white/20 text-white" title="Fim" />
                  <Select value={status} onValueChange={(v) => setStatus(v)}>
                    <SelectTrigger className="bg-white text-black w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent className="bg-white text-black">
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={(v) => setSort(v)}>
                    <SelectTrigger className="bg-white text-black w-40"><SelectValue placeholder="Ordenar" /></SelectTrigger>
                    <SelectContent className="bg-white text-black">
                      <SelectItem value="date_desc">Data ↓</SelectItem>
                      <SelectItem value="date_asc">Data ↑</SelectItem>
                      <SelectItem value="price_desc">Valor ↓</SelectItem>
                      <SelectItem value="price_asc">Valor ↑</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar..." className="bg-white/20 text-white placeholder:text-white/70 border-white/25 w-48" />
                  <Button onClick={loadExpenses} className="bg-white/20 text-white hover:bg-white/25">Aplicar</Button>
                </div>
              </div>

              {/* Lista */}
              <div className="grid grid-cols-1 gap-2">
                {filtered.map((e) => (
                  <div key={e.id} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{e.name}</div>
                        <div className="text-xs text-white/80 truncate">Descrição: {e.description || "—"}</div>
                        <div className="text-xs text-white/80">
                          Valor: R$ {e.price_brl.toFixed(2)} • Forma: {e.payment_type}
                          {e.payment_type === "parcelado" ? ` • Meses: ${e.installments_months} • Entrada: R$ ${e.down_payment.toFixed(2)}` : ""}
                        </div>
                        <div className="text-xs text-white/80">Data: {e.created_at?.slice(0, 19).replace("T", " ")}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="bg-white text-black hover:bg-white/90"
                            onClick={() => { setEditExp(e); fetchFiles(e.id); }}
                          >
                            Editar
                          </Button>
                          <Button variant="destructive" onClick={() => setDelExp(e)}>Excluir</Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs">Ativo</span>
                        <Switch
                          checked={e.status === "ativo"}
                          onCheckedChange={async (checked) => {
                            const res = await fetch(`${API_URL}/api/expenses/${e.id}`, {
                              method: "PUT",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: checked ? "ativo" : "inativo" }),
                            });
                            if (res.ok) {
                              toast.success("Status atualizado.");
                              await loadExpenses();
                            } else {
                              toast.error("Falha ao atualizar status.");
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* anexos */}
                    <div className="mt-3 space-y-2">
                      <div className="text-sm">Anexos</div>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center">
                          <input
                            type="file"
                            className="block rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:text-white hover:bg-white/15"
                            onChange={(ev) => {
                              const f = ev.target.files?.[0];
                              if (f) uploadFile(e.id, f);
                              ev.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <Button
                          variant="outline"
                          className="bg-white text-black hover:bg-white/90"
                          onClick={() => fetchFiles(e.id)}
                        >
                          Atualizar lista
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {(filesMap[e.id] || []).map((f) => (
                          <div key={f.name} className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2">
                            <a href={`${API_URL}/${f.url}`} target="_blank" rel="noreferrer" className="truncate text-white hover:underline">
                              {f.name}
                            </a>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/70">
                                {(Number(f.size_bytes) / (1024 * 1024)).toFixed(2)} MB
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white text-black hover:bg-white/90"
                                onClick={() => deleteFile(e.id, f.name)}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                        {(filesMap[e.id] || []).length === 0 && (
                          <div className="text-xs text-white/80">Nenhum anexo.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && !loading && <div className="text-sm text-white/80">Nenhum gasto encontrado.</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* modal editar */}
      <Dialog open={!!editExp} onOpenChange={(o) => { if (!o) setEditExp(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Editar Gasto</DialogTitle>
            <DialogDescription className="text-white/80">Atualize os campos do gasto.</DialogDescription>
          </DialogHeader>
          {editExp && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editExp.name} onChange={(e) => setEditExp({ ...editExp, name: e.target.value })} className="bg-white text-black" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={editExp.description} onChange={(e) => setEditExp({ ...editExp, description: e.target.value })} className="bg-white text-black" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" min={0} step={0.01} value={editExp.price_brl} onChange={(e) => setEditExp({ ...editExp, price_brl: Number(e.target.value || 0) })} className="bg-white text-black" />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={editExp.payment_type} onValueChange={(v) => setEditExp({ ...editExp, payment_type: v as Expense["payment_type"] })}>
                  <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white text-black">
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                    <SelectItem value="recorrente">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editExp.payment_type === "parcelado" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Parcelas (meses)</Label>
                    <Input type="number" min={1} value={editExp.installments_months} onChange={(e) => setEditExp({ ...editExp, installments_months: Number(e.target.value || 1) })} className="bg-white text黑" />
                  </div>
                  <div className="space-y-2">
                    <Label>Entrada (R$)</Label>
                    <Input type="number" min={0} step={0.01} value={editExp.down_payment} onChange={(e) => setEditExp({ ...editExp, down_payment: Number(e.target.value || 0) })} className="bg-white text黑" />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setEditExp(null)}>Cancelar</Button>
                <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" onClick={saveEdits}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* confirmação excluir */}
      <Dialog open={!!delExp} onOpenChange={(o) => { if (!o) setDelExp(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Excluir Gasto</DialogTitle>
            <DialogDescription className="text-white/80">Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setDelExp(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;