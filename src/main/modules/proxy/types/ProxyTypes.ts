export interface Proxy {
  id?: string
  host?: string
  port?: number
  protocol?: string
  username?: string
  password?: string
}

export interface ProxyTestResult {
  success: boolean
  error?: string
}

export interface ProxyPoolConfig {
  maxSize?: number
}

export interface ProxySession {
  id?: string
  proxy?: Proxy
}

export type RotationStrategy = 'round-robin' | 'random'

export interface ProxyPoolState {
  size: number
}
