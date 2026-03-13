import { useState, useEffect } from "react";
import { Settings, Library, Clock, User, Save, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/utils/uploadImage";
import ImageLightbox from "@/components/ImageLightbox";

const Configuracoes = () => {
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { toast } = useToast();

  // Library Settings (localStorage)
  const [libraryName, setLibraryName] = useState(() => localStorage.getItem("bk_library_name") || "");
  const [libraryAddress, setLibraryAddress] = useState(() => localStorage.getItem("bk_library_address") || "");
  const [defaultDays, setDefaultDays] = useState(() => localStorage.getItem("bk_default_days") || "14");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserEmail(session.user.email || "");
        const meta = session.user.user_metadata;
        const fullName = meta?.full_name || meta?.name || "";
        setUserName(fullName || (session.user.email || "").split("@")[0]);
        setAvatarUrl(meta?.avatar_url || "");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAvatarUrl(session.user.user_metadata?.avatar_url || "");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSaveLibrary = () => {
    localStorage.setItem("bk_library_name", libraryName);
    localStorage.setItem("bk_library_address", libraryAddress);
    toast({ title: "✅ Informações da biblioteca salvas!" });
  };

  const handleSaveLoan = () => {
    localStorage.setItem("bk_default_days", defaultDays);
    toast({ title: "✅ Configurações de empréstimo salvas!" });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const uploadedUrl = await uploadImage(file);

    if (uploadedUrl) {
      const { data, error } = await supabase.auth.updateUser({
        data: { avatar_url: uploadedUrl }
      });

      if (error) {
        toast({ title: "Erro ao atualizar foto", description: error.message, variant: "destructive" });
      } else {
        setAvatarUrl(uploadedUrl);
        toast({ title: "✅ Foto atualizada com sucesso!" });
      }
    } else {
      toast({ title: "Erro ao fazer upload da imagem", variant: "destructive" });
    }

    setUploadingAvatar(false);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      {/* User Profile */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Perfil do Usuário
          </CardTitle>
          <CardDescription>Informações da sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative group w-16 h-16 rounded-full overflow-hidden bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightboxOpen(true)}
                  title="Clique para ampliar"
                />
              ) : (
                <span>{userEmail ? (userName || userEmail).charAt(0).toUpperCase() : "?"}</span>
              )}
              <label
                className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ${uploadingAvatar ? 'opacity-100 cursor-wait' : ''}`}
              >
                {uploadingAvatar ? (
                  <span className="text-[10px]">Carregando...</span>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px]">Alterar</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <div>
              <p className="font-medium text-foreground">{userName || userEmail || "Carregando..."}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              <Badge variant="secondary" className="text-xs mt-1">Administrador</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Library Info */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Library className="h-5 w-5 text-blue-500" />
            Informações da Biblioteca
          </CardTitle>
          <CardDescription>Configure os dados da sua escola/biblioteca.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="libName">Nome da Biblioteca</Label>
            <Input
              id="libName"
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              placeholder="Ex: Biblioteca Escola Municipal Vinicius de Moraes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="libAddress">Endereço</Label>
            <Input
              id="libAddress"
              value={libraryAddress}
              onChange={(e) => setLibraryAddress(e.target.value)}
              placeholder="Ex: Rua das Flores, 123"
            />
          </div>
          <Button onClick={handleSaveLibrary} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Loan Settings */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-emerald-500" />
            Configurações de Empréstimo
          </CardTitle>
          <CardDescription>Defina os prazos padrão para empréstimos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Prazo padrão de devolução (dias)</Label>
            <Input
              type="number"
              min="1"
              value={defaultDays}
              onChange={(e) => setDefaultDays(e.target.value)}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Este prazo será sugerido ao criar novos empréstimos.
            </p>
          </div>
          <Button onClick={handleSaveLoan} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-0 shadow-sm bg-muted/30">
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">BiblioKids</p>
            <p className="text-xs text-muted-foreground">v1.0.0 — Sistema de Biblioteca Infantil</p>
          </div>
          <Badge variant="outline" className="text-xs">SaaS</Badge>
        </CardContent>
      </Card>

      {/* Image Lightbox */}
      <ImageLightbox
        src={avatarUrl}
        alt={userName || "Foto de perfil"}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

export default Configuracoes;
