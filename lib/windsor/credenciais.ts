/**
 * A credencial do Windsor.ai — lida e decifrada. Irmã de
 * `lib/plataformas-de-anuncio/credenciais-de-leitura.ts`, mesma cifra
 * (`fn_encrypt_oauth` via `encryptWebhookSecret`/`decryptWebhookSecret`),
 * tabela própria pelas razões no cabeçalho da migration 0233.
 *
 * ⚠️ SEMPRE COM `organization_id` NO FILTRO — lição da #236 (ver o cabeçalho
 * de `credenciais-de-leitura.ts` para o incidente completo).
 *
 * ⚠️ EXIGE O ADMIN CLIENT. `windsor_connections` tem RLS ligada e ZERO
 * policies, grants revogados de anon/authenticated. Pelo client de sessão
 * isto não devolve nada — nem erro, só vazio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";
import type { CredencialWindsor, LeituraDeCredencialWindsor } from "./types";

export async function lerCredencialWindsor(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LeituraDeCredencialWindsor> {
  const { data, error } = await admin
    .from("windsor_connections")
    .select("api_key_encrypted")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    logger.error("[windsor.credenciais] leitura falhou", {
      organizationId,
      error: error.message,
    });
    return { ok: false, motivo: "sem_conexao" };
  }
  if (!data) return { ok: false, motivo: "sem_conexao" };

  const linha = data as { api_key_encrypted: string | null };
  if (!linha.api_key_encrypted) return { ok: false, motivo: "sem_conexao" };

  const apiKey = await decryptWebhookSecret(admin, linha.api_key_encrypted);
  if (!apiKey) return { ok: false, motivo: "cifra_indisponivel" };

  return { ok: true, credencial: { apiKey } };
}

/**
 * Existe conexão? — sem decifrar nada. Mesmo motivo de
 * `existeConexaoDeLeitura`: a página server-side só precisa saber se mostra o
 * formulário de conectar ou o painel de contas.
 */
export async function existeConexaoWindsor(
  admin: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("windsor_connections")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    logger.error("[windsor.credenciais] checagem falhou", {
      organizationId,
      error: error.message,
    });
    return false;
  }
  return Boolean(data);
}
