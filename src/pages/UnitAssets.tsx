"use client";

import React from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Search, Plus, Image as ImageIcon, ChevronsRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PhotoCropper from "@/components/PhotoCropper";
// ADDED: edição e confirmação
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

type Asset = {
  id: number;
  unit_id: string;
  name: string;
  description: string;
  qr_code?: string;
  rfid_code?: string;
  item_code?: string;
  category?: string;
  notes?: string;
  photo_path?: string;
  quantity?: number | null;
  unit?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // ADDED: para visão consolidada
  unit_path?: string;
};

const unitsList = ["Unidade", "Kg", "g", "Metro", "cm", "Litros"];

const UnitAssetsPage: React.FC = () => {
  const { unitId } = useParams();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [q, setQ] = React.useState<string>("");
  const [sort, setSort] = React.useState<"name_asc"|"name_desc"|"created_desc"|"created_asc">("name_asc");

  // ADDED: visão consolidada
  const [includeSubUnits, setIncludeSubUnits] = React.useState<boolean>(false);
  const [hierarchyFilter, setHierarchyFilter] = React.useState<string>("");
  const [allUnits, setAllUnits] = React.useState<any[]>([]);

  const [categories, setCategories] = React.useState<string[]>([]);
  const [filterCategory, setFilterCategory] = React.useState<string>("");

  const [openNew, setOpenNew] = React.useState<boolean>(false);
  // ADDED: modo edição, edição e seleção
  const [editMode, setEditMode] = React.useState<boolean>(false);
  const [openEdit, setOpenEdit] = React.useState<boolean>(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<number | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

  const [name, setName] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [qrCode, setQrCode] = React.useState<string>("");
  const [rfidCode, setRfidCode] = React.useState<string>("");
  const [itemCode, setItemCode] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [photoBase64, setPhotoBase64] = React.useState<string | null>(null);
  // ADDED: quantidade e unidade
  const [quantity, setQuantity] = React.useState<number>(1);
  const [unit, setUnit] = React.useState<string>("Unidade");

  const [openCatMgr, setOpenCatMgr] = React.useState<boolean>(false);
  const [newCategory, setNewCategory] = React.useState<string>("");

  const genItemCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setItemCode(code);
  };

  // Helpers de seleção
  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    // confirma via dialog
    setDeleteTarget(-1); // -1 como marcador para bulk
  };

  // Abrir edição com dados
  const openEditAsset = (a: Asset) => {
    setEditId(a.id);
    setName(a.name);
    setDescription(a.description);
    setQrCode(a.qr_code || "");
    setRfidCode(a.rfid_code || "");
    setItemCode(a.item_code || "");
    setCategory(a.category || "");
    setNotes(a.notes || "");
    setPhotoBase64(null);
    setQuantity(typeof a.quantity === "number" ? a.quantity : 1);
    setUnit(a.unit || "Unidade");
    setOpenEdit(true);
  };

  const loadData = React.useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const endpoint = includeSubUnits
        ? `${API_URL}/api/units/all/assets`
        : `${API_URL}/api/units/${unitId}/assets`;
      
      const qs = new URLSearchParams({ q, sort });
      const res = await fetch(`${endpoint}?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (includeSubUnits) {
        const hierarchyRes = await fetch(`${API_URL}/api/hierarchy`, { credentials: "include" });
        const hierarchyData = await hierarchyRes.json();
        const allNodes = hierarchyData.nodes || [];
        setAllUnits(allNodes);

        const getSubUnitIds = (startId: string): string[] => {
          const ids: string[] = [];
          const queue: string[] = [startId];
          const visited: Set<string> = new Set();

          const childrenMap = new Map<string, string[]>();
          allNodes.forEach((node: any) => {
            if (node.parentId) {
              if (!childrenMap.has(node.parentId)) {
                childrenMap.set(node.parentId, []);
              }
              childrenMap.get(node.parentId)!.push(node.id);
            }
          });
          
          const allChildrenOf = (id: string): string[] => {
            const res: string[] = [];
            const q = [id];
            while(q.length > 0) {
              const curr = q.shift()!;
              const children = childrenMap.get(curr) || [];
              res.push(...children);
              q.push(...children);
            }
            return res;
          }

          return [startId, ...allChildrenOf(startId)];
        };
        
        const targetUnitIds = getSubUnitIds(unitId);
        
        const allAssets = (data?.assets ?? []) as Asset[];

        const getUnitPath = (id: string, nodes: any[]): string => {
          const map = new Map(nodes.map(n => [n.id, n]));
          let path = [];
          let current = map.get(id);
          while(current) {
            path.unshift(current.name);
            current = current.parentId ? map.get(current.parentId) : null;
          }
          return path.join(" > ");
        };

        const filteredAssets = allAssets
          .filter(a => targetUnitIds.includes(a.unit_id))
          .map(a => ({ ...a, unit_path: getUnitPath(a.unit_id, allNodes) }));

        setAssets(filteredAssets);

      } else {
        setAssets((data?.assets ?? []) as Asset[]);
      }

    } catch {
      toast.error("Falha ao carregar ativos.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, unitId, q, sort, includeSubUnits]);

  const loadCategories = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/asset-categories`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setCategories((data?.categories ?? []) as string[]);
    } catch {}
  }, [API_URL]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const saveAsset = async () => {
    if (!unitId) return;
    if (!name.trim() || !description.trim() || !itemCode.trim()) {
      toast.error("Preencha os campos obrigatórios (Nome, Descrição, Código do Item).");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim(),
      qr_code: qrCode.trim() || undefined,
      rfid_code: rfidCode.trim() || undefined,
      item_code: itemCode.trim(),
      category: category.trim() || undefined,
      notes: notes.trim() || undefined,
      photo_base64: photoBase64 || undefined,
      // ADDED: quantidade e unidade
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      unit: unit || undefined,
    };
    const res = await fetch(`${API_URL}/api/units/${unitId}/assets`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao salvar ativo.");
      return;
    }
    toast.success("Ativo cadastrado com sucesso!");
    setOpenNew(false);
    setName(""); setDescription(""); setQrCode(""); setRfidCode(""); setItemCode(""); setCategory(""); setNotes(""); setPhotoBase64(null);
    setQuantity(1); setUnit("Unidade");
    await loadData();
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (!name.trim() || !description.trim() || !itemCode.trim()) {
      toast.error("Preencha os campos obrigatórios (Nome, Descrição, Código do Item).");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim(),
      qr_code: qrCode.trim() || undefined,
      rfid_code: rfidCode.trim() || undefined,
      item_code: itemCode.trim(),
      category: category.trim() || undefined,
      notes: notes.trim() || undefined,
      photo_base64: photoBase64 || undefined,
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      unit: unit || undefined,
    };
    const res = await fetch(`${API_URL}/api/assets/${editId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao atualizar ativo.");
      return;
    }
    toast.success("Ativo atualizado!");
    setOpenEdit(false);
    setEditId(null);
    await loadData();
  };

  const deleteOne = async (id: number) => {
    const res = await fetch(`${API_URL}/api/assets/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao excluir ativo.");
      return;
    }
    toast.success("Ativo excluído.");
    await loadData();
  };

  const confirmDelete = async () => {
    if (deleteTarget === null) return;
    if (deleteTarget === -1) {
      // bulk
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await fetch(`${API_URL}/api/assets/${id}`, { method: "DELETE", credentials: "include" });
      }
      toast.success("Exclusão em massa concluída.");
      clearSelection();
      setDeleteTarget(null);
      await loadData();
      return;
    }
    await deleteOne(deleteTarget);
    setDeleteTarget(null);
  };

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const hFilter = hierarchyFilter.trim().toLowerCase();
    return assets.filter(a => {
      const text = [a.name, a.description, a.item_code || "", a.category || ""].join(" ").toLowerCase();
      const okTerm = term ? text.includes(term) : true;
      const okCat = filterCategory ? (a.category || "").toLowerCase() === filterCategory.toLowerCase() : true;
      const okHierarchy = includeSubUnits && hFilter ? (a.unit_path || "").toLowerCase().includes(hFilter) : true;
      return okTerm && okCat && okHierarchy;
    });
  }, [assets, q, filterCategory, includeSubUnits, hierarchyFilter]);

  const sorted = React.useMemo(() => {
    const list = [...filtered];
    if (sort === "name_asc") list.sort((a,b)=>a.name.localeCompare(b.name));
    else if (sort === "name_desc") list.sort((a,b)=>b.name.localeCompare(a.name));
    else if (sort === "created_desc") list.sort((a,b)=> (b.created_at || "").localeCompare(a.created_at || ""));
    else list.sort((a,b)=> (a.created_at || "").localeCompare(b.created_at || ""));
    return list;
  }, [filtered, sort]);

  const photoUrl = (p?: string) => {
    if (!p) return null;
    const path = p.replace(/\\/g, "/").replace(/^\/+/, "");
    const web = path.startsWith("static/") ? path : (path.startsWith("media/") ? path.replace(/^media\//, "static/") : `static/${path}`);
    return `${API_URL}/${web}`;
  };

  const addCategory = async () => {
    const nm = newCategory.trim();
    if (!nm) return;
    const res = await fetch(`${API_URL}/api/asset-categories`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm }),
    });
    if (!res.ok) {
      toast.error("Falha ao adicionar categoria.");
      return;
    }
    const data = await res.json();
    setCategories((data?.categories ?? []) as string[]);
    setNewCategory("");
    toast.success("Categoria adicionada.");
  };

  const removeCategory = async (nm: string) => {
    const res = await fetch(`${API_URL}/api/asset-categories`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm }),
    });
    if (!res.ok) {
      toast.error("Falha ao remover categoria.");
      return;
    }
    const data = await res.json();
    setCategories((data?.categories ?? []) as string[]);
    toast.success("Categoria removida.");
  };

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl md:text-2xl">Ativos da Unidade</CardTitle>
              <div className="flex items-center gap-2">
                <Button className="bg-white/20 text-white hover:bg-white/25" onClick={() => setOpenNew(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ativo
                </Button>
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setOpenCatMgr(true)}>
                  Categorias
                </Button>
                {/* Toggle de modo edição */}
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs text-white/80">Modo edição</span>
                  <Switch checked={editMode} onCheckedChange={setEditMode} />
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/80">Cadastre e gerencie ativos desta unidade. Use pesquisa, filtros e ordenação para localizar itens rapidamente.</div>
          </CardHeader>

          <CardContent>
            {/* Filtros */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
                  <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Pesquisar por nome, código, categoria..." className="w-72 pl-9 bg-white/20 text-white placeholder:text-white/70 border-white/25" />
                </div>
                <select value={filterCategory} onChange={(e)=>setFilterCategory(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black">
                  <option value="">Todas as categorias</option>
                  {categories.map((c)=><option key={`f-cat-${c}`} value={c}>{c}</option>)}
                </select>
                <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="rounded-md border px-2 py-2 bg-white text-black">
                  <option value="name_asc">Nome ↑</option>
                  <option value="name_desc">Nome ↓</option>
                  <option value="created_desc">Mais recentes</option>
                  <option value="created_asc">Mais antigos</option>
                </select>
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={loadData}>Aplicar</Button>
              </div>
              {/* ADDED: toggle e filtro de hierarquia */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/80">Incluir filiais</span>
                  <Switch checked={includeSubUnits} onCheckedChange={setIncludeSubUnits} />
                </div>
                {includeSubUnits && (
                  <Input value={hierarchyFilter} onChange={(e)=>setHierarchyFilter(e.target.value)} placeholder="Filtrar por unidade..." className="w-48 bg-white/20 text-white placeholder:text-white/70 border-white/25" />
                )}
              </div>
            </div>

            <Separator className="my-4 bg-white/20" />

            {loading ? (
              <div className="text-sm text-white/80">Carregando...</div>
            ) : sorted.length === 0 ? (
              <div className="text-sm text:white/80">Nenhum ativo encontrado.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sorted.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/20 bg-white/10 p-3 text-white space-y-2">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 ring-1 ring-white/30">
                        {photoUrl(a.photo_path) ? <AvatarImage src={photoUrl(a.photo_path) || ""} alt={a.name} /> : <AvatarFallback><ImageIcon className="h-6 w-6" /></AvatarFallback>}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold truncate">{a.name}</div>
                          {a.category ? <Badge variant="outline" className="bg-white/10 text:white">{a.category}</Badge> : null}
                        </div>
                        <div className="text-xs text-white/80 line-clamp-2">{a.description}</div>
                        <div className="text-xs text-white/70">Código: {a.item_code || "—"}</div>
                        <div className="text-xs text-white/70">QR: {a.qr_code || "—"} • RFID: {a.rfid_code || "—"}</div>
                        {/* ADDED: quantidade e unidade */}
                        <div className="text-xs text-white/70">Quantidade: {typeof a.quantity === "number" ? a.quantity : "—"} {a.unit || ""}</div>
                        {/* ADDED: caminho da unidade */}
                        {includeSubUnits && a.unit_path && (
                          <div className="text-xs text-cyan-300 mt-1 flex items-center gap-1">
                            <ChevronsRight className="h-3 w-3" /> {a.unit_path}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Ações em modo edição */}
                    {editMode && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedIds.has(a.id)}
                            onCheckedChange={(c)=> toggleSelected(a.id, !!c)}
                          />
                          <span className="text-xs">Selecionar</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={()=>openEditAsset(a)}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={()=>setDeleteTarget(a.id)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal categorias */}
      <Dialog open={openCatMgr} onOpenChange={setOpenCatMgr}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Categorias de Ativos</DialogTitle>
            <DialogDescription className="text-white/80">Gerencie a lista de categorias.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={newCategory} onChange={(e)=>setNewCategory(e.target.value)} placeholder="Nova categoria" className="bg-white text-black w-full" />
              <Button className="bg-white/20 text-white hover:bg-white/25" onClick={addCategory}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {categories.length ? categories.map((c)=>(
                <div key={`mgr-cat-${c}`} className="flex items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 py-2">
                  <span className="text-sm">{c}</span>
                  <Button variant="destructive" size="sm" onClick={()=>removeCategory(c)}>Remover</Button>
                </div>
              )) : (
                <div className="text-xs text-white/70">Nenhuma categoria cadastrada.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal novo ativo (fix de classes e layout) */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Novo Ativo</DialogTitle>
            <DialogDescription className="text-white/80">Preencha os dados do ativo da unidade.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nome do ativo" className="bg-white text-black w-full" />
              </div>
              <div className="space-y-2">
                <Label>Código do Item</Label>
                <div className="flex items-center gap-2">
                  <Input value={itemCode} onChange={(e)=>setItemCode(e.target.value)} placeholder="Código (10 dígitos)" className="bg-white text-black w-full" />
                  <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={genItemCode}>Gerar</Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Descrição do ativo" className="bg-white text-black w-full" />
            </div>

            {/* Quantidade e Unidade com largura correta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={0} step={0.01} value={quantity} onChange={(e)=>setQuantity(Number(e.target.value || 0))} className="bg-white text-black w-full" />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <select value={unit} onChange={(e)=>setUnit(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black w-full">
                  {unitsList.map((u)=> <option key={`unit-${u}`} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>QR Code</Label>
                <Input value={qrCode} onChange={(e)=>setQrCode(e.target.value)} placeholder="Código QR (opcional)" className="bg-white text-black w-full" />
              </div>
              <div className="space-y-2">
                <Label>RFID</Label>
                <Input value={rfidCode} onChange={(e)=>setRfidCode(e.target.value)} placeholder="Código RFID (opcional)" className="bg-white text-black w-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex items-center gap-2">
                  <select value={category} onChange={(e)=>setCategory(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black w-full">
                    <option value="">Selecione</option>
                    {categories.map((c)=><option key={`cat-${c}`} value={c}>{c}</option>)}
                  </select>
                  <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={()=>setOpenCatMgr(true)}>Gerenciar</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Observações (opcional)" className="bg-white text-black w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Foto do Item</Label>
              <PhotoCropper initialImage={null} onChange={(data)=>setPhotoBase64(data)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={()=>setOpenNew(false)}>Cancelar</Button>
              <Button onClick={saveAsset}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal editar ativo (mesmo layout do novo, com dados) */}
      <Dialog open={openEdit} onOpenChange={(o)=>{ setOpenEdit(o); if (!o) setEditId(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Editar Ativo</DialogTitle>
            <DialogDescription className="text-white/80">Atualize os dados do ativo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Repetir os mesmos campos do modal de novo ativo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nome do ativo" className="bg-white text-black w-full" />
              </div>
              <div className="space-y-2">
                <Label>Código do Item</Label>
                <div className="flex items-center gap-2">
                  <Input value={itemCode} onChange={(e)=>setItemCode(e.target.value)} placeholder="Código (10 dígitos)" className="bg-white text-black w-full" />
                  <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={genItemCode}>Gerar</Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Descrição do ativo" className="bg-white text-black w-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={0} step={0.01} value={quantity} onChange={(e)=>setQuantity(Number(e.target.value || 0))} className="bg-white text-black w-full" />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <select value={unit} onChange={(e)=>setUnit(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black w-full">
                  {unitsList.map((u)=> <option key={`unit-edit-${u}`} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>QR Code</Label>
                <Input value={qrCode} onChange={(e)=>setQrCode(e.target.value)} placeholder="Código QR (opcional)" className="bg-white text-black w-full" />
              </div>
              <div className="space-y-2">
                <Label>RFID</Label>
                <Input value={rfidCode} onChange={(e)=>setRfidCode(e.target.value)} placeholder="Código RFID (opcional)" className="bg-white text-black w-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex items-center gap-2">
                  <select value={category} onChange={(e)=>setCategory(e.target.value)} className="rounded-md border px-2 py-2 bg-white text-black w-full">
                    <option value="">Selecione</option>
                    {categories.map((c)=><option key={`cat-edit-${c}`} value={c}>{c}</option>)}
                  </select>
                  <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={()=>setOpenCatMgr(true)}>Gerenciar</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Observações (opcional)" className="bg-white text-black w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Foto do Item</Label>
              <PhotoCropper initialImage={null} onChange={(data)=>setPhotoBase64(data)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={()=>setOpenEdit(false)}>Cancelar</Button>
              <Button onClick={saveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão (individual ou massa) */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o)=>{ if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ativo{deleteTarget === -1 ? "s selecionados" : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Confirma a exclusão {deleteTarget === -1 ? "dos ativos selecionados" : "deste ativo"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UnitAssetsPage;