// Client storage adapter for Supabase authentication
export function brokeredPreviewStorage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
