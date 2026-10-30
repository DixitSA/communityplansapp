import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function emptyState() {
  return {
    version: 1,
    drafts: {},
    decisions: [],
    approvals: [],
    attempts: [],
    activity: [],
    accounts: [],
    discoveryCandidates: [],
    discoveryLeads: [],
    hashtagSearchAttempts: [],
    eventReviewDrafts: [],
    encryptedTokens: null,
    providerUsage: { period: '', spentUsd: 0 },
  };
}

export class JsonStore {
  #tail = Promise.resolve();

  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw error;
    }
  }

  async initialize() {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    await this.#serialize(async () => {
      try {
        const existing = JSON.parse(await readFile(this.filePath, 'utf8'));
        let changed = false;
        for (const key of ['discoveryCandidates', 'discoveryLeads', 'hashtagSearchAttempts', 'eventReviewDrafts']) {
          if (!Array.isArray(existing[key])) { existing[key] = []; changed = true; }
        }
        if (changed) {
          existing.updatedAt = new Date().toISOString();
          await this.#write(existing);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await this.#write(emptyState());
      }
    });
  }

  async transaction(mutator) {
    return this.#serialize(async () => {
      const state = await this.read();
      const result = await mutator(state);
      state.updatedAt = new Date().toISOString();
      await this.#write(state);
      return result;
    });
  }

  async #serialize(operation) {
    const next = this.#tail.then(operation, operation);
    this.#tail = next.catch(() => undefined);
    return next;
  }

  async #write(value) {
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    const handle = await open(tempPath, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }
}
