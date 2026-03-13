import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, Heart, Library, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden font-sans">
      {/* Header */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-border/40">
        <div className="flex items-center gap-4">
          <img src="/images/logo-unifor.png" alt="Logo Unifor" className="h-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="h-8 w-px bg-border hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-xl">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">
              Acervo Yolanda
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl px-6 font-semibold shadow-sm">
              Acessar Sistema
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-primary text-primary-foreground py-20 lg:py-28 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-xl animate-pulse"></div>
          <div className="absolute bottom-10 right-20 w-48 h-48 bg-accent rounded-full mix-blend-overlay filter blur-2xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium">
              <GraduationCap className="h-4 w-4 text-accent" />
              <span>Escola de Aplicação Yolanda Queiroz</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
              Transformando vidas através da <span className="text-accent text-transparent bg-clip-text bg-gradient-to-r from-accent to-yellow-400">Educação</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-lg leading-relaxed font-light">
              O Acervo Yolanda é o sistema digital de gestão da biblioteca escolar, conectando alunos ao mundo da leitura com organização e carinho.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <Link to="/login">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6 rounded-2xl shadow-lg font-bold group w-full sm:w-auto">
                  Entrar no Acervo
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="relative">
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 bg-black/10 flex items-center justify-center">
              <img src="/images/historia1.jpg" alt="Alunos da Escola Yolanda Queiroz" className="w-full h-full object-cover" onError={(e) => { 
                e.currentTarget.style.display = 'none'; 
                e.currentTarget.parentElement?.classList.add('bg-white/5');
              }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                 <p className="text-white font-medium text-lg">Mais de 40 anos de história e dedicação</p>
              </div>
            </div>
            
            {/* Floating Info card */}
            <div className="absolute -bottom-6 -left-6 bg-card text-card-foreground p-5 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce-gentle border border-border">
               <div className="bg-success/20 p-3 rounded-full">
                 <Library className="h-6 w-6 text-success" />
               </div>
               <div>
                  <p className="font-bold text-lg">Incentivo à Leitura</p>
                  <p className="text-sm text-muted-foreground">Acervo 100% digitalizado</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* History Section */}
      <section className="py-24 bg-card text-card-foreground relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary">Nossa História</h2>
            <div className="w-20 h-1 bg-accent mx-auto rounded-full mb-8"></div>
            <div className="space-y-4 text-muted-foreground leading-relaxed text-lg text-justify md:text-center">
              <p>
                A <strong>Escola Yolanda de Queiroz</strong> foi inaugurada em 23 de julho de 1982, como um projeto de responsabilidade social da Fundação Edson Queiroz. Localizada dentro do campus da Unifor, seu objetivo primordial sempre foi oferecer educação de excelência a crianças de comunidades próximas e filhos de funcionários do Grupo Edson Queiroz.
              </p>
              <p>
                Oferecendo ensino totalmente gratuito, do Infantil ao Ensino Fundamental, a escola fornece não apenas a educação formal, mas também materiais escolares, uniformes, refeições nutritivas e atividades enriquecedoras como informática, artes, música e educação física.
              </p>
              <p>
                A escola também atua como um importante campo de estágio para alunos da Universidade de Fortaleza (UNIFOR), reafirmando seu compromisso de transformar a sociedade formando grandes cidadãos com muito amor e dedicação.
              </p>
            </div>
          </div>

          {/* Image Gallery */}
          {/* Se as imagens não existirem, elas serão ocultadas nativamente pelo onError event */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
             <div className="md:col-span-2 md:row-span-2 rounded-2xl overflow-hidden shadow-md group bg-muted flex items-center justify-center min-h-[200px]">
                <img src="/images/historia2.jpg" alt="Momentos da Escola Yolanda Queiroz" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="text-muted-foreground absolute z-[-1]">Insira historia2.jpg</span>
             </div>
             <div className="rounded-2xl overflow-hidden shadow-md group aspect-square bg-muted flex items-center justify-center">
                <img src="/images/historia3.jpg" alt="Momentos da Escola Yolanda Queiroz" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="text-muted-foreground absolute z-[-1]">Insira historia3.jpg</span>
             </div>
             <div className="rounded-2xl overflow-hidden shadow-md group aspect-square bg-muted flex items-center justify-center">
                <img src="/images/historia4.jpg" alt="Momentos da Escola Yolanda Queiroz" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="text-muted-foreground absolute z-[-1]">Insira historia4.jpg</span>
             </div>
             <div className="md:col-span-2 rounded-2xl overflow-hidden shadow-md group h-48 sm:h-auto bg-muted flex items-center justify-center min-h-[150px]">
                <img src="/images/historia5.jpg" alt="Momentos da Escola Yolanda Queiroz" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="text-muted-foreground absolute z-[-1]">Insira historia5.jpg</span>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">Acervo Yolanda</span>
          </div>
          <div className="flex items-center gap-6">
             <img src="/images/logo-unifor.png" alt="Unifor" className="h-8 object-contain brightness-0 opacity-60 hover:opacity-100 transition-opacity" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            Feito com <Heart className="h-4 w-4 text-destructive" /> para a Escola Yolanda de Queiroz
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
