/**
 * Cliente HTTP da API de conectores do Windsor.ai — a fronteira que sabe o
 * NOME DO CAMPO e o FORMATO DO FIO. Ninguém fora deste arquivo (e de
 * `sync.ts`, que consome o que ele devolve já normalizado) deveria saber que
 * o parâmetro se chama `select_accounts` ou que o conector de Meta Ads se
 * chama `facebook` — mesma fronteira que `lib/plataformas-de-anuncio/meta/`
 * mantém para o token direto da Meta.
 *
 * ─── Base e autenticação ─────────────────────────────────────────────────
 * `https://connectors.windsor.ai/{connector}?api_key=...&fields=...`. A API
 * pública de conectores do Windsor.ai só aceita a chave por QUERY STRING —
 * não por header. Isto normalmente violaria o anti-pattern 12 do CLAUDE.md
 * ("API key nunca em query string"), que existe para as NOSSAS rotas
 * (`/api/v1/...`), cujos logs de acesso são nossos e o formato é nossa
 * escolha. Aqui é o contrato de um provedor externo que só suporta esse
 * modo — documentado em `https://windsor.ai/api-documentation/` (lido em
 * 2026-09-16) —, e não há alternativa de header a escolher. O que ISTO
 * arquivo faz para não agravar o risco: a chamada sai só do SERVIDOR (nunca
 * do browser), e nenhum log da casa imprime a URL montada — ver `logger.info`
 * abaixo, que loga o conector e a organização, nunca a query completa.
 *
 * ─── Verificado contra a documentação pública, não contra uma conta real ───
 * Os nomes de campo abaixo (`FIELDS_*`) foram conferidos em
 * `windsor.ai/api-documentation/`, `windsor.ai/data-field/facebook/` e
 * `windsor.ai/data-field/instagram/` em 2026-09-16 — nenhuma chave de API real
 * foi usada para testar esta integração. Se o conector do Windsor.ai devolver
 * 400/`campo_invalido` para algum destes nomes, o `_max_rows`/`fields` errado
 * está aqui, não no restante do sistema; ajuste esta lista e o resto do eixo
 * (tabelas, sync, telas) não muda.
 */
import { logger } from "@/lib/logger";
import type {
  CriativoWindsor,
  FalhaWindsor,
  LinhaInsightInstagramDiaria,
  LinhaMetricaCriativoDiaria,
  LinhaMetricaDiaria,
  MidiaInstagram,
  ResultadoWindsor,
} from "./types";

const BASE_URL = "https://connectors.windsor.ai";

const CONECTOR_META_ADS = "facebook";
const CONECTOR_INSTAGRAM = "instagram";

const FIELDS_CONTAS_META =
  "account_id,account_name,account_currency,account_status";
const FIELDS_METRICA_DIARIA_META = "date,account_id,impressions,clicks,spend,reach,results";
const FIELDS_CRIATIVOS_META =
  "ad_id,ad_name,image_url,thumbnail_url,message,date,impressions,clicks,spend,results";

const FIELDS_CONTAS_INSTAGRAM = "account_id,username,account_name";
const FIELDS_INSIGHTS_DIARIOS_INSTAGRAM =
  "date,account_id,followers_count,reach_1d,media_impressions,profile_views_1d";
const FIELDS_MIDIA_INSTAGRAM =
  "media_id,media_type,media_caption,media_permalink,media_thumbnail_url,media_like_count,media_comments_count,media_saved,media_shares,date";

interface RespostaWindsor {
  data?: Array<Record<string, unknown>>;
  error?: string;
  message?: string;
}

