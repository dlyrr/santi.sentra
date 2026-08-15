import type { ProxySession, ProxyPoolConfig } from "../types/ProxyTypes";
import { ProxyPool } from "./ProxyPool";

export class ProxyManager {
  private pool: ProxyPool;

  constructor(_config: ProxyPoolConfig = {}) {
    this.pool = new ProxyPool(_config);
  }

  getPool(): ProxyPool {
    return this.pool;
  }

  createSession(): ProxySession {
    return { id: "default" };
  }
}

export class ProxyManagerFactory {
  static create(_config: ProxyPoolConfig = {}): ProxyManager {
    return new ProxyManager(_config);
  }
}
