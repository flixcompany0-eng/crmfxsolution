# HANDOFF — Windsor.ai (Meta Ads + Instagram) como provedor de conexão

> Leia antes de continuar esta feature. Escrito na sessão que a implementou; nenhuma parte
> daqui foi provada num Postgres real nem numa tela real — ver "O que falta provar" no fim.

## O pedido, em uma frase

Uma nova aba em **Conexões** — isolada do WhatsApp e da conexão direta Meta/Instagram que já
existe (`/app/settings/meta-ads`) — onde a organização cola uma chave de API do Windsor.ai e
passa a ver, dentro do CRM: métricas de Meta Ads (com múltiplas contas da mesma empresa),
criativos, saldo/depósitos da conta de anúncios, e todas as métricas de Instagram Insights. Os
dados devem alimentar o mesmo banco que já serve a IA, para uma curadoria futura.

## Por que "isolado" foi levado ao pé da letra

O pedido do usuário foi explícito: Windsor.ai é um **sistema isolado** do Face Ads/Instagram
direto. O repo já tinha um eixo de leitura direta contra a Meta Graph API
(`lib/plataformas-de-anuncio/`, tabela `ad_insights_connections`, tela `/app/settings/meta-ads` +
`/app/ads/meta`). Em vez de estender esse eixo, criei um **par completo e paralelo**:

| Direto (já existia) | Windsor.ai (novo) |
|---|---|
| `lib/plataformas-de-anuncio/` | `lib/windsor/` |
| `ad_insights_connections` | `windsor_connections` |
| `/app/settings/meta-ads`, `/app/ads/meta` | `/app/ads/windsor/meta`, `/app/ads/windsor/instagram` |
| credencial: token OAuth da Graph API | credencial: chave de API do Windsor.ai |

Uma organização pode ter as duas conexões ligadas ao mesmo tempo, sem que uma interfira na
outra — inclusive a chave, a tabela e o gate de erro (`ApiErrorCodes`) são todos próprios do
Windsor (`windsor_sem_conexao`, não `ads_sem_conexao`).

## O que existe, arquivo por arquivo

### Banco (migration 0233 + baseline + MANIFEST — o trio que a doutrina exige)

`supabase/migrations/20260916230000_0233_windsor_ai_meta_instagram.sql` cria 7 tabelas, todas
`organization_id not null`, RLS **ligada com zero policies** (mesmo padrão de credencial
sensível que `ad_insights_connections` usa — só `service_role` acessa, e o admin client do
servidor filtra `organization_id` manualmente):

- `windsor_connections` — 1 por organização, a chave de API cifrada (`fn_encrypt_oauth`, mesma
  função pgcrypto do resto do repo — a chave **nunca** é lida de volta em texto puro).
- `windsor_ad_accounts` — contas Meta Ads **ou** perfis de Instagram vinculados (múltiplas por
  organização, com um `is_default` por plataforma).
- `windsor_metrics_daily` — métrica diária crua (impressões, cliques, gasto em centavos,
  alcance, resultados) por conta.
- `windsor_creatives` + `windsor_creative_metrics_daily` — o criativo (arte/copy) e sua métrica
  diária, em tabelas separadas porque o criativo muda pouco e a métrica muda todo dia (doutrina
  DIRC: duplicar métrica com o criativo seria desperdício de storage e um UPDATE que devia ser
  INSERT).
- `windsor_instagram_insights_daily` — a métrica diária de conta (Instagram Insights).
- `windsor_instagram_media` — os posts recentes, para a "seleção de criativo" que o pedido
  descreveu também no lado Instagram.
- `windsor_account_billing` — **separada de propósito**, ver seção "Saldo e depósitos" abaixo.

Apêndice idempotente já está em `supabase/baseline.sql` (é o que o kit self-host realmente
aplica) e a linha está em `supabase/migrations/MANIFEST.md`. As duas origens de `EXECUTE` de
qualquer função nova foram revogadas de `public`/`anon` conforme o item 9 da doutrina de
migrations.

### Camada de domínio

- `lib/windsor/types.ts` — vocabulário: `PlataformaWindsor`, `FalhaWindsor` (física de erro
  declarada: `chave_invalida` / `conta_nao_alcancada` / `limite_de_chamadas` / `campo_invalido` /
  `transitorio` — nunca um `null` mudo), `MotivoSemCredencialWindsor`.
- `lib/windsor/credenciais.ts` — lê/decifra a chave (`lerCredencialWindsor`), confere se existe
  conexão (`existeConexaoWindsor`).
