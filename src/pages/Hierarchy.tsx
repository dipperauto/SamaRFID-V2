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
import { Plus, Search, Layers, UserCheck } from "lucide-react";

type Responsible = { name: string; isPrimary?: boolean };
type LocationNode = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  category?: string;
  responsibles: Responsible[];
  children: LocationNode[];
  parentId?: string | null;
};

const LS_NODES = "hierarchy.nodes";
const LS_CATEGORIES = "hierarchy.categories";

function genId() {
  return `loc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function loadNodes(): LocationNode[] {
  try {
    const raw = localStorage.getItem(LS_NODES);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function saveNodes(nodes: LocationNode[]) {
  localStorage.setItem(LS_NODES, JSON.stringify(nodes));
}

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(LS_CATEGORIES);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function saveCategories(categories: string[]) {
  localStorage.setItem(LS_CATEGORIES, JSON.stringify(categories));
}

// Monta cadeia de responsáveis herdada: pai (principal primeiro), depois demais, e ancestrais acima, sem duplicar
function buildInheritedResponsibles(nodes: LocationNode[], parentId: string | null | undefined): Responsible[] {
  if (!parentId) return [];
  const map = new Map<string, LocationNode>();
  const indexAll = (list: LocationNode[]) => {
    for (const n of list) {
      map.set(n.id, n);
      if (n.children?.length) indexAll(n.children);
    }
  };
  indexAll(nodes);

  const chain: LocationNode[] = [];
  let cur = parentId ? map.get(parentId) || null : null;
  while (cur) {
    chain.push(cur);
    cur = cur.parentId ? map.get(cur.parentId) || null : null;
  }

  const ordered: Responsible[] = [];
  const added = new Set<string>();
  for (const loc of chain) {
    // principal primeiro
    const primary = loc.responsibles.find((r) => r.isPrimary);
    if (primary && !added.has(primary.name)) {
      ordered.push({ name: primary.name, isPrimary: false });
      added.add(primary.name);
    }
    for (const r of loc.responsibles) {
      if (!added.has(r.name)) {
        ordered.push({ name: r.name, isPrimary: false });
        added.add(r.name);
      }
    }
  }
  return ordered;
}

const HierarchyPage: React.FC = () => {
  const [nodes, setNodes] = React.useState<LocationNode[]>(() => loadNodes());
  const [categories, setCategories] = React.useState<string[]>(() => loadCategories());

  const [search, setSearch] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<string>("");
  const [filterResponsible, setFilterResponsible] = React.useState<string>("");

  const [openNewRoot, setOpenNewRoot] = React.useState(false);
  const [openNewChild, setOpenNewChild] = React.useState(false);
  const [parentForNewChild, setParentForNewChild] = React.useState<LocationNode | null>(null);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("#0ea5e9"); // default azul
  const [categoryInput, setCategoryInput] = React.useState("");
  const [primaryIndex, setPrimaryIndex] = React.useState<number>(-1);
  const [responsibleName, setResponsibleName] = React.useState("");
  const [responsibles, setResponsibles] = React.useState<Responsible[]>([]);

  React.useEffect(() => {
    saveNodes(nodes);
  }, [nodes]);

  React.useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#0ea5e9");
    setCategoryInput("");
    setPrimaryIndex(-1);
    setResponsibleName("");
    setResponsibles([]);
  };

  const openChildDialog = (parent: LocationNode) => {
    setParentForNewChild(parent);
    // Herdar responsáveis do pai e ancestrais
    const inherited = buildInheritedResponsibles(nodes, parent.id);
    setResponsibles(inherited);
    setPrimaryIndex(inherited.length > 0 ? 0 : -1); // principal inicial herdado (primeiro da lista)
    resetForm(); // reseta campos, mas mantém herdados
    setResponsibles(inherited);
    setPrimaryIndex(inherited.length > 0 ? 0 : -1);
    setOpenNewChild(true);
  };

  const openRootDialog = () => {
    setParentForNewChild(null);
    resetForm();
    setOpenNewRoot(true);
  };

  const addResponsible = () => {
    const nameTrim = responsibleName.trim();
    if (!nameTrim) return;
    if (responsibles.find((r) => r.name.toLowerCase() === nameTrim.toLowerCase())) {
      toast.error("Responsável já adicionado.");
      return;
    }
    const next = [...responsibles, { name: nameTrim }];
    setResponsibles(next);
    if (primaryIndex === -1) setPrimaryIndex(0);
    setResponsibleName("");
  };

  const removeResponsible = (idx: number) => {
    const next = responsibles.slice();
    next.splice(idx, 1);
    setResponsibles(next);
    if (primaryIndex === idx) setPrimaryIndex(next.length ? 0 : -1);
    else if (primaryIndex > idx) setPrimaryIndex(primaryIndex - 1);
  };

  const setPrimary = (idx: number) => {
    setPrimaryIndex(idx);
  };

  const ensureCategoryInList = (cat: string) => {
    const c = cat.trim();
    if (!c) return;
    if (!categories.find((x) => x.toLowerCase() === c.toLowerCase())) {
      setCategories((prev) => [...prev, c]);
    }
  };

  const handleSave = (isChild: boolean) => {
    const nm = name.trim();
    if (!nm) {
      toast.error("Informe o nome do local.");
      return;
    }
    // marcar principal
    const finalResponsibles: Responsible[] = responsibles.map((r, i) => ({ ...r, isPrimary: i === primaryIndex }));
    if (finalResponsibles.length === 0) {
      toast.error("Informe pelo menos um responsável.");
      return;
    }
    const cat = categoryInput.trim();
    if (cat) ensureCategoryInList(cat);

    const node: LocationNode = {
      id: genId(),
      name: nm,
      description: description.trim() || undefined,
      color,
      category: cat || undefined,
      responsibles: finalResponsibles,
      children: [],
      parentId: isChild && parentForNewChild ? parentForNewChild.id : null,
    };

    setNodes((prev) => {
      if (!isChild || !parentForNewChild) {
        return [...prev, node];
      }
      // inserir como filho do pai
      const addChild = (list: LocationNode[]): LocationNode[] =>
        list.map((n) => {
          if (n.id === parentForNewChild.id) {
            return { ...n, children: [...n.children, node] };
          }
          if (n.children?.length) {
            return { ...n, children: addChild(n.children) };
          }
          return n;
        });
      return addChild(prev);
    });

    toast.success(isChild ? "Filial adicionada com sucesso!" : "Local raiz adicionado com sucesso!");
    setOpenNewChild(false);
    setOpenNewRoot(false);
    setParentForNewChild(null);
    resetForm();
  };

  // Filtros e busca aplicados ao render
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
    const okResp = resp ? node.responsibles.some((r) => r.name.toLowerCase().includes(resp)) : true;
    return okSearch && okCat && okResp;
  };

  // Render recursivo da árvore com item
  const renderNode = (node: LocationNode, level: number = 0): React.ReactNode => {
    const inherited = buildInheritedResponsibles(nodes, node.parentId);
    // Cadeia completa: principal do próprio primeiro
    const chainNames: string[] = [];
    const ownPrimary = node.responsibles.find((r) => r.isPrimary)?.name;
    const remainderOwn = node.responsibles.filter((r) => !r.isPrimary).map((r) => r.name);
    if (ownPrimary) chainNames.push(ownPrimary);
    chainNames.push(...remainderOwn);
    for (const inh of inherited) {
      if (!chainNames.includes(inh.name)) chainNames.push(inh.name);
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
                Responsáveis (em ordem de colocação):
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {chainNames.map((nm, idx) => (
                  <Badge key={`${node.id}-resp-${nm}-${idx}`} variant={idx === 0 ? "default" : "outline"} className={idx === 0 ? "bg-[#10b981] text-white" : "bg-white/10 text-white"}>
                    {idx + 1}. {nm}{idx === 0 ? " (principal)" : ""}
                  </Badge>
                ))}
                {chainNames.length === 0 && <span className="text-white/70">—</span>}
              </div>
            </div>
          </div>
          {/* Botão adicionar dependente */}
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => openChildDialog(node)}
              title="Adicionar filial (dependente)"
            >
              <Plus className="h-4 w-4" />
            </Button>
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

  const filteredRoots = nodes.filter((n) => !n.parentId);

  return (
    <div className="min-h-screen w-full overflow-hidden p-4">
      <div className="relative z-10 space-y-4">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Hierarquias de Localidades
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Botão separado para adicionar locais raiz */}
                <Button
                  className="bg-white/20 text-white hover:bg-white/25"
                  onClick={openRootDialog}
                  title="Adicionar local raiz"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Raiz
                </Button>
              </div>
            </div>

            {/* Ajuda lúdica */}
            <div className="mt-3 text-xs text-white/80">
              Crie sua hierarquia de ambientes em cascata. Use o botão “Adicionar Raiz” para os primeiros níveis.
              Depois, clique no “+” à direita de qualquer item para adicionar um dependente (filial) sob ele.
              Cada novo ambiente pede nome, descrição, cor, responsáveis (defina o principal) e categoria.
              Filiais herdam responsáveis do ambiente pai e dos níveis acima, mantendo a ordem (principal primeiro).
            </div>
          </CardHeader>

          <CardContent>
            {/* Filtros e busca */}
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
              {/* Lista rápida de categorias para clique */}
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

            {/* Árvore de raízes */}
            <div className="space-y-3">
              {filteredRoots.length ? (
                filteredRoots.map((root) => renderNode(root, 0))
              ) : (
                <div className="text-sm text-white/80">
                  Nenhum local cadastrado. Clique em “Adicionar Raiz” para começar.
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
            <DialogTitle>Novo Local Raiz</DialogTitle>
            <DialogDescription className="text-white/80">Preencha os dados do ambiente.</DialogDescription>
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
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resumo do ambiente" className="bg-white text-black" />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <Input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} placeholder="Digite ou escolha uma categoria" className="bg-white text-black" />
                <div className="flex flex-wrap gap-1">
                  {categories.map((c) => (
                    <button key={`root-cat-${c}`} type="button" className="text-xs rounded-md border bg-white/10 text-white px-2 py-1 hover:bg-white/20" onClick={() => setCategoryInput(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Responsáveis */}
            <div className="space-y-2">
              <Label>Responsáveis</Label>
              <div className="flex items-center gap-2">
                <Input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome do responsável" className="bg-white text-black" />
                <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={addResponsible}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {responsibles.map((r, idx) => (
                  <div key={`root-resp-${r.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1">
                    <button
                      type="button"
                      className={`text-xs rounded-sm px-2 py-0.5 ${primaryIndex === idx ? "bg-[#10b981] text-white" : "bg-white/20 text-white"}`}
                      onClick={() => setPrimary(idx)}
                      title="Definir como principal"
                    >
                      {primaryIndex === idx ? "Principal" : "Tornar principal"}
                    </button>
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
                ))}
                {responsibles.length === 0 && <span className="text-xs text-white/70">Nenhum responsável ainda.</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setOpenNewRoot(false)}>Cancelar</Button>
              <Button onClick={() => handleSave(false)}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de novo dependente */}
      <Dialog open={openNewChild} onOpenChange={setOpenNewChild}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Novo Dependente</DialogTitle>
            <DialogDescription className="text-white/80">
              Adicione um ambiente filial ao pai selecionado. Responsáveis do pai e dos níveis acima são herdados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sala de Reunião" className="bg-white text-black" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-md border border-white/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Resumo do ambiente" className="bg-white text-black" />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <Input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} placeholder="Digite ou escolha uma categoria" className="bg-white text-black" />
                <div className="flex flex-wrap gap-1">
                  {categories.map((c) => (
                    <button key={`child-cat-${c}`} type="button" className="text-xs rounded-md border bg-white/10 text-white px-2 py-1 hover:bg-white/20" onClick={() => setCategoryInput(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Responsáveis (herdáveis + novos) */}
            <div className="space-y-2">
              <Label>Responsáveis</Label>
              <div className="text-xs text-white/70">
                Herdados do pai e ancestrais são listados abaixo. Você pode adicionar novos e escolher o principal.
              </div>
              <div className="flex items-center gap-2">
                <Input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome do responsável" className="bg-white text-black" />
                <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={addResponsible}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {responsibles.map((r, idx) => (
                  <div key={`child-resp-${r.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1">
                    <button
                      type="button"
                      className={`text-xs rounded-sm px-2 py-0.5 ${primaryIndex === idx ? "bg-[#10b981] text-white" : "bg-white/20 text-white"}`}
                      onClick={() => setPrimary(idx)}
                      title="Definir como principal"
                    >
                      {primaryIndex === idx ? "Principal" : "Tornar principal"}
                    </button>
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
                ))}
                {responsibles.length === 0 && <span className="text-xs text-white/70">Nenhum responsável ainda.</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90" onClick={() => setOpenNewChild(false)}>Cancelar</Button>
              <Button onClick={() => handleSave(true)}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HierarchyPage;