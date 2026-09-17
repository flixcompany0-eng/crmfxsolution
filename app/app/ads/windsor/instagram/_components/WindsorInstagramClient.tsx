"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { sincronizarContaWindsor } from "@/app/actions/integrations/windsor/sincronizar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";
import { useWindsorAccounts, useWindsorInstagram } from "@/hooks/ads/useWindsorAds";
import { ApiError } from "@/lib/api/types";
import type { Idioma } from "@/lib/i18n/idiomas";

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  windsor_sem_conexao: "Nenhuma chave do Windsor.ai conectada. Conecte em Conexões › Windsor.ai.",
  windsor_cifra_indisponivel: "A chave de criptografia da instalação não está disponível — configuração do servidor.",
  windsor_conta_nao_encontrada: "Este perfil não existe mais ou foi removido.",
  forbidden_role: "Seu papel não permite ver os dados de Instagram.",
};

function comoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function haDias(dias: number): { de: string; ate: string } {
  const fim = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const inicio = new Date(fim.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  return { de: comoData(inicio), ate: comoData(fim) };
}

export function WindsorInstagramClient({ idioma }: { idioma: Idioma }) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const contas = useWindsorAccounts("instagram", true);
  const listaDeContas = useMemo(() => contas.data?.data.contas ?? [], [contas.data]);
  const [contaId, setContaId] = useState<string | null>(null);
  const contaEfetiva = contaId ?? listaDeContas.find((c) => c.is_default)?.id ?? listaDeContas[0]?.id ?? null;

  const [preset, setPreset] = useState("30");
  const [intervalo, setIntervalo] = useState(() => haDias(30));

  const painel = useWindsorInstagram(contaEfetiva, intervalo.de, intervalo.ate);

  function mensagemDeErro(erro: unknown): string {
    if (erro instanceof ApiError) return t(MENSAGEM_POR_CODIGO[erro.code] ?? "Não consegui carregar os dados agora.");
    return t("Não consegui carregar os dados agora.");
  }

  if (listaDeContas.length === 0 && !contas.isLoading) {
    return (
      <Card className="p-6 text-sm">
        <p className="font-medium">{t("Nenhum perfil de Instagram adicionado.")}</p>
        <p className="mt-1 text-muted-foreground">
          {t("Adicione um perfil em Conexões › Windsor.ai para ver os dados aqui.")}
        </p>
      </Card>
    );
  }

  const dados = painel.data?.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil">{t("Perfil")}</Label>
          <Select value={contaEfetiva ?? ""} onValueChange={setContaId}>
            <SelectTrigger id="perfil" className="w-72">
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
          <Select
            value={preset}
            onValueChange={(v) => {
              setPreset(v);
              setIntervalo(haDias(Number(v)));
            }}
          >
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
              const r = await sincronizarContaWindsor(contaEfetiva, "instagram");
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
            <Kpi rotulo={t("Seguidores")} valor={dados.seguidores_atual?.toLocaleString(idioma) ?? "—"} />
            <Kpi
              rotulo={t("Alcance no período")}
              valor={dados.serie_diaria.reduce((acc, l) => acc + (l.reach ?? 0), 0).toLocaleString(idioma)}
            />
            <Kpi
              rotulo={t("Impressões no período")}
              valor={dados.serie_diaria.reduce((acc, l) => acc + (l.impressions ?? 0), 0).toLocaleString(idioma)}
            />
            <Kpi
              rotulo={t("Visualizações de perfil")}
              valor={dados.serie_diaria.reduce((acc, l) => acc + (l.profile_views ?? 0), 0).toLocaleString(idioma)}
            />
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-medium">{t("Conteúdo recente")}</h3>
            {dados.midia.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("Nenhum post no período. Clique em Atualizar.")}</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {dados.midia.map((m) => (
                <a
                  key={m.external_media_id}
                  href={m.permalink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-2 rounded-md border p-3 hover:bg-muted"
                >
                  {m.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arte externa do Instagram.
                    <img src={m.thumbnail_url} alt={m.caption ?? ""} className="h-28 w-full rounded-md object-cover" />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      {m.media_type ?? t("Sem prévia")}
                    </div>
                  )}
                  <p className="line-clamp-2 text-xs">{m.caption ?? t("Sem legenda")}</p>
                  <p className="text-xs text-muted-foreground">
                    ❤ {m.like_count ?? 0} · 💬 {m.comments_count ?? 0}
                  </p>
                </a>
              ))}
            </div>
          </Card>

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
