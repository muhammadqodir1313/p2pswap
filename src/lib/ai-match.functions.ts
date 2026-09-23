import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { Output, streamText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const RecommendInput = z.object({
  need: z.string().min(3).max(600),
  quality: z.enum(["fast", "balanced", "deep"]).default("balanced"),
});

export type RecommendQuality = "fast" | "balanced" | "deep";

const EFFORT: Record<RecommendQuality, "low" | "medium" | "high"> = {
  fast: "low",
  balanced: "medium",
  deep: "high",
};

const RecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      reason: z.string(),
    }),
  ),
  note: z.string(),
});

export type PartnerRecommendation = {
  id: string;
  score: number;
  reason: string;
};

export type RecommendPartnersResult = {
  recommendations: PartnerRecommendation[];
  note: string;
};

type Candidate = {
  id: string;
  name: string;
  bio: string;
  teach: string[];
  learn: string[];
};

export const recommendPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data, context }): Promise<RecommendPartnersResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("peer_directory")
      .select("id, first_name, last_name, bio, is_active, teach, learn");
    if (error) throw new Error(error.message);

    const all = (rows ?? []) as Array<{
      id: string | null;
      first_name: string | null;
      last_name: string | null;
      bio: string | null;
      is_active: boolean | null;
      teach: string[] | null;
      learn: string[] | null;
    }>;

    const me = all.find((p) => p.id === userId);
    const candidates: Candidate[] = all
      .filter((p) => p.id && p.id !== userId && p.is_active !== false)
      .map((p) => ({
        id: p.id as string,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "PeerSwap a’zosi",
        bio: p.bio ?? "",
        teach: p.teach ?? [],
        learn: p.learn ?? [],
      }));

    if (candidates.length === 0) {
      return { recommendations: [], note: "Hozircha tavsiya qilish uchun faol hamkor yo‘q." };
    }

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({ schema: RecommendationSchema }),
      system: [
        "Siz PeerSwap platformasining mos hamkor tanlovchisisiz.",
        "Faqat berilgan nomzodlar ro‘yxatidan tanlang va faqat ularning `id` qiymatlarini qaytaring.",
        "Eng ko‘pi bilan 5 ta nomzod tavsiya qiling, mos kelmasa bo‘sh ro‘yxat qaytaring.",
        "`score` 0 dan 100 gacha butun son. `reason` va `note` faqat o‘zbek tilida, qisqa (1-2 jumla).",
        "Nomzodning o‘rgata oladigan ko‘nikmasi foydalanuvchi ehtiyojiga mos kelishi asosiy mezon;",
        "ikki tomonlama almashinuv imkoniyati (foydalanuvchi o‘rgata oladigan narsa nomzodga kerak bo‘lishi) qo‘shimcha ustunlik beradi.",
      ].join(" "),
      prompt: JSON.stringify({
        user: {
          teach: me?.teach ?? [],
          learn: me?.learn ?? [],
          bio: me?.bio ?? "",
          need: data.need,
        },
        candidates,
      }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: EFFORT[data.quality],
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const output = await result.output;
    const valid = new Set(candidates.map((c) => c.id));

    return {
      recommendations: output.recommendations
        .filter((r) => valid.has(r.id))
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          score: Math.max(0, Math.min(100, Math.round(r.score))),
          reason: r.reason,
        })),
      note: output.note,
    };
  });
