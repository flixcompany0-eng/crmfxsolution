Flix Company  |  Edição de 17 de setembro de 2026

Use este guia e os arquivos do kit para reproduzir a aparência do FX Solution em um novo sistema. O objetivo é transferir a marca, os componentes e o comportamento visual, mantendo as funções e os dados do novo CRM sob a sua própria arquitetura.

Identidade principal: símbolo FX metálico, fundo grafite e destaque coral.

## Como usar esta entrega

Leia o guia para entender as decisões visuais e as medidas.

Use os SVGs, imagens, fontes e tokens do pacote como referência de implementação.

Abra preview/index.html para consultar as telas de exemplo.

Entregue docs/PROMPT-PARA-IA.md à IA responsável pelo novo CRM.

O pacote visual contém arquivos de marca e exemplos com conteúdo neutro. A base visual é a edição do projeto identificada pela revisão e2748be9d27a, preservada no arquivo de referência.

# A marca e suas assinaturas

Da esquerda para a direita: assinatura horizontal, símbolo da interface e favicon original.

A marca combina o monograma FX de traços angulares com a assinatura FX SOLUTION. O símbolo funciona sozinho em áreas compactas; a assinatura completa identifica a plataforma na entrada e na navegação lateral. OPERATION INTELLIGENCE é o descritivo secundário presente no projeto.

| Elemento | Valor da interface |
| --- | --- |
| Símbolo vetorial | viewBox 0 0 64 64; dois paths; preenchimento currentColor |
| Símbolo na assinatura | 39 × 39 px; cor #F2F2F4; distância de 10 px para o texto |
| FX | Outfit 17 px, peso 600, espaçamento 1 px |
| SOLUTION | Outfit 12 px, peso 400, espaçamento 1,3 px |
| Descritivo | IBM Plex Mono 6,7 px; espaçamento 1,3 px; cor #959AA5 |
| Marca na entrada móvel | Símbolo de 31 px; assinatura principal de 15 px |

## Arquivos para aplicação

Use assets/fx-symbol-ui.svg no modo inline para herdar currentColor. Use fx-symbol-light.svg ou fx-symbol-coral.svg como imagem externa. O componente components/FXBrand.tsx preserva a composição HTML original. fx-logo-horizontal.svg é uma versão em curvas preparada para esta entrega, sem depender da instalação de fontes.

Preserve os arquivos como variantes distintas: o monograma da interface, o favicon e a escultura metálica têm desenhos diferentes na base original. Não substitua todos por um símbolo novo gerado por IA.

## Regras para o novo CRM

Mantenha a proporção original. Como regra de aplicação, reserve ao redor do símbolo pelo menos metade da sua altura. Sobre fundos claros, use um suporte escuro para a assinatura branca. O nome da empresa cliente pode variar no workspace; o selo FX continua identificando a plataforma.

# Imagens favicon e arquivos de marca

Arte vertical de entrada, capa horizontal e imagem de compartilhamento incluídas no kit.

| Arquivo em assets | Dimensões | Aplicação |
| --- | --- | --- |
| fx-brand.webp | 1400 × 1738 | Arte principal da entrada |
| fx-cover.webp | 1800 × 1200 | Capa de apresentação da marca |
| fx-og.webp | 1200 × 630 | Prévia de compartilhamento |
| favicon.svg | viewBox 64 × 64 | Ícone vetorial do navegador |
| icon-32.png | 32 × 32 | Favicon raster de apoio |
| icon-180.png | 180 × 180 | Apple touch icon |
| icon-192.png | 192 × 192 | Ícone do aplicativo |
| icon-512.png | 512 × 512 | Ícone maior do aplicativo |

A imagem fx-brand.webp mostra uma peça metálica prateada, com faces vermelhas, apoiada em uma superfície cinza. Ela é o foco visual da entrada. A capa e a imagem Open Graph já contêm textos incorporados; são peças de apresentação, não substitutos do fundo de login.

O favicon SVG tem fundo #181A1E, cantos de 13 unidades e símbolo #E46674. Preserve também as versões PNG originais. Os novos SVGs do símbolo e da assinatura estão identificados no inventário assets/manifest.json.

No novo projeto, copie os arquivos para a pasta pública de assets e ajuste os caminhos do manifest. Use o domínio do novo sistema para og:image. Não copie URLs de publicação, títulos operacionais ou descrições do sistema anterior.

# Cores e hierarquia visual

Paleta principal extraída das regras da interface. Os valores completos estão em design-tokens.json.

