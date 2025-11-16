"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { toast } from "sonner";
import BackendStatus from "../components/BackendStatus";
import PhotoCropper from "../components/PhotoCropper";

const AdminAddUser: React.FC = () => {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<string>("administrador");
  const [fullName, setFullName] = React.useState<string>("");
  const [profilePhotoBase64, setProfilePhotoBase64] = React.useState<string | null>(null);
  const [adminToken, setAdminToken] = React.useState("");

  // Diagnóstico do token
  const [backendTokenPreview, setBackendTokenPreview] = React.useState<string | null>(null);
  const [adminConfigured, setAdminConfigured] = React.useState<boolean>(false);
  const [inputTokenPreview, setInputTokenPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/token-check`, { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        setBackendTokenPreview(data?.tokenPreview ?? null);
        setAdminConfigured(!!data?.adminConfigured);
      } catch {
        setBackendTokenPreview(null);
        setAdminConfigured(false);
      }
    };
    check();
  }, [API_URL]);

  async function sha256Preview(s: string): Promise<string> {
    const enc = new TextEncoder().encode(s);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const arr = Array.from(new Uint8Array(buf));
    const hex = arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8);
  }

  React.useEffect(() => {
    const run = async () => {
      const t = adminToken.trim();
      if (!t) {
        setInputTokenPreview(null);
        return;
      }
      const prev = await sha256Preview(t);
      setInputTokenPreview(prev);
    };
    run();
  }, [adminToken]);

  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = adminToken.trim();
    if (!username || !password || !role || !fullName || token.length === 0) {
      toast.error("Preencha todos os campos obrigatórios e o token de administrador.");
      return;
    }
    if (!isValidEmail(username)) {
      toast.error("Usuário deve ser um e-mail válido.");
      return;
    }
    const res = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({
        username,
        password,
        role,
        full_name: fullName,
        profile_photo_base64: profilePhotoBase64,
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      if (res.status === 401) {
        toast.error("Token de administrador inválido ou não configurado no backend.");
      } else {
        toast.error(detail?.detail ?? "Falha ao cadastrar usuário.");
      }
      return;
    }
    const data = await res.json().catch(() => ({}));
    toast.success("Usuário cadastrado com sucesso!");
    if (data?.profile_photo_path) {
      toast.message("Foto salva", { description: `Armazenada em: ${data.profile_photo_path}` });
    }
    setUsername("");
    setPassword("");
    setRole("administrador");
    setFullName("");
    setProfilePhotoBase64(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white p-4">
      <div className="w-full max-w-md space-y-4">
        <BackendStatus />

        <div className="w-full bg-white border rounded-xl shadow-sm p-6 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Adicionar Usuário (admin)</h1>
            <p className="text-sm text-gray-500">Use o token de administrador para cadastrar com segurança.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminToken">Token de Administrador</Label>
              <Input
                id="adminToken"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="ADMIN_TOKEN"
              />
              {adminConfigured ? (
                <div className="text-xs text-gray-500">
                  Token do backend (SHA-256, prefixo): <span className="font-mono">{backendTokenPreview ?? "?"}</span>{" "}
                  • Seu token (SHA-256, prefixo): <span className="font-mono">{inputTokenPreview ?? "—"}</span>{" "}
                  •{" "}
                  {inputTokenPreview && backendTokenPreview ? (
                    inputTokenPreview === backendTokenPreview ? (
                      <span className="text-green-600">Corresponde</span>
                    ) : (
                      <span className="text-red-600">Não corresponde</span>
                    )
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-red-600">ADMIN_TOKEN não está configurado no backend.</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">E-mail (Usuário)</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex.: joao@empresa.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ex.: João da Silva" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha segura" />
            </div>

            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Foto de Perfil (opcional)</Label>
              <PhotoCropper onChange={setProfilePhotoBase64} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>Voltar</Button>
              <Button type="submit">Cadastrar</Button>
            </div>
          </form>

          <div className="pt-2 text-xs text-gray-500">
            Dica: se preferir edição manual do CSV, gere o hash via <span className="font-mono">POST /auth/hash</span> com o token e cole em <span className="font-mono">password_hash</span>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAddUser;