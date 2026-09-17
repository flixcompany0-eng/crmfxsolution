"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { salvarTokenDeNegocioMeta, sincronizarSaldoMeta } from "@/app/actions/integrations/windsor/billing";
import { sincronizarContaWindsor } from "@/app/actions/integrations/windsor/sincronizar";
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
import { useWindsorAccounts, useWindsorMeta } from "@/hooks/ads/useWindsorAds";
import { ApiError } from "@/lib/api/types";
import type { Idioma } from "@/lib/i18n/idiomas";

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  windsor_sem_conexao: "Nenhuma chave do Windsor.ai conectada. Conecte em Conexões › Windsor.ai.",
  windsor_cifra_indisponivel: "A chave de criptografia da instalação não está disponível — configuração do servidor.",
  windsor_conta_nao_encontrada: "Esta conta não existe mais ou foi removida.",
  forbidden_role: "Seu papel não permite ver os dados de anúncios.",
};

function comoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function ontem(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}
function haDias(dias: number): { de: string; ate: string } {
  const fim = ontem();
  const inicio = new Date(fim.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  return { de: comoData(inicio), ate: comoData(fim) };
}

function formatarMoeda(centavos: number, moeda: string): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: moeda || "BRL" });
}

export function WindsorMetaClient({ idioma }: { idioma: Idioma }) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const contas = useWindsorAccounts("meta_ads", true);
  const listaDeContas = useMemo(() => contas.data?.data.contas ?? [], [contas.data]);

  const [contaId, setContaId] = useState<string | null>(null);
  const contaEfetiva = contaId ?? listaDeContas.find((c) => c.is_default)?.id ?? listaDeContas[0]?.id ?? null;

  const [preset, setPreset] = useState("30");
  const [intervalo, setIntervalo] = useState(() => haDias(30));
  const [tokenNegocio, setTokenNegocio] = useState("");

  function trocarPreset(valor: string) {
    setPreset(valor);
    setIntervalo(haDias(Number(valor)));
  }

  const painel = useWindsorMeta(contaEfetiva, intervalo.de, intervalo.ate);

  function mensagemDeErro(erro: unknown): string {
    if (erro instanceof ApiError) return t(MENSAGEM_POR_CODIGO[erro.code] ?? "Não consegui carregar os dados agora.");
    return t("Não consegui carregar os dados agora.");
  }

  if (listaDeContas.length === 0 && !contas.isLoading) {
    return (
      <Card className="p-6 text-sm">
        <p className="font-medium">{t("Nenhuma conta de Meta Ads adicionada.")}</p>
        <p className="mt-1 text-muted-foreground">
          {t("Adicione uma conta em Conexões › Windsor.ai para ver os dados aqui.")}
        </p>
      </Card>
    );
  }

  const dados = painel.data?.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conta">{t("Conta de anúncios")}</Label>
          <Select value={contaEfetiva ?? ""} onValueChange={setContaId} disabled={listaDeContas.length === 0}>
            <SelectTrigger id="conta" className="w-72">
              <SelectValue placeholder={t("Carregando…")} />
            </SelectTrigger>
            <SelectContent>
              {listaDeContas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome ?? c.external_account_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodo">{t("Período")}</Label>
          {/* Presets fixos, sem período customizado nesta versão: o eixo direto
              da Meta (`/app/ads/meta`) já cobre customizado com leitura sob
              demanda; aqui os dados vêm de sincronização periódica gravada no
              banco, e os três presets cobrem o caso de uso real. */}
          <Select value={preset} onValueChange={trocarPreset}>
            <SelectTrigger id="periodo" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("Últimos 7 dias")}</SelectItem>
              <SelectItem value="30">{t("Últimos 30 dias")}</SelectItem>
              <SelectItem value="90">{t("Últimos 90 dias")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() =>
            contaEfetiva &&
            startTransition(async () => {
              const r = await sincronizarContaWindsor(contaEfetiva, "meta_ads");
              if (r.ok) {
                toast.success(t("Atualizado."));
                painel.refetch();
                return;
              }
              toast.error(t(MENSAGEM_POR_CODIGO[r.error] ?? "Não consegui atualizar agora."));
            })
          }
          disabled={isPending || !contaEfetiva}
        >
          {isPending ? t("Atualizando…") : t("Atualizar")}
        </Button>
      </div>

      {painel.error && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {mensagemDeErro(painel.error)}
        </div>
      )}

      {dados && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi rotulo={t("Impressões")} valor={dados.totais.impressions.toLocaleString(idioma)} />
            <Kpi rotulo={t("Cliques")} valor={dados.totais.clicks.toLocaleString(idioma)} />
            <Kpi rotulo={t("Investimento")} valor={formatarMoeda(dados.totais.spend_cents, dados.conta.moeda)} />
            <Kpi
              rotulo={t("CTR")}
              valor={dados.totais.impressions > 0 ? `${((dados.totais.clicks / dados.totais.impressions) * 100).toFixed(2)}%` : "—"}
            />
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-medium">{t("Criativos")}</h3>
            {dados.criativos.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("Nenhum criativo no período. Clique em Atualizar.")}</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {dados.criativos.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 rounded-md border p-3">
                  {c.image_url || c.video_thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arte externa da Meta, sem otimização de asset local.
                    <img
                      src={c.image_url ?? c.video_thumbnail_url ?? ""}
                      alt={c.ad_name ?? ""}
                      className="h-28 w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      {t("Sem prévia")}
                    </div>
                  )}
                  <p className="line-clamp-2 text-xs font-medium">{c.ad_name ?? t("Sem nome")}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.totais.impressions.toLocaleString(idioma)} {t("impr.")} ·{" "}
                    {formatarMoeda(c.totais.spend_cents, dados.conta.moeda)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <PainelDeSaldo contaId={dados.conta.id} moeda={dados.conta.moeda} tokenNegocio={tokenNegocio} setTokenNegocio={setTokenNegocio} />

          <p className="text-xs text-muted-foreground">
            {t("Período")}: {dados.periodo.from} {t("a")} {dados.periodo.to} · {t("sincronizado em")}{" "}
            {new Date(dados.lido_em).toLocaleString(idioma)}
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
    </Card>
  );
}

/**
 * Saldo e depósito — sempre OPCIONAL e claramente separado do resto: exige um
 * segundo token (sistema Meta Business), que a maioria das organizações não
 * vai ter de imediato. Ver o cabeçalho de `billing.ts` para por que "último
 * depósito" fica de fora nesta versão.
 */
function PainelDeSaldo({
  contaId,
  moeda,
  tokenNegocio,
  setTokenNegocio,
}: {
  contaId: string;
  moeda: string;
  tokenNegocio: string;
  setTokenNegocio: (v: string) => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("Saldo e depósitos")}</h3>
        {!mostrarFormulario && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setMostrarFormulario(true)}>
            {t("Conectar saldo (opcional)")}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "Não disponível pelo Windsor.ai — exige um token de sistema da Meta Business, separado da chave do Windsor.ai. Histórico de depósito não é suportado nesta versão; saldo e gasto total, sim.",
        )}
      </p>

      {mostrarFormulario && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="token_negocio">{t("Token de sistema Meta Business")}</Label>
            <Input
              id="token_negocio"
              type="password"
              value={tokenNegocio}
              onChange={(e) => setTokenNegocio(e.target.value)}
              placeholder="EAA…"
            />
          </div>
          <Button
            type="button"
            disabled={isPending || tokenNegocio.trim().length < 20}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarTokenDeNegocioMeta({
                  ad_account_id: contaId,
                  meta_business_token: tokenNegocio.trim(),
                });
                if (!r.ok) {
                  toast.error(t("Não consegui salvar o token."));
                  return;
                }
                const sync = await sincronizarSaldoMeta(contaId);
                if (sync.ok) {
                  toast.success(t("Saldo sincronizado."));
                  setTokenNegocio("");
                  setMostrarFormulario(false);
                } else {
                  toast.error(t("Token salvo, mas não consegui ler o saldo agora."));
                }
              })
            }
          >
            {t("Salvar e sincronizar")}
          </Button>
        </div>
      )}
    </Card>
  );
}
