/**
 * O resumo de Meta Ads + Instagram que a IA do sistema pode ler — "apenas
 * para a inteligência artificial do sistema ter esses dados".
 *
 * ─── O que este arquivo É ───────────────────────────────────────────────────
 * Uma função PURA de leitura e formatação: recebe um admin client e uma
 * organização, devolve um resumo estruturado (e uma versão em texto corrido,
 * pronta para entrar num prompt) dos últimos N dias de Meta Ads e Instagram.
 * Sem chamada de modelo aqui dentro.
 *
 * ─── O que este arquivo NÃO é (ainda) ───────────────────────────────────────
 * Não é um "ponto de IA" registrado. `lib/ai/pontos/registro.ts` é a fonte
 * única de verdade de "quem chama modelo, com qual capacidade" —
 * `tests/unit/pontos-de-ia-completude.test.ts` reprova tanto uma chamada de
 * modelo sem registro quanto um registro que nada chama. Conectar isto a uma
 * chamada de LLM de verdade (o "campo de conversa com IA" e a "curadoria
 * rápida" pedidos no briefing da feature) é o próximo passo, documentado no
 * handoff da feature — não implementado aqui de propósito, para não abrir uma
 * 24ª chamada de modelo sem registro, binding por organização e teste de
 * completude, que é exatamente o problema que aquele arquivo existe para
 * fechar.
 *
 * O que ESTE arquivo entrega é a peça que faltava para chegar lá: os dados já
 * organizados, para quem ligar o ponto de IA não precisar reaprender o schema
 * de `windsor_metrics_daily`/`windsor_instagram_insights_daily`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResumoWindsorParaIA {
  organizationId: string;
  geradoEm: string;
  periodo: { de: string; ate: string };
  metaAds: Array<{
    conta: string;
    moeda: string;
    impressoes: number;
    cliques: number;
    gastoCentavos: number;
    resultados: number;
    ctr: number | null;
    custoPorResultadoCentavos: number | null;
  }>;
  instagram: Array<{
    conta: string;
    seguidoresAtual: number | null;
    variacaoDeSeguidores: number | null;
    alcanceTotal: number;
    impressoesTotal: number;
  }>;
  /** Pronto para colar num prompt de sistema — nenhuma formatação adicional necessária. */
  textoCorrido: string;
}

function comoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Monta o resumo dos últimos `dias` (padrão 30) para TODAS as contas
 * acompanhadas da organização, nas duas plataformas.
 *
 * Admin client: as tabelas fonte têm RLS ligada sem policies (0233). Esta
 * função não decide QUEM pode vê-la — quem chamar precisa aplicar o próprio
 * gate de autorização, do mesmo jeito que toda rota que usa o admin client.
 */
export async function montarResumoWindsorParaIA(
  admin: SupabaseClient,
  organizationId: string,
  dias = 30,
): Promise<ResumoWindsorParaIA> {
  const ate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const de = new Date(ate.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  const periodo = { de: comoData(de), ate: comoData(ate) };

  const { data: contas } = await admin
    .from("windsor_ad_accounts")
    .select("id, platform, nome, external_account_id, moeda")
    .eq("organization_id", organizationId);

  const contasMeta = (contas ?? []).filter((c: { platform: string }) => c.platform === "meta_ads");
  const contasInstagram = (contas ?? []).filter((c: { platform: string }) => c.platform === "instagram");

  const metaAds: ResumoWindsorParaIA["metaAds"] = [];
  for (const conta of contasMeta) {
    const c = conta as { id: string; nome: string | null; external_account_id: string; moeda: string | null };
    const { data: linhas } = await admin
      .from("windsor_metrics_daily")
      .select("impressions, clicks, spend_cents, results")
      .eq("ad_account_id", c.id)
      .gte("date", periodo.de)
      .lte("date", periodo.ate);

    const totais = (linhas ?? []).reduce(
      (acc: { impressions: number; clicks: number; spend_cents: number; results: number }, l: { impressions: number; clicks: number; spend_cents: number; results: number | null }) => ({
        impressions: acc.impressions + l.impressions,
        clicks: acc.clicks + l.clicks,
        spend_cents: acc.spend_cents + l.spend_cents,
        results: acc.results + (l.results ?? 0),
      }),
      { impressions: 0, clicks: 0, spend_cents: 0, results: 0 },
    );

    metaAds.push({
      conta: c.nome ?? c.external_account_id,
      moeda: c.moeda ?? "BRL",
      impressoes: totais.impressions,
      cliques: totais.clicks,
      gastoCentavos: totais.spend_cents,
      resultados: totais.results,
      ctr: totais.impressions > 0 ? Number(((totais.clicks / totais.impressions) * 100).toFixed(2)) : null,
      custoPorResultadoCentavos: totais.results > 0 ? Math.round(totais.spend_cents / totais.results) : null,
    });
  }

  const instagram: ResumoWindsorParaIA["instagram"] = [];
  for (const conta of contasInstagram) {
    const c = conta as { id: string; nome: string | null; external_account_id: string };
    const { data: linhas } = await admin
      .from("windsor_instagram_insights_daily")
      .select("date, followers_count, reach, impressions")
      .eq("ad_account_id", c.id)
      .gte("date", periodo.de)
      .lte("date", periodo.ate)
      .order("date", { ascending: true });

    const serie = (linhas ?? []) as Array<{
      date: string;
      followers_count: number | null;
      reach: number | null;
      impressions: number | null;
    }>;
    const primeira = serie[0]?.followers_count ?? null;
    const ultima = serie.at(-1)?.followers_count ?? null;

    instagram.push({
      conta: c.nome ?? c.external_account_id,
      seguidoresAtual: ultima,
      variacaoDeSeguidores: primeira !== null && ultima !== null ? ultima - primeira : null,
      alcanceTotal: serie.reduce((acc, l) => acc + (l.reach ?? 0), 0),
      impressoesTotal: serie.reduce((acc, l) => acc + (l.impressions ?? 0), 0),
    });
  }

  const linhasDeTexto: string[] = [
    `Meta Ads e Instagram — ${periodo.de} a ${periodo.ate} (via Windsor.ai).`,
  ];
  for (const m of metaAds) {
    linhasDeTexto.push(
      `Meta Ads "${m.conta}": ${m.impressoes} impressões, ${m.cliques} cliques` +
        (m.ctr !== null ? ` (CTR ${m.ctr}%)` : "") +
        `, gasto ${(m.gastoCentavos / 100).toFixed(2)} ${m.moeda}` +
        (m.resultados > 0 ? `, ${m.resultados} resultados` : ""),
    );
  }
  for (const i of instagram) {
    linhasDeTexto.push(
      `Instagram "${i.conta}": ${i.seguidoresAtual ?? "—"} seguidores` +
        (i.variacaoDeSeguidores !== null ? ` (${i.variacaoDeSeguidores >= 0 ? "+" : ""}${i.variacaoDeSeguidores} no período)` : "") +
        `, alcance total ${i.alcanceTotal}, impressões ${i.impressoesTotal}`,
    );
  }

  return {
    organizationId,
    geradoEm: new Date().toISOString(),
    periodo,
    metaAds,
    instagram,
    textoCorrido: linhasDeTexto.join("\n"),
  };
}
