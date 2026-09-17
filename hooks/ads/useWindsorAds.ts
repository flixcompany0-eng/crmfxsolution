"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

/**
 * Hooks do eixo Windsor.ai — irmãos de `useMetaAds.ts`, com uma diferença que
 * MUDA o tuning: aquelas rotas chamam a Meta na hora (por isso `retry: false`
 * e cota justa); estas leem o NOSSO banco, já sincronizado. Uma leitura falha
 * aqui é rede/banco nosso, não cota de terceiro — então o retry padrão do
 * react-query (3 tentativas) é aceitável, e `staleTime` pode ser mais curto.
 */

export interface ContaWindsorResumo {
  id: string;
  nome: string | null;
  external_account_id: string;
  moeda: string | null;
  is_default: boolean;
}

export function useWindsorAccounts(platform: "meta_ads" | "instagram", enabled: boolean) {
  return useQuery({
    queryKey: ["ads", "windsor", "accounts", platform],
    queryFn: async () =>
      apiClient.get<{ data: { contas: ContaWindsorResumo[] } }>(
        `/api/v1/ads/windsor/accounts?platform=${platform}`,
      ),
    enabled,
    staleTime: 60_000,
  });
}

export interface WindsorMetaResposta {
  conta: { id: string; nome: string | null; moeda: string; is_default: boolean };
  periodo: { from: string; to: string };
  totais: { impressions: number; clicks: number; spend_cents: number; results: number };
  serie_diaria: Array<{
    date: string;
    impressions: number;
    clicks: number;
    spend_cents: number;
    reach: number | null;
    results: number | null;
  }>;
  criativos: Array<{
    id: string;
    ad_name: string | null;
    image_url: string | null;
    video_thumbnail_url: string | null;
    message: string | null;
    totais: { impressions: number; clicks: number; spend_cents: number; results: number };
  }>;
  lido_em: string;
}

export function useWindsorMeta(contaId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: ["ads", "windsor", "meta", contaId, de, ate],
    queryFn: async () => {
      const qs = new URLSearchParams({ account_id: contaId as string, from: de, to: ate });
      return apiClient.get<{ data: WindsorMetaResposta }>(`/api/v1/ads/windsor/meta?${qs}`);
    },
    enabled: Boolean(contaId),
  });
}

export interface WindsorInstagramResposta {
  conta: { id: string; nome: string | null; is_default: boolean };
  periodo: { from: string; to: string };
  seguidores_atual: number | null;
  serie_diaria: Array<{
    date: string;
    followers_count: number | null;
    reach: number | null;
    impressions: number | null;
    profile_views: number | null;
  }>;
  midia: Array<{
    external_media_id: string;
    media_type: string | null;
    caption: string | null;
    permalink: string | null;
    thumbnail_url: string | null;
    like_count: number | null;
    comments_count: number | null;
    saved_count: number | null;
    shares_count: number | null;
    posted_at: string | null;
  }>;
  lido_em: string;
}

export function useWindsorInstagram(contaId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: ["ads", "windsor", "instagram", contaId, de, ate],
    queryFn: async () => {
      const qs = new URLSearchParams({ account_id: contaId as string, from: de, to: ate });
      return apiClient.get<{ data: WindsorInstagramResposta }>(`/api/v1/ads/windsor/instagram?${qs}`);
    },
    enabled: Boolean(contaId),
  });
}
