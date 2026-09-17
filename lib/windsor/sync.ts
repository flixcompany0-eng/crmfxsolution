/**
 * A sincronização: busca no Windsor.ai, grava nas tabelas da 0233.
 *
 * Mesma filosofia do eixo de leitura direta da Meta (`/app/ads/meta`): NADA
 * roda sozinho por padrão. Isto é chamado pela Server Action que atende o
 * clique em "Atualizar" (`app/actions/integrations/windsor/sincronizarConta.ts`)
 * e, opcionalmente, por um cron (`app/api/v1/cron/windsor-sync`) que só existe
 * se a instalação ligar `WINDSOR_SYNC_CRON_ENABLED=1` — ver o handoff da
 * feature para o porquê de vir desligado por padrão.
 *
 * Cada função aqui cobre UMA conta e UMA janela de datas. Quem decide "quais
 * contas, com que frequência" é o chamador — este arquivo não sabe que existe
 * mais de uma organização no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import {
  buscarCriativos,
  buscarInsightsInstagram,
  buscarMetricasDiariasMeta,
  buscarMidiaInstagram,
} from "./client";
import { lerCredencialWindsor } from "./credenciais";
import type { FalhaWindsor } from "./types";

export type ResultadoDeSync =
  | { ok: true; linhasGravadas: number }
  | { ok: false; motivo: "sem_conexao" | "cifra_indisponivel" | "conta_nao_encontrada" | FalhaWindsor; detalhe?: string };

interface ContaCarregada {
  id: string;
  organizationId: string;
  platform: "meta_ads" | "instagram";
  externalAccountId: string;
}

async function carregarConta(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId: string,
): Promise<ContaCarregada | null> {
  const { data, error } = await admin
    .from("windsor_ad_accounts")
    .select("id, organization_id, platform, external_account_id")
    .eq("id", adAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  const linha = data as {
    id: string;
    organization_id: string;
    platform: "meta_ads" | "instagram";
    external_account_id: string;
  };
  return {
    id: linha.id,
    organizationId: linha.organization_id,
    platform: linha.platform,
    externalAccountId: linha.external_account_id,
  };
}

function janelaPadrao(dias: number): { de: string; ate: string } {
  // Ontem, nunca hoje — mesma regra de `app/app/ads/meta/_components/MetaAdsClient.tsx`:
  // o dia corrente está incompleto e a plataforma ainda o reprocessa.
  const ate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const de = new Date(ate.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const comoData = (d: Date) => d.toISOString().slice(0, 10);
  return { de: comoData(de), ate: comoData(ate) };
}

/** Sincroniza uma conta de Meta Ads: métricas diárias + criativos. */
export async function sincronizarContaMeta(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId: string,
  dias = 30,
): Promise<ResultadoDeSync> {
  const conta = await carregarConta(admin, organizationId, adAccountId);
  if (!conta || conta.platform !== "meta_ads") return { ok: false, motivo: "conta_nao_encontrada" };

  const credencial = await lerCredencialWindsor(admin, organizationId);
  if (!credencial.ok) return { ok: false, motivo: credencial.motivo };

  const { de, ate } = janelaPadrao(dias);
  let linhasGravadas = 0;

  const metricas = await buscarMetricasDiariasMeta(credencial.credencial.apiKey, conta.externalAccountId, de, ate);
  if (!metricas.ok) return { ok: false, motivo: metricas.falha, detalhe: metricas.detalhe };

  if (metricas.dados.length > 0) {
    const linhas = metricas.dados.map((m) => ({
      organization_id: organizationId,
      ad_account_id: conta.id,
      date: m.data,
      impressions: m.impressoes,
      clicks: m.cliques,
      spend_cents: m.gastoCentavos,
      reach: m.alcance,
      results: m.resultados,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .from("windsor_metrics_daily")
      .upsert(linhas, { onConflict: "ad_account_id,date" });
    if (error) {
      logger.error("[windsor.sync] gravar metrics_daily falhou", { organizationId, error: error.message });
      return { ok: false, motivo: "transitorio", detalhe: error.message };
    }
    linhasGravadas += linhas.length;
  }

  const criativos = await buscarCriativos(credencial.credencial.apiKey, conta.externalAccountId, de, ate);
  if (!criativos.ok) {
    // Métricas de conta já foram gravadas — não desfazer um sucesso parcial
    // por causa de um segundo endpoint. A tela mostra o número de conta e
    // avisa que os criativos não atualizaram.
    logger.warn("[windsor.sync] buscar criativos falhou", { organizationId, falha: criativos.falha });
    return { ok: true, linhasGravadas };
  }

  if (criativos.dados.criativos.length > 0) {
    const linhasCriativos = criativos.dados.criativos.map((c) => ({
      organization_id: organizationId,
      ad_account_id: conta.id,
      external_creative_id: c.idExterno,
      ad_name: c.nomeDoAnuncio,
      image_url: c.imagemUrl,
      video_thumbnail_url: c.thumbnailVideoUrl,
      message: c.mensagem,
    }));
    const { data: criativosGravados, error: erroCriativos } = await admin
      .from("windsor_creatives")
      .upsert(linhasCriativos, { onConflict: "ad_account_id,external_creative_id" })
      .select("id, external_creative_id");

    if (erroCriativos) {
      logger.error("[windsor.sync] gravar creatives falhou", { organizationId, error: erroCriativos.message });
      return { ok: true, linhasGravadas };
    }

    const idPorExterno = new Map((criativosGravados ?? []).map((c: { id: string; external_creative_id: string }) => [c.external_creative_id, c.id]));

    if (criativos.dados.metricas.length > 0) {
      const linhasMetricaCriativo = criativos.dados.metricas
        .map((m) => {
          const creativeId = idPorExterno.get(m.idExternoDoCriativo);
          if (!creativeId) return null;
          return {
            organization_id: organizationId,
            creative_id: creativeId,
            date: m.data,
            impressions: m.impressoes,
            clicks: m.cliques,
            spend_cents: m.gastoCentavos,
            results: m.resultados,
            synced_at: new Date().toISOString(),
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      if (linhasMetricaCriativo.length > 0) {
        const { error: erroMetricaCriativo } = await admin
          .from("windsor_creative_metrics_daily")
          .upsert(linhasMetricaCriativo, { onConflict: "creative_id,date" });
        if (erroMetricaCriativo) {
          logger.error("[windsor.sync] gravar creative_metrics_daily falhou", {
            organizationId,
            error: erroMetricaCriativo.message,
          });
        } else {
          linhasGravadas += linhasMetricaCriativo.length;
        }
      }
    }
  }

  // Nome/moeda da conta: atualizado a cada sync, best-effort, a partir da
  // primeira linha de métrica encontrada não é confiável (o conector de
  // métricas não traz sempre account_name) — deixado para a listagem de
  // contas (`listarContasMeta`), chamada só na tela de "adicionar conta".

  return { ok: true, linhasGravadas };
}

/** Sincroniza um perfil de Instagram: insights diários + mídia recente. */
export async function sincronizarContaInstagram(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId: string,
  dias = 30,
): Promise<ResultadoDeSync> {
  const conta = await carregarConta(admin, organizationId, adAccountId);
  if (!conta || conta.platform !== "instagram") return { ok: false, motivo: "conta_nao_encontrada" };

  const credencial = await lerCredencialWindsor(admin, organizationId);
  if (!credencial.ok) return { ok: false, motivo: credencial.motivo };

  const { de, ate } = janelaPadrao(dias);
  let linhasGravadas = 0;

  const insights = await buscarInsightsInstagram(credencial.credencial.apiKey, conta.externalAccountId, de, ate);
  if (!insights.ok) return { ok: false, motivo: insights.falha, detalhe: insights.detalhe };

  if (insights.dados.length > 0) {
    const linhas = insights.dados.map((i) => ({
      organization_id: organizationId,
      ad_account_id: conta.id,
      date: i.data,
      followers_count: i.seguidores,
      reach: i.alcance,
      impressions: i.impressoes,
      profile_views: i.visualizacoesDePerfil,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .from("windsor_instagram_insights_daily")
      .upsert(linhas, { onConflict: "ad_account_id,date" });
    if (error) {
      logger.error("[windsor.sync] gravar instagram_insights_daily falhou", {
        organizationId,
        error: error.message,
      });
      return { ok: false, motivo: "transitorio", detalhe: error.message };
    }
    linhasGravadas += linhas.length;
  }

  const midia = await buscarMidiaInstagram(credencial.credencial.apiKey, conta.externalAccountId, de, ate);
  if (midia.ok && midia.dados.length > 0) {
    const linhasMidia = midia.dados.map((m) => ({
      organization_id: organizationId,
      ad_account_id: conta.id,
      external_media_id: m.idExterno,
      media_type: m.tipo,
      caption: m.legenda,
      permalink: m.permalink,
      thumbnail_url: m.thumbnailUrl,
      like_count: m.curtidas,
      comments_count: m.comentarios,
      saved_count: m.salvamentos,
      shares_count: m.compartilhamentos,
      posted_at: m.publicadoEm,
      synced_at: new Date().toISOString(),
    }));
    const { error: erroMidia } = await admin
      .from("windsor_instagram_media")
      .upsert(linhasMidia, { onConflict: "ad_account_id,external_media_id" });
    if (erroMidia) {
      logger.error("[windsor.sync] gravar instagram_media falhou", { organizationId, error: erroMidia.message });
    } else {
      linhasGravadas += linhasMidia.length;
    }
  } else if (!midia.ok) {
    logger.warn("[windsor.sync] buscar mídia do instagram falhou", { organizationId, falha: midia.falha });
  }

  return { ok: true, linhasGravadas };
}
