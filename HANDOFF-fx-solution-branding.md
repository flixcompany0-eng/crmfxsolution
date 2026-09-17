# HANDOFF — Identidade visual FX Solution

> Leia antes de mexer em qualquer coisa relacionada a marca/branding neste clone.

## O que foi pedido e o que foi entregue

O pedido foi clonar o DeskcommCRM "pasta a pasta" e aplicar a identidade visual FX Solution
**sem tocar em nenhuma linha de lógica de front-end ou back-end** — só a "roupa" muda. Este
repositório (`fx-solution/`) é essa cópia: nada em `app/`, `components/`, `lib/`, `hooks/` ou
`supabase/` teve seu **comportamento** alterado por causa da marca. As únicas mudanças que
tocam arquivo existente são as listadas na seção seguinte, e cada uma é uma troca de **valor**
(nome, cor, fonte), nunca de lógica.

Isso foi possível porque o DeskcommCRM **já** tem um sistema de marca própria (whitelabel)
inteiramente dirigido por banco de dados — ver `docs/white-label.md` e a seção "Marca própria"
do `CLAUDE.md`. A tarefa de branding, na prática, virou "preencher a semente certa nesse
sistema já existente", não "inventar um novo".

## Onde a marca FX Solution mora

```
branding/fx-solution/
├── assets/
│   ├── fx-logo-horizontal.svg   (vetor original do kit)
│   ├── fx-logo-horizontal.png   (640×176 — rasterizado por mim, para o upload em /admin/marca)
│   ├── fx-symbol-coral.svg
│   └── fx-symbol-coral.png      (512×512 — idem)
├── fonts/        (fonte do kit, referência — ver seção "Fonte" abaixo)
├── styles/tokens.css   (paleta e tokens originais do kit, referência)
├── components/FXBrand.tsx      (símbolo/wordmark em React, referência — não importado por nada)
├── preview/, docs/, reference/  (material original do kit, preservado como veio)
└── README.md
```

Este diretório é **material de referência e o ativo pronto para upload** — não é consumido em
runtime por nenhum código do produto. Isso é deliberado: consumir CSS de fora do
`app/globals.css` violaria a doutrina de tokens (`tests/unit/tailwind-tokens.test.ts`) e a regra
"uma imagem Docker serve todas as marcas" (nada de asset de marca embutido no build).

## O que muda de fato, e por quê

| Onde | O quê | Por quê é seguro |
|---|---|---|
| `.env.example`, `.env.vps.example` | `APP_NAME=FX Solution`, `APP_ACCENT_HEX=#DF4650` | Estas variáveis já são documentadas no `CLAUDE.md` como **semente e piso de rollback** — nunca a fonte de verdade em produção. Mudar o valor semente não muda uma linha de código |
| `app/layout.tsx` | Fonte trocada de `Atkinson_Hyperlegible` para `Outfit` (`next/font/google`), pesos `["300","400","500","600","700"]`. Nome da variável CSS **mantido** (`--font-atkinson`) | Única exceção arquitetural documentada abaixo |

Nada mais no código muda. Nome do produto, cor de destaque e logo são resolvidos em
**runtime**, a partir do banco (`platform_branding` e `organizations.settings.branding`), pela
tela `/admin/marca` já existente — é essa tela que o operador usa para aplicar a marca de
verdade, não uma edição de arquivo.

### A fonte é a exceção declarada, e o motivo está no próprio `docs/white-label.md`

> *"font is the ONE non-configurable-at-runtime branding element (baked via `next/font/google`
> at build time)"*

A doutrina do repo já reconhece que fonte não é um token de runtime como cor — ela é decidida
no build (`next/font/google` gera arquivos estáticos e um hash). Por isso é a única peça do kit
FX Solution que exigiu uma edição de arquivo (`app/layout.tsx`), e ela está isolada a uma linha
de import e ao array de pesos. **Nenhuma outra tela, componente ou rota foi tocada.**

