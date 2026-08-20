import type {
  Proxy,
  ProxyPoolConfig,
  ProxyPoolState,
} from "../types/ProxyTypes";

export class ProxyPool {
  constructor(_config: ProxyPoolConfig = {}) {
    void _config;
  }

  addProxy(proxy: Proxy): void {
    void proxy;
  }

  removeProxy(_id: string): void {}

  getState(): ProxyPoolState {
    return { size: 0 };
  }
}
