# Aplicar a identidade visual FX Solution no novo CRM

Você é responsável pela implementação da interface do meu novo CRM. Aplique a identidade visual fornecida neste repositório, usando os arquivos originais da marca e as especificações do guia.

## Leia antes de alterar

1. `docs/IDENTIDADE-VISUAL.md` ou `docs/FX-Solution-Identidade-Visual.docx`.
2. `styles/design-tokens.json` e `styles/tokens.css`.
3. As referências de `preview/`, principalmente entrada, painel, componentes e funil.
4. `assets/manifest.json` para identificar os arquivos visuais.

## Objetivo

Transferir a aparência e a experiência visual do FX Solution para o novo CRM. Preserve a arquitetura, os dados, as permissões e as regras de negócio do novo produto. Este kit é uma referência visual, não um backend nem uma aplicação operacional pronta.

## Identidade obrigatória

- Preserve o símbolo FX e a assinatura FX SOLUTION. Não redesenhe o monograma e não o substitua por uma imagem gerada por IA.
- Use `assets/fx-brand.webp` como arte da entrada. Preserve sua proporção e o enquadramento descrito no guia.
- Use os favicons originais e ajuste somente seus caminhos de publicação.
- Use Outfit para interface e IBM Plex Mono para informações técnicas. Carregue os arquivos de `fonts/` ou mantenha uma estratégia equivalente aprovada. Preserve os arquivos de licença.
- A base é grafite `#101113`, painéis `#181A1E`, texto `#ECEDEF`, texto secundário `#989DA8` e destaque coral `#DF4650`.
- Respeite as bordas finas, raios moderados, títulos leves e espaçamentos. Evite brilhos intensos e efeitos que dificultem leitura.

## Entrada e navegação

No desktop, reproduza a entrada com duas colunas iguais: marca, formulário e ações à esquerda; imagem da marca e frase à direita. Até 760 px, coloque a arte acima do formulário com 340 px de altura. Os campos e o botão de entrada devem ter pelo menos 48 px de altura no celular.

Use a sidebar e a topbar como referências. Adapte os itens de navegação aos módulos reais do novo CRM. O nome da empresa pode ser personalizado, mantendo o selo da plataforma onde estiver definido no projeto.

## Componentes

Implemente ou adapte componentes reutilizáveis para marca, botões, botões de ícone, campos, seletores, badges, cards, tabelas, modal, toast, estado vazio e carregamento. Conecte as ações às funções existentes no novo sistema. Os controles da prévia são demonstrações de aparência.

Inclua os estados normal, hover, foco, pressionado, desabilitado, carregando, erro e sucesso. Não crie botões operacionais sem ação real. Aplique rótulos acessíveis, foco visível e retorno de foco ao fechar modais.

## Gráficos conversas e funis

Use a linguagem visual do guia para indicadores, séries de gráficos, tabelas, mensagens e cartões de etapas. Exiba somente dados reais do novo sistema ou exemplos explicitamente identificados durante desenvolvimento. Não transforme os traçados ilustrativos da prévia em resultados de operação.

Se o novo produto tiver editor de funis, preserve o modo 2D como padrão. A perspectiva é opcional: `perspective: 1300px` e `rotateX(18deg) rotateY(-10deg) scale(.94)`. Valide o arraste, o zoom e as conexões após aplicar a transformação. Não trate essa perspectiva CSS como motor 3D.

## Separação do sistema anterior

Não importe cadastros, conversas, produtos, comissões, integrações, bancos de dados, rotas autenticadas, domínios, credenciais ou arquivos de configuração do CRM de origem. Nenhum deles é necessário para aplicar o visual. Configure títulos, descrições, links e metadados de compartilhamento com os dados do novo CRM.

Não copie o CSS global diretamente sobre a aplicação sem avaliar conflitos. Mapeie os tokens para os componentes do novo projeto ou coloque os estilos em um escopo próprio.

## Adaptações de acessibilidade

O guia distingue os valores originais das melhorias recomendadas. Preserve a identidade ao aumentar textos muito pequenos, ampliar áreas de toque, revisar o contraste do botão coral e respeitar `prefers-reduced-motion`. Registre qualquer diferença de implementação em relação à referência visual.

## Ordem de execução

1. Inspecione a estrutura atual do novo CRM.
2. Mapeie os componentes existentes para a identidade FX.
3. Adicione assets, fontes, tokens e marca.
4. Aplique a entrada, a navegação e os componentes básicos.
5. Adapte os módulos do novo CRM.
6. Valide desktop e celular, estados, teclado, zoom e leitura.
7. Apresente as telas implementadas, os arquivos alterados e as diferenças deliberadas em relação ao guia.

## Critério de aprovação

A entrega deve ser reconhecível como FX Solution pelas imagens, símbolo, paleta, tipografia, composição e estados. O funcionamento e as informações devem ser exclusivamente os do novo CRM. Não considere o trabalho concluído apenas por trocar o logo e a cor do botão.