| Uso | Cor | Orientação |
| --- | --- | --- |
| Fundo global | #101113 | Base escura contínua |
| Sidebar e topbar | #141518 | Estrutura persistente |
| Cards e painéis | #181A1E | Conteúdo agrupado |
| Borda principal | #2A2C32 | Separação de 1 px |
| Texto principal | #ECEDEF | Títulos, valores e leitura prioritária |
| Texto secundário | #989DA8 | Descrições e suporte |
| Ação principal | #DF4650 | Botões primários e seleção |
| Texto de destaque | #F1848C | Ênfase coral suave |
| Foco por teclado | #F68A93 | Contorno visível de 2 px |
| Ícones comuns | #A6ACB6 | Controles secundários |

A base é predominantemente escura e neutra. O coral identifica a ação principal, a seleção e os pontos de atenção. Tons frios de azul e vinho aparecem em conversas, modais e blocos do funil; eles complementam a marca sem tomar o lugar do coral.

Estados: sucesso usa texto #79C4A0, atenção #D9BA80 e erro #F18B94. Aplique os fundos translúcidos e as bordas especificados nos tokens; não use preenchimentos verdes, amarelos ou vermelhos saturados em grandes áreas.

A cor configurável original é --accent. Para personalização consistente no novo CRM, derive também as transparências, os estados de seleção e as cores de foco. Trocar apenas o botão deixa outros detalhes presos à cor anterior.

# Tipografia medidas e organização

| Papel | Especificação original |
| --- | --- |
| Família principal | Outfit; pesos 300, 400, 500, 600 e 700 |
| Família técnica | IBM Plex Mono; pesos 400 e 500 |
| Título da página | 30 px, peso 400, entreletra −0,9 px, linha 1,2 |
| Título do login | 43 px, peso 300, entreletra −1,2 px, linha 1,17 |
| Título da arte | 46 px, peso 300, entreletra −1,1 px, linha 1,15 |
| Número de indicador | 29 px, peso 400, algarismos tabulares |
| Título de seção | 15 px, peso 500 |
| Botão comum | 12 px, peso 500 |
| Eyebrow técnico | IBM Plex Mono 10 px, entreletra 1,8 px |
| Texto auxiliar | 11 a 12 px; metadados menores conforme o componente |

## Estrutura do workspace

No desktop, a sidebar fixa mede 225 px e a topbar 72 px. O conteúdo usa margem esquerda de 225 px e padding de 34 px no topo, 32 px nas laterais e 25 px na base. O painel padrão tem padding de 24 px, borda de 1 px e raio de 11 px.

| Componente | Raio | Espaçamento característico |
| --- | --- | --- |
| Botão e campo | 7 px | Botão 10 × 15 px; campo 11 × 12 px |
| Badge | 4 px | 4 × 7 px |
| Painel | 11 px | 24 px interno |
| Modal | 13 px | Cabeçalho e formulário com 27 px laterais |
| Nó de funil | 9 px | 17 × 16 px; largura de 240 px |

## Fontes incluídas

A pasta fonts contém os arquivos TTF e as licenças SIL Open Font License das duas famílias. fonts/fonts.css permite carregamento local. Os arquivos vieram das famílias utilizadas pelo CSS do projeto; mantenha os avisos de licença ao redistribuí-los.

No novo sistema, mantenha títulos leves e hierarquia clara. Aumentos de tamanho para acessibilidade devem ser tratados como adaptação documentada, preservando a família, o peso relativo e a composição.

# Entrada do sistema no desktop e no celular

Referência reconstruída com os estilos e a arte originais, sem autenticação ou dados conectados.

A entrada usa duas colunas iguais. À esquerda ficam marca, título, campos e ações. À direita, a arte ocupa toda a altura com object-fit: cover, object-position: center 38% e brilho de 0,85. Um degradê escurece a região inferior para dar contraste ao texto.

| Área | Composição original |
| --- | --- |
| Coluna de formulário | Padding 38 px 48 px 25 px; altura mínima 100dvh |
| Miolo do formulário | Largura máxima 365 px; centralização vertical |
| Campos do login | Fundo #19191E; borda #35343E; altura mínima 46 px |
| Ação de entrada | Coral; largura total; texto à esquerda e seta à direita |
| Ação secundária | Contorno discreto, sem preenchimento coral |
| Arte e copy | Título próximo à base; textos pequenos em mono no topo e no rodapé |

Copy de marca disponível: “Bem-vindo ao próximo nível.”; “Toda a sua operação. Uma visão inteligente.”; “A próxima decisão muda tudo.”; “Da primeira conexão ao resultado. Transforme informação em direção.”. Fluxos de convite, cadastro e recuperação devem seguir a autenticação do novo CRM.

