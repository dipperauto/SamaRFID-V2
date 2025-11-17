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
      {/* Card com formulário de login */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/25 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex flex-col items-center">
            <img src="/logo.png" alt="Logo" className="h-16 w-auto" />
            <Badge variant="outline" className="mt-2">Acesso</Badge>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input
                id="login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Seu usuário"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-600 hover:text-gray-900"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <LogIn className="mr-2 h-4 w-4" />
              Entrar
            </Button>
          </form>
        </div>
      </div>

      {/* Debug técnico no canto da página */}
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