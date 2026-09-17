-- 0233 · Windsor.ai como provedor de leitura de Meta Ads e Instagram.
--
-- ─── O que isto fecha ────────────────────────────────────────────────────────
-- A 0214 deu ao CRM uma janela para a conta de anúncios via token direto da
-- Meta (`ads_read`). Esta migration abre uma SEGUNDA janela, isolada da
-- primeira: uma organização que já usa Windsor.ai para agregar Meta Ads +
-- Instagram (e, no plano deles, outras fontes) cola UMA chave de API do
-- Windsor.ai aqui, em vez de gerar um token direto na Meta for Developers.
--
-- ─── Por que TABELAS NOVAS, e não reaproveitar `ad_insights_connections` ─────
-- Mesmas quatro razões do cabeçalho da 0214, aplicadas a um credenciamento
-- diferente:
--  1. A credencial é OUTRA: uma chave de API do Windsor.ai, não um token da
--     Meta. Não é o mesmo segredo, não cabe na mesma coluna.
--  2. `platform` em `ad_insights_connections` tem `check (platform in
--     ('meta_ads','google_ads'))` — projetado para token DIRETO por
--     plataforma. Uma linha Windsor.ai que alcança meta_ads E instagram ao
--     mesmo tempo não descreve "uma plataforma", quebrando essa premissa.
--  3. Windsor.ai introduz um conceito que a 0214 não tem: VÁRIAS contas de
--     anúncio por conexão (`select_accounts` da API deles), cada uma podendo
--     ser ativada/desativada independentemente. Preso a uma linha por
--     `(organization_id, platform)`, não haveria onde guardar a lista.
--  4. Isolamento pedido explicitamente pelo produto: o dono do tráfego pode
--     usar o token direto da Meta (0214) OU o Windsor.ai, sem que um dependa
--     ou interfira no outro. Tabelas separadas tornam essa independência
--     estrutural, não uma convenção que alguém pode violar sem querer.
--
-- O que é reaproveitado, integralmente: a CIFRA (`fn_encrypt_oauth`, a mesma
-- de `ad_insights_connections`, `ad_platform_connections`, `channel_sessions`
-- e `calendar_connections` — sem terceiro caminho de cifra no repo) e a
-- POSTURA (RLS ligada, zero policies, grants revogados de anon/authenticated,
-- leitura só pelo admin client no servidor).
--
-- ─── Por que NÃO existe `enabled` em `windsor_connections` ──────────────────
-- Mesmo raciocínio da 0214: nada roda sozinho aqui. A sincronização acontece
-- quando alguém abre a tela e clica em "Atualizar", ou quando o cron opcional
-- de `app/api/v1/cron/windsor-sync` (que só existe se `WINDSOR_SYNC_CRON=1`)
-- dispara. Um interruptor "desligado" seria indistinguível de "desconectado".
-- Desconectar apaga a linha (cascade cuida do resto); reconectar é colar a
-- chave de novo.
--
-- ─── Por que `windsor_ad_accounts` TEM `is_default`, mas não `enabled` ──────
-- `is_default` decide qual conta a tela abre primeiro — mesmo papel do
-- `default_account_id` da 0214, promovido a coluna própria porque aqui há
-- VÁRIAS contas por organização e "qual é a padrão" é uma pergunta sobre a
-- LINHA, não sobre a conexão inteira. Não existe "conta pausada": remover uma
-- conta da lista de acompanhamento é excluir a linha (e seus dados
-- derivados, via cascade) — mesma filosofia de "ausência = não conectado".
--
-- ─── `windsor_account_billing` é uma tabela À PARTE, e opcional por desenho ─
-- Windsor.ai (API de relatórios) não expõe saldo, depósito nem forma de
-- pagamento da conta de anúncios — isso vive na API de Negócios da própria
-- Meta (`/act_<id>` com os campos `balance`, `amount_spent`, `currency`, e o
-- histórico de depósito exige permissão de `business_management` que a
-- maioria das contas não tem liberada para apps de terceiro). Por isso este
-- dado usa uma credencial SEGUNDA e OPCIONAL — um token de usuário do sistema
-- com escopo de negócio —, guardada nesta tabela e não em
-- `windsor_connections`, pela mesma doutrina da 0214: escopos diferentes não
-- compartilham linha. Sem esse token, o painel mostra "não conectado" em vez
-- de inventar número — não é uma feature incompleta, é a mesma recusa de
-- "não crie botão operacional sem ação real" que o resto da casa segue.
--
-- ─── Por que RLS LIGADA com ZERO policies, em TODAS as tabelas novas ────────
-- Mesmo motivo da 0213/0214: a anon key vai para o browser, e a chave de API
-- do Windsor.ai — como qualquer credencial de leitura de ads — expõe
-- orçamento, criativo e performance da empresa. Ninguém lê estas tabelas pelo
-- client de sessão; toda leitura passa pelo admin client em rota de servidor,
-- que filtra `organization_id` manualmente (anti-pattern 10 do CLAUDE.md).
--
-- Nenhuma função nova em `public` ⇒ item 9 da doutrina de migrations não é
-- acionado por este arquivo.