# Entrada móvel e adaptação responsiva

Entrada a 390 px de largura. A arte aparece antes do formulário.

Até 760 px, a entrada vira uma coluna e a arte sobe para o topo. O bloco visual mede 340 px de altura, usa object-position: center 35% e brilho de 0,65. O título da arte cai para 29 px. O parágrafo da arte e seu rodapé ficam ocultos.

O formulário recebe padding lateral de 27 px e largura máxima de 420 px. O título mede 29 px; campos e botão principal têm altura mínima de 48 px. O formulário continua abaixo da arte, com rolagem normal da página.

# Botões campos e janelas de edição

Amostras de ações, estados, campos, mensagens e modal em conteúdo neutro.

| Estado ou controle | Especificação |
| --- | --- |
| Botão primário | Fundo e borda #DF4650; texto #FFFFFF; hover brightness 1,1 |
| Botão secundário | Fundo #212328; borda #35383F; hover #2C2F35 / #5B606A |
| Ação discreta coral | Fundo #DF465017; texto #F78E95; borda #DF46502B |
| Desabilitado | Opacidade 0,45; cursor not-allowed |
| Pressionado | Deslocamento vertical de 1 px |
| Foco de botão ou link | Outline #F68A93 de 2 px; distância de 4 px |
| Campo comum | Fundo #121417; texto #E9EBEF; borda #33363D |
| Campo em foco | Borda coral; halo de 3 px em #DF465018 |

O botão padrão tem altura mínima de 39 px, raio de 7 px, padding de 10 × 15 px e ícone com distância de 8 px do texto. Ícones isolados usam botão de 34 × 34 px e raio de 6 px. Campos precisam de label visível; placeholder complementa o label.

O modal mede 640 px, limitado à largura da tela menos 30 px e a 90dvh de altura. Use fundo #1B2028, texto #DEE5EF, borda #4A5261, backdrop #05080DCF com blur de 7 px e rodapé de ações fixo dentro do modal. No celular, o formulário passa de duas para uma coluna.

# Painel navegação listas e conversas

Composição ilustrativa com valores vazios e registros de exemplo, usando a linguagem visual do projeto.

A navegação lateral usa ícones de contorno, texto cinza e espaçamento vertical compacto. O item ativo tem fundo #DF465014 e uma linha coral interna de 2 px à esquerda. A topbar mostra o caminho da página e controles de apoio; o título principal pertence ao conteúdo abaixo dela.

| Componente | Direcionamento visual |
| --- | --- |
| Indicadores | Quatro colunas, gap de 16 px; apenas um destaque coral quando necessário |
| Gráficos | Série principal coral 2,5 px; secundária #758393 de 1,5 px; preenchimento coral de 25% a zero |
| Tabelas | Alinhamento consistente, bordas discretas, ações curtas; rolagem no contêiner |
| Kanban | Colunas de 225 px mínimas, raio 9 px; cartões #1D2127, raio 7 px |
| Mensagens | Entrada #272F39; saída #402E39; texto #CAD2DE; cantos assimétricos |
| Ícones | Tabler Icons em contorno; 16 a 20 px nos controles, 19 px na navegação |

Use os módulos que existirem no novo CRM. Os nomes, os registros, os indicadores e as ações devem vir do novo produto. As telas de referência do kit demonstram composição e não representam uma operação real.

# Funis profundidade e movimento

Workspace de referência com perspectiva CSS e blocos sem regras operacionais.

O efeito espacial é uma transformação do canvas em CSS. Não é um motor de cena 3D. O projeto usa React Flow para nós, conexões, zoom e arraste; o modo Perspectiva aplica a inclinação ao contêiner que mantém os elementos do fluxo.

| Propriedade | Valor original |
| --- | --- |
| Área de trabalho | 650 px de altura; colunas de 170 px, área flexível e 220 px |
| Perspectiva | 1300 px no contêiner do canvas |
| Transformação | rotateX(18deg) rotateY(-10deg) scale(.94) |
| Transição do plano | 700 ms ease; origem 50% 50% |
| Bloco | 240 px de largura; padding 17 × 16 px; raio 9 px |
| Material do bloco | Degradê #2A2E38 para #1D222A; borda #50515F |
| Conexões e grade | Conexão #B45460; grade de pontos #353941 a cada 22 px |
| Seleção | Borda coral e halo suave #DF46502A |

