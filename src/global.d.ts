import type { ElectronAPI } from './types';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
  const __APP_VERSION__: string;
}

export {};
