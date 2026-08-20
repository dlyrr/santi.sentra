export interface RestrictedIpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
  send(channel: string, ...args: any[]): void;

  on(channel: string, listener: (...args: any[]) => void): () => void;
  once(channel: string, listener: (...args: any[]) => void): void;
  removeListener(channel: string, listener: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}

export interface RestrictedElectronAPI {
  ipcRenderer: RestrictedIpcRenderer;
  process: {
    platform: NodeJS.Platform;
    versions: Record<string, string | undefined>;
  };
}
