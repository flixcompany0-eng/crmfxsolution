# Identidade visual FX Solution

Kit de marca e referência de interface para aplicar o visual do FX Solution em outro CRM.

## Comece aqui

Abra `docs/FX-Solution-Identidade-Visual.docx` para o guia ilustrado. A versão em texto está em `docs/IDENTIDADE-VISUAL.md`. Entregue `docs/PROMPT-PARA-IA.md` à IA que implementará o novo sistema.

## Prévia local

Abra `preview/index.html` no navegador. O menu inferior leva à entrada, painel, componentes, perspectiva e marca. Os exemplos são locais e usam conteúdo neutro. Não há autenticação, banco de dados ou integrações. O menu móvel e o seletor de perspectiva demonstram comportamento visual; os demais controles são amostras de apresentação.

## Arquivos

- `assets/`: imagens originais, símbolo da interface, assinatura em curvas, favicons e manifest.
- `fonts/`: Outfit, IBM Plex Mono, CSS local e licenças.
- `styles/design-tokens.json`: especificação de cores e medidas.
- `styles/tokens.css`: variáveis semânticas.
- `styles/interface.css`: CSS de referência com carregamento local de fontes.
- `components/FXBrand.tsx`: componente React de marca, sem dependências operacionais.
- `preview/`: composições de referência em HTML.
- `docs/`: guia e instruções para implementação.
- `reference/interface-original.css`: CSS da versão de origem para comparação.

## Aplicar em outro projeto

Copie os assets e as fontes para caminhos públicos adequados. Mapeie os tokens para os componentes do novo CRM. Use o CSS completo para consulta: ele contém seletores globais e não deve ser importado sem avaliar conflitos com os estilos existentes. Atualize o manifest e os metadados com o domínio e a descrição do novo produto.

`assets/fx-symbol-ui.svg` usa `currentColor` e foi extraído dos dois paths do componente da interface. Para uso em `<img>`, prefira `assets/fx-symbol-light.svg` ou `assets/fx-symbol-coral.svg`. `assets/fx-logo-horizontal.svg` é a assinatura convertida para curvas para esta entrega. O componente React é a referência para a composição responsiva.

As imagens e os favicons originais foram preservados. O favicon e a arte metálica não têm exatamente o mesmo desenho do símbolo vetorial da interface. Consulte o guia antes de unificar variantes.

## Proveniência

Identidade extraída do pacote FX-Solution-N8N-Atualizacao, revisão `e2748be9d27a435af245c0fccc0f6b952b909361`, e organizada em 17/09/2026. O inventário de assets registra arquivos, dimensões e hashes. As prévias foram reconstruídas com conteúdo neutro para demonstrar o estilo.

Este kit não contém o backend, dados operacionais, credenciais ou configurações de publicação do sistema de origem. As fontes mantêm suas licenças SIL Open Font License em `fonts/`. A identidade de marca deve ser utilizada conforme a autorização da Flix Company.