-- ─────────────────────────────────────────────────────────────────────────────
-- A conexão: UMA chave de API do Windsor.ai por organização
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.windsor_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  api_key_encrypted bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create unique index if not exists windsor_connections_org_uk
  on public.windsor_connections (organization_id);

comment on table public.windsor_connections is
  'Credencial de LEITURA via Windsor.ai (agregador de Meta Ads + Instagram), isolada do token direto da Meta em ad_insights_connections (0214). Server-side only: RLS ligada sem policies, grants revogados de anon/authenticated. A chave nunca volta ao browser.';
comment on column public.windsor_connections.api_key_encrypted is
  'Cifrado por fn_encrypt_oauth (pgp_sym/aes256) via encryptWebhookSecret — a mesma cifra de ad_insights_connections, channel_sessions e calendar_connections.';

alter table public.windsor_connections enable row level security;
revoke all on public.windsor_connections from anon, authenticated;
grant select, insert, update, delete on public.windsor_connections to service_role;

drop trigger if exists trg_windsor_connections_updated_at on public.windsor_connections;
create trigger trg_windsor_connections_updated_at
  before update on public.windsor_connections
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- As contas de anúncio / perfis acompanhados por essa conexão
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.windsor_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.windsor_connections(id) on delete cascade,
  -- Vocabulário agnóstico já usado por ad_insights_connections/ad_platform_connections
  -- (PlataformaDeAnuncio), mais 'instagram' — que ali não existe porque a 0213/0214
  -- nunca tiveram fonte de dado do Instagram.
  platform text not null check (platform in ('meta_ads', 'instagram')),
  -- Id da conta na Meta (`act_<id>` sem o prefixo, ou o id numérico puro — o que a
  -- API do Windsor devolve em `select_accounts`) ou o id da conta do Instagram.
  external_account_id text not null,
  -- Preenchidos/atualizados a cada sync; nulos até a primeira sincronização.
  nome text,
  moeda text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists windsor_ad_accounts_org_platform_conta_uk
  on public.windsor_ad_accounts (organization_id, platform, external_account_id);

-- Só uma conta padrão por plataforma por organização — mesma lição da 0213/0214:
-- sem isto, dois cliques de "tornar padrão" deixariam duas linhas com
-- is_default=true e a tela abriria uma delas em silêncio, sem ordem garantida.
create unique index if not exists windsor_ad_accounts_uma_padrao_por_plataforma
  on public.windsor_ad_accounts (organization_id, platform)
  where is_default;

comment on table public.windsor_ad_accounts is
  'Contas de anúncio (meta_ads) ou perfis (instagram) que a organização escolheu acompanhar via Windsor.ai. Uma conexão (windsor_connections) pode ter várias — "podendo adicionar outras contas de anúncio da mesma empresa". RLS ligada sem policies: mesma postura de windsor_connections.';

alter table public.windsor_ad_accounts enable row level security;
revoke all on public.windsor_ad_accounts from anon, authenticated;
grant select, insert, update, delete on public.windsor_ad_accounts to service_role;

drop trigger if exists trg_windsor_ad_accounts_updated_at on public.windsor_ad_accounts;
create trigger trg_windsor_ad_accounts_updated_at
  before update on public.windsor_ad_accounts
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Métricas diárias de Meta Ads (conta) — contadores CRUS, nunca razões prontas
-- ─────────────────────────────────────────────────────────────────────────────
-- Doutrina DIRC: CTR, CPC e CPM são CALCULÁVEIS a partir de impressions/clicks/
-- spend_cents e não ganham coluna própria — a mesma lição que LinhaDeCampanha
-- (lib/plataformas-de-anuncio/types.ts) já aplica ao eixo de leitura direta.

create table if not exists public.windsor_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_account_id uuid not null references public.windsor_ad_accounts(id) on delete cascade,
  date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend_cents bigint not null default 0,
  reach bigint,
  -- `results` cru do Windsor (campo `actions`/`results` do conector, conforme o
  -- objetivo da campanha) — nullable porque nem toda conta tem objetivo com
  -- resultado nomeável. O RÓTULO de qual resultado é este vive fora do banco,
  -- em lib/windsor/tipos.ts, pela mesma razão de ResultadoDaCampanha.indicador.
  results bigint,
  synced_at timestamptz not null default now()
);

create unique index if not exists windsor_metrics_daily_conta_data_uk
  on public.windsor_metrics_daily (ad_account_id, date);

comment on table public.windsor_metrics_daily is
  'Série diária de Meta Ads por conta, obtida via API de relatórios do Windsor.ai. Contadores crus (DIRC): CTR/CPC/CPM calculados on-demand, nunca gravados.';

alter table public.windsor_metrics_daily enable row level security;
revoke all on public.windsor_metrics_daily from anon, authenticated;
grant select, insert, update, delete on public.windsor_metrics_daily to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Criativos (nível de anúncio) e suas métricas diárias
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.windsor_creatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_account_id uuid not null references public.windsor_ad_accounts(id) on delete cascade,
  -- `ad_id` do Windsor/Meta — é o nível de granularidade real do criativo
  -- (um criativo pode servir vários anúncios, mas a métrica que o Windsor
  -- reporta é por ad_id).
  external_creative_id text not null,
  ad_name text,
  image_url text,
  video_thumbnail_url text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists windsor_creatives_conta_id_uk
  on public.windsor_creatives (ad_account_id, external_creative_id);

