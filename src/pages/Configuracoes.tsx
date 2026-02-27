import { Settings } from "lucide-react";

const Configuracoes = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Settings className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">Em breve.</p>
      </div>
    </div>
  );
};

export default Configuracoes;
