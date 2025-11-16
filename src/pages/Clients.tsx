"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import ClientForm, { ClientFormValues } from "@/components/clients/ClientForm";
import ClientCard, { Client } from "@/components/clients/ClientCard";

type ClientsResponse = {
  count: number;
  clients: Client[];
};

const ClientsPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery<ClientsResponse>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/clients`, { credentials: "include" });
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
    const res = await fetch(`${API_URL}/clients/register`, {
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
    const res = await fetch(`${API_URL}/clients/${selected.id}`, {
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
            <div className="flex items-center justify-between">
              <CardTitle>Clientes</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">Modo edição</span>
                  <Switch checked={editMode} onCheckedChange={setEditMode} />
                </div>
                <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                  <DialogTrigger asChild>
                    <Button className="bg-white/20 text-white hover:bg-white/25">Cadastrar Cliente</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl bg-black/50 border border-white/25 ring-1 ring-white/20 backdrop-blur-2xl text-white">
                    <DialogHeader>
                      <DialogTitle>Novo Cliente</DialogTitle>
                    </DialogHeader>
                    <ClientForm
                      onSubmit={handleCreate}
                      onCancel={() => setOpenCreate(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Indicadores:</span>
              <Badge variant="outline" className="bg-white/10 text-white">Total: {total}</Badge>
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
          {data?.clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              apiUrl={API_URL}
              onView={onView}
              onEdit={editMode ? onEdit : undefined}
              editMode={editMode}
            />
          ))}
          {total === 0 && (
            <div className="text-sm text-black/80">
              Nenhum cliente cadastrado ainda. Clique em "Cadastrar Cliente" para começar.
            </div>
          )}
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={openView} onOpenChange={(o) => !o ? setSelected(null) : null}>
        <DialogContent className="sm:max-w-2xl bg-black/50 border border-white/25 ring-1 ring-white/20 backdrop-blur-2xl text-white">
          <DialogHeader>
            <DialogTitle>Cliente</DialogTitle>
          </DialogHeader>
          {selected && (
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
                notes: selected.notes || "",
                profile_photo_base64: null, // visualização não recarrega foto base64
              }}
              readOnly
              onSubmit={() => {}}
              onCancel={() => setOpenView(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onOpenChange={(o) => !o ? setSelected(null) : null}>
        <DialogContent className="sm:max-w-2xl bg-black/50 border border-white/25 ring-1 ring-white/20 backdrop-blur-2xl text-white">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {selected && (
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
                notes: selected.notes || "",
                profile_photo_base64: null,
              }}
              onSubmit={handleEdit}
              onCancel={() => setOpenEdit(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsPage;