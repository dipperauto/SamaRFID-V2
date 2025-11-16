"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { toast } from "sonner";

const AdminAddUser: React.FC = () => {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<string>("administrador");
  const [adminToken, setAdminToken] = React.useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = adminToken.trim();
    if (!username || !password || !role || token.length === 0) {
      toast.error("Preencha todos os campos e o token de administrador.");
      return;
    }
    const res = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ username, password, role }),
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
    toast.success("Usuário cadastrado com sucesso!");
    setUsername("");
    setPassword("");
    setRole("administrador");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white p-4">
      <div className="w-full max-w-md bg-white border rounded-xl shadow-sm p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Adicionar Usuário (admin)</h1>
          <p className="text-sm text-gray-500">Use o token de administrador para cadastrar com segurança.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminToken">Token de Administrador</Label>
            <Input id="adminToken" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} placeholder="ADMIN_TOKEN" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex.: joao" />
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
  );
};

export default AdminAddUser;