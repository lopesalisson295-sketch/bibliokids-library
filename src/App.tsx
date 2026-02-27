import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Acervo from "./pages/Acervo";
import Alunos from "./pages/Alunos";
import Emprestimos from "./pages/Emprestimos";
import Configuracoes from "./pages/Configuracoes";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/acervo" element={<DashboardLayout><Acervo /></DashboardLayout>} />
          <Route path="/alunos" element={<DashboardLayout><Alunos /></DashboardLayout>} />
          <Route path="/emprestimos" element={<DashboardLayout><Emprestimos /></DashboardLayout>} />
          <Route path="/configuracoes" element={<DashboardLayout><Configuracoes /></DashboardLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
