"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { supportWriteError } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";

/**
 * Conectar o Windsor.ai — pela aba "Windsor.ai" de Conexões.
 *
 * Irmã de `updateAdInsightsConnection.ts` (0214), mesma filosofia, tabela
 * própria (`windsor_connections`, 0233) pelas razões do cabeçalho dessa
 * migration: é OUTRA credencial (chave de API do Windsor.ai, não token direto
 * da Meta), isolada de propósito — a organização pode usar as duas ao mesmo
 * tempo sem uma interferir na outra.
 *
 * ─── Por que `admin` da organização ─────────────────────────────────────────
 * Mesmo gate de `updateAdInsightsConnection.ts`: a chave alcança orçamento,
 * criativo e performance da conta de anúncios inteira — dado que um
 * concorrente pagaria para ver.
 *
 * ─── NUNCA em claro ──────────────────────────────────────────────────────────
 * Se `fn_encrypt_oauth` não puder cifrar, o save RECUSA (`cifra_indisponivel`).
 * Mesma decisão de toda credencial desta casa.
 */
export type ConectarWindsorResultado =
  | { ok: true }
  | {
      ok: false;
      error:
        | "validation_failed"
        | "unauthenticated"
        | "forbidden_tenant"
        | "forbidden_role"
        | "mfa_required"
        | "cifra_indisponivel"
        | "erro_ao_gravar";
      details?: unknown;
    };

const entradaSchema = z.object({
  // Chaves de API do Windsor.ai não têm formato público documentado (não são
  // JWT nem têm prefixo fixo) — o piso de 20 caracteres é o mesmo usado para
  // o token direto da Meta (`updateAdInsightsConnection.ts`), suficiente para
  // recusar um "cole aqui" vazio ou truncado sem inventar uma regex que a
  // Windsor.ai não documenta.
  api_key: z.string().trim().min(20).max(500),
});

export async function conectarWindsor(input: {
  api_key: string;
}): Promise<ConectarWindsorResultado> {
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation_failed", details: parsed.error.flatten() };
  }

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  if (supportWriteError(authUser.support)) return { ok: false, error: "forbidden_role" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!authUser.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    return { ok: false, error: "forbidden_role" };
  }
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };

  const admin = createAdminClient();

  const cifrado = await encryptWebhookSecret(admin, parsed.data.api_key);
  if (!cifrado) return { ok: false, error: "cifra_indisponivel" };

  const { data: existente } = await admin
    .from("windsor_connections")
    .select("id")
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  // `upsert` e não `update`: a linha não existe em quem nunca conectou —
  // mesma lição da #144 que `updateAdInsightsConnection.ts` documenta.
  const { error } = await admin.from("windsor_connections").upsert(
    {
      organization_id: activeOrg.orgId,
      api_key_encrypted: cifrado,
      updated_by: authUser.id,
    },
    { onConflict: "organization_id" },
  );

  if (error) return { ok: false, error: "erro_ao_gravar", details: error.message };

  const hdrs = await headers();
  await audit({
    action: existente ? "windsor_connection.updated" : "windsor_connection.created",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "windsor_connections",
    resourceId: null,
    requestId: hdrs.get("x-request-id") ?? undefined,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
    metadata: { primeira_conexao: !existente },
  });

  revalidatePath("/app/connections");
  revalidatePath("/app/ads/windsor/meta");
  revalidatePath("/app/ads/windsor/instagram");
  return { ok: true };
}

/**
 * Desconectar — apaga a linha e, por cascade, TODAS as contas e métricas
 * derivadas (`windsor_ad_accounts`, `windsor_metrics_daily`,
 * `windsor_creatives`, `windsor_creative_metrics_daily`,
 * `windsor_instagram_insights_daily`, `windsor_instagram_media`,
 * `windsor_account_billing`). Mesma filosofia de `disconnectAdInsights`:
 * não existe "pausar" — reconectar é colar a chave de novo e re-sincronizar.
 */
export async function desconectarWindsor(): Promise<ConectarWindsorResultado> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  if (supportWriteError(authUser.support)) return { ok: false, error: "forbidden_role" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!authUser.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    return { ok: false, error: "forbidden_role" };
  }
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("windsor_connections")
    .delete()
    .eq("organization_id", activeOrg.orgId);

  if (error) return { ok: false, error: "erro_ao_gravar", details: error.message };

  const hdrs = await headers();
  await audit({
    action: "windsor_connection.deleted",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "windsor_connections",
    resourceId: null,
    requestId: hdrs.get("x-request-id") ?? undefined,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
    metadata: {},
  });

  revalidatePath("/app/connections");
  revalidatePath("/app/ads/windsor/meta");
  revalidatePath("/app/ads/windsor/instagram");
  return { ok: true };
}
