import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Teste from "./pages/Teste";
import AdminAddUser from "./pages/AdminAddUser";
import Home from "./pages/Home";
import AppLayout from "./components/AppLayout";
import ClientsPage from "./pages/Clients";
import UsersPage from "./pages/Users";
import AnimatedBackground from "@/components/AnimatedBackground";
import KanbanPage from "./pages/Kanban";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Fundo animado global */}
      <AnimatedBackground />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="/login" element={<Login />} />
          {/* Rotas com layout (menu responsivo) */}
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/teste" element={<Teste />} />
            <Route path="/admin/add-user" element={<AdminAddUser />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;