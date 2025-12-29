"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Search, MapPin, UserCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NavLink, useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Responsible = { name: string; username?: string; photo_rel?: string | null; isPrimary?: boolean };
type LocationNode = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  category?: string | null;
  responsibles: Responsible[];
  children: LocationNode[];
  parentId?: string | null;
};

const HierarchyPage: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const navigate = useNavigate();

  const [nodes, setNodes] = React.useState<LocationNode[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);

  const [search, setSearch] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<string>("");
  const [filterResponsible, setFilterResponsible] = React.useState<string>("");

  const [openNewRoot, setOpenNewRoot] = React.useState(false);
  const [openNewChild, setOpenNewChild] = React.useState(false);
  const [parentForNewChild, setParentForNewChild] = React.useState<LocationNode | null>(null);

  // Gerenciador de categorias
  const [openCatManager, setOpenCatManager] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState("");

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("#0ea5e9");
  const [categoryInput, setCategoryInput] = React.useState("");
  const [primaryIndex, setPrimaryIndex] = React.useState<number>(-1);
  const [responsibles, setResponsibles] = React.useState<Responsible[]>([]);

  // Busca de usuários para responsáveis (com foto)
  const [userQuery, setUserQuery] = React.useState("");
  const [userResults, setUserResults] = React.useState<{ username: string; full_name: string; role: string; profile_photo_path?: string | null }[]>([]);

  const normalizePhotoRel = (raw?: string | null) => {
    if (!raw) return null;
    const p = String(raw).replace(/\\/g, "/").replace(/^\/+/, "");
    if (p.startsWith("static/")) return p;
    if (p.startsWith("media/")) return p.replace(/^media\//, "static/");
    return `static/${p}`;
  };

  const searchUsers = React.useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) {
      setUserResults([]);
      return;
    }
    // 1) Tenta endpoint público
    try {
      const res = await fetch(`${API_URL}/api/users/search-public?q=${encodeURIComponent(q)}`, { credentials: "include" });
      let list: any[] = [];
      if (res.ok) {
        const data = await res.json();
        list = (data?.users ?? []) as any[];
      }
      // Se vazio, tenta fallback admin (lista completa)
      if (!list.length) {
        const adminRes = await fetch(`${API_URL}/api/users`, { credentials: "include" });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          const all = (adminData?.users ?? []) as any[];
          // filtra por nome/email contendo a query
          list = all.filter((u) => {
            const name = (u.full_name || "").toLowerCase();
            const email = (u.username || "").toLowerCase();
            const qq = q.toLowerCase();
            return name.includes(qq) || email.includes(qq);
          });
          // normaliza forma (compatível com público)
          list = list.map((u) => ({
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            profile_photo_path: u.profile_photo_path || null,
          }));
        }
      }
      // Ordena alfabeticamente por nome (fallback para username)
      list.sort((a, b) => {
        const na = (a.full_name || a.username || "").toLowerCase();
        const nb = (b.full_name || b.username || "").toLowerCase();
        return na.localeCompare(nb);
      });
      setUserResults(list.slice(0, 3));
    } catch {
      setUserResults([]);
    }
  }, [API_URL]);

  React.useEffect(() => {
    const t = setTimeout(() => searchUsers(userQuery), 250);
    return () => clearTimeout(t);
  }, [userQuery, searchUsers]);

  const loadHierarchy = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/hierarchy`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNodes((data?.nodes ?? []) as LocationNode[]);
      setCategories((data?.categories ?? []) as string[]);
    } catch {
      toast.error("Falha ao carregar Unidades.");
    }
  }, [API_URL]);

  React.useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#0ea5e9");
    setCategoryInput("");
    setPrimaryIndex(-1);
    setResponsibles([]);
    setUserQuery("");
    setUserResults([]);
  };

  const buildInheritedResponsibles = React.useCallback((nodesList: LocationNode[], parentId: string | null | undefined): Responsible[] => {
    if (!parentId) return [];
    const map = new Map<string, LocationNode>();
    const indexAll = (list: LocationNode[]) => {
      for (const n of list) {
        map.set(n.id, n);
        if (n.children?.length) indexAll(n.children);
      }
    };
    indexAll(nodesList);

    const chain: LocationNode[] = [];
    let cur = parentId ? map.get(parentId) || null : null;
    while (cur) {
      chain.push(cur);
      cur = cur.parentId ? map.get(cur.parentId) || null : null;
    }

    const ordered: Responsible[] = [];
    const added = new Set<string>(); // preferir dedupe por username se disponível
    for (const loc of chain) {
      const primary = loc.responsibles.find((r) => r.isPrimary);
      const keyPrimary = (primary?.username || primary?.name || "").toLowerCase();
      if (primary && keyPrimary && !added.has(keyPrimary)) {
        ordered.push({ ...primary, isPrimary: false });
        added.add(keyPrimary);
      }
      for (const r of loc.responsibles) {
        const key = (r.username || r.name || "").toLowerCase();
        if (!key || added.has(key)) continue;
        ordered.push({ ...r, isPrimary: false });
        added.add(key);
      }
    }
    return ordered;
  }, []);

  const openChildDialog = (parent: LocationNode) => {
    setParentForNewChild(parent);
    const inherited = buildInheritedResponsibles(nodes, parent.id);
    setResponsibles(inherited);
    setPrimaryIndex(inherited.length > 0 ? 0 : -1);
    setOpenNewChild(true);
  };

  const openRootDialog = () => {
    setParentForNewChild(null);
    resetForm();
    setOpenNewRoot(true);
  };

  const ensurePrimaryExists = () => {
    if (responsibles.length === 0) return false;
    if (primaryIndex < 0 || primaryIndex >= responsibles.length) {
      setPrimaryIndex(0);
    }
    return true;
  };

  const addResponsibleFromUser = (u: { username: string; full_name: string; profile_photo_path?: string | null }) => {
    const nm = u.full_name || u.username;
    const key = (u.username || nm).toLowerCase();
    if (responsibles.find((r) => (r.username || r.name || "").toLowerCase() === key)) return;
    const photoRel = normalizePhotoRel(u.profile_photo_path || null);
    const next = [...responsibles, { name: nm, username: u.username, photo_rel: photoRel }];
    setResponsibles(next);
    if (primaryIndex === -1) setPrimaryIndex(0);
  };

  const removeResponsible = (idx: number) => {
    const next = responsibles.slice();
    next.splice(idx, 1);
    setResponsibles(next);
    if (primaryIndex === idx) setPrimaryIndex(next.length ? 0 : -1);
    else if (primaryIndex > idx) setPrimaryIndex(primaryIndex - 1);
  };

  const setPrimary = (idx: number) => setPrimaryIndex(idx);

  const saveRoot = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da unidade.");
      return;
    }
    if (!ensurePrimaryExists()) {
      toast.error("Informe pelo menos um responsável.");
      return;
    }
    const finalResponsibles: Responsible[] = responsibles.map((r, i) => ({ ...r, isPrimary: i === primaryIndex }));
    const payload = {
      name: name.trim(),
      description: description.trim(),
      color,
      category: categoryInput.trim(),
      responsibles: finalResponsibles,
    };
    const res = await fetch(`${API_URL}/api/hierarchy/root`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao salvar unidade raiz.");
      return;
    }
    toast.success("Unidade raiz adicionada com sucesso!");
    setOpenNewRoot(false);
    resetForm();
    await loadHierarchy();
  };

  const saveChild = async () => {
    if (!parentForNewChild) return;
    if (!name.trim()) {
      toast.error("Informe o nome da unidade.");
      return;
    }
    if (!ensurePrimaryExists()) {
      toast.error("Informe pelo menos um responsável.");
      return;
    }
    const finalResponsibles: Responsible[] = responsibles.map((r, i) => ({ ...r, isPrimary: i === primaryIndex }));
    const payload = {
      name: name.trim(),
      description: description.trim(),
      color,
      category: categoryInput.trim(),
      responsibles: finalResponsibles,
    };
    const res = await fetch(`${API_URL}/api/hierarchy/${encodeURIComponent(parentForNewChild.id)}/child`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao salvar dependente.");
      return;
    }
    toast.success("Filial adicionada com sucesso!");
    setOpenNewChild(false);
    setParentForNewChild(null);
    resetForm();
    await loadHierarchy();
  };

  // Filtros e busca no render
  const matchFilters = (node: LocationNode): boolean => {
    const term = search.trim().toLowerCase();
    const cat = filterCategory.trim().toLowerCase();
    const resp = filterResponsible.trim().toLowerCase();
    const text = [
      node.name,
      node.description || "",
      node.category || "",
      node.responsibles.map((r) => r.name).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    const okSearch = term ? text.includes(term) : true;
    const okCat = cat ? (node.category || "").toLowerCase() === cat : true;
    const okResp = resp ? node.responsibles.some((r) => (r.name || "").toLowerCase().includes(resp) || (r.username || "").toLowerCase().includes(resp)) : true;
    return okSearch && okCat && okResp;
  };

  const filteredRoots = nodes.filter((n) => !n.parentId);

  const renderRespBadge = (r: Responsible, idx: number, idKey: string) => {
    const url = r.photo_rel ? `${API_URL}/${r.photo_rel}` : null;
    return (
      <div key={`${idKey}-resp-${idx}`} className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1">
        <Avatar className="h-6 w-6">
          {url ? <AvatarImage src={url} alt={r.name} /> : <AvatarFallback>👤</AvatarFallback>}
        </Avatar>
        <span className="text-xs">{idx + 1}. {r.name}{idx === 0 ? " (principal)" : ""}</span>
      </div>
    );
  };

  const renderNode = (node: LocationNode, level: number = 0): React.ReactNode => {
    // Monta cadeia completa de responsáveis (próprios + herdados sem duplicar)
    const inherited = ((): Responsible[] => {
      if (!node.parentId) return [];
      return buildInheritedResponsibles(nodes, node.parentId);
    })();
    const chain: Responsible[] = [];
    const ownPrimary = node.responsibles.find((r) => r.isPrimary);
    const remainderOwn = node.responsibles.filter((r) => !r.isPrimary);
    if (ownPrimary) chain.push(ownPrimary);
    chain.push(...remainderOwn);
    for (const inh of inherited) {
      const key = (inh.username || inh.name || "").toLowerCase();
      if (!chain.find(c => (c.username || c.name || "").toLowerCase() === key)) chain.push(inh);
    }

    const visible = matchFilters(node);

    return (
      <div key={node.id} className={`rounded-xl border ${visible ? "border-white/20" : "border-white/10 opacity-60"} bg-white/10 p-3 text-white space-y-2`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: node.color || "#93c5fd" }} />
              <div className="font-semibold truncate">{node.name}</div>
              {node.category && <Badge variant="outline" className="bg-white/10 text-white">{node.category}</Badge>}
              <Badge className="bg-white/20 text-white hover:bg-white/25">Nível {level + 1}</Badge>
            </div>
            {node.description && (
              <div className="text-xs text-white/80 mt-1 line-clamp-2">{node.description}</div>
            )}
            <div className="mt-2 text-xs">
              <div className="font-medium flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                Responsáveis (ordem):
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {chain.length ? chain.map((r, idx) => renderRespBadge(r, idx, node.id)) : <span className="text-white/70">—</span>}
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => openChildDialog(node)} title="Adicionar filial (dependente)"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate(`/units/${encodeURIComponent(node.id)}/assets`)}
              title="Abrir página da unidade"
            >
              Abrir
            </Button>
            {editMode && (
              <>
                <Button
                  variant="outline" size="sm"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => openEditDialog(node)} title="Editar unidade"
                >
                  Editar
                </Button>
                <Button
                  variant="destructive" size="sm"
                  onClick={() => setDeleteTarget(node)} title="Excluir unidade"
                >
                  Excluir
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filhos */}
        {node.children?.length ? (
          <div className="pl-4 border-l border-white/15 space-y-2">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  // Categoria: gerenciador (modal)
  const addCategory = async () => {
    const nm = newCategory.trim();
    if (!nm) return;
    const res = await fetch(`${API_URL}/api/hierarchy/categories`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao adicionar categoria.");
      return;
    }
    const data = await res.json();
    setCategories((data?.categories ?? []) as string[]);
    setNewCategory("");
    toast.success("Categoria adicionada.");
  };

  const removeCategory = async (nm: string) => {
    const res = await fetch(`${API_URL}/api/hierarchy/categories`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao remover categoria.");
      return;
    }
    const data = await res.json();
    setCategories((data?.categories ?? []) as string[]);
    toast.success("Categoria removida.");
  };

  const openEditDialog = (node: LocationNode) => {
    setEditTarget(node);
    setName(node.name || "");
    setDescription(node.description || "");
    setColor(node.color || "#0ea5e9");
    setCategoryInput(node.category || "");
    const rs = Array.isArray(node.responsibles) ? node.responsibles : [];
    setResponsibles(rs);
    const pi = rs.findIndex((r) => r.isPrimary);
    setPrimaryIndex(pi >= 0 ? pi : (rs.length ? 0 : -1));
    setUserQuery("");
    setUserResults([]);
    setOpenEdit(true);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!name.trim()) { toast.error("Informe o nome da unidade."); return; }
    if (responsibles.length === 0) { toast.error("Informe ao menos um responsável."); return; }
    const finalResponsibles = responsibles.map((r, i) => ({ ...r, isPrimary: i === primaryIndex }));
    const payload = { name: name.trim(), description: description.trim(), color, category: categoryInput.trim(), responsibles: finalResponsibles };
    const res = await fetch(`${API_URL}/api/hierarchy/${encodeURIComponent(editTarget.id)}`, {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao salvar edição.");
      return;
    }
    toast.success("Unidade atualizada com sucesso!");
    setOpenEdit(false);
    setEditTarget(null);
    await loadHierarchy();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`${API_URL}/api/hierarchy/${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE", credentials: "include",
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao excluir unidade.");
      return;
    }
    toast.success("Unidade excluída.");
    setDeleteTarget(null);
    await loadHierarchy();
  };

  // ADDED: estado de modo edição para evitar referência não definida
  const [editMode, setEditMode] = React.useState<boolean>(false);

  const [editTarget, setEditTarget] = React.useState<LocationNode | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<LocationNode | null>(null);
  const [openEdit, setOpenEdit] = React.useState(false);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Unidades
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button className="bg-white/20 text-white hover:bg-white/25" onClick={openRootDialog} title="Adicionar unidade raiz">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Raiz
                </Button>
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setOpenCatManager(true)} title="Gerenciar categorias">
                  Categorias
                </Button>
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs text-white/80">Modo edição</span>
                  <Switch checked={editMode} onCheckedChange={setEditMode} />
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-white/80">
              Crie sua hierarquia de ambientes em cascata. Use o botão "Adicionar Raiz" para os primeiros níveis.
              Depois, clique no "+" à direita de qualquer item para adicionar um dependente (filial) sob ele.
              Cada nova unidade pede nome, descrição, cor, responsáveis (defina o principal) e categoria.
              Filiais herdam responsáveis do ambiente pai e dos níveis acima, mantendo a ordem (principal primeiro).
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar por nome, descrição, categoria ou responsável..."
                    className="w-72 pl-9 bg-white/20 text-white placeholder:text-white/70 border-white/25 focus-visible:ring-white/50"
                  />
                </div>
                <Input
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  placeholder="Filtrar por categoria"
                  className="w-48 bg-white/20 text-white placeholder:text-white/70 border-white/25"
                />
                <Input
                  value={filterResponsible}
                  onChange={(e) => setFilterResponsible(e.target.value)}
                  placeholder="Filtrar por responsável"
                  className="w-56 bg-white/20 text-white placeholder:text-white/70 border-white/25"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/70">Categorias:</span>
                <div className="flex flex-wrap gap-1">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`text-xs rounded-md border px-2 py-1 ${filterCategory.toLowerCase() === c.toLowerCase() ? "bg-white text-black" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
                      onClick={() => setFilterCategory(c)}
                      title={`Filtrar: ${c}`}
                    >
                      {c}
                    </button>
                  ))}
                  {categories.length === 0 && <span className="text-xs text-white/60">Nenhuma categoria ainda.</span>}
                </div>
              </div>
            </div>

            <Separator className="my-4 bg-white/20" />

            <div className="space-y-3">
              {filteredRoots.length ? (
                filteredRoots.map((root) => renderNode(root, 0))
              ) : (
                <div className="text-sm text-white/80">
                  Nenhum local cadastrado. Clique em "Adicionar Raiz" para começar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de novo local raiz */}
      <Dialog open={openNewRoot} onOpenChange={setOpenNewRoot}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Nova Unidade (Raiz)</DialogTitle>
            <DialogDescription className="text-white/80">Preencha os dados da unidade.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Escritório" className="bg-white text-black" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-md border border-white/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resumo do ambiente" className="bg:white text-black" />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <select value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black">
                  <option value="">Selecione</option>
                  {categories.map((c) => (
                    <option key={`cat-${c}`} value={c}>{c}</option>
                  ))}
                </select>
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setOpenCatManager(true)}>
                  Gerenciar
                </Button>
              </div>
            </div>

            {/* Responsáveis via busca */}
            <div className="space-y-2">
              <Label>Responsáveis</Label>
              <div className="text-xs text-white/70">Pesquise usuários para associar e defina o principal.</div>
              <div className="flex items-center gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Buscar usuários por nome ou e-mail..."
                  className="bg-white text-black"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {userResults.map((u) => {
                  const photoRel = normalizePhotoRel(u.profile_photo_path || null);
                  const url = photoRel ? `${API_URL}/${photoRel}` : null;
                  return (
                    <button
                      key={u.username}
                      type="button"
                      onClick={() => addResponsibleFromUser(u)}
                      className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-left hover:bg-white/20"
                      title={`Adicionar ${u.full_name}`}
                    >
                      <Avatar className="h-8 w-8">
                        {url ? <AvatarImage src={url} alt={u.full_name} /> : <AvatarFallback>👤</AvatarFallback>}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name}</div>
                        <div className="text-xs text-white/80 truncate">{u.username}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {responsibles.map((r, idx) => {
                  const url = r.photo_rel ? `${API_URL}/${r.photo_rel}` : null;
                  return (
                    <div key={`root-resp-${r.username || r.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1">
                      <button
                        type="button"
                        className={`text-xs rounded-sm px-2 py-0.5 ${primaryIndex === idx ? "bg-[#10b981] text-white" : "bg-white/20 text-white"}`}
                        onClick={() => setPrimary(idx)}
                        title="Definir como principal"
                      >
                        {primaryIndex === idx ? "Principal" : "Tornar principal"}
                      </button>
                      <Avatar className="h-6 w-6">
                        {url ? <AvatarImage src={url} alt={r.name} /> : <AvatarFallback>👤</AvatarFallback>}
                      </Avatar>
                      <span className="text-xs">{r.name}</span>
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:text-red-400"
                        onClick={() => removeResponsible(idx)}
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  );
                })}
                {responsibles.length === 0 && <span className="text-xs text-white/70">Nenhum responsável ainda.</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setOpenNewRoot(false)}>Cancelar</Button>
              <Button onClick={saveRoot}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de novo dependente */}
      <Dialog open={openNewChild} onOpenChange={setOpenNewChild}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Nova Filial</DialogTitle>
            <DialogDescription className="text-white/80">
              Responsáveis do pai e dos níveis acima são herdados automaticamente. Você pode adicionar novos via busca.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sala de Reunião" className="bg:white text:black" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-md border border-white/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resumo do ambiente" className="bg:white text:black" />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <select value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black">
                  <option value="">Selecione</option>
                  {categories.map((c) => (
                    <option key={`child-cat-${c}`} value={c}>{c}</option>
                  ))}
                </select>
                <Button variant="outline" className="border-white/30 bg-white/10 text:white hover:bg:white/20" onClick={() => setOpenCatManager(true)}>
                  Gerenciar
                </Button>
              </div>
            </div>

            {/* Responsáveis via busca */}
            <div className="space-y-2">
              <Label>Responsáveis</Label>
              <div className="text-xs text-white/70">
                Herdados do pai e dos níveis acima; você pode adicionar novos via busca abaixo.
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Buscar usuários por nome ou e-mail..."
                  className="bg-white text-black"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {userResults.map((u) => {
                  const photoRel = normalizePhotoRel(u.profile_photo_path || null);
                  const url = photoRel ? `${API_URL}/${photoRel}` : null;
                  return (
                    <button
                      key={`child-${u.username}`}
                      type="button"
                      onClick={() => addResponsibleFromUser(u)}
                      className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-left hover:bg-white/20"
                      title={`Adicionar ${u.full_name}`}
                    >
                      <Avatar className="h-8 w-8">
                        {url ? <AvatarImage src={url} alt={u.full_name} /> : <AvatarFallback>👤</AvatarFallback>}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name}</div>
                        <div className="text-xs text-white/80 truncate">{u.username}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {responsibles.map((r, idx) => {
                  const url = r.photo_rel ? `${API_URL}/${r.photo_rel}` : null;
                  return (
                    <div key={`child-resp-${r.username || r.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1">
                      <button
                        type="button"
                        className={`text-xs rounded-sm px-2 py-0.5 ${primaryIndex === idx ? "bg-[#10b981] text-white" : "bg-white/20 text-white"}`}
                        onClick={() => setPrimary(idx)}
                        title="Definir como principal"
                      >
                        {primaryIndex === idx ? "Principal" : "Tornar principal"}
                      </button>
                      <Avatar className="h-6 w-6">
                        {url ? <AvatarImage src={url} alt={r.name} /> : <AvatarFallback>👤</AvatarFallback>}
                      </Avatar>
                      <span className="text-xs">{r.name}</span>
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:text-red-400"
                        onClick={() => removeResponsible(idx)}
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  );
                })}
                {responsibles.length === 0 && <span className="text-xs text:white/70">Nenhum responsável ainda.</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setOpenNewChild(false)}>Cancelar</Button>
              <Button onClick={saveChild}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={openEdit} onOpenChange={(o) => { setOpenEdit(o); if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Editar Unidade</DialogTitle>
            <DialogDescription className="text-white/80">Atualize os dados desta unidade.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da unidade" className="bg-white text-black" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-md border border-white/20" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resumo" className="bg-white text-black" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <select value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black">
                  <option value="">Selecione</option>
                  {categories.map((c) => (
                    <option key={`edit-cat-${c}`} value={c}>{c}</option>
                  ))}
                </select>
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setOpenCatManager(true)}>
                  Gerenciar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsáveis</Label>
              <div className="flex items-center gap-2">
                <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Buscar usuários por nome ou e-mail..." className="bg-white text-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {userResults.map((u) => {
                  const photoRel = normalizePhotoRel(u.profile_photo_path || null);
                  const url = photoRel ? `${API_URL}/${photoRel}` : null;
                  return (
                    <button
                      key={`edit-${u.username}`} type="button" onClick={() => addResponsibleFromUser(u)}
                      className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-left hover:bg-white/20" title={`Adicionar ${u.full_name}`}
                    >
                      <Avatar className="h-8 w-8">{url ? <AvatarImage src={url} alt={u.full_name} /> : <AvatarFallback>👤</AvatarFallback>}</Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.full_name}</div>
                        <div className="text-xs text-white/80 truncate">{u.username}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {responsibles.map((r, idx) => {
                  const url = r.photo_rel ? `${API_URL}/${r.photo_rel}` : null;
                  return (
                    <div key={`edit-resp-${r.username || r.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1">
                      <button type="button" className={`text-xs rounded-sm px-2 py-0.5 ${primaryIndex === idx ? "bg-[#10b981] text-white" : "bg-white/20 text-white"}`} onClick={() => setPrimary(idx)} title="Definir como principal">
                        {primaryIndex === idx ? "Principal" : "Tornar principal"}
                      </button>
                      <Avatar className="h-6 w-6">{url ? <AvatarImage src={url} alt={r.name} /> : <AvatarFallback>👤</AvatarFallback>}</Avatar>
                      <span className="text-xs">{r.name}</span>
                      <button type="button" className="text-xs text-red-300 hover:text-red-400" onClick={() => removeResponsible(idx)} title="Remover">Remover</button>
                    </div>
                  );
                })}
                {responsibles.length === 0 && <span className="text-xs text-white/70">Nenhum responsável ainda.</span>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setOpenEdit(false)}>Cancelar</Button>
              <Button onClick={saveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Unidade</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Confirma a exclusão da unidade "{deleteTarget?.name}" e suas dependências?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de gerenciamento de categorias */}
      <Dialog open={openCatManager} onOpenChange={setOpenCatManager}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Categorias</DialogTitle>
            <DialogDescription className="text-white/80">Adicione ou remova categorias da lista.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nova categoria"
                className="bg-white text-black"
              />
              <Button className="bg-white/20 text-white hover:bg:white/25" onClick={addCategory}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {categories.length ? categories.map((c) => (
                <div key={`mgr-cat-${c}`} className="flex items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 py-2">
                  <span className="text-sm">{c}</span>
                  <Button variant="destructive" size="sm" onClick={() => removeCategory(c)}>Remover</Button>
                </div>
              )) : (
                <div className="text-xs text-white/70">Nenhuma categoria cadastrada.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HierarchyPage;