/**
 * O vocabulário do eixo Windsor.ai — irmão de `lib/plataformas-de-anuncio/types.ts`,
 * separado dele porque a credencial, a tabela e o ciclo de vida são outros (ver
 * o cabeçalho da migration 0233). O que os dois compartilham é a FILOSOFIA:
 * falha com física declarada, nunca um `null` mudo, e contadores crus — nunca
 * uma razão pronta gravada onde poderia ser calculada.
 */

/** As duas plataformas que o Windsor.ai alcança, nesta feature. */
export type PlataformaWindsor = "meta_ads" | "instagram";

/** Uma conta de anúncios ou perfil que a organização escolheu acompanhar. */
export interface ContaWindsor {
  id: string;
  plataforma: PlataformaWindsor;
  idExterno: string;
  nome: string | null;
  moeda: string | null;
  padrao: boolean;
}

/**
 * Por que cada ausência tem nome próprio — mesma lição de `MotivoSemCredencial`
 * em `lib/plataformas-de-anuncio/credenciais.ts`: "nunca conectou" convida a
 * conectar; "chave inválida" pede para colar outra; "cifra indisponível" é
 * problema de INSTALAÇÃO e nenhum clique na tela da organização resolve.
 */
export type MotivoSemCredencialWindsor = "sem_conexao" | "cifra_indisponivel";

export interface CredencialWindsor {
  apiKey: string;
}

export type LeituraDeCredencialWindsor =
  | { ok: true; credencial: CredencialWindsor }
  | { ok: false; motivo: MotivoSemCredencialWindsor };

/**
 * O resultado de uma chamada à API do Windsor.ai, com a física da falha
 * declarada — mesmo desenho de `ResultadoDeLeitura<T>` no eixo de leitura
 * direta da Meta.
 *
 *  - `chave_invalida`      → a API do Windsor recusou a chave (401/403).
 *  - `conta_nao_alcancada` → a chave vale, mas não alcança a conta pedida —
 *                            geralmente porque ela foi removida da seleção de
 *                            contas lá no painel do Windsor.ai.
 *  - `limite_de_chamadas`  → 429. Windsor documenta 600/min e 10.000/dia.
 *  - `campo_invalido`      → a API recusou um campo da consulta — bug nosso ou
 *                            campo que o conector removeu, não erro do operador.
 *  - `transitorio`         → rede, timeout, 5xx.
 */
export type FalhaWindsor =
  | "chave_invalida"
  | "conta_nao_alcancada"
  | "limite_de_chamadas"
  | "campo_invalido"
  | "transitorio";

export type ResultadoWindsor<T> =
  | { ok: true; dados: T }
  | { ok: false; falha: FalhaWindsor; detalhe: string };

/** Uma linha crua de métrica diária de conta (Meta Ads), já normalizada dos nomes de campo do Windsor. */
export interface LinhaMetricaDiaria {
  data: string; // YYYY-MM-DD
  impressoes: number;
  cliques: number;
  gastoCentavos: number;
  alcance: number | null;
  resultados: number | null;
}

/** Um criativo (nível de anúncio) com sua arte/copy, sem métrica — a métrica vem em linha própria. */
export interface CriativoWindsor {
  idExterno: string;
  nomeDoAnuncio: string | null;
  imagemUrl: string | null;
  thumbnailVideoUrl: string | null;
  mensagem: string | null;
}

export interface LinhaMetricaCriativoDiaria {
  idExternoDoCriativo: string;
  data: string;
  impressoes: number;
  cliques: number;
  gastoCentavos: number;
  resultados: number | null;
}

/** Uma linha diária de Instagram Insights (nível de conta). */
export interface LinhaInsightInstagramDiaria {
  data: string;
  seguidores: number | null;
  alcance: number | null;
  impressoes: number | null;
  visualizacoesDePerfil: number | null;
}

export type TipoDeMidiaInstagram = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";

export interface MidiaInstagram {
  idExterno: string;
  tipo: TipoDeMidiaInstagram | null;
  legenda: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  curtidas: number | null;
  comentarios: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  publicadoEm: string | null; // ISO
}
