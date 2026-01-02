"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import ClientForm, { ClientFormValues } from "@/components/clients/ClientForm";
import ClientCard, { Client } from "@/components/clients/ClientCard";
import ClientAttachments from "@/components/clients/ClientAttachments";

type ClientsResponse = {
  count: number;
  clients: Client[];
};

const ClientsPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "https://sama.dipperauto.com";
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery<ClientsResponse>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/clients`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  const [openCreate, setOpenCreate] = React.useState(false);
  const [openView, setOpenView] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [selected, setSelected] = React.useState<Client | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Client | null>(null);

  React.useEffect(() => {
    const handler = (e: any) => setDeleteTarget(e.detail);
    window.addEventListener("client-delete-request", handler as any);
    return () => window.removeEventListener("client-delete-request", handler as any);
  }, []);

  const handleCreate = async (values: ClientFormValues) => {
    const required = [values.full_name, values.doc, values.address, values.phone].every(Boolean);
    if (!required) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const notesLines = (values.notes || "").split(/\r?\n/).length;
    if (notesLines > 50) {
      toast.error("Notas devem ter no máximo 50 linhas.");
      return;
    }
    const res = await fetch(`${API_URL}/api/clients/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao cadastrar cliente.");
      return;
    }
    toast.success("Cliente cadastrado com sucesso!");
    setOpenCreate(false);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleEdit = async (values: ClientFormValues) => {
    if (!selected) return;
    const notesLines = (values.notes || "").split(/\r?\n/).length;
    if (notesLines > 50) {
      toast.error("Notas devem ter no máximo 50 linhas.");
      return;
    }
    const res = await fetch(`${API_URL}/api/clients/${selected.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao atualizar cliente.");
      return;
    }
    toast.success("Cliente atualizado com sucesso!");
    setOpenEdit(false);
    setSelected(null);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const onView = (client: Client) => {
    setSelected(client);
    setOpenView(true);
  };

  const onEdit = (client: Client) => {
    setSelected(client);
    setOpenEdit(true);
  };

  const total = data?.count ?? 0;

  const clients = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.clients ?? [];
    if (!term) return list;
    return list.filter((c) => {
      const fields = [
        c.full_name,
        c.doc,
        c.phone,
        c.address,
        c.pix_key || "",
        c.bank_data || "",
        c.municipal_registration || "",
        c.state_registration || "",
        c.corporate_name || "",
        c.trade_name || "",
        c.notes || "",
      ].join(" ").toLowerCase();
      return fields.includes(term);
    });
  }, [data, search]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden p-4 text-black">
      {/* FULLSCREEN GRADIENT BACKDROP */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(900px 500px at 0% 0%, rgba(37, 99, 235, 0.28), transparent 60%),
            radial-gradient(800px 450px at 100% 100%, rgba(255, 255, 255, 0.65), transparent 55%),
            radial-gradient(700px 400px at 100% 0%, rgba(147, 197, 253, 0.35), transparent 55%),
            radial-gradient(700px 400px at 0% 100%, rgba(255, 255, 255, 0.55), transparent 55%)
          `,
          backgroundColor: "#eef5ff",
        }}
      />
      {/* Decorative blobs over backdrop */}
      <div className="pointer-events-none fixed -top-28 -left-28 h-[650px] w-[650px] rounded-full bg-blue-400/35 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-white/50 blur-3xl" />

      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/25 bg-black/40 shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75 text-white">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-xl md:text-2xl">Clientes</CardTitle>

              {/* Grupo direito (desktop) + empilhado (mobile) */}
              <div className="flex w-full md:w-auto items-center gap-3 md:justify-end">
                {/* Busca desktop */}
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar por nome, documento, telefone..."
                    className="w-64 pl-9 bg-white/20 text-white placeholder:text-white/70 border-white/25 focus-visible:ring-white/50"
                  />
                </div>

                {/* Switch desktop */}
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-sm text-white/80">Modo edição</span>
                  <Switch checked={editMode} onCheckedChange={setEditMode} />
                </div>

                {/* Botão - full width no mobile */}
                <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                  <DialogTrigger asChild>
                    <Button className="w-full md:w-auto bg-white/20 text-white hover:bg-white/25">
                      Cadastrar Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl rounded-2xl bg-black/35 border border-white/25 ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 shadow-2xl text-white max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Novo Cliente</DialogTitle>
                      <DialogDescription className="text-white/70">
                        Preencha os dados abaixo para cadastrar um novo cliente.
                      </DialogDescription>
                    </DialogHeader>
                    <ClientForm
                      onSubmit={handleCreate}
                      onCancel={() => setOpenCreate(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {/* Busca mobile */}
              <div className="relative md:hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome, documento, telefone..."
                  className="w-full pl-9 bg-white/20 text-white placeholder:text-white/70 border-white/25 focus-visible:ring-white/50"
                />
              </div>

              {/* Switch mobile */}
              <div className="flex items-center gap-2 md:hidden">
                <span className="text-sm text-white/80">Modo edição</span>
                <Switch checked={editMode} onCheckedChange={setEditMode} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Indicadores:</span>
              <Badge variant="outline" className="bg-white/10 text-white">Total: {total}</Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">
                Encontrados: {clients.length}
              </Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">
                Com Pix: {data?.clients.filter((c) => !!c.pix_key).length ?? 0}
              </Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">
                Com Dados Bancários: {data?.clients.filter((c) => !!c.bank_data).length ?? 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              apiUrl={API_URL}
              onView={onView}
              onEdit={editMode ? onEdit : undefined}
              editMode={editMode}
            />
          ))}
          {clients.length === 0 && (
            <div className="text-sm text-black/80">
              {search
                ? "Nenhum cliente encontrado para a pesquisa."
                : 'Nenhum cliente cadastrado ainda. Clique em "Cadastrar Cliente" para começar.'}
            </div>
          )}
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={openView} onOpenChange={(o) => { setOpenView(o); if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl bg-gradient-to-b from-black/80 to-black/70 border border-white/30 ring-1 ring-white/20 backdrop-blur-3xl backdrop-saturate-200 shadow-2xl text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cliente</DialogTitle>
          </DialogHeader>
          {selected && (
            <>
              <ClientForm
                initial={{
                  full_name: selected.full_name,
                  doc: selected.doc,
                  address: selected.address,
                  phone: selected.phone,
                  pix_key: selected.pix_key || "",
                  bank_data: selected.bank_data || "",
                  municipal_registration: selected.municipal_registration || "",
                  state_registration: selected.state_registration || "",
                  corporate_name: selected.corporate_name || "",
                  trade_name: selected.trade_name || "",
                  notes: selected.notes || "",
                  profile_photo_base64: null,
                }}
                readOnly
                onSubmit={() => {}}
                onCancel={() => setOpenView(false)}
              />
              <div className="mt-4">
                <ClientAttachments clientId={selected.id} apiUrl={API_URL} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onOpenChange={(o) => { setOpenEdit(o); if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl bg-gradient-to-b from-black/80 to-black/70 border border-white/30 ring-1 ring-white/20 backdrop-blur-3xl backdrop-saturate-200 shadow-2xl text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {selected && (
            <>
              <ClientForm
                initial={{
                  full_name: selected.full_name,
                  doc: selected.doc,
                  address: selected.address,
                  phone: selected.phone,
                  pix_key: selected.pix_key || "",
                  bank_data: selected.bank_data || "",
                  municipal_registration: selected.municipal_registration || "",
                  state_registration: selected.state_registration || "",
                  corporate_name: selected.corporate_name || "",
                  trade_name: selected.trade_name || "",
                  notes: selected.notes || "",
                  profile_photo_base64: null,
                }}
                onSubmit={handleEdit}
                onCancel={() => setOpenEdit(false)}
              />
              <div className="mt-4">
                <ClientAttachments clientId={selected.id} apiUrl={API_URL} editable />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-gradient-to-b from-black/80 to-black/70 border border-white/30 ring-1 ring-white/20 backdrop-blur-3xl text-white">
          <DialogHeader>
            <DialogTitle>Excluir Cliente</DialogTitle>
            <DialogDescription className="text-white/80">
              Tem certeza que deseja excluir o cliente {deleteTarget?.full_name} (#{deleteTarget?.id})? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="text-black bg-white hover:bg-white/90"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                // 1) Rota dedicada existente
                let res = await fetch(`${API_URL}/api/clients/${deleteTarget.id}/delete`, {
                  method: "POST",
                  credentials: "include",
                });
                // 2) Fallback: DELETE clássico
                if (!res.ok) {
                  res = await fetch(`${API_URL}/api/clients/${deleteTarget.id}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                }
                if (!res.ok) {
                  const detail = await res.json().catch(() => null);
                  toast.error(detail?.detail ?? "Falha ao excluir cliente.");
                  return;
                }
                toast.success("Cliente excluído com sucesso!");
                setDeleteTarget(null);
                await refetch();
                queryClient.invalidateQueries({ queryKey: ["clients"] });
              }}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsPage;