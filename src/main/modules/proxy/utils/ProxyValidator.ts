import type { Proxy } from '../types/ProxyTypes'

export class ProxyValidator {
  static validate(proxy: Proxy): boolean {
    if (!proxy || typeof proxy !== 'object') return false
    if (typeof proxy.host !== 'string' || proxy.host.length === 0) return false
    if (typeof proxy.port !== 'number' || Number.isNaN(proxy.port)) return false
    return proxy.port > 0 && proxy.port <= 65535
  }
}
