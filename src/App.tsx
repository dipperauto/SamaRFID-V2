import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AppLayout from "./components/AppLayout";
import UsersPage from "./pages/Users";
import EventsPage from "./pages/Events";
import AnimatedBackground from "@/components/AnimatedBackground";
import PageTransitionOverlay from "@/components/PageTransitionOverlay";
import ParametrosPage from "./pages/Parametros";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Fundo animado global */}
      <AnimatedBackground />
      <BrowserRouter>
        <PageTransitionOverlay />
        <Routes>
          <Route path="/" element={<Login />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="/login" element={<Login />} />
          {/* Rotas com layout (menu responsivo) */}
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/parametros" element={<ParametrosPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;