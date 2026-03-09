import { Link } from "react-router-dom";
import { BookOpen, ArrowLeftRight, Users, BarChart3, QrCode, Shield, Sparkles, Star, Heart, Rocket, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-yellow-50 overflow-hidden">
      {/* Floating decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 text-6xl animate-float opacity-20">📚</div>
        <div className="absolute top-40 right-20 text-5xl animate-float-slow opacity-20">🌟</div>
        <div className="absolute bottom-40 left-20 text-4xl animate-float-reverse opacity-15">📖</div>
        <div className="absolute top-60 left-1/3 text-3xl animate-float opacity-15">✏️</div>
        <div className="absolute bottom-60 right-1/4 text-5xl animate-float-slow opacity-15">🎨</div>
        <div className="absolute top-32 right-1/3 text-4xl animate-float-reverse opacity-10">🦋</div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-xl shadow-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            BiblioKids
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 rounded-xl px-6">
              Entrar
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-amber-200 rounded-full px-4 py-2 text-sm text-amber-700 shadow-sm">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>A biblioteca escolar do futuro ✨</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                Leitura é
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                aventura! 🚀
              </span>
            </h1>
            <p className="text-lg md:text-xl text-amber-800/70 max-w-lg leading-relaxed">
              Gerencie o acervo da sua biblioteca infantil com facilidade.
              Cadastre livros, alunos e empréstimos em um sistema divertido e profissional.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/login">
                <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-lg px-8 py-6 rounded-2xl shadow-xl shadow-amber-500/30 animate-pulse-glow">
                  Comece Agora — É Grátis
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-6 text-sm text-amber-700/60">
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>100% Seguro</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                <span>Fácil de usar</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>Feito com ♥</span>
              </div>
            </div>
          </div>

          {/* Hero Illustration */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-80 h-80 md:w-96 md:h-96">
              {/* Main circle */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-200 to-orange-300 rounded-full opacity-30 animate-pulse"></div>
              <div className="absolute inset-4 bg-gradient-to-br from-amber-100 to-orange-200 rounded-full opacity-50"></div>

              {/* Floating elements */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 text-7xl animate-float">📚</div>
              <div className="absolute bottom-16 left-8 text-5xl animate-float-slow animation-delay-200">👧</div>
              <div className="absolute bottom-16 right-8 text-5xl animate-float-reverse animation-delay-400">👦</div>
              <div className="absolute top-1/2 left-4 text-3xl animate-bounce-gentle animation-delay-600">⭐</div>
              <div className="absolute top-1/2 right-4 text-3xl animate-bounce-gentle animation-delay-800">🌈</div>
              <div className="absolute top-16 right-12 text-2xl animate-float animation-delay-400">🦄</div>
              <div className="absolute top-16 left-12 text-2xl animate-float-slow animation-delay-600">🎈</div>
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-3xl animate-bounce-gentle">❤️</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 bg-white/60 backdrop-blur-sm py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                Tudo que você precisa
              </span>
            </h2>
            <p className="text-lg text-amber-800/60 max-w-2xl mx-auto">
              Um sistema completo para gerenciar sua biblioteca escolar com eficiência e diversão.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: BookOpen,
                title: "Acervo Digital",
                description: "Cadastre e organize todos os livros com título, autor, gênero e ISBN.",
                color: "from-amber-400 to-orange-500",
                emoji: "📖"
              },
              {
                icon: ArrowLeftRight,
                title: "Empréstimos",
                description: "Controle empréstimos e devoluções com datas e status automáticos.",
                color: "from-blue-400 to-indigo-500",
                emoji: "🔄"
              },
              {
                icon: Users,
                title: "Alunos",
                description: "Cadastre alunos por turma e acompanhe o histórico de leitura.",
                color: "from-emerald-400 to-teal-500",
                emoji: "👨‍🎓"
              },
              {
                icon: BarChart3,
                title: "Relatórios",
                description: "Gráficos e estatísticas para acompanhar o uso da biblioteca.",
                color: "from-violet-400 to-purple-500",
                emoji: "📊"
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg shadow-amber-500/5 border border-amber-100 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-2 transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  {feature.title} {feature.emoji}
                </h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative z-10 py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
              Simples como 1, 2, 3!
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {[
            {
              step: "1",
              title: "Cadastre",
              description: "Adicione seus livros e alunos ao sistema em poucos cliques.",
              emoji: "✍️",
              color: "from-amber-400 to-orange-500"
            },
            {
              step: "2",
              title: "Empreste",
              description: "Registre empréstimos com data de devolução automática.",
              emoji: "🤝",
              color: "from-blue-400 to-indigo-500"
            },
            {
              step: "3",
              title: "Acompanhe",
              description: "Veja relatórios e controle devoluções em tempo real.",
              emoji: "📈",
              color: "from-emerald-400 to-teal-500"
            },
          ].map((item) => (
            <div key={item.step} className="text-center group">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Fredoka, sans-serif' }}>{item.step}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {item.title} {item.emoji}
              </h3>
              <p className="text-gray-600 max-w-xs mx-auto leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-12 md:p-16 text-center shadow-2xl shadow-amber-500/30">
            {/* Decorative dots */}
            <div className="absolute top-4 left-4 text-2xl opacity-30">⭐</div>
            <div className="absolute top-4 right-4 text-2xl opacity-30">🌟</div>
            <div className="absolute bottom-4 left-4 text-2xl opacity-30">✨</div>
            <div className="absolute bottom-4 right-4 text-2xl opacity-30">💫</div>

            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              Pronto para transformar sua biblioteca? 🎉
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Comece a usar o BiblioKids hoje e veja como é fácil gerenciar sua biblioteca escolar!
            </p>
            <Link to="/login">
              <Button size="lg" className="bg-white text-amber-600 hover:bg-amber-50 text-lg px-10 py-6 rounded-2xl shadow-xl font-bold">
                Começar Agora
                <Rocket className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-white/40 backdrop-blur-sm border-t border-amber-200 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="h-5 w-5 text-amber-500" />
            <span className="text-lg font-bold text-amber-700" style={{ fontFamily: 'Fredoka, sans-serif' }}>BiblioKids</span>
          </div>
          <p className="text-sm text-amber-600/60">
            © 2026 BiblioKids — Feito com ❤️ para bibliotecas infantis
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