Nota de doutrina que fica registrada aqui, não escondida: o `CLAUDE.md` do Deskcomm original
lista "seletor de fonte" como algo que **não vale a pena** fazer configurável — a razão dada é
que a fonte original (Atkinson Hyperlegible) foi escolhida por legibilidade, não por marca. Essa
é uma posição de produto do Deskcomm; a FX Solution pediu explicitamente sua própria fonte
(Outfit, conforme `branding/fx-solution/fonts/`), e atendê-la é a única linha de código deste
pacote de branding. Se uma sessão futura preferir reverter para Atkinson Hyperlegible por
acessibilidade, a mudança é a mesma linha, ao contrário.

## O passo manual que falta (e é o único)

O logo em si **não está aplicado** — ele está pronto em
`branding/fx-solution/assets/fx-logo-horizontal.png` (640×176, 17,7 KB) esperando upload. Depois
do primeiro deploy:

1. Entrar como `platform_admin` em `/admin/marca`.
2. Preencher nome (`FX Solution`), cor (`#DF4650`) e subir
   `branding/fx-solution/assets/fx-logo-horizontal.png`
   (ou `branding/fx-solution/assets/fx-symbol-coral.png`, 512×512, para o ícone quadrado —
   ex.: PWA/app icon, se a tela pedir um separado).
3. Salvar. A partir daí a marca vem do banco em toda tela, e-mail, PDF de LGPD (que continua
   levando a razão social do **controlador**, nunca a marca do revendedor — ver a doutrina de
   "quatro papéis, três identidades" no `CLAUDE.md`) e favicon (gerado em runtime a partir de
   nome+cor por `lib/branding/icone.ts` — nenhum arquivo de favicon precisa ser gerado à mão).

O limite de upload da tela é 512 KB por PNG/JPG — os dois PNGs rasterizados aqui estão dentro
disso.

## O que eu verifiquei, e o que continua sem prova

Verificado nesta sessão:
- `pnpm typecheck` — 0 erros, com estas mudanças aplicadas.
- `pnpm lint` — 0 erros (347 warnings pré-existentes no repo, não deste pacote).
- `pnpm test:unit` — suíte inteira (742 arquivos), **742/742 passando**, 1 falha esperada e
  pré-existente. Essa rodada pegou uma exclusão que faltava em
  `tests/unit/tailwind-tokens.test.ts` (a pasta `branding/` tem um `.tsx` de referência com
  `className=`, e o gate de cobertura do `@source` não sabia que aquele arquivo nunca é
  renderizado pelo app) — corrigido junto com o resto no `HANDOFF-windsor-ai.md`.
- Os dois PNGs rasterizados foram abertos e conferidos visualmente (símbolo e wordmark corretos,
  fundo transparente).

**Não verificado — dívida declarada, não escondida:**
- Nenhuma tela foi dirigida por browser real (Playwright) para provar o upload em `/admin/marca`
  com estes arquivos específicos, nem o efeito ponta a ponta (cor no sidebar, e-mail, PDF). A
  doutrina de QA Visual do `CLAUDE.md` pede exatamente isso antes de "pronto" para qualquer
  mudança de UI, e não deu tempo nesta sessão de subir Supabase local + rodar o fluxo completo.
- `pnpm test:db` (o gate que sobe Postgres efêmero e roda os 364 invariantes) não foi executado
  aqui — esta mudança não toca schema, então o risco é baixo, mas "baixo risco" não é "provado".

## Anti-check: por que isto não quebra o self-host

- Nenhum serviço do `docker-compose.prod.yml` foi tocado — a imagem continua genérica, servindo
  qualquer marca, exatamente como a doutrina de packaging exige.
- `branding/fx-solution/` não entra na imagem Docker de produção (não é importado por nenhum
  código de `app/`, `lib/`, `components/`) — ele é só o material de origem para quem for operar
  `/admin/marca`. Se quiser confirmar: `grep -rn "branding/fx-solution" app lib components hooks`
  não deve retornar nada além deste próprio handoff.
