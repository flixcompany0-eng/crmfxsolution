/**
 * GET /api/v1/ads/windsor/accounts?platform=meta_ads|instagram — a lista de
 * contas que a organização já adicionou (não as que a chave ALCANÇA — essa
 * é `listarContasWindsorDisponiveis`, uma Server Action, porque só entra em
 * jogo na tela de Conexões, ao adicionar uma conta nova).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  platform: z.enum(["meta_ads", "instagram"]),
});

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
  const { data } = await admin
    .from("windsor_ad_accounts")
    .select("id, nome, external_account_id, moeda, is_default")
    .eq("organization_id", org.orgId)
    .eq("platform", parsed.data.platform)
    .order("created_at", { ascending: true });

  return ok({ contas: data ?? [] }, { requestId });
}
