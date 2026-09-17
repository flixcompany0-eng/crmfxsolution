---
impacto: capacidade_nova
secao: adicionado
titulo: Windsor.ai como provedor de Meta Ads e Instagram, e a marca vira FX Solution
---

Conexões ganhou uma aba nova, isolada do WhatsApp e da conexão direta com a Meta que já existia:
cole a chave de API do Windsor.ai e o CRM passa a trazer, para dentro do próprio banco, métricas
de Meta Ads (com suporte a mais de uma conta da mesma empresa), os criativos de cada campanha, e
todos os indicadores de Instagram Insights. Quem já usa a conexão direta com a Meta continua
usando normalmente — as duas convivem, e nenhuma mexe na credencial ou nos dados da outra.

Saldo e gasto acumulado da conta de anúncios ficam disponíveis por um token de negócio Meta
separado e opcional; "último depósito" não é mostrado, porque a Meta não expõe esse número de
forma confiável — a tela diz "não disponível" em vez de inventar um valor.

No mesmo passe, o produto passou a se chamar FX Solution: nome, cor de destaque e (depois de um
upload em `/admin/marca`) o logo. Nenhuma tela, fluxo ou regra de negócio mudou de comportamento
por causa disso — a marca inteira é resolvida em runtime pelo sistema de marca própria que o
produto já tinha.

Ainda não entregue neste pacote: o campo de conversa com IA que leria esses dados para
curadoria, e a integração com o radar do CRM. Os dados já ficam agregados e prontos para isso
(`lib/windsor/resumo-para-ia.ts`); falta registrar o ponto de IA seguindo o catálogo existente
(`lib/ai/pontos/registro.ts`) — ver `HANDOFF-windsor-ai.md`.

Trabalho original desta sessão; nenhuma parte foi ainda provada num Postgres real nem numa tela
real — ver os dois arquivos de handoff (`HANDOFF-windsor-ai.md`, `HANDOFF-fx-solution-branding.md`)
para o que falta antes de considerar isto pronto para produção.
