import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: "❌ Erro ao entrar",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      setIsNavigating(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Preencha seu nome", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    if (error) {
      toast({
        title: "❌ Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✅ Cadastro realizado!",
        description: "Verifique seu e-mail para confirmar o cadastro, ou faça login agora.",
      });
      setIsSignUp(false);
      setName("");
      setPassword("");
    }
    setLoading(false);
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };

  // Redirecionar se já autenticado
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  if (isNavigating) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-4">
        <AnimatedBackground variant="vibrant" />
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="h-16 w-16 text-amber-500 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-amber-600 mb-2">Entrando no sistema...</h2>
          <p className="text-amber-700/60 text-sm">Preparando a biblioteca infantil</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <AnimatedBackground variant="vibrant" />
      <div className="w-full max-w-sm space-y-8 relative z-10">
        {/* Back to landing */}
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-xl shadow-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              BiblioKids
            </h1>
          </div>
          <p className="text-amber-700/60 text-sm">Biblioteca Infantil</p>
        </div>

        {/* Login Form */}
        {!isSignUp ? (
          <form onSubmit={handleLogin} className="space-y-5 bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-amber-100">
            <h2 className="text-2xl font-semibold text-foreground text-center">
              Acesso para Funcionários
            </h2>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Senha</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm text-amber-600 hover:text-amber-700 hover:underline transition-colors"
              >
                Não tem conta? <span className="font-semibold">Cadastre-se</span>
              </button>
            </div>
          </form>
        ) : (
          /* Sign Up Form */
          <form onSubmit={handleSignUp} className="space-y-5 bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-amber-100">
            <h2 className="text-2xl font-semibold text-foreground text-center">
              Criar Conta
            </h2>
            <p className="text-sm text-muted-foreground text-center -mt-2">
              Cadastre-se como funcionário da biblioteca
            </p>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Nome completo</label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-email" className="text-sm font-medium text-foreground">Email</label>
              <Input
                id="signup-email"
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-password" className="text-sm font-medium text-foreground">Senha</label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md" disabled={loading}>
              {loading ? "Cadastrando..." : "Criar Conta"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm text-amber-600 hover:text-amber-700 hover:underline transition-colors"
              >
                Já tem conta? <span className="font-semibold">Faça login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
