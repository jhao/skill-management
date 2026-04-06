export interface StartupLog {
  message: string;
  level: 'info' | 'warn' | 'error';
  elapsed: string;
}

export interface SkillNode {
  id: string;
  name: string;
  path: string;
  type: 'directory' | 'file';
  level: 'computer' | 'software' | 'workdir' | 'project';
  fileType?: 'markdown' | 'code' | 'image' | 'pdf' | 'video' | 'audio' | 'office' | 'text' | 'unknown';
  extension?: string;
  size: number;
  modifiedAt: string;
  children?: SkillNode[];
  skillName?: string;
  description?: string;
  softwareName?: string;
  isSkillRoot?: boolean;
  isSymlink?: boolean;
  parentId?: string;
  content?: string;
}

export interface Settings {
  authorizedPaths: string[];
  scanDepth: number;
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
  aiConfig?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

export interface AppConfig {
  settings: Settings;
  onboardingDone: boolean;
}

export interface ScanProgress {
  progress?: number;
  currentPath?: string;
  discoveredCount?: number;
}

export type PromoteResult =
  | { success: true; destPath: string }
  | { success: false; reason: 'symlink_unsupported'; error: string };

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  updateConfig: (configPatch: Partial<AppConfig>) => Promise<AppConfig>;
  scanSkills: (params: { authorizedPaths: string[]; scanDepth: number }) => Promise<SkillNode[]>;
  getCachedSkills: (params: { authorizedPaths: string[]; scanDepth: number }) => Promise<SkillNode[] | null>;
  onScanProgress: (listener: (progress: ScanProgress) => void) => () => void;
  onStartupLog: (listener: (log: StartupLog) => void) => () => void;
  readTextFile: (filePath: string) => Promise<string>;
  getFileUrl: (filePath: string) => Promise<string>;
  openPath: (targetPath: string) => Promise<string>;
  revealPath: (targetPath: string) => Promise<boolean>;
  selectDirectory: () => Promise<string | null>;
  transferPath: (payload: {
    sourcePath: string;
    targetDirectoryPath: string;
    mode: 'copy' | 'cut';
  }) => Promise<{ destinationPath: string }>;
  deletePath: (targetPath: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  promoteToComputer: (sourcePath: string) => Promise<PromoteResult>;
}

export type AppState = {
  settings: Settings;
  skills: SkillNode[];
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  isScanning: boolean;
  scanProgress: number;
  scanCurrentPath: string;
  showSettings: boolean;
  showOnboarding: boolean;
  showCreateSkill: boolean;
  appStatus: 'initializing' | 'ready' | 'error';
  initError: string | null;
  startupLogs: StartupLog[];
};
