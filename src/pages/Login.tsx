import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [health, setHealth] = React.useState<{ status?: string; adminConfigured?: boolean } | null>(null);
  const [healthErr, setHealthErr] = React.useState<string | null>(null);

  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  React.useEffect(() => {
    const check = async () => {
      setHealthErr(null);
      try {
        const res = await fetch(`${API_URL}/health`, { method: "GET" });
        if (!res.ok) {
          setHealth(null);
          setHealthErr(`HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        setHealth(data);
      } catch (e: any) {
        setHealth(null);
        setHealthErr(e?.message || "Falha ao conectar");
      }
    };
    check();
  }, [API_URL]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!login || !password) {
      toast.error("Preencha login e senha.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: login, password }),
      });

      if (!res.ok) {
        toast.error("Login inválido. Verifique suas credenciais.");
        return;
      }

      const data = await res.json();
      toast.success(`Login bem-sucedido! Papel: ${data.role ?? "não definido"}`);
      navigate("/home");
    } catch {
      toast.error("Não foi possível conectar ao servidor. Verifique o endereço do backend.");
    }
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4"
    >
      <div className="absolute bottom-3 right-3 z-20 text-[10px] text-black space-y-0.5 text-right">
        <div>Backend: {API_URL}</div>
        <div>Conexão: {health && !healthErr ? "OK" : "Indisponível"}</div>
        <div>
          Token admin: {health && !healthErr ? (health?.adminConfigured ? "Configurado" : "Não configurado") : "—"}
        </div>
        {healthErr && <div className="text-red-600">Erro: {healthErr}</div>}
      </div>
    </div>
  );
};

export default Login;