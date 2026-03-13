import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BookOpen, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedBackground from "@/components/AnimatedBackground";
import ImageLightbox from "@/components/ImageLightbox";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const extractName = (session: any) => {
      const meta = session?.user?.user_metadata;
      const fullName = meta?.full_name || meta?.name || "";
      if (fullName) {
        return fullName.split(" ")[0]; // primeiro nome
      }
      return (session?.user?.email || "").split("@")[0] || "Usuário";
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/");
        return;
      }
      setUserName(extractName(session));
      setAvatarUrl(session?.user?.user_metadata?.avatar_url || "");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
        return;
      }
      setUserName(extractName(session));
      setAvatarUrl(session?.user?.user_metadata?.avatar_url || "");
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!authChecked) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center">
        <AnimatedBackground variant="subtle" />
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-3" />
          <p className="text-primary text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AnimatedBackground variant="subtle" />
      <div className="min-h-screen flex w-full relative z-10">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-4 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="mr-2" />
              <img src="/images/logo-unifor.png" alt="Unifor" className="h-6 object-contain hidden sm:inline mix-blend-multiply" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="text-lg font-bold text-primary hidden sm:inline">Acervo Yolanda</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Perfil"
                    className="w-8 h-8 rounded-full object-cover shadow-sm clickable-image"
                    onClick={() => setLightboxOpen(true)}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  Olá, <strong className="text-foreground">{userName}!</strong>
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        src={avatarUrl}
        alt={userName || "Foto de perfil"}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </SidebarProvider>
  );
};

export default DashboardLayout;
