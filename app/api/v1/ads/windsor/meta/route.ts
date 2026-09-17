/**
 * GET /api/v1/ads/windsor/meta — série diária + criativos de UMA conta de
 * Meta Ads, lidos do nosso próprio banco (já sincronizado via Windsor.ai).
 *
 * Diferença estrutural para `/api/v1/ads/meta/campaigns`: aquela rota chama a
 * plataforma NA HORA, a cada abertura de tela. Esta lê tabelas que só mudam
 * quando alguém clica "Atualizar" (Server Action `sincronizarContaWindsor`,
 * que fala com o Windsor.ai) — então esta rota nunca fala com um provedor
 * externo, e por isso não tem `_falha.ts` de rede: as únicas causas de falha
 * aqui são "sem conexão", "cifra indisponível" e "conta não é sua".
 *
 * `account_id` é o UUID interno de `windsor_ad_accounts`, não o `act_<id>` da
 * Meta — o id externo é um detalhe de `lib/windsor/client.ts` que a tela nunca
 * precisa ver.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { existeConexaoWindsor } from "@/lib/windsor/credenciais";

import { respostaContaNaoEncontrada, respostaSemConexaoWindsor } from "../_falha";

export const dynamic = "force-dynamic";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z
  .object({
    account_id: z.string().uuid(),
    from: z.string().regex(DATA).optional(),
    to: z.string().regex(DATA).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "o início do período não pode ser depois do fim",
    path: ["from"],
  });

function comoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodoPadrao(): { from: string; to: string } {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const trintaDiasAntes = new Date(ontem.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: comoData(trintaDiasAntes), to: comoData(ontem) };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("manager", { requestId, resource: "windsor_ads_insights" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const admin = createAdminClient();

  const conectado = await existeConexaoWindsor(admin, org.orgId);
  if (!conectado) return respostaSemConexaoWindsor("sem_conexao", { requestId });

  const { data: conta } = await admin
    .from("windsor_ad_accounts")
    .select("id, nome, moeda, external_account_id, is_default")
    .eq("id", parsed.data.account_id)
    .eq("organization_id", org.orgId)
    .eq("platform", "meta_ads")
    .maybeSingle();

  if (!conta) return respostaContaNaoEncontrada({ requestId });

  const padrao = periodoPadrao();
  const de = parsed.data.from ?? padrao.from;
  const ate = parsed.data.to ?? padrao.to;

  const { data: metricas } = await admin
    .from("windsor_metrics_daily")
    .select("date, impressions, clicks, spend_cents, reach, results")
    .eq("ad_account_id", conta.id)
    .gte("date", de)
    .lte("date", ate)
    .order("date", { ascending: true });

  const { data: criativos } = await admin
    .from("windsor_creatives")
    .select("id, external_creative_id, ad_name, image_url, video_thumbnail_url, message")
    .eq("ad_account_id", conta.id);

  const idsDosCriativos = (criativos ?? []).map((c: { id: string }) => c.id);
  const { data: metricasDosCriativos } =
    idsDosCriativos.length > 0
      ? await admin
          .from("windsor_creative_metrics_daily")
          .select("creative_id, date, impressions, clicks, spend_cents, results")
          .in("creative_id", idsDosCriativos)
          .gte("date", de)
          .lte("date", ate)
      : { data: [] };

  const totaisPorCriativo = new Map<
    string,
    { impressions: number; clicks: number; spend_cents: number; results: number }
  >();
  for (const linha of metricasDosCriativos ?? []) {
    const l = linha as {
      creative_id: string;
      impressions: number;
      clicks: number;
      spend_cents: number;
      results: number | null;
    };
    const acumulado = totaisPorCriativo.get(l.creative_id) ?? {
      impressions: 0,
      clicks: 0,
      spend_cents: 0,
      results: 0,
    };
    acumulado.impressions += l.impressions;
    acumulado.clicks += l.clicks;
    acumulado.spend_cents += l.spend_cents;
    acumulado.results += l.results ?? 0;
    totaisPorCriativo.set(l.creative_id, acumulado);
  }

  const totais = (metricas ?? []).reduce(
    (acc, l: { impressions: number; clicks: number; spend_cents: number; reach: number | null; results: number | null }) => ({
      impressions: acc.impressions + l.impressions,
      clicks: acc.clicks + l.clicks,
      spend_cents: acc.spend_cents + l.spend_cents,
      results: acc.results + (l.results ?? 0),
    }),
    { impressions: 0, clicks: 0, spend_cents: 0, results: 0 },
  );

  return ok(
    {
      conta: {
        id: conta.id,
        nome: conta.nome,
        moeda: conta.moeda ?? "BRL",
        is_default: conta.is_default,
      },
      periodo: { from: de, to: ate },
      totais,
      serie_diaria: metricas ?? [],
      criativos: (criativos ?? []).map((c: { id: string; external_creative_id: string; ad_name: string | null; image_url: string | null; video_thumbnail_url: string | null; message: string | null }) => ({
        id: c.id,
        ad_name: c.ad_name,
        image_url: c.image_url,
        video_thumbnail_url: c.video_thumbnail_url,
        message: c.message,
        totais: totaisPorCriativo.get(c.id) ?? { impressions: 0, clicks: 0, spend_cents: 0, results: 0 },
      })),
      lido_em: new Date().toISOString(),
    },
    { requestId },
  );
}
