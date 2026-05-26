import { supabase } from "@/integrations/supabase/client";

/**
 * Atualiza automaticamente no banco de dados todos os empréstimos
 * que passaram da data de devolução prevista e ainda estão com status "ativo".
 * 
 * Estratégia dupla:
 * 1. Tenta usar a função RPC do servidor (mais eficiente, uma única query)
 * 2. Se falhar, faz o update direto via cliente Supabase (fallback)
 * 
 * Retorna a quantidade de registros atualizados.
 */
export const syncOverdueLoans = async (): Promise<number> => {
  try {
    // Estratégia 1: Chamar a função RPC do servidor (mais eficiente)
    const { data, error } = await (supabase as any).rpc(
      "atualizar_emprestimos_atrasados"
    );

    if (!error && typeof data === "number") {
      if (data > 0) {
        console.log(`✅ [RPC] ${data} empréstimo(s) marcado(s) como atrasado(s) automaticamente.`);
      }
      return data;
    }

    // Se a função RPC não existir, usa fallback
    console.warn("Função RPC indisponível, usando fallback client-side:", error?.message);
  } catch {
    // Silenciosamente cai no fallback
  }

  // Estratégia 2: Fallback via queries do cliente
  try {
    const today = new Date().toISOString().split("T")[0]; // yyyy-MM-dd

    // Buscar todos empréstimos ativos cuja data de devolução já passou
    const { data: overdueLoans, error: fetchError } = await supabase
      .from("emprestimos")
      .select("id")
      .eq("status", "ativo")
      .lt("data_devolucao_prevista", today);

    if (fetchError || !overdueLoans || overdueLoans.length === 0) {
      return 0;
    }

    const overdueIds = overdueLoans.map((l) => l.id);

    // Atualizar todos de uma vez para "atrasado"
    const { error: updateError } = await supabase
      .from("emprestimos")
      .update({ status: "atrasado" })
      .in("id", overdueIds);

    if (updateError) {
      console.error("Erro ao atualizar empréstimos atrasados:", updateError);
      return 0;
    }

    console.log(`✅ [Fallback] ${overdueIds.length} empréstimo(s) marcado(s) como atrasado(s) automaticamente.`);
    return overdueIds.length;
  } catch (err) {
    console.error("Erro no fallback de atualização de atrasados:", err);
    return 0;
  }
};
