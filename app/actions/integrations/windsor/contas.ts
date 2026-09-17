"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { supportWriteError } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarContasInstagram, listarContasMeta } from "@/lib/windsor/client";
import { lerCredencialWindsor } from "@/lib/windsor/credenciais";
import type { PlataformaWindsor } from "@/lib/windsor/types";

type ErroComum =
  | "unauthenticated"
  | "forbidden_tenant"
  | "forbidden_role"
  | "mfa_required"
  | "sem_conexao"
  | "cifra_indisponivel"
  | "validation_failed"
  | "erro_ao_gravar";

async function autenticarEAutorizar(): Promise<
  | { ok: true; authUserId: string; organizationId: string }
  | { ok: false; error: ErroComum }
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

/**
 * Contas/perfis que a chave do Windsor.ai alcança e que a organização AINDA
 * NÃO adicionou — para o seletor de "adicionar conta". Chamar isto na tela
 * evita pedir ao operador que digite um id de conta de cabeça; ele escolhe
 * de uma lista, do mesmo jeito que já escolhe no painel do Windsor.ai.
 */
export async function listarContasWindsorDisponiveis(
  plataforma: PlataformaWindsor,
): Promise<
  | { ok: true; contas: Array<{ idExterno: string; nome: string | null }> }
  | { ok: false; error: ErroComum | "chave_invalida" | "conta_nao_alcancada" | "limite_de_chamadas" | "campo_invalido" | "transitorio" }
> {
  const auth = await autenticarEAutorizar();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const credencial = await lerCredencialWindsor(admin, auth.organizationId);
  if (!credencial.ok) return { ok: false, error: credencial.motivo };

  const { data: jaAdicionadas } = await admin
    .from("windsor_ad_accounts")
    .select("external_account_id")
    .eq("organization_id", auth.organizationId)
    .eq("platform", plataforma);
  const idsJaAdicionados = new Set((jaAdicionadas ?? []).map((l: { external_account_id: string }) => l.external_account_id));

  const resultado =
    plataforma === "meta_ads"
      ? await listarContasMeta(credencial.credencial.apiKey)
      : await listarContasInstagram(credencial.credencial.apiKey);

  if (!resultado.ok) return { ok: false, error: resultado.falha };

  return {
    ok: true,
    contas: resultado.dados
      .filter((c) => !idsJaAdicionados.has(c.idExterno))
      .map((c) => ({ idExterno: c.idExterno, nome: "nome" in c ? c.nome : null })),
  };
}

const adicionarSchema = z.object({
  platform: z.enum(["meta_ads", "instagram"]),
  external_account_id: z.string().trim().min(1).max(200),
  nome: z.string().trim().max(200).nullable().optional(),
});

/** Adiciona uma conta/perfil à lista de acompanhamento — "podendo adicionar outras contas de anúncio da mesma empresa". */
export async function adicionarContaWindsor(input: {
  platform: PlataformaWindsor;
  external_account_id: string;
  nome?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: ErroComum }> {
  const parsed = adicionarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_failed" };

  const auth = await autenticarEAutorizar();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  // Primeira conta da plataforma vira padrão automaticamente — sem isto, o
  // painel abriria sem nenhuma conta selecionada até alguém entrar e escolher
  // manualmente, uma fricção que a conta única (caso comum) não deveria ter.
  const { count } = await admin
    .from("windsor_ad_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", auth.organizationId)
    .eq("platform", parsed.data.platform);

  const { data, error } = await admin
    .from("windsor_ad_accounts")
    .insert({
      organization_id: auth.organizationId,
      connection_id: (
        await admin
          .from("windsor_connections")
          .select("id")
          .eq("organization_id", auth.organizationId)
          .single()
      ).data?.id,
      platform: parsed.data.platform,
      external_account_id: parsed.data.external_account_id,
      nome: parsed.data.nome ?? null,
      is_default: (count ?? 0) === 0,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "erro_ao_gravar" };

  const hdrs = await headers();
  await audit({
    action: "windsor_ad_account.created",
    actorUserId: auth.authUserId,
    organizationId: auth.organizationId,
    resourceType: "windsor_ad_accounts",
    resourceId: data.id,
    requestId: hdrs.get("x-request-id") ?? undefined,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
    metadata: { platform: parsed.data.platform },
  });

  revalidatePath("/app/connections");
  revalidatePath("/app/ads/windsor/meta");
  revalidatePath("/app/ads/windsor/instagram");
  return { ok: true, id: data.id };
}

export async function removerContaWindsor(
  contaId: string,
): Promise<{ ok: true } | { ok: false; error: ErroComum }> {
  const auth = await autenticarEAutorizar();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("windsor_ad_accounts")
    .delete()
    .eq("id", contaId)
    .eq("organization_id", auth.organizationId);

  if (error) return { ok: false, error: "erro_ao_gravar" };

  const hdrs = await headers();
  await audit({
    action: "windsor_ad_account.deleted",
    actorUserId: auth.authUserId,
    organizationId: auth.organizationId,
    resourceType: "windsor_ad_accounts",
    resourceId: contaId,
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

/** Torna uma conta a padrão da sua plataforma — abre o painel nela por default. */
export async function definirContaWindsorPadrao(
  contaId: string,
): Promise<{ ok: true } | { ok: false; error: ErroComum }> {
  const auth = await autenticarEAutorizar();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { data: conta, error: erroLeitura } = await admin
    .from("windsor_ad_accounts")
    .select("platform")
    .eq("id", contaId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (erroLeitura || !conta) return { ok: false, error: "erro_ao_gravar" };

  // Duas escritas, não uma transação explícita (a doutrina de migrations
  // proíbe BEGIN/COMMIT fora do runner, e isto é código de aplicação, não
  // migration — mas a MESMA cautela vale): primeiro zera as outras da
  // plataforma, depois liga a escolhida. O índice parcial
  // `windsor_ad_accounts_uma_padrao_por_plataforma` (0233) impede as duas
  // ficarem `true` ao mesmo tempo mesmo se a ordem inverter.
  await admin
    .from("windsor_ad_accounts")
    .update({ is_default: false })
    .eq("organization_id", auth.organizationId)
    .eq("platform", (conta as { platform: string }).platform);

  const { error } = await admin
    .from("windsor_ad_accounts")
    .update({ is_default: true })
    .eq("id", contaId)
    .eq("organization_id", auth.organizationId);

  if (error) return { ok: false, error: "erro_ao_gravar" };

  revalidatePath("/app/connections");
  revalidatePath("/app/ads/windsor/meta");
  revalidatePath("/app/ads/windsor/instagram");
  return { ok: true };
}
