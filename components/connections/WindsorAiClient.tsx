"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  adicionarContaWindsor,
  definirContaWindsorPadrao,
  listarContasWindsorDisponiveis,
  removerContaWindsor,
} from "@/app/actions/integrations/windsor/contas";
import { conectarWindsor, desconectarWindsor } from "@/app/actions/integrations/windsor/connectWindsor";
import { sincronizarContaWindsor } from "@/app/actions/integrations/windsor/sincronizar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";

/**
 * Aba "Windsor.ai" de Conexões — leitura de Meta Ads e Instagram via
 * Windsor.ai, ISOLADA do token direto da Meta (aba "API Oficial (Meta)" trata
 * de CANAL de mensagem, não de leitura de anúncio; a leitura direta vive em
 * Configurações › Meta Ads e não tem cartão nesta tela).
 *
 * A chave nunca é lida de volta — mesma regra de todo formulário de
 * credencial desta casa (ver `FormularioDeMetaAds`).
 */

const ERRO_EM_PORTUGUES: Record<string, string> = {
  validation_failed: "Confira a chave: ela precisa ter pelo menos 20 caracteres.",
  unauthenticated: "Sua sessão expirou. Entre de novo.",
  forbidden_tenant: "Você não está em nenhuma organização ativa.",
  forbidden_role: "Só um administrador da organização pode mudar esta conexão.",
  mfa_required: "Confirme o segundo fator para salvar esta mudança.",
  cifra_indisponivel:
    "Esta instalação está sem a chave mestra de criptografia, e a chave não foi gravada. Quem instalou o sistema precisa configurá-la — refazer o cadastro aqui não resolve.",
  erro_ao_gravar: "Não consegui gravar agora. Tente de novo em instantes.",
  sem_conexao: "Nenhuma chave do Windsor.ai conectada.",
  chave_invalida: "O Windsor.ai recusou a chave — confira se ela ainda é válida no painel deles.",
  conta_nao_alcancada: "Esta chave não alcança mais essa conta no Windsor.ai.",
  limite_de_chamadas: "O Windsor.ai limitou as chamadas por excesso de consultas. Espere alguns minutos.",
  campo_invalido: "O Windsor.ai recusou um campo desta consulta — avise quem mantém a instalação.",
  transitorio: "Não consegui falar com o Windsor.ai agora. Tente de novo em instantes.",
};

function erroPara(codigo: string): string {
  return ERRO_EM_PORTUGUES[codigo] ?? "Não consegui completar agora.";
}

interface ContaLinha {
  id: string;
  platform: "meta_ads" | "instagram";
  external_account_id: string;
  nome: string | null;
  is_default: boolean;
}

export function WindsorAiClient({
  conectado,
  contas,
}: {
  conectado: boolean;
  contas: ContaLinha[];
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState("");

  if (!conectado) {
    return (
      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h3 className="text-base font-medium">{t("Windsor.ai — Meta Ads e Instagram")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "Uma conexão isolada, à parte do canal do WhatsApp e do token direto da Meta: cole aqui a chave de API da sua conta Windsor.ai para trazer as métricas de Meta Ads e Instagram para dentro do CRM.",
            )}
          </p>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            {t("Entre em ")}
            <span className="font-mono">windsor.ai</span>
            {t(" e conecte suas contas de Meta Ads e Instagram por lá (OAuth deles, não desta tela).")}
          </li>
          <li>{t("Copie a chave de API do seu painel Windsor.ai.")}</li>
          <li>{t("Cole a chave abaixo e clique em Conectar.")}</li>
        </ol>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await conectarWindsor({ api_key: apiKey.trim() });
              if (r.ok) {
                setApiKey("");
                toast.success(t("Windsor.ai conectado."));
                router.refresh();
                return;
              }
              toast.error(t(erroPara(r.error)));
            });
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="windsor_api_key">{t("Chave de API do Windsor.ai")}</Label>
            <Input
              id="windsor_api_key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="wnd_..."
            />
          </div>
          <div>
            <Button type="submit" disabled={isPending || apiKey.trim().length < 20}>
              {isPending ? t("Conectando…") : t("Conectar")}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  const contasMeta = contas.filter((c) => c.platform === "meta_ads");
  const contasInstagram = contas.filter((c) => c.platform === "instagram");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">{t("Windsor.ai conectado")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("A chave está guardada criptografada e nunca é mostrada de volta.")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await desconectarWindsor();
                if (r.ok) {
                  toast.success(t("Windsor.ai desconectado."));
                  router.refresh();
                  return;
                }
                toast.error(t(erroPara(r.error)));
              })
            }
          >
            {t("Desconectar")}
          </Button>
        </div>
      </Card>

      <GrupoDeContas
        titulo={t("Contas de Meta Ads")}
        plataforma="meta_ads"
        contas={contasMeta}
        linkPainel="/app/ads/windsor/meta"
      />
      <GrupoDeContas
        titulo={t("Perfis de Instagram")}
        plataforma="instagram"
        contas={contasInstagram}
        linkPainel="/app/ads/windsor/instagram"
      />
    </div>
  );
}

