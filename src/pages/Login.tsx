import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn } from "lucide-react";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!login || !password) {
      toast.error("Preencha login e senha.");
      return;
    }
    toast.success("Login bem-sucedido!");
    navigate("/teste");
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
        <div className="rounded-3xl border border-white/25 bg-black/25 p-8 shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-90">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-16 w-auto mb-2 drop-shadow"
            />
            <h1 className="text-2xl font-semibold text-white/90 tracking-tight">
              Bem-vindo
            </h1>
            <p className="text-white/60 text-sm">
              Acesse sua conta para continuar
            </p>
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

        <p className="mt-4 text-center text-white/70 text-xs">
          Dica: use qualquer login e senha — é apenas demonstração.
        </p>
      </div>
    </div>
  );
};

export default Login;