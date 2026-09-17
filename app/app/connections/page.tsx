import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ConexoesShell } from "@/components/connections/ConexoesShell";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { existeConexaoWindsor } from "@/lib/windsor/credenciais";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }
  const idioma = user.idioma;

  const key = process.env.WAHA_API_KEY;
  const wahaConfigured = Boolean(
    process.env.WAHA_API_BASE_URL && key && key !== "dev_plaintext_change_me",
  );

  // Admin client: windsor_connections/windsor_ad_accounts têm RLS ligada sem
  // policies (0233) — mesma postura de ad_insights_connections. A chave em si
  // não é lida aqui, só a existência da conexão e a lista de contas (sem
  // segredo nenhum nessas colunas).
  const admin = createAdminClient();
  const windsorConectado = await existeConexaoWindsor(admin, activeOrg.orgId);
  const { data: windsorContasData } = windsorConectado
    ? await admin
        .from("windsor_ad_accounts")
        .select("id, platform, external_account_id, nome, is_default")
        .eq("organization_id", activeOrg.orgId)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Conexões", idioma)}</h1>
        <p className="text-sm text-muted-foreground">
          {traduzir(
            "Por onde seu negócio fala com o cliente. Conecte números por QR ou o número oficial da Meta, e acompanhe a saúde de cada um.",
            idioma,
          )}
        </p>
      </header>
      <ConexoesShell
        wahaConfigured={wahaConfigured}
        windsorConectado={windsorConectado}
        windsorContas={windsorContasData ?? []}
      />
    </div>
  );
}
