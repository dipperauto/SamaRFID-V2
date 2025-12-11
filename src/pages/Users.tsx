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
import UserForm, { UserFormValues } from "@/components/users/UserForm";
import UserCard, { AppUser } from "@/components/users/UserCard";

type UsersResponse = {
  count: number;
  users: AppUser[];
};

const UsersPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery<UsersResponse>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/users`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Acesso restrito a administradores.");
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  const [openCreate, setOpenCreate] = React.useState(false);
  const [openView, setOpenView] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [selected, setSelected] = React.useState<AppUser | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AppUser | null>(null);

  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { method: "GET", credentials: "include" });
        if (!res.ok) {
          setIsAdmin(false);
          return;
        }
        const me = await res.json();
        setIsAdmin((me?.role ?? "").toLowerCase() === "administrador");
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [API_URL]);

  const handleCreate = async (values: UserFormValues) => {
    const required = [values.username, values.full_name, values.role, values.password].every(Boolean);
    if (!required) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v);
    if (!isValidEmail(values.username)) {
      toast.error("Usuário deve ser um e-mail válido.");
      return;
    }
    const res = await fetch(`${API_URL}/api/users/register-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao cadastrar usuário.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    toast.success("Usuário cadastrado com sucesso!");
    if (data?.profile_photo_path) {
      toast.message("Foto salva", { description: `Armazenada em: ${data.profile_photo_path}` });
    }
    setOpenCreate(false);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const handleEdit = async (values: UserFormValues) => {
    if (!selected) return;
    const payload = {
      full_name: values.full_name,
      role: values.role,
      password: values.password || undefined,
      profile_photo_base64: values.profile_photo_base64 || undefined,
      allowed_pages: values.allowed_pages,
    };
    const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(selected.username)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao atualizar usuário.");
      return;
    }
    toast.success("Usuário atualizado com sucesso!");
    setOpenEdit(false);
    setSelected(null);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const onView = (user: AppUser) => {
    setSelected(user);
    setOpenView(true);
  };

  const onEdit = (user: AppUser) => {
    setSelected(user);
    setOpenEdit(true);
  };

  const total = data?.count ?? 0;

  const users = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.users ?? [];
    if (!term) return list;
    return list.filter((u) => {
      const fields = [
        u.full_name,
        u.username,
        u.role,
        (u.allowed_pages || []).join(" "),
      ].join(" ").toLowerCase();
      return fields.includes(term);
    });
  }, [data, search]);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4 text-white">
      <div className="relative z-10 space-y-4">
        {/* Top header com liquid glass escuro */}
        <div className="rounded-2xl px-3 md:px-4 py-3 border border-white/20 ring-1 ring-white/10 bg-[#0b1d3a]/50 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-xl md:text-2xl font-semibold">Usuários</h1>
            <div className="flex w-full md:w-auto items-center gap-3 md:justify-end">
              {/* Busca desktop */}
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/90" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome, e-mail, papel..."
                  className="w-64 pl-9 bg-white text-black placeholder:text-slate-600 border-white/10 focus-visible:ring-white/30"
                />
              </div>
              {/* Switch desktop */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-white/80">Modo edição</span>
                <Switch checked={editMode} onCheckedChange={setEditMode} />
              </div>
              {/* Botão - full width no mobile (apenas admin) */}
              {isAdmin && (
                <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                  <DialogTrigger asChild>
                    <Button className="w-full md:w-auto bg-white/20 text-white hover:bg-white/25 border border-white/20 ring-1 ring-white/10">
                      Cadastrar Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 shadow-2xl text-white max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Novo Usuário</DialogTitle>
                      <DialogDescription className="text-white/80">
                        Preencha os dados abaixo para cadastrar um novo usuário.
                      </DialogDescription>
                    </DialogHeader>
                    <UserForm
                      onSubmit={handleCreate}
                      onCancel={() => setOpenCreate(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Busca mobile */}
            <div className="relative md:hidden">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/90" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, e-mail, papel..."
                className="w-full pl-9 bg-white text-black placeholder:text-slate-600 border-white/10 focus-visible:ring-white/30"
              />
            </div>

            {/* Switch mobile */}
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-sm text-white/80">Modo edição</span>
              <Switch checked={editMode} onCheckedChange={setEditMode} />
            </div>
          </div>

          {/* Indicadores */}
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Indicadores:</span>
              <Badge variant="outline" className="bg-white/10 text-white">Total: {total}</Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">
                Encontrados: {users.length}
              </Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">
                Administradores: {data?.users.filter((u) => (u.role || "").toLowerCase() === "administrador").length ?? 0}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((u) => (
            <UserCard
              key={u.username}
              user={u}
              apiUrl={API_URL}
              onView={onView}
              onEdit={editMode && isAdmin ? onEdit : undefined}
              editMode={editMode && isAdmin}
              onDelete={editMode && isAdmin ? () => setDeleteTarget(u) : undefined}
            />
          ))}
          {users.length === 0 && (
            <div className="text-sm text-white/80">
              {search
                ? "Nenhum usuário encontrado para a pesquisa."
                : "Nenhum usuário cadastrado ainda."}
            </div>
          )}
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={openView} onOpenChange={(o) => { setOpenView(o); if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usuário</DialogTitle>
          </DialogHeader>
          {selected && (
            <UserForm
              initial={{
                username: selected.username,
                full_name: selected.full_name,
                role: selected.role,
                allowed_pages: selected.allowed_pages || [],
                password: null,
                profile_photo_base64: null,
              }}
              readOnly
              isEdit
              onSubmit={() => {}}
              onCancel={() => setOpenView(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onOpenChange={(o) => { setOpenEdit(o); if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {selected && (
            <UserForm
              initial={{
                username: selected.username,
                full_name: selected.full_name,
                role: selected.role,
                allowed_pages: selected.allowed_pages || [],
                password: "",
                profile_photo_base64: null,
              }}
              isEdit
              onSubmit={handleEdit}
              onCancel={() => setOpenEdit(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir Usuário: confirmação */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription className="text-white/80">Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="text-sm">Tem certeza que deseja excluir {deleteTarget?.full_name}?</div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(deleteTarget.username)}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                if (!res.ok) {
                  toast.error("Falha ao excluir usuário.");
                  return;
                }
                toast.success("Usuário excluído.");
                setDeleteTarget(null);
                await refetch();
                queryClient.invalidateQueries({ queryKey: ["users"] });
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

export default UsersPage;