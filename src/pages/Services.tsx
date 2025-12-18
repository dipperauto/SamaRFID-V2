"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Service = { id: number; name: string; description?: string; price_brl: number; payment_type: string; installments_months: number; down_payment: number };
type Client = { id: number; full_name: string };
type Assignment = {
  id: number;
  client_id: number;
  client_name: string;
  service_id: number;
  service_name: string;
  payment_type: string;
  installments_months: number;
  down_payment: number;
  base_price: number;
  discount_percent: number;
  discount_value: number;
  discount_type: "percent" | "value";
  total_value: number;
  status: "ativo" | "pausado" | "cancelado" | "aguardo";
  notes?: string;
};

const ServicesPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [services, setServices] = React.useState<Service[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);

  const loadAll = React.useCallback(async () => {
    try {
      const [sv, cl, asg] = await Promise.all([
        fetch(`${API_URL}/api/services`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_URL}/api/clients`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_URL}/api/client-services`, { credentials: "include" }).then(r => r.json()),
      ]);
      setServices((sv?.services ?? []) as Service[]);
      setClients(((cl?.clients ?? []) as any[]).map(c => ({ id: Number(c.id), full_name: String(c.full_name) })));
      setAssignments((asg?.assignments ?? []) as Assignment[]);
    } catch {
      toast.error("Falha ao carregar dados de serviços.");
    }
  }, [API_URL]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  // Dialog de novo serviço
  const [openNewService, setOpenNewService] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState<number>(0);
  const [ptype, setPtype] = React.useState<string>("avista");
  const [months, setMonths] = React.useState<number>(0);
  const [down, setDown] = React.useState<number>(0);

  const saveService = async () => {
    if (!name.trim() || price <= 0) {
      toast.error("Informe nome e valor do serviço.");
      return;
    }
    const payload = { name, description, price_brl: price, payment_type: ptype, installments_months: months, down_payment: down };
    const res = await fetch(`${API_URL}/api/services`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Falha ao salvar serviço.");
      return;
    }
    toast.success("Serviço salvo.");
    setOpenNewService(false);
    setName(""); setDescription(""); setPrice(0); setPtype("avista"); setMonths(0); setDown(0);
    await loadAll();
  };

  // Edição/remoção de serviço
  const updateService = async (s: Service) => {
    const res = await fetch(`${API_URL}/api/services/${s.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    if (!res.ok) {
      toast.error("Falha ao atualizar serviço.");
      return;
    }
    toast.success("Serviço atualizado.");
    await loadAll();
  };

  const deleteService = async (id: number) => {
    const res = await fetch(`${API_URL}/api/services/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toast.error("Falha ao excluir serviço.");
      return;
    }
    toast.success("Serviço excluído.");
    await loadAll();
  };

  // Dialog de atribuir serviço a cliente
  const [openAssign, setOpenAssign] = React.useState(false);
  const [assignClientId, setAssignClientId] = React.useState<number>(0);
  const [assignServiceId, setAssignServiceId] = React.useState<number>(0);
  const [discount, setDiscount] = React.useState<number>(0);
  const [discountType, setDiscountType] = React.useState<"percent" | "value">("percent");
  const [notes, setNotes] = React.useState<string>("");

  const currentService = React.useMemo(() => services.find(s => s.id === assignServiceId) || null, [services, assignServiceId]);
  const summaryTotal = React.useMemo(() => {
    const base = currentService?.price_brl ?? 0;
    const d = Math.max(0, discount);
    if (discountType === "percent") return base * (1 - d / 100);
    return Math.max(0, base - d);
  }, [currentService, discount, discountType]);

  const saveAssignment = async () => {
    if (!assignClientId || !assignServiceId) {
      toast.error("Selecione cliente e serviço.");
      return;
    }
    const body: any = { client_id: assignClientId, service_id: assignServiceId, notes, discount_type: discountType };
    if (discountType === "percent") body.discount_percent = discount; else body.discount_value = discount;
    const res = await fetch(`${API_URL}/api/client-services`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Falha ao vincular serviço.");
      return;
    }
    toast.success("Serviço vinculado ao cliente.");
    setOpenAssign(false);
    setAssignClientId(0); setAssignServiceId(0); setDiscount(0); setDiscountType("percent"); setNotes("");
    await loadAll();
  };

  // Atualizar status/discount da lista principal
  const updateAssignment = async (row: Assignment) => {
    const payload: any = { status: row.status, notes: row.notes ?? "" , discount_type: row.discount_type };
    if (row.discount_type === "percent") payload.discount_percent = row.discount_percent; else payload.discount_value = row.discount_value;
    const res = await fetch(`${API_URL}/api/client-services/${row.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Falha ao atualizar vínculo.");
      return;
    }
    toast.success("Vínculo atualizado.");
    await loadAll();
  };

  const deleteAssignment = async (id: number) => {
    const res = await fetch(`${API_URL}/api/client-services/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toast.error("Falha ao excluir vínculo.");
      return;
    }
    toast.success("Vínculo excluído.");
    await loadAll();
  };

  // Busca de vínculos
  const [search, setSearch] = React.useState("");
  const filteredAssignments = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter(a => [a.client_name, a.service_name, a.payment_type].join(" ").toLowerCase().includes(term));
  }, [search, assignments]);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-xl md:text-2xl">Serviços</CardTitle>

              <div className="flex items-center gap-2">
                {/* Botão Cadastrar */}
                <Dialog open={openNewService} onOpenChange={setOpenNewService}>
                  <DialogTrigger asChild>
                    <Button className="bg-white/20 text-white hover:bg-white/25">Cadastrar Serviço</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
                    <DialogHeader>
                      <DialogTitle>Novo Serviço</DialogTitle>
                      <DialogDescription className="text-white/80">Preencha os dados do serviço.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Nome do serviço</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Balanço mensal" />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resumo do serviço" />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value || 0))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Forma de pagamento</Label>
                        <Select value={ptype} onValueChange={(v) => setPtype(v)}>
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
                            <Label>Meses</Label>
                            <Input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value || 1))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Entrada (R$)</Label>
                            <Input type="number" min={0} step={0.01} value={down} onChange={(e) => setDown(Number(e.target.value || 0))} />
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <Button onClick={saveService} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">Salvar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Botão Gerenciar Serviços */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-white/20 text-white hover:bg-white/25">Gerenciar Serviços</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
                    <DialogHeader>
                      <DialogTitle>Catálogo</DialogTitle>
                      <DialogDescription className="text-white/80">Filtre, edite ou exclua serviços.</DialogDescription>
                    </DialogHeader>
                    <ServiceManager services={services} onUpdate={updateService} onDelete={deleteService} />
                  </DialogContent>
                </Dialog>

                {/* Botão vincular */}
                <Dialog open={openAssign} onOpenChange={setOpenAssign}>
                  <DialogTrigger asChild>
                    <Button className="bg-white/20 text-white hover:bg-white/25">Vincular Serviço a Cliente</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
                    <DialogHeader>
                      <DialogTitle>Novo vínculo</DialogTitle>
                      <DialogDescription className="text-white/80">Selecione cliente e serviço.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Cliente</Label>
                        <Select value={assignClientId ? String(assignClientId) : ""} onValueChange={(v) => setAssignClientId(Number(v))}>
                          <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                          <SelectContent className="bg-white text-black">
                            {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Serviço</Label>
                        <Select value={assignServiceId ? String(assignServiceId) : ""} onValueChange={(v) => setAssignServiceId(Number(v))}>
                          <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                          <SelectContent className="bg-white text-black">
                            {services.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} — R$ {s.price_brl.toFixed(2)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Observação</Label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações do vínculo (opcional)" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Tipo de desconto</Label>
                          <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "value")}>
                            <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-white text-black">
                              <SelectItem value="percent">Porcentagem (%)</SelectItem>
                              <SelectItem value="value">Valor (R$)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}</Label>
                          <Input type="number" min={0} step={discountType === "percent" ? 1 : 0.01} value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} />
                        </div>
                      </div>
                      <div className="rounded-md border border-white/20 p-3">
                        <div className="text-sm">Resumo</div>
                        <div className="text-xs text-white/80">
                          Serviço: {currentService ? currentService.name : "—"} | Forma: {currentService ? currentService.payment_type : "—"}
                          {currentService?.payment_type === "parcelado" ? ` • Meses: ${currentService.installments_months} • Entrada: R$ ${currentService.down_payment.toFixed(2)}` : ""}
                        </div>
                        <div className="mt-1 text-sm font-semibold">Total com desconto: R$ {summaryTotal.toFixed(2)}</div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={saveAssignment} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">Salvar vínculo</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {/* Indicadores e busca */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-white/10 text-white">Serviços cadastrados: {services.length}</Badge>
                <Badge className="bg-white/20 text-white">Vínculos: {assignments.length}</Badge>
                <Badge className="bg-white/20 text-white">Recorrentes: {services.filter(s => s.payment_type === "recorrente").length}</Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    placeholder="Pesquisar por cliente ou serviço..."
                    className="w-64 bg-white/20 text-white placeholder:text-white/70 border-white/25"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Lista de serviços cadastrados resumida */}
              <div>
                <div className="text-sm font-medium mb-2">Catálogo de serviços</div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {services.map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{s.name}</div>
                        <Badge variant="outline" className="bg-white/10 text-white">R$ {s.price_brl.toFixed(2)}</Badge>
                      </div>
                      <div className="text-xs text-white/80">Pagamento: {s.payment_type}</div>
                      {!!(s.description) && <div className="text-xs text-white/80">Desc: {s.description}</div>}
                      {s.payment_type === "parcelado" && (
                        <div className="text-xs text-white/80">Meses: {s.installments_months} • Entrada: R$ {s.down_payment.toFixed(2)}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => deleteService(s.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                  {services.length === 0 && <div className="text-sm text-white/80">Nenhum serviço cadastrado.</div>}
                </div>
              </div>

              {/* Lista principal de vínculos cliente-serviço */}
              <div>
                <div className="text-sm font-medium mb-2">Serviços com clientes</div>
                <div className="grid grid-cols-1 gap-2">
                  {filteredAssignments.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{a.service_name}</div>
                          <div className="text-xs text-white/80 truncate">Cliente: {a.client_name}</div>
                          <div className="text-xs text-white/80">
                            Forma: {a.payment_type}{a.payment_type === "parcelado" ? ` • Meses: ${a.installments_months} • Entrada: R$ ${a.down_payment.toFixed(2)}` : ""}
                          </div>
                          <div className="text-xs text-white/80">
                            Valor base: R$ {a.base_price.toFixed(2)} • Desconto: {a.discount_type === "percent" ? `${a.discount_percent}%` : `R$ ${a.discount_value.toFixed(2)}`}
                          </div>
                          {a.notes && <div className="text-xs text-white/80">Obs: {a.notes}</div>}
                          <div className="text-sm font-semibold">Total: R$ {a.total_value.toFixed(2)}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={a.status} onValueChange={(v) => updateAssignment({ ...a, status: v as Assignment["status"] })}>
                            <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-white text-black">
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="pausado">Pausado</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                              <SelectItem value="aguardo">Em aguardo</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={a.discount_type} onValueChange={(v) => updateAssignment({ ...a, discount_type: v as "percent" | "value" })}>
                            <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-white text-black">
                              <SelectItem value="percent">%</SelectItem>
                              <SelectItem value="value">R$</SelectItem>
                            </SelectContent>
                          </Select>
                          {a.discount_type === "percent" ? (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={a.discount_percent}
                              onChange={(e) => updateAssignment({ ...a, discount_percent: Number(e.target.value || 0) })}
                              className="w-24 bg-white text-black"
                              title="Desconto (%)"
                            />
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={a.discount_value}
                              onChange={(e) => updateAssignment({ ...a, discount_value: Number(e.target.value || 0) })}
                              className="w-24 bg-white text-black"
                              title="Desconto (R$)"
                            />
                          )}
                          <Input
                            value={a.notes || ""}
                            onChange={(e) => updateAssignment({ ...a, notes: e.target.value })}
                            className="w-40 bg-white text-black"
                            placeholder="Obs."
                          />
                          <Button variant="destructive" onClick={() => deleteAssignment(a.id)}>Excluir</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredAssignments.length === 0 && <div className="text-sm text-white/80">Nenhum serviço vinculado.</div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Component auxiliar para gerenciamento com filtro/edição simples
const ServiceManager: React.FC<{ services: Service[]; onUpdate: (s: Service) => Promise<void> | void; onDelete: (id: number) => Promise<void> | void; }> = ({ services, onUpdate, onDelete }) => {
  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return services;
    return services.filter(s => [s.name, s.description || "", s.payment_type].join(" ").toLowerCase().includes(t));
  }, [q, services]);
  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, descrição ou tipo..." className="bg-white/20 text-white placeholder:text-white/70 border-white/25" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(s => (
          <div key={s.id} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white space-y-2">
            <Input value={s.name} onChange={(e) => (s.name = e.target.value, onUpdate({ ...s }))} className="bg-white text-black" />
            <Input value={s.description || ""} onChange={(e) => (s.description = e.target.value, onUpdate({ ...s }))} className="bg-white text-black" placeholder="Descrição" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" step={0.01} value={s.price_brl} onChange={(e) => (s.price_brl = Number(e.target.value || 0), onUpdate({ ...s }))} className="bg-white text-black" />
              <Select value={s.payment_type} onValueChange={(v) => (s.payment_type = v, onUpdate({ ...s }))}>
                <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {s.payment_type === "parcelado" && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={s.installments_months} onChange={(e) => (s.installments_months = Number(e.target.value || 0), onUpdate({ ...s }))} className="bg-white text-black" />
                <Input type="number" step={0.01} value={s.down_payment} onChange={(e) => (s.down_payment = Number(e.target.value || 0), onUpdate({ ...s }))} className="bg-white text-black" />
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => onDelete(s.id)}>Excluir</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-sm text-white/80">Nenhum serviço encontrado.</div>}
      </div>
    </div>
  );
};

export default ServicesPage;