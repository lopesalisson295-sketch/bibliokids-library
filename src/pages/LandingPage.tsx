import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";

const LandingPage = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const galleryImages = [
    { src: "/images/Fachada da escola - Yolanda.jpg", alt: "Fachada da Escola Yolanda Queiroz" },
    { src: "/images/galeria_escola_yolanda_queiroz_01.jpg", alt: "Escola Yolanda Queiroz" },
    { src: "/images/foto da fundadora 2.jpg", alt: "Dona Yolanda Queiroz" },
    { src: "/images/foto da fundadora 3.jpg", alt: "Dona Yolanda Queiroz (Retrato)" },
    { src: "/images/foto da escola.jpg", alt: "Fachada da Escola" },
    { src: "/images/Foto-05_Lucas-Plutarcho-1-1024x683.jpg", alt: "Estrutura da Escola" },
    { src: "/images/1725573806879.jpeg", alt: "Alunos" }
  ];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden font-sans">
      {/* Header */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-border/40">
        <div className="flex items-center gap-4">
          <img src="/images/logo-unifor-transparent.png" alt="Logo Unifor" className="h-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 bg-black/10 flex items-center justify-center cursor-pointer group" onClick={() => openLightbox(0)}>
              <img src={galleryImages[0].src} alt={galleryImages[0].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { 
                e.currentTarget.style.display = 'none'; 
                e.currentTarget.parentElement?.classList.add('bg-white/5');
              }} />
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

          {/* Portfólio de Imagens */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pb-12">
             <div className="md:col-span-2 row-span-2 rounded-3xl overflow-hidden shadow-xl group flex items-center justify-center min-h-[300px] md:min-h-[500px] cursor-pointer" onClick={() => openLightbox(1)}>
                <img src={galleryImages[1].src} alt={galleryImages[1].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
             <div className="rounded-2xl overflow-hidden shadow-lg group aspect-square flex items-center justify-center cursor-pointer" onClick={() => openLightbox(2)}>
                <img src={galleryImages[2].src} alt={galleryImages[2].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
             <div className="rounded-2xl overflow-hidden shadow-lg group aspect-square flex items-center justify-center cursor-pointer" onClick={() => openLightbox(3)}>
                <img src={galleryImages[3].src} alt={galleryImages[3].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
             <div className="rounded-2xl overflow-hidden shadow-lg group aspect-square flex items-center justify-center cursor-pointer" onClick={() => openLightbox(4)}>
                <img src={galleryImages[4].src} alt={galleryImages[4].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
             <div className="rounded-2xl overflow-hidden shadow-lg group aspect-square flex items-center justify-center cursor-pointer" onClick={() => openLightbox(5)}>
                <img src={galleryImages[5].src} alt={galleryImages[5].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
             <div className="rounded-2xl overflow-hidden shadow-lg group aspect-square flex items-center justify-center cursor-pointer" onClick={() => openLightbox(6)}>
                <img src={galleryImages[6].src} alt={galleryImages[6].alt} className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
          </div>
        </div>
      </section>

      {/* Pre-Footer CTA */}
      <section className="bg-gradient-to-br from-primary to-primary/95 text-primary-foreground py-20">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 block">
           <h2 className="text-3xl md:text-5xl font-bold">Faça parte desta história</h2>
           <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
             Acesse o nosso sistema para acompanhar os empréstimos e incentivar a leitura das nossas crianças todos os dias.
           </p>
           <Link to="/login" className="inline-block mt-4">
             <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-10 py-6 text-lg rounded-full shadow-xl font-bold transition-all hover:scale-105">
               Entrar no Acervo
             </Button>
           </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2">
              <img src="/images/logo-unifor-transparent.png" alt="Unifor" className="h-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="text-2xl font-bold text-primary ml-2">Acervo Yolanda</span>
            </div>
            <p className="text-sm text-muted-foreground text-center md:text-left">
              Sistema de Gestão da Biblioteca Escolar Infantil
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Escola de Aplicação Yolanda Queiroz.</p>
            <p>Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Image Lightbox */}
      <ImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={galleryImages}
        initialIndex={lightboxIndex}
      />
    </div>
  );
};

export default LandingPage;