Outros movimentos: botões em 180 ms; entrada da página em 350 ms com fade e deslocamento de 8 px; gaveta móvel em 250 ms; spinner em ciclo de 1 segundo. Preserve prefers-reduced-motion para desligar animações e transições quando solicitado pelo usuário.

Na implementação nova, mantenha 2D como modo padrão de edição. A perspectiva deve ser opcional. Confirme as coordenadas de arraste e conexão após transformar o canvas, especialmente em telas de toque.

# Responsividade legibilidade e estados

| Largura | Comportamento do projeto |
| --- | --- |
| A partir de 1600 px | Workspace com 44 px laterais; indicadores maiores; áreas de gráfico e funil ampliadas |
| Até 1250 px | Sidebar de 205 px; padding lateral de 23 px; grades de catálogo em duas colunas |
| Até 1000 px | Sidebar de 190 px; indicadores em duas colunas; painel principal em uma coluna |
| Até 760 px | Sidebar como gaveta de 240 px; topbar de 60 px; conteúdo com 16 px laterais; grades em uma coluna |
| Até 600 px | Ajustes adicionais em filtros, paginação e gráfico compacto |

## Estados necessários no novo sistema

Normal, hover, foco, pressionado, desabilitado e carregamento nos controles.

Vazio, carregando, erro, sucesso e sem permissão nas áreas de conteúdo.

Labels, ajuda e erro associados a cada campo.

Fechar modal por botão e Escape, com foco retornando ao controle de origem.

Menu móvel operável por teclado, com fechamento e fundo de bloqueio.

## Ajustes recomendados para a nova implementação

A interface original usa vários textos de 7 a 12 px. Para a nova operação, aumente textos de leitura contínua para 14 a 16 px e preserve a hierarquia. Prefira áreas de toque de pelo menos 44 × 44 px, mesmo quando o ícone visual for menor. No iPhone, campos com texto de 16 px também evitam o zoom automático de foco.

Branco sobre o coral #DF4650 tem contraste calculado de aproximadamente 4,09:1. Para texto pequeno de botão, valide uma variação coral mais escura ou texto escuro; não afirme conformidade de acessibilidade mantendo esse par sem revisão. Os valores originais permanecem documentados para reprodução fiel.

Esses ajustes são recomendações para o novo CRM, não características já aplicadas ao projeto de referência. Valide contraste, navegação por teclado, zoom de 200% e ausência de corte horizontal antes de aprovar a nova interface.

# Entrega para a IA e organização do repositório

| Pasta ou arquivo | Conteúdo e uso |
| --- | --- |
| assets/ | Imagens, símbolos, assinatura, favicons, manifest e inventário com hashes |
| fonts/ | Fontes TTF, CSS de carregamento e licenças |
| styles/design-tokens.json | Valores de cor, tipografia, medidas, breakpoints e movimento |
| styles/tokens.css | Variáveis semânticas com prefixo --fx |
| styles/interface.css | Referência visual completa, com fontes locais |
| components/FXBrand.tsx | Símbolo e assinatura em componentes React de apresentação |
| preview/ | Referências navegáveis de entrada, painel, componentes, marca e perspectiva |
| docs/ | Este guia, versão Markdown e instruções prontas para outra IA |
| reference/interface-original.css | CSS de origem para conferir valores e diferenças |

## Ordem de aplicação

Copiar assets e fontes para o novo projeto e ajustar seus caminhos públicos.

Definir os tokens e importar as fontes uma única vez.

Implementar o símbolo, a assinatura, a estrutura e a entrada responsiva.

Mapear os componentes existentes para botões, campos, painéis, tabelas e estados FX.

Aplicar os estilos aos módulos do novo CRM sem copiar a lógica do projeto anterior.

Conferir desktop, celular, foco, erros, carregamento e redução de movimento.

O CSS completo tem seletores globais. Use-o para comparação em um ambiente isolado; em um aplicativo existente, adote os tokens e adapte os seletores ou coloque a interface em um escopo próprio. Não sobreponha estilos globais de produção sem verificar conflitos.

## Critérios de aceite

A nova interface deve manter o símbolo FX, as imagens originais, as duas famílias tipográficas, a hierarquia escura com coral, a composição da entrada e a consistência dos estados. Os dados, os links, a autenticação, as permissões e as integrações devem pertencer exclusivamente ao novo CRM.

Inicie pela prévia local e pelo arquivo PROMPT-PARA-IA.md. As licenças de fontes ficam em fonts; o inventário em assets/manifest.json permite confirmar quais imagens e símbolos foram usados.
