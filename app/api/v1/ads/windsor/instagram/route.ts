/**
 * GET /api/v1/ads/windsor/instagram — insights diários + mídia recente de UM
 * perfil de Instagram, lidos do nosso banco (sincronizado via Windsor.ai).
 * Irmã de `../meta/route.ts`; mesma razão de não falar com provedor externo
 * nesta rota.
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

  const authz = await requireRole("manager", { requestId, resource: "windsor_instagram_insights" });
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
    .select("id, nome, external_account_id, is_default")
    .eq("id", parsed.data.account_id)
    .eq("organization_id", org.orgId)
    .eq("platform", "instagram")
    .maybeSingle();

  if (!conta) return respostaContaNaoEncontrada({ requestId });

  const padrao = periodoPadrao();
  const de = parsed.data.from ?? padrao.from;
  const ate = parsed.data.to ?? padrao.to;

  const { data: insights } = await admin
    .from("windsor_instagram_insights_daily")
    .select("date, followers_count, reach, impressions, profile_views")
    .eq("ad_account_id", conta.id)
    .gte("date", de)
    .lte("date", ate)
    .order("date", { ascending: true });

  const { data: midia } = await admin
    .from("windsor_instagram_media")
    .select(
      "external_media_id, media_type, caption, permalink, thumbnail_url, like_count, comments_count, saved_count, shares_count, posted_at",
    )
    .eq("ad_account_id", conta.id)
    .order("posted_at", { ascending: false })
    .limit(24);

  const ultimaLinha = (insights ?? []).at(-1) as
    | { followers_count: number | null }
    | undefined;

  return ok(
    {
      conta: { id: conta.id, nome: conta.nome, is_default: conta.is_default },
      periodo: { from: de, to: ate },
      seguidores_atual: ultimaLinha?.followers_count ?? null,
      serie_diaria: insights ?? [],
      midia: midia ?? [],
      lido_em: new Date().toISOString(),
    },
    { requestId },
  );
}
