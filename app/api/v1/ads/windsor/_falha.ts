/**
 * Tradução de falha do eixo Windsor.ai para resposta HTTP — irmã de
 * `app/api/v1/ads/meta/_falha.ts`, mesma razão de existir (o `error.code`
 * decide a frase na tela, e as rotas de meta e instagram compartilham as
 * mesmas causas) e mesma regra: NENHUMA destas falhas é 401. O que falhou é a
 * credencial do Windsor.ai ou a leitura do nosso próprio banco — nunca a
 * sessão de quem está com a tela aberta.
 */
import type { NextResponse } from "next/server";

import { fail, type ApiError } from "@/lib/api/wrappers";

interface Opcoes {
  requestId?: string;
}

export function respostaSemConexaoWindsor(
  motivo: "sem_conexao" | "cifra_indisponivel",
  { requestId }: Opcoes = {},
): NextResponse<ApiError> {
  if (motivo === "cifra_indisponivel") {
    return fail(
      "windsor_cifra_indisponivel",
      "A chave de criptografia da instalação não está disponível, então a chave guardada não pode ser lida. Isso é configuração do servidor.",
      422,
      { requestId },
    );
  }
  return fail("windsor_sem_conexao", "Nenhuma chave do Windsor.ai conectada.", 422, { requestId });
}

export function respostaContaNaoEncontrada({ requestId }: Opcoes = {}): NextResponse<ApiError> {
  return fail(
    "windsor_conta_nao_encontrada",
    "Esta conta não existe ou não pertence à sua organização.",
    404,
    { requestId },
  );
}
