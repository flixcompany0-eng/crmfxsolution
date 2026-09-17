"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { supportWriteError } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarContaInstagram, sincronizarContaMeta } from "@/lib/windsor/sync";

/**
 * "Atualizar" — o único jeito de os dados do Windsor.ai mudarem nesta
 * instalação, a menos que o cron opcional esteja ligado. Papel `manager`
 * (não `admin`): ler/atualizar o painel é uma tarefa diferente de trocar a
 * credencial — mesma distinção que `/app/ads/meta` faz frente a
 * `/app/settings/meta-ads`.
 */
export type SincronizarWindsorResultado =
  | { ok: true; linhasGravadas: number }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "forbidden_tenant"
        | "forbidden_role"
        | "sem_conexao"
        | "cifra_indisponivel"
        | "conta_nao_encontrada"
        | "chave_invalida"
        | "conta_nao_alcancada"
        | "limite_de_chamadas"
        | "campo_invalido"
        | "transitorio";
      detalhe?: string;
    };

export async function sincronizarContaWindsor(
  contaId: string,
  plataforma: "meta_ads" | "instagram",
): Promise<SincronizarWindsorResultado> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  if (supportWriteError(authUser.support)) return { ok: false, error: "forbidden_role" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!authUser.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    return { ok: false, error: "forbidden_role" };
  }

  const admin = createAdminClient();
  const resultado =
    plataforma === "meta_ads"
      ? await sincronizarContaMeta(admin, activeOrg.orgId, contaId)
      : await sincronizarContaInstagram(admin, activeOrg.orgId, contaId);

  if (!resultado.ok) {
    return { ok: false, error: resultado.motivo, detalhe: resultado.detalhe };
  }

  // Sync bem-sucedido MUDA dado visível (as tabelas de métrica) mesmo sendo
  // disparado por um GET conceitual ("Atualizar") — por isso audita, seguindo
  // a mesma régua do cron `recover-stuck-messages`: audita quando há efeito.
  const hdrs = await headers();
  await audit({
    action: "windsor_sync.completed",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "windsor_ad_accounts",
    resourceId: contaId,
    requestId: hdrs.get("x-request-id") ?? undefined,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
    metadata: { platform: plataforma, linhas_gravadas: resultado.linhasGravadas },
  });

  revalidatePath("/app/ads/windsor/meta");
  revalidatePath("/app/ads/windsor/instagram");
  return { ok: true, linhasGravadas: resultado.linhasGravadas };
}
