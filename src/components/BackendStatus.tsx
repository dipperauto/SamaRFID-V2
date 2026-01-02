"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

type Health = {
  status?: string;
  adminConfigured?: boolean;
} | null;

const BackendStatus: React.FC = () => {
  const API_URL = import.meta.env.VITE_BACKEND_URL || "https://sama.dipperauto.com";
  const [health, setHealth] = React.useState<Health>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const run = async () => {
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/health`, { method: "GET" });
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          setHealth(null);
          return;
        }
        const data = await res.json();
        setHealth(data);
      } catch (e: any) {
        setError(e?.message || "Falha ao conectar");
        setHealth(null);
      }
    };
    run();
  }, [API_URL]);

  const connected = !!health && !error;
  const adminConfigured = !!health?.adminConfigured;

  return (
    <div className="w-full rounded-lg border bg-white p-3 text-sm text-slate-700 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Backend:</span>
        <Badge variant="outline">{API_URL}</Badge>
        <span className="ml-2 font-medium">Conexão:</span>
        {connected ? (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">OK</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Indisponível</Badge>
        )}
        <span className="ml-2 font-medium">Token admin:</span>
        {connected ? (
          <Badge variant="secondary">{adminConfigured ? "Configurado" : "Não configurado"}</Badge>
        ) : (
          <Badge variant="secondary">—</Badge>
        )}
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-600">
          Erro: {error}. Se o backend estiver desligado, verifique se outra aplicação está escutando neste endereço ou se o VITE_BACKEND_URL aponta para outro servidor.
        </div>
      )}
    </div>
  );
};

export default BackendStatus;