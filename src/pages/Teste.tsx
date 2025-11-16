import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Teste: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6">
      <div className="max-w-lg w-full rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200 shadow-lg p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-800">Página de Teste</h1>
        <p className="mt-2 text-slate-600">
          Você chegou aqui após um login de demonstração.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Teste;