comment on table public.windsor_creatives is
  'Um criativo (nível de anúncio) por conta de Meta Ads, com a arte/copy vinda do conector facebook do Windsor.ai. "ver a característica de cada criativo e seus dados".';

alter table public.windsor_creatives enable row level security;
revoke all on public.windsor_creatives from anon, authenticated;
grant select, insert, update, delete on public.windsor_creatives to service_role;

drop trigger if exists trg_windsor_creatives_updated_at on public.windsor_creatives;
create trigger trg_windsor_creatives_updated_at
  before update on public.windsor_creatives
  for each row execute function public.fn_set_updated_at();

create table if not exists public.windsor_creative_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  creative_id uuid not null references public.windsor_creatives(id) on delete cascade,
  date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend_cents bigint not null default 0,
  results bigint,
  synced_at timestamptz not null default now()
);

create unique index if not exists windsor_creative_metrics_daily_uk
  on public.windsor_creative_metrics_daily (creative_id, date);

comment on table public.windsor_creative_metrics_daily is
  'Série diária por criativo (ad_id). organization_id repetido aqui de propósito (não só via creative_id): toda tabela tenant-aware desta casa carrega a própria coluna de organização, para RLS e para o filtro manual do admin client valerem sem depender de JOIN.';

alter table public.windsor_creative_metrics_daily enable row level security;
revoke all on public.windsor_creative_metrics_daily from anon, authenticated;
grant select, insert, update, delete on public.windsor_creative_metrics_daily to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Instagram — métricas diárias de conta (Insights) e mídia (posts/reels)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.windsor_instagram_insights_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_account_id uuid not null references public.windsor_ad_accounts(id) on delete cascade,
  date date not null,
  followers_count bigint,
  reach bigint,
  impressions bigint,
  profile_views bigint,
  media_count bigint,
  synced_at timestamptz not null default now()
);

create unique index if not exists windsor_instagram_insights_daily_uk
  on public.windsor_instagram_insights_daily (ad_account_id, date);

comment on table public.windsor_instagram_insights_daily is
  'Série diária de métricas de conta do Instagram (conector instagram do Windsor.ai). ad_account_id aponta para uma linha de windsor_ad_accounts com platform=instagram.';

alter table public.windsor_instagram_insights_daily enable row level security;
revoke all on public.windsor_instagram_insights_daily from anon, authenticated;
grant select, insert, update, delete on public.windsor_instagram_insights_daily to service_role;

create table if not exists public.windsor_instagram_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_account_id uuid not null references public.windsor_ad_accounts(id) on delete cascade,
  external_media_id text not null,
  media_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  like_count bigint,
  comments_count bigint,
  saved_count bigint,
  shares_count bigint,
  posted_at timestamptz,
  synced_at timestamptz not null default now()
);

create unique index if not exists windsor_instagram_media_uk
  on public.windsor_instagram_media (ad_account_id, external_media_id);

comment on table public.windsor_instagram_media is
  'Posts/reels do Instagram e suas métricas, para a galeria de conteúdo do painel de Instagram.';

alter table public.windsor_instagram_media enable row level security;
revoke all on public.windsor_instagram_media from anon, authenticated;
grant select, insert, update, delete on public.windsor_instagram_media to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Saldo e depósitos da conta de anúncios — OPCIONAL, credencial própria
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.windsor_account_billing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_account_id uuid not null references public.windsor_ad_accounts(id) on delete cascade,
  -- Token de usuário do sistema da Meta Business, escopo business_management.
  -- Separado de windsor_connections de propósito (ver cabeçalho): é outra
  -- credencial, outra plataforma (Meta direto, não Windsor.ai), outro escopo.
  meta_business_token_encrypted bytea,
  currency text,
  balance_cents bigint,
  amount_spent_cents bigint,
  -- Melhor esforço: a API de Negócios da Meta não garante histórico de
  -- depósito para todo tipo de conta/permissão. Nulo = "não alcançável com o
  -- token atual", nunca "zero".
  last_deposit_amount_cents bigint,
  last_deposit_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create unique index if not exists windsor_account_billing_conta_uk
  on public.windsor_account_billing (ad_account_id);

comment on table public.windsor_account_billing is
  'Saldo/depósito da conta de anúncios Meta, opcional: só populado quando a organização também cola um token de sistema com business_management. Ausência de linha = painel mostra "não conectado", nunca dado inventado.';

alter table public.windsor_account_billing enable row level security;
revoke all on public.windsor_account_billing from anon, authenticated;
grant select, insert, update, delete on public.windsor_account_billing to service_role;

drop trigger if exists trg_windsor_account_billing_updated_at on public.windsor_account_billing;
create trigger trg_windsor_account_billing_updated_at
  before update on public.windsor_account_billing
  for each row execute function public.fn_set_updated_at();
