/**
 * Análise → Instagram (Windsor.ai). Não existe eixo direto concorrente aqui
 * (ao contrário de Meta Ads) — antes desta feature, o sistema não tinha
 * nenhuma leitura de Instagram. Mesmo piso de papel (`manager`) do resto do
 * grupo "Análise".
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { existeConexaoWindsor } from "@/lib/windsor/credenciais";

import { WindsorInstagramClient } from "./_components/WindsorInstagramClient";

export const metadata = { title: "Instagram · Windsor.ai" };
export const dynamic = "force-dynamic";

export default async function WindsorInstagramPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const admin = createAdminClient();
  const conectado = await existeConexaoWindsor(admin, activeOrg.orgId);

  const idioma = user.idioma;
  const t = (texto: string) => traduzir(texto, idioma);
  const podeConectar = (user.is_platform_admin && !user.support) || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Instagram (Windsor.ai)")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("Seguidores, alcance e o conteúdo recente do perfil, agregados pelo Windsor.ai.")}
        </p>
      </header>

      {conectado ? (
        <WindsorInstagramClient idioma={idioma} />
      ) : (
        <div className="rounded-md border p-6 text-sm">
          <p className="font-medium">{t("Windsor.ai ainda não foi conectado.")}</p>
          <p className="mt-1 text-muted-foreground">
            {podeConectar
              ? t("Conecte a chave de API do Windsor.ai em Conexões para ver os dados aqui.")
              : t("Peça a quem administra a organização para conectar o Windsor.ai em Conexões.")}
          </p>
          {podeConectar && (
            <a
              className="mt-4 inline-block rounded-md border px-4 py-2 font-medium underline-offset-2 hover:bg-muted"
              href="/app/connections?aba=windsor"
            >
              {t("Conectar Windsor.ai")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