function GrupoDeContas({
  titulo,
  plataforma,
  contas,
  linkPainel,
}: {
  titulo: string;
  plataforma: "meta_ads" | "instagram";
  contas: ContaLinha[];
  linkPainel: string;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disponiveis, setDisponiveis] = useState<Array<{ idExterno: string; nome: string | null }> | null>(null);
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false);
  const [selecionada, setSelecionada] = useState<string>("");

  async function carregarDisponiveis() {
    setCarregandoDisponiveis(true);
    const r = await listarContasWindsorDisponiveis(plataforma);
    setCarregandoDisponiveis(false);
    if (!r.ok) {
      toast.error(t(erroPara(r.error)));
      setDisponiveis([]);
      return;
    }
    setDisponiveis(r.contas);
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{titulo}</h3>
        <a href={linkPainel} className="text-sm underline underline-offset-2">
          {t("Abrir painel")}
        </a>
      </div>

      {contas.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("Nenhuma conta adicionada ainda.")}</p>
      )}

      {contas.map((conta) => (
        <div key={conta.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{conta.nome ?? conta.external_account_id}</span>
            {conta.is_default && <Badge variant="outline">{t("padrão")}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await sincronizarContaWindsor(conta.id, plataforma);
                  if (r.ok) {
                    toast.success(t("Atualizado."));
                    router.refresh();
                    return;
                  }
                  toast.error(t(erroPara(r.error)));
                })
              }
            >
              {t("Atualizar")}
            </Button>
            {!conta.is_default && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await definirContaWindsorPadrao(conta.id);
                    if (r.ok) {
                      router.refresh();
                      return;
                    }
                    toast.error(t(erroPara(r.error)));
                  })
                }
              >
                {t("Tornar padrão")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await removerContaWindsor(conta.id);
                  if (r.ok) {
                    toast.success(t("Conta removida."));
                    router.refresh();
                    return;
                  }
                  toast.error(t(erroPara(r.error)));
                })
              }
            >
              {t("Remover")}
            </Button>
          </div>
        </div>
      ))}

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>{t("Adicionar outra conta da mesma empresa")}</Label>
          <Select
            value={selecionada}
            onValueChange={setSelecionada}
            onOpenChange={(aberto) => {
              if (aberto && disponiveis === null) void carregarDisponiveis();
            }}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  carregandoDisponiveis ? t("Carregando…") : t("Escolha uma conta alcançada pela chave")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(disponiveis ?? []).length === 0 && !carregandoDisponiveis && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {t("Nenhuma conta nova encontrada.")}
                </div>
              )}
              {(disponiveis ?? []).map((c) => (
                <SelectItem key={c.idExterno} value={c.idExterno}>
                  {c.nome ?? c.idExterno}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          disabled={isPending || !selecionada}
          onClick={() =>
            startTransition(async () => {
              const escolhida = (disponiveis ?? []).find((c) => c.idExterno === selecionada);
              const r = await adicionarContaWindsor({
                platform: plataforma,
                external_account_id: selecionada,
                nome: escolhida?.nome ?? null,
              });
              if (r.ok) {
                toast.success(t("Conta adicionada."));
                setSelecionada("");
                setDisponiveis(null);
                router.refresh();
                return;
              }
              toast.error(t(erroPara(r.error)));
            })
          }
        >
          {t("Adicionar")}
        </Button>
      </div>
    </Card>
  );
}
