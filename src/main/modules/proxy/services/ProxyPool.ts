import type { Proxy, ProxyPoolConfig, ProxyPoolState } from '../types/ProxyTypes'

export class ProxyPool {
  constructor(_config: ProxyPoolConfig = {}) {}

  addProxy(proxy: Proxy): void {
    void proxy
  }

  removeProxy(_id: string): void {
    // no-op stub
  }

  getState(): ProxyPoolState {
    return { size: 0 }
  }
}
