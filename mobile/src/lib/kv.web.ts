// Web build (screenshots, previews): the browser's localStorage. expo-sqlite's web worker needs a
// wasm file Metro can't bundle here (same reason as supabase.web.ts). Missing during static render.
const store = typeof localStorage === 'undefined' ? undefined : localStorage;

export const kv = {
  getItem: async (key: string): Promise<string | null> => store?.getItem(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store?.setItem(key, value);
  },
};
