// PeerSwap Supabase Client with Autonomous Standalone Fallback.
// Allows the app to work seamlessly both with a real Supabase project (*.supabase.co)
// and in standalone local mode if external Supabase credentials are not provided.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import { createMockSupabaseClient } from "./mock-client";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function isOfflineHost(url: string | undefined): boolean {
  if (!url || !url.trim()) return true;
  // If host is inactive template URL or placeholder, fallback to mock
  if (
    url.includes("lovable.cloud") ||
    url.includes("placeholder") ||
    url.includes("example.supabase.co")
  ) {
    return true;
  }
  return false;
}

export const DEFAULT_SUPABASE_URL = "https://sfymvxrcyamothgrkbtn.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_nBwy0FEsE0tK5dvXy4MBhQ_xIfOAJDN";

function createSupabaseClient() {
  const customUrl =
    typeof window !== "undefined" ? window.localStorage.getItem("CUSTOM_SUPABASE_URL") : null;
  const customKey =
    typeof window !== "undefined" ? window.localStorage.getItem("CUSTOM_SUPABASE_KEY") : null;

  const SUPABASE_URL =
    customUrl ||
    import.meta.env["VITE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_PUBLISHABLE_KEY =
    customKey ||
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    DEFAULT_SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || isOfflineHost(SUPABASE_URL)) {
    console.info("[PeerSwap] Running in autonomous local storage mode.");
    return createMockSupabaseClient() as unknown as ReturnType<typeof createClient<Database>>;
  }

  try {
    return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      },
      auth: {
        storage: brokeredPreviewStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn("[PeerSwap] Error initializing Supabase client, using autonomous fallback:", err);
    return createMockSupabaseClient() as unknown as ReturnType<typeof createClient<Database>>;
  }
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
