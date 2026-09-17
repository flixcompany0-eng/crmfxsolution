"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { supportWriteError } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";

/**
 * Saldo e depósito da conta de anúncios — a parte OPCIONAL e separada do
 * eixo Windsor.ai, pelas razões do cabeçalho da migration 0233:
 * `windsor_account_billing` guarda um token DIFERENTE (sistema Meta Business,
 * escopo `business_management`), porque a API de relatórios do Windsor.ai
 * não expõe saldo nem depósito — só a própria Meta expõe, e por outra porta.
 *
 * ─── O que É lido, e o que NÃO É ────────────────────────────────────────────
 * `balance` e `amount_spent` vêm de `GET /act_<id>?fields=balance,amount_spent,
 * currency` — campos documentados da Graph API. HISTÓRICO DE DEPÓSITO não:
 * a Graph API não tem um campo simples e estável para isso (exige o produto de
 * Business Manager, com permissão que a maioria das contas de anúncio não tem
 * liberada para app de terceiro). Por isso `last_deposit_amount_cents` e
 * `last_deposit_at` ficam sempre `null` nesta versão — a tela mostra "não
 * disponível" em vez de um número calculado por aproximação, que pareceria
 * exato e não seria.
 */

const GRAPH_API_VERSAO = "v21.0";

type ErroBilling =
  | "unauthenticated"
  | "forbidden_tenant"
  | "forbidden_role"
  | "mfa_required"
  | "validation_failed"
  | "cifra_indisponivel"
  | "conta_nao_encontrada"
  | "erro_ao_gravar"
  | "token_invalido"
  | "transitorio";

async function autorizarAdmin(): Promise<
  { ok: true; authUserId: string; organizationId: string } | { ok: false; error: ErroBilling }
> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  if (supportWriteError(authUser.support)) return { ok: false, error: "forbidden_role" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!authUser.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    return { ok: false, error: "forbidden_role" };
  }
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };
  return { ok: true, authUserId: authUser.id, organizationId: activeOrg.orgId };
}

const salvarSchema = z.object({
  ad_account_id: z.string().uuid(),
  meta_business_token: z.string().trim().min(20).max(1000),
});

/** Cola (ou troca) o token de sistema Meta Business para ESTA conta. */
export async function salvarTokenDeNegocioMeta(input: {
  ad_account_id: string;
  meta_business_token: string;
}): Promise<{ ok: true } | { ok: false; error: ErroBilling }> {
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_failed" };

  const auth = await autorizarAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { data: conta } = await admin
    .from("windsor_ad_accounts")
    .select("id")
    .eq("id", parsed.data.ad_account_id)
    .eq("organization_id", auth.organizationId)
    .eq("platform", "meta_ads")
    .maybeSingle();
  if (!conta) return { ok: false, error: "conta_nao_encontrada" };

  const cifrado = await encryptWebhookSecret(admin, parsed.data.meta_business_token);
  if (!cifrado) return { ok: false, error: "cifra_indisponivel" };

  const { error } = await admin.from("windsor_account_billing").upsert(
    {
      organization_id: auth.organizationId,
      ad_account_id: parsed.data.ad_account_id,
      meta_business_token_encrypted: cifrado,
      updated_by: auth.authUserId,
    },
    { onConflict: "ad_account_id" },
  );
  if (error) return { ok: false, error: "erro_ao_gravar" };

  revalidatePath("/app/ads/windsor/meta");
  return { ok: true };
}

export async function removerTokenDeNegocioMeta(
  adAccountId: string,
): Promise<{ ok: true } | { ok: false; error: ErroBilling }> {
  const auth = await autorizarAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("windsor_account_billing")
    .delete()
    .eq("ad_account_id", adAccountId)
    .eq("organization_id", auth.organizationId);
  if (error) return { ok: false, error: "erro_ao_gravar" };

  revalidatePath("/app/ads/windsor/meta");
  return { ok: true };
}

/** Chama a Graph API e atualiza saldo/gasto — não busca depósito (ver cabeçalho). */
export async function sincronizarSaldoMeta(
  adAccountId: string,
): Promise<{ ok: true } | { ok: false; error: ErroBilling }> {
  const auth = await autorizarAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { data: linha } = await admin
    .from("windsor_account_billing")
    .select("meta_business_token_encrypted")
    .eq("ad_account_id", adAccountId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (!linha?.meta_business_token_encrypted) return { ok: false, error: "conta_nao_encontrada" };

  const { data: conta } = await admin
    .from("windsor_ad_accounts")
    .select("external_account_id")
    .eq("id", adAccountId)
    .maybeSingle();
  if (!conta) return { ok: false, error: "conta_nao_encontrada" };

  const token = await decryptWebhookSecret(admin, linha.meta_business_token_encrypted as string);
  if (!token) return { ok: false, error: "cifra_indisponivel" };

  const idDaConta = String((conta as { external_account_id: string }).external_account_id).replace(/^act_/, "");

  let resposta: Response;
  try {
    resposta = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSAO}/act_${idDaConta}?fields=balance,amount_spent,currency&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
  } catch (erro) {
    logger.warn("[windsor.billing] chamada à Graph API falhou", {
      organizationId: auth.organizationId,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return { ok: false, error: "transitorio" };
  }

  if (resposta.status === 401 || resposta.status === 400) return { ok: false, error: "token_invalido" };
  if (!resposta.ok) return { ok: false, error: "transitorio" };

  const corpo = (await resposta.json()) as { balance?: string; amount_spent?: string; currency?: string };

  const { error } = await admin
    .from("windsor_account_billing")
    .update({
      currency: corpo.currency ?? null,
      balance_cents: corpo.balance ? Number(corpo.balance) : null,
      amount_spent_cents: corpo.amount_spent ? Number(corpo.amount_spent) : null,
      synced_at: new Date().toISOString(),
    })
    .eq("ad_account_id", adAccountId)
    .eq("organization_id", auth.organizationId);

  if (error) return { ok: false, error: "erro_ao_gravar" };

  revalidatePath("/app/ads/windsor/meta");
  return { ok: true };
}
