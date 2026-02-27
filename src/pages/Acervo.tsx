import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Acervo = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Acervo</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Cadastrar Livro
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Nenhum livro cadastrado ainda</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Clique em "Cadastrar Livro" para começar.
        </p>
      </div>
    </div>
  );
};

export default Acervo;