- `lib/windsor/client.ts` — o HTTP client contra `connectors.windsor.ai`. Grounded em pesquisa
  na documentação pública do Windsor.ai (setembro/2026): base
  `https://connectors.windsor.ai/{connector}`, `api_key` como **query param** (é assim que a API
  deles funciona — diferente da regra do próprio CLAUDE.md de "API key nunca em query string",
  que vale para **nossa** API, não para como um provedor terceiro desenhou a dele), conectores
  `facebook` (Meta Ads) e `instagram`, parâmetros `fields`, `date_from`/`date_to`,
  `select_accounts`, `_max_rows`. A chave do cliente **nunca** aparece em log — o client loga só
  a URL com a query de `api_key` redigida.
- `lib/windsor/sync.ts` — `sincronizarContaMeta()` e `sincronizarContaInstagram()`: buscam no
  Windsor.ai e gravam nas tabelas acima. Nada roda sozinho por padrão (mesma filosofia do eixo
  direto) — é chamado pelo clique em "Atualizar" na tela.
- `lib/windsor/resumo-para-ia.ts` — `montarResumoWindsorParaIA()`: agrega os dados já gravados
  (gasto, resultados, follow-up, Instagram) num objeto plano. **Deliberadamente não chama
  nenhuma LLM** — ver "O que foi propositalmente deixado pela metade" abaixo.

### Server Actions, rotas e tela

- `app/actions/integrations/windsor/connectWindsor.ts` — conectar/desconectar a chave.
- `app/actions/integrations/windsor/contas.ts` — listar contas alcançáveis pela chave,
  adicionar/remover/marcar padrão.
- `app/actions/integrations/windsor/sincronizar.ts` — o "Atualizar" da tela.
- `app/actions/integrations/windsor/billing.ts` — o token de negócio Meta separado (ver seção
  seguinte).
- `app/api/v1/ads/windsor/{accounts,meta,instagram}/route.ts` + `hooks/ads/useWindsorAds.ts` —
  o par API + hook que a tela consome, no mesmo molde do eixo `ads/meta` existente.
