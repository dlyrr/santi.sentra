import type {
  Proxy,
  ProxyPoolConfig,
  ProxySession,
  ProxyPoolState,
  ProxyTestResult,
} from "../types/ProxyTypes";

export interface IProxyTester {
  testProxy(proxy: Proxy): Promise<ProxyTestResult>;
}

export interface IProxyPool {
  addProxy(proxy: Proxy): void;
  removeProxy(id: string): void;
  getState(): ProxyPoolState;
}

export interface IProxyManager {
  getPool(): IProxyPool;
  createSession(): ProxySession;
}
