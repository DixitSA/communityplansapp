import Storage from 'expo-sqlite/kv-store';

/** A tiny key-value store on the device (SQLite on iOS). See kv.web.ts for the web build. */
export const kv = {
  getItem: (key: string): Promise<string | null> => Storage.getItem(key),
  setItem: (key: string, value: string): Promise<void> => Storage.setItem(key, value),
};
