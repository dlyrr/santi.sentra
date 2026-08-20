import { HBAClient } from "roblox-bat";
import { webcrypto } from "node:crypto";

const MAX_HBA_CLIENTS = 50;

class HBAManager {
  private clients: Map<string, HBAClient> = new Map();

  async getClient(cookie: string): Promise<HBAClient> {
    if (this.clients.has(cookie)) {
      const existing = this.clients.get(cookie)!;
      this.clients.delete(cookie);
      this.clients.set(cookie, existing);
      return existing;
    }

    if (this.clients.size >= MAX_HBA_CLIENTS) {
      const oldestKey = this.clients.keys().next().value;
      if (oldestKey !== undefined) {
        this.clients.delete(oldestKey);
      }
    }

    const keys = await webcrypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign"],
    );

    const client = new HBAClient({
      keys: keys as any,
      cookie: `.ROBLOSECURITY=${cookie}`,
    });

    this.clients.set(cookie, client);
    return client;
  }

  async getHeaders(
    cookie: string,
    url: string,
    method: string,
  ): Promise<Record<string, string>> {
    const client = await this.getClient(cookie);
    const headers = await client.generateBaseHeaders(url, method, true);
    return headers as Record<string, string>;
  }
}

export const hbaManager = new HBAManager();
