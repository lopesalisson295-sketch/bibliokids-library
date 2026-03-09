import { supabase } from "@/integrations/supabase/client";

export const uploadImage = async (file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('imagens')
            .upload(filePath, file);

        if (uploadError) {
            console.error("Erro no upload:", uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('imagens')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error("Erro ao fazer upload da imagem:", error);
        return null;
    }
};
