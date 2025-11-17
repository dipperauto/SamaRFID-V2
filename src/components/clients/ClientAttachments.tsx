"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FileItem = {
  name: string;
  url: string;
  size_bytes: number;
};

type FilesResponse = {
  files: FileItem[];
  total_bytes: number;
  limit_bytes: number;
};

type Props = {
  clientId: number;
  apiUrl: string;
  editable?: boolean;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const ClientAttachments: React.FC<Props> = ({ clientId, apiUrl, editable = false }) => {
  const { data, refetch } = useQuery<FilesResponse>({
    queryKey: ["client-files", clientId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/clients/${clientId}/files`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const onUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${apiUrl}/clients/${clientId}/files`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao anexar arquivo.");
      return;
    }
    toast.success("Arquivo anexado com sucesso!");
    await refetch();
  };

  const onDelete = async (name: string) => {
    const res = await fetch(`${apiUrl}/clients/${clientId}/files/${encodeURIComponent(name)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      toast.error(detail?.detail ?? "Falha ao remover arquivo.");
      return;
    }
    toast.success("Arquivo removido!");
    await refetch();
  };

  return (
    <Card className="rounded-xl border border-white/20 bg-black/30 ring-1 ring-white/10 text-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Anexos</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white/10 text-white">
              Total: {formatSize(data?.total_bytes ?? 0)} / {formatSize(data?.limit_bytes ?? 0)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editable && (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center">
              <input
                type="file"
                className="block rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:text-white hover:bg-white/15"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <span className="text-xs text-white/80">Limite total por cliente: 50MB</span>
          </div>
        )}

        <div className="space-y-2">
          {data?.files?.length ? (
            data.files.map((f) => (
              <div key={f.name} className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2">
                <a
                  href={`${apiUrl}/${f.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-white hover:underline"
                >
                  {f.name}
                </a>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">{formatSize(f.size_bytes)}</span>
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/30 bg-white text-black hover:bg-white/90"
                      onClick={() => onDelete(f.name)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-white/80">Nenhum arquivo anexado.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientAttachments;