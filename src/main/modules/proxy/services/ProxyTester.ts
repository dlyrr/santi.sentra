import type { Proxy, ProxyTestResult } from "../types/ProxyTypes";

export class ProxyTester {
  async testProxy(proxy: Proxy): Promise<ProxyTestResult> {
    return {
      success: !!proxy?.host,
      error: proxy?.host ? undefined : "Missing proxy host",
    };
  }
}