- `components/connections/WindsorAiClient.tsx` — a nova aba dentro de **Conexões**
  (`ConexoesShell.tsx` ganhou a `TabsTrigger`/`TabsContent` "Windsor.ai", ao lado de "Números por
  QR", "API Oficial (Meta)", etc. — a estrutura de abas que já existia, só com uma aba a mais).
- `app/app/ads/windsor/meta/page.tsx` e `app/app/ads/windsor/instagram/page.tsx` — os dois
  dashboards, cada um com porta própria em `lib/navigation/catalogo.ts` (sem isso o CI de
  navegação reprova — telas que só existem digitando a URL não contam).

## Saldo e depósitos da Meta — o que É e o que NÃO é

O pedido pede "últimos depósitos e saldo atual". Pesquisei a Graph API da Meta: o endpoint
`GET /act_<id>?fields=balance,amount_spent,currency` existe e é documentado, e devolve saldo e
gasto acumulado **reais**. **Não existe** um campo confiável de "último depósito" na API
pública da Meta — não é limitação de tempo desta sessão, é ausência real na documentação, e
inventar esse número violaria a doutrina de UI honesta do próprio produto ("nunca fabricar
dado — mostrar 'não disponível'").

Por isso a implementação:
1. Traz **saldo e gasto acumulado reais** via um token de negócio Meta separado e opcional
   (`salvarTokenDeNegocioMeta()` / `sincronizarSaldoMeta()`), guardado em
   `windsor_account_billing` — **fora** do fluxo do Windsor.ai, porque a Windsor.ai API não
   expõe billing; é uma segunda credencial isolada, claramente rotulada na tela como opcional.
2. **Não mostra** "último depósito" — a tela deixa o campo como "não disponível" em vez de um
   número inventado.

Se o Windsor.ai vier a expor billing no futuro (não expõe em setembro/2026), ou se a Meta
documentar um endpoint de depósito, é um patch dentro de `lib/windsor/client.ts` +
`billing.ts`, não um redesenho.

## O que foi propositalmente deixado pela metade: o "campo de conversa com IA"

O pedido inclui um chat de IA que lê a direção dos dados (WhatsApp + site + Instagram + Meta
Ads) para curadoria e alimenta o "radar" do CRM. O repo tem `lib/ai/pontos/registro.ts`: um
**registro fechado de todo call site de LLM**, com um teste
(`tests/unit/pontos-de-ia-completude.test.ts`) que **reprova o CI** tanto para chamada de LLM
não registrada quanto para registro sem chamada. Abrir um novo call site de LLM sem entender
o contrato inteiro desse registro (rate limit, custo, fallback de provider, o dispatcher em
`lib/ai/dispatcher/`) é o tipo de mudança que este pacote de trabalho foi instruído a **não**
fazer sem cautela extra — e não havia tempo nesta sessão para estudar esse eixo com o rigor que
ele exige.

O que **foi** entregue: `montarResumoWindsorParaIA()` — a metade honesta e testável, que agrega
os dados já gravados (gasto, cliques, resultados, Instagram, e o que a leitura direta da Meta e
o WhatsApp já expõem) num objeto plano, pronto para ser o **input** de um call site de LLM.

**O que falta, como próximo passo concreto:**
1. Ler `lib/ai/pontos/registro.ts` e o dispatcher inteiro.
2. Registrar um novo ponto (`windsor_curadoria` ou nome similar) seguindo o padrão dos pontos
   existentes.
3. Decidir onde esse chat vive na UI — o pedido menciona "radar do CRM": o candidato natural é
   uma aba nova dentro do módulo de radar existente, consumindo `montarResumoWindsorParaIA()`
   mais o que o radar já calcula sobre pipeline.
4. Cobrir com o teste de completude de pontos de IA antes de declarar pronto.

Entregar isso sem esse estudo teria dois riscos reais: quebrar o gate de CI (reprova o merge
inteiro), ou pior, criar um call site sem o fallback de provider e sem rate limit que o resto do
produto tem — silenciosamente mais caro ou mais frágil que qualquer chamada de IA existente.

## Radar do CRM — mesma situação

"Dar um direcionamento também dentro do radar do CRM" está descrito, não implementado. O dado
que alimentaria isso (`montarResumoWindsorParaIA()`) já existe; o que falta é a integração no
módulo de radar em si, que eu não localizei/mapeei nesta sessão — é o primeiro passo de quem
continuar este trabalho.

## i18n e navegação — os dois gates que o CI cobra e que FORAM cobertos

- Toda string nova (`t("...")`) da UI do Windsor.ai tem entrada em `lib/i18n/dicionario.ts` —
  medido: `pnpm typecheck` passou depois de eu remover 14 chaves duplicadas que eu mesmo tinha
  introduzido (ver "Erros que corrigi nesta sessão" abaixo). Não rodei o teste específico
  `tests/unit/i18n-espanhol-cobre-a-tela.test.ts` isoladamente, mas ele faz parte de
  `pnpm test:unit`.
- As duas rotas novas (`/app/ads/windsor/meta`, `/app/ads/windsor/instagram`) têm entrada em
  `lib/navigation/catalogo.ts` e ícone registrado em `lib/navigation/registry.ts`.

## Erros que corrigi nesta sessão (rodando `pnpm typecheck` de verdade, não presumindo)

Rodei `pnpm install` + `pnpm typecheck` pela primeira vez depois de escrever todo o código novo,
e ele **reprovou com 22 erros reais**, todos meus:

1. **Seis strings de auditoria não registradas** (`windsor_connection.created/updated/deleted`,
   `windsor_ad_account.created/deleted`, `windsor_sync.completed`) — o `action` de `audit()` é
   tipado contra um union fechado em `lib/audit/actions.ts`, e eu tinha usado as strings nos
   Server Actions sem declará-las lá. Adicionadas ao array `AUDIT_ACTIONS`, com o mesmo tipo de
   comentário doutrinário que as entradas vizinhas já têm (por que é ação própria e não
   `metadata` de outra).
2. **Um motivo de erro com nome errado** — `lib/windsor/sync.ts` declarava
   `"sem_credencial"` no tipo `ResultadoDeSync`, mas `lerCredencialWindsor()` (em
   `credenciais.ts`) sempre devolve `"sem_conexao"`. Corrigido para `"sem_conexao"`, alinhando
   com o resto do eixo (`_falha.ts`, as rotas de API, a Server Action de sincronizar).
3. **14 chaves duplicadas em `lib/i18n/dicionario.ts`** — ao apender as ~90 traduções novas,
   repeti palavras comuns que o dicionário já tinha (`Conectar`, `Remover`, `Adicionar`,
   `Atualizar`, `Perfil`, `Impressões`, `CTR`, `a`, entre outras). TypeScript recusa objeto
   literal com chave repetida (`TS1117`). Removidas as 14 linhas duplicadas do bloco novo,
   mantendo a definição original de cada uma (nenhuma tradução existente foi alterada).

Depois desses três consertos: `pnpm typecheck` → **0 erros**. `pnpm lint` → **0 erros** (347
warnings, todos pré-existentes no repo — nenhum nos arquivos desta feature além do padrão já
tolerado em todo o código-base).

Rodei em seguida `pnpm test:unit` de verdade (a suíte inteira, 742 arquivos, não o recorte de
`tests/unit/`) e ela pegou **mais três defeitos reais**, todos meus:

4. **Duas telas novas usavam `rounded` puro** (`WindsorMetaClient.tsx` e
   `WindsorInstagramClient.tsx`, nas miniaturas de criativo/mídia) — no Tailwind 4 isso vale
   4px em vez dos 8px de `--radius-md` que o resto do produto usa, um encolhimento silencioso
   que `tests/unit/tailwind-tokens.test.ts` existe justamente para pegar. Trocado para
   `rounded-md`, igual ao resto da tela.
5. **A Server Action de sincronizar não tinha o guarda de `supportWriteError`** — as outras três
   Server Actions do Windsor.ai (`connectWindsor.ts`, `contas.ts`, `billing.ts`) bloqueiam
   sessão de suporte/impersonation antes de mutar dado do tenant; `sincronizar.ts` resolvia a
   organização ativa mas pulava esse bloqueio, o que deixaria uma sessão de suporte disparar
   sincronização (escrita) na conta de um cliente. Corrigido com a mesma linha que as outras
   três já tinham (`tests/unit/suporte-cobertura-de-efeitos.test.ts` é o gate que pegou).
6. **`branding/fx-solution/` não estava excluída da varredura de `@source` do Tailwind** —
   `components/FXBrand.tsx` (o exemplo React do kit) tem `className=`, e o teste que garante
   que toda pasta com classe está coberta pelo `@source` de `app/globals.css` não sabia que
   aquela pasta é referência, nunca renderizada pelo app. Adicionei `branding` à mesma lista de
   exclusão que já cobre `docs/`/`tests/` pelo mesmo motivo (fixture/exemplo, não UI servida).

E os dois handoffs (este e o de branding) citavam os PNGs do logo pelo nome solto
(`` `fx-logo-horizontal.png` ``), o que o gate `tests/unit/evidencia-citada.test.ts` interpreta
como citação em `evidence/<nome>` — pasta onde esses arquivos não estão. Corrigido citando o
caminho completo (`` `branding/fx-solution/assets/fx-logo-horizontal.png` ``).

**Depois de todos os consertos:** `pnpm test:unit` → **742/742 arquivos, 7964 testes passando,
1 falha esperada (pré-existente, documentada no próprio `CLAUDE.md`)**, rodado com o log
completo redirecionado e o rodapé conferido (não só `grep FAIL`, seguindo o próprio aviso do
`CLAUDE.md` sobre reporter silencioso).

## O que falta provar (dívida declarada, não escondida)

Esta feature **não** passou pelo ciclo de QA Visual que o `CLAUDE.md` exige como critério de
aceite ("provado pela tela como um leigo faria, em ambiente fresco estilo VPS"). Especificamente
faltam:

- `pnpm test:db` — os 364 invariantes contra um Postgres efêmero, incluindo a prova de que as 7
  tabelas novas isolam corretamente entre duas organizações (o teste genérico de RLS deveria
  cobrir automaticamente tabelas com `organization_id` + RLS ligada, mas isso não foi confirmado
  lendo `tests/invariants/rls-isolation.test.ts` nesta sessão).
- Nenhuma chamada real contra a API do Windsor.ai foi feita — não há chave de teste. O client
  foi escrito contra a documentação pública, não contra tráfego real; nomes de campo do
  connector `facebook`/`instagram` podem ter mudado desde a pesquisa.
- Nenhuma tela foi aberta num browser. O fluxo "colar chave → ver contas → adicionar conta →
  ver dashboard" nunca rodou de ponta a ponta.
- O "Living System Checklist" do item 13 do `CLAUDE.md` (mapa vivo em `docs/architecture/*.json`)
  não foi atualizado — as 7 tabelas novas e as duas telas novas não aparecem em nenhum mapa de
  arquitetura, se o repo mantém um.

**Antes de vender/instalar isto numa VPS real:** rodar `pnpm test:db`, testar com uma chave
Windsor.ai de verdade (mesmo que de sandbox/trial), e dirigir a tela uma vez com Playwright ou
manualmente, seguindo a doutrina de QA Visual do próprio repo.
