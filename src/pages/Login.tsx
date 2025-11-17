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
      style={{
        backgroundImage: `
          radial-gradient(900px 500px at 0% 0%, rgba(37, 99, 235, 0.28), transparent 60%),
          radial-gradient(800px 450px at 100% 100%, rgba(255, 255, 255, 0.65), transparent 55%),
          radial-gradient(700px 400px at 100% 0%, rgba(147, 197, 253, 0.35), transparent 55%),
          radial-gradient(700px 400px at 0% 100%, rgba(255, 255, 255, 0.55), transparent 55%)
        `,
        backgroundColor: "#eef5ff",
      }}
    >
      <div className="pointer-events-none absolute -top-28 -left-28 h-[650px] w-[650px] rounded-full bg-blue-400/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-white/50 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-white/25 bg-black/50 p-8 shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-20 w-auto drop-shadow"
            />
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="login" className="text-white/90">
                Login
              </Label>
              <Input
                id="login"
                placeholder="seu login ou e-mail"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/40"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 pr-11 focus-visible:ring-white/40"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center px-2 text-white/80 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-white/90 text-slate-900 hover:bg-white"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Entrar
            </Button>
          </form>
        </div>

        <div className="absolute bottom-3 right-3 z-20 text-[10px] text-white/70 space-y-0.5 text-right">
          <div>Backend: {API_URL}</div>
          <div>Conexão: {health && !healthErr ? "OK" : "Indisponível"}</div>
          <div>
            Token admin:{" "}
            {health && !healthErr ? (health?.adminConfigured ? "Configurado" : "Não configurado") : "—"}
          </div>
          {healthErr && <div className="text-red-200">Erro: {healthErr}</div>}
        </div>
      </div>
    </div>
  );
};

export default Login;