async function chamar(
  conector: string,
  apiKey: string,
  params: Record<string, string>,
): Promise<ResultadoWindsor<Array<Record<string, unknown>>>> {
  const url = new URL(`${BASE_URL}/${conector}`);
  url.searchParams.set("api_key", apiKey);
  for (const [chave, valor] of Object.entries(params)) {
    url.searchParams.set(chave, valor);
  }

  let resposta: Response;
  try {
    resposta = await fetch(url.toString(), {
      method: "GET",
      // Melhor esforço de timeout: a doutrina de rede da casa (webhooks
      // outbound) usa AbortSignal.timeout; replicado aqui pela mesma razão —
      // uma chamada pendurada não pode travar o botão "Atualizar".
      signal: AbortSignal.timeout(20_000),
    });
  } catch (erro) {
    logger.warn("[windsor.client] chamada falhou (rede)", {
      conector,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return { ok: false, falha: "transitorio", detalhe: "Falha de rede ao falar com o Windsor.ai." };
  }

  const falhaPorStatus = mapearStatus(resposta.status);
  if (falhaPorStatus) {
    const corpo = await resposta.text().catch(() => "");
    logger.warn("[windsor.client] status de erro", {
      conector,
      status: resposta.status,
    });
    return { ok: false, falha: falhaPorStatus, detalhe: corpo.slice(0, 300) || `HTTP ${resposta.status}` };
  }

  let corpo: RespostaWindsor;
  try {
    corpo = (await resposta.json()) as RespostaWindsor;
  } catch {
    return { ok: false, falha: "transitorio", detalhe: "Resposta do Windsor.ai não era JSON." };
  }

  if (corpo.error || corpo.message) {
    return {
      ok: false,
      falha: "campo_invalido",
      detalhe: corpo.error ?? corpo.message ?? "Erro não identificado do Windsor.ai.",
    };
  }

  return { ok: true, dados: corpo.data ?? [] };
}

function mapearStatus(status: number): FalhaWindsor | null {
  if (status === 401 || status === 403) return "chave_invalida";
  if (status === 429) return "limite_de_chamadas";
  if (status === 400) return "campo_invalido";
  if (status >= 500) return "transitorio";
  return null;
}

function numero(valor: unknown): number {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "string" ? Number(valor) : valor;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim().length > 0) return valor;
  return null;
}

/** Contas de Meta Ads que a chave alcança — usado só na tela de "adicionar conta". */
export async function listarContasMeta(
  apiKey: string,
): Promise<ResultadoWindsor<Array<{ idExterno: string; nome: string | null; moeda: string | null }>>> {
  const r = await chamar(CONECTOR_META_ADS, apiKey, {
    fields: FIELDS_CONTAS_META,
    date_preset: "last_7d",
    _max_rows: "200",
  });
  if (!r.ok) return r;
  const vistos = new Set<string>();
  const contas: Array<{ idExterno: string; nome: string | null; moeda: string | null }> = [];
  for (const linha of r.dados) {
    const id = texto(linha.account_id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    contas.push({
      idExterno: id,
      nome: texto(linha.account_name),
      moeda: texto(linha.account_currency),
    });
  }
  return { ok: true, dados: contas };
}

/** Perfis de Instagram que a chave alcança. */
export async function listarContasInstagram(
  apiKey: string,
): Promise<ResultadoWindsor<Array<{ idExterno: string; nome: string | null }>>> {
  const r = await chamar(CONECTOR_INSTAGRAM, apiKey, {
    fields: FIELDS_CONTAS_INSTAGRAM,
    date_preset: "last_7d",
    _max_rows: "200",
  });
  if (!r.ok) return r;
  const vistos = new Set<string>();
  const contas: Array<{ idExterno: string; nome: string | null }> = [];
  for (const linha of r.dados) {
    const id = texto(linha.account_id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    contas.push({ idExterno: id, nome: texto(linha.account_name) ?? texto(linha.username) });
  }
  return { ok: true, dados: contas };
}

export async function buscarMetricasDiariasMeta(
  apiKey: string,
  idExternoDaConta: string,
  dateFrom: string,
  dateTo: string,
): Promise<ResultadoWindsor<LinhaMetricaDiaria[]>> {
  const r = await chamar(CONECTOR_META_ADS, apiKey, {
    fields: FIELDS_METRICA_DIARIA_META,
    select_accounts: idExternoDaConta,
    date_from: dateFrom,
    date_to: dateTo,
    _max_rows: "1000",
  });
  if (!r.ok) return r;
  const linhas: LinhaMetricaDiaria[] = r.dados
    .filter((l) => texto(l.date))
    .map((l) => ({
      data: String(l.date),
      impressoes: numero(l.impressions),
      cliques: numero(l.clicks),
      // Windsor devolve `spend` em unidade cheia (ex.: 125.45) — a casa grava
      // dinheiro em `_cents` (convenção do CLAUDE.md), então a conversão
      // acontece aqui, na borda, uma vez só.
      gastoCentavos: Math.round(numero(l.spend) * 100),
      alcance: numeroOuNulo(l.reach),
      resultados: numeroOuNulo(l.results),
    }));
  return { ok: true, dados: linhas };
}

export async function buscarCriativos(
  apiKey: string,
  idExternoDaConta: string,
  dateFrom: string,
  dateTo: string,
): Promise<ResultadoWindsor<{ criativos: CriativoWindsor[]; metricas: LinhaMetricaCriativoDiaria[] }>> {
  const r = await chamar(CONECTOR_META_ADS, apiKey, {
    fields: FIELDS_CRIATIVOS_META,
    select_accounts: idExternoDaConta,
    date_from: dateFrom,
    date_to: dateTo,
    _max_rows: "2000",
  });
  if (!r.ok) return r;

  const criativosPorId = new Map<string, CriativoWindsor>();
  const metricas: LinhaMetricaCriativoDiaria[] = [];

  for (const linha of r.dados) {
    const idExterno = texto(linha.ad_id);
    if (!idExterno) continue;

    if (!criativosPorId.has(idExterno)) {
      criativosPorId.set(idExterno, {
        idExterno,
        nomeDoAnuncio: texto(linha.ad_name),
        imagemUrl: texto(linha.image_url),
        thumbnailVideoUrl: texto(linha.thumbnail_url),
        mensagem: texto(linha.message),
      });
    }

    const data = texto(linha.date);
    if (data) {
      metricas.push({
        idExternoDoCriativo: idExterno,
        data,
        impressoes: numero(linha.impressions),
        cliques: numero(linha.clicks),
        gastoCentavos: Math.round(numero(linha.spend) * 100),
        resultados: numeroOuNulo(linha.results),
      });
    }
  }

  return { ok: true, dados: { criativos: [...criativosPorId.values()], metricas } };
}

export async function buscarInsightsInstagram(
  apiKey: string,
  idExternoDaConta: string,
  dateFrom: string,
  dateTo: string,
): Promise<ResultadoWindsor<LinhaInsightInstagramDiaria[]>> {
  const r = await chamar(CONECTOR_INSTAGRAM, apiKey, {
    fields: FIELDS_INSIGHTS_DIARIOS_INSTAGRAM,
    select_accounts: idExternoDaConta,
    date_from: dateFrom,
    date_to: dateTo,
    _max_rows: "1000",
  });
  if (!r.ok) return r;
  const linhas: LinhaInsightInstagramDiaria[] = r.dados
    .filter((l) => texto(l.date))
    .map((l) => ({
      data: String(l.date),
      seguidores: numeroOuNulo(l.followers_count),
      alcance: numeroOuNulo(l.reach_1d),
      impressoes: numeroOuNulo(l.media_impressions),
      visualizacoesDePerfil: numeroOuNulo(l.profile_views_1d),
    }));
  return { ok: true, dados: linhas };
}

export async function buscarMidiaInstagram(
  apiKey: string,
  idExternoDaConta: string,
  dateFrom: string,
  dateTo: string,
): Promise<ResultadoWindsor<MidiaInstagram[]>> {
  const r = await chamar(CONECTOR_INSTAGRAM, apiKey, {
    fields: FIELDS_MIDIA_INSTAGRAM,
    select_accounts: idExternoDaConta,
    date_from: dateFrom,
    date_to: dateTo,
    _max_rows: "500",
  });
  if (!r.ok) return r;
  const vistos = new Set<string>();
  const midias: MidiaInstagram[] = [];
  for (const linha of r.dados) {
    const idExterno = texto(linha.media_id);
    if (!idExterno || vistos.has(idExterno)) continue;
    vistos.add(idExterno);
    const tipo = texto(linha.media_type);
    midias.push({
      idExterno,
      tipo: tipo === "IMAGE" || tipo === "VIDEO" || tipo === "CAROUSEL_ALBUM" || tipo === "REEL" ? tipo : null,
      legenda: texto(linha.media_caption),
      permalink: texto(linha.media_permalink),
      thumbnailUrl: texto(linha.media_thumbnail_url),
      curtidas: numeroOuNulo(linha.media_like_count),
      comentarios: numeroOuNulo(linha.media_comments_count),
      salvamentos: numeroOuNulo(linha.media_saved),
      compartilhamentos: numeroOuNulo(linha.media_shares),
      publicadoEm: texto(linha.date) ? new Date(String(linha.date)).toISOString() : null,
    });
  }
  return { ok: true, dados: midias };
}
