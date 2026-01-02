"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search } from "lucide-react";

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
  unit_path?: string;
};

const Home: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "https://sama.dipperauto.com";
  const [openSearch, setOpenSearch] = React.useState(false);
  const [searchCode, setSearchCode] = React.useState("");
  const [foundAsset, setFoundAsset] = React.useState<Asset | null>(null);
  const [searchStatus, setSearchStatus] = React.useState<"idle" | "searching" | "not_found">("idle");
  const [matchedBy, setMatchedBy] = React.useState<string | null>(null);

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = searchCode.trim();
    if (!code) return;

    setSearchStatus("searching");
    setFoundAsset(null);
    setMatchedBy(null);

    try {
      const res = await fetch(`${API_URL}/api/units/all/assets`, { credentials: "include" });
      if (!res.ok) {
        toast.error("Falha ao buscar ativos.");
        setSearchStatus("idle");
        return;
      }
      const data = await res.json();
      const allAssets = (data?.assets ?? []) as Asset[];

      const codeLower = code.toLowerCase();
      let found: Asset | null = null;
      let matchType: string | null = null;

      for (const asset of allAssets) {
        if ((asset.qr_code || "").toLowerCase() === codeLower) {
          found = asset;
          matchType = "QR Code";
          break;
        }
        if ((asset.rfid_code || "").toLowerCase() === codeLower) {
          found = asset;
          matchType = "RFID";
          break;
        }
        if ((asset.item_code || "").toLowerCase() === codeLower) {
          found = asset;
          matchType = "Código do Item";
          break;
        }
      }

      if (found) {
        // Para obter o caminho da unidade, precisamos da hierarquia
        const hierarchyRes = await fetch(`${API_URL}/api/hierarchy`, { credentials: "include" });
        const hierarchyData = await hierarchyRes.json();
        const allNodes = hierarchyData.nodes || [];
        
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

        found.unit_path = getUnitPath(found.unit_id, allNodes);
        setFoundAsset(found);
        setMatchedBy(matchType);
        setSearchStatus("idle");
      } else {
        setSearchStatus("not_found");
      }
    } catch {
      toast.error("Erro ao comunicar com o servidor.");
      setSearchStatus("idle");
    }
  };

  const photoUrl = (p?: string) => {
    if (!p) return null;
    const path = p.replace(/\\/g, "/").replace(/^\/+/, "");
    const web = path.startsWith("static/") ? path : (path.startsWith("media/") ? path.replace(/^media\//, "static/") : `static/${path}`);
    return `${API_URL}/${web}`;
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4"
    >
      <div className="relative z-10 w-full max-w-3xl">
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <CardTitle className="text-white">
              Bem-vindo(a) ao <span className="text-[#93c5fd] font-semibold">SamaRFID</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-white/90">
                O SamaRFID é uma plataforma SaaS de Controle Patrimonial que utiliza tecnologia RFID para rastrear ativos com precisão e em tempo real.
                Com integração simples de etiquetas e leitores, você automatiza inventários, acompanha movimentações e garante governança sobre todo o ciclo de vida dos bens.
              </p>
              <p className="text-white/90">
                Oferecemos dashboards em tempo real, trilhas de auditoria, alertas de conformidade e APIs para integração com sistemas corporativos.
                O SamaRFID eleva a eficiência operacional, reduz perdas e aumenta a confiabilidade dos dados patrimoniais.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={() => setOpenSearch(true)} className="bg-white/20 text-white hover:bg-white/25">
                <Search className="mr-2 h-4 w-4" />
                Consultar Item
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Status:</span>
              <Badge variant="outline" className="bg-white/10 text-white hover:bg-white/15">Online</Badge>
              <Badge className="bg-[#3b82f6]/20 text-[#e6f0ff] hover:bg-[#2563eb]/25">v1.0</Badge>
            </div>

            <div className="mt-6 text-xs text-white/70">
              developed by Dipper Automation 2025
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de consulta de item */}
      <Dialog open={openSearch} onOpenChange={setOpenSearch}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-[#0b1d3a]/50 border border-white/20 ring-1 ring-white/10 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle>Consultar Item</DialogTitle>
            <DialogDescription className="text-white/80">
              Digite o QR Code, RFID ou Código do Item e pressione Enter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Digite o código para buscar..."
                className="bg-white text-black"
              />
            </div>

            {searchStatus === "searching" && <div className="text-sm text-white/80">Buscando...</div>}
            {searchStatus === "not_found" && <div className="text-sm text-red-400">Item não localizado.</div>}

            {foundAsset && (
              <div className="space-y-3 rounded-lg border border-white/20 bg-white/10 p-4">
                <div className="flex items-start gap-4">
                  {foundAsset.photo_path && (
                    <img src={photoUrl(foundAsset.photo_path) || ""} alt={foundAsset.name} className="h-24 w-24 rounded-md object-cover border border-white/20" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{foundAsset.name}</div>
                    <div className="text-xs text-white/80">{foundAsset.description}</div>
                    {matchedBy && <Badge className="mt-1 bg-green-500/30 text-white">Localizado por: {matchedBy}</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Unidade:</span> {foundAsset.unit_path || "N/A"}</div>
                  <div><span className="font-medium">Categoria:</span> {foundAsset.category || "N/A"}</div>
                  <div><span className="font-medium">Código do Item:</span> {foundAsset.item_code}</div>
                  <div><span className="font-medium">Quantidade:</span> {foundAsset.quantity ?? "N/A"} {foundAsset.unit || ""}</div>
                  <div><span className="font-medium">QR Code:</span> {foundAsset.qr_code || "N/A"}</div>
                  <div><span className="font-medium">RFID:</span> {foundAsset.rfid_code || "N/A"}</div>
                  <div className="col-span-2"><span className="font-medium">Observações:</span> {foundAsset.notes || "Nenhuma"}</div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;