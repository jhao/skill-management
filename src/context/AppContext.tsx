import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Settings, SkillNode, StartupLog } from '../types';

interface AppContextType extends AppState {
  setSettings: (settings: Settings) => Promise<void>;
  setSelectedNodeId: (id: string | null) => void;
  toggleNodeExpansion: (id: string) => void;
  startScan: () => Promise<void>;
  setShowSettings: (show: boolean) => void;
  setShowOnboarding: (show: boolean) => Promise<void>;
  setShowCreateSkill: (show: boolean) => void;
  getNodeById: (id: string) => SkillNode | null;
  openInSystem: (targetPath: string) => Promise<void>;
  revealInFinder: (targetPath: string) => Promise<void>;
  getBinaryUrl: (targetPath: string) => Promise<string | null>;
  readTextContent: (targetPath: string) => Promise<string>;
  clipboard: { sourcePath: string; mode: 'copy' | 'cut' } | null;
  setCopySource: (sourcePath: string) => void;
  setCutSource: (sourcePath: string) => void;
  clearClipboard: () => void;
  pasteToDirectory: (targetDirectoryPath: string) => Promise<boolean>;
  deletePathFromDisk: (targetPath: string) => Promise<boolean>;
  refreshFromCache: () => Promise<boolean>;
}

const defaultSettings: Settings = {
  authorizedPaths: ['~/'],
  scanDepth: 8,
  theme: 'light',
  language: 'zh',
  aiConfig: {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4'
  }
};

const initialState: AppState = {
  settings: defaultSettings,
  skills: [],
  selectedNodeId: null,
  expandedNodeIds: new Set(),
  isScanning: false,
  scanProgress: 0,
  scanCurrentPath: '',
  showSettings: false,
  showOnboarding: true,
  showCreateSkill: false,
  appStatus: 'initializing',
  initError: null,
  startupLogs: [],
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const flattenNodes = (nodes: SkillNode[]): SkillNode[] => {
  const result: SkillNode[] = [];
  const visit = (node: SkillNode) => {
    result.push(node);
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [nodeMap, setNodeMap] = useState<Map<string, SkillNode>>(new Map());
  const [clipboard, setClipboard] = useState<{ sourcePath: string; mode: 'copy' | 'cut' } | null>(null);
  const startTimeRef = useRef(Date.now());

  const addLog = useCallback((message: string, level: StartupLog['level'] = 'info') => {
    const ms = Date.now() - startTimeRef.current;
    const elapsed = `+${(ms / 1000).toFixed(2)}s`;
    setState((s) => ({
      ...s,
      startupLogs: [...s.startupLogs, { message, level, elapsed }],
    }));
  }, []);

  const applySkillsToState = (skills: SkillNode[]) => {
    setState((s) => ({
      ...s,
      skills,
      isScanning: false,
      scanProgress: 100,
      scanCurrentPath: '',
    }));
  };

  const startScanWith = async (settingsForScan: Settings) => {
    if (window.electronAPI != null) {
      const skills = await window.electronAPI.scanSkills({
        authorizedPaths: settingsForScan.authorizedPaths,
        scanDepth: settingsForScan.scanDepth,
      });

      applySkillsToState(skills);
      return;
    }

    setState((s) => ({ ...s, isScanning: false, scanProgress: 100, scanCurrentPath: '' }));
  };

  const refreshFromCache = async (): Promise<boolean> => {
    if (window.electronAPI == null) return false;
    const cachedSkills = await window.electronAPI.getCachedSkills({
      authorizedPaths: state.settings.authorizedPaths,
      scanDepth: state.settings.scanDepth,
    });
    if (!Array.isArray(cachedSkills)) return false;
    applySkillsToState(cachedSkills);
    return true;
  };

  useEffect(() => {
    // 用于清理时取消错误回调，不影响 initialize() 本身的执行
    let cancelled = false;

    // 安全兜底：15 秒内未完成则显示超时错误
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      const msg = '初始化超时（15秒），IPC 通信可能异常，请重启应用';
      addLog(msg, 'error');
      setState((s) => ({ ...s, appStatus: 'error', initError: msg }));
    }, 15000);

    const initialize = async () => {
      addLog('初始化开始');

      if (window.electronAPI == null) {
        addLog('运行于浏览器模式，跳过 Electron 初始化');
        const savedSettings = localStorage.getItem('skills-settings');
        const hasOnboarded = localStorage.getItem('skills-onboarded');
        if (savedSettings != null) {
          setState((s) => ({ ...s, settings: JSON.parse(savedSettings) }));
          addLog('已从本地存储读取设置');
        }
        if (hasOnboarded != null) {
          setState((s) => ({ ...s, showOnboarding: false }));
        }
        clearTimeout(safetyTimer);
        setState((s) => ({ ...s, appStatus: 'ready' }));
        addLog('初始化完成');
        return;
      }

      addLog('正在读取应用配置...');
      // 注意：不使用 mounted/cancelled 提前退出 initialize()。
      // React StrictMode 会运行两次 effect，第一次的 cleanup 会设 cancelled=true，
      // 但我们让两次 initialize() 都完整运行（setState 是幂等的），避免第二次
      // 因第一次被取消而造成 appStatus 永远停在 'initializing'。
      const config = await window.electronAPI.getConfig();
      addLog('配置读取成功');

      clearTimeout(safetyTimer);
      setState((s) => ({
        ...s,
        settings: config.settings,
        showOnboarding: config.onboardingDone === false,
        appStatus: 'ready',
      }));
      addLog(`引导完成状态: ${config.onboardingDone ? '是' : '否'}`);

      if (config.onboardingDone) {
        addLog('正在检查本地技能缓存...');
        const cachedSkills = await window.electronAPI.getCachedSkills({
          authorizedPaths: config.settings.authorizedPaths,
          scanDepth: config.settings.scanDepth,
        });

        if (Array.isArray(cachedSkills)) {
          addLog(`发现缓存，共 ${cachedSkills.length} 个技能节点，正在加载...`);
          applySkillsToState(cachedSkills);
          addLog('缓存加载完成');
          return;
        }

        addLog('未找到缓存，准备扫描文件系统...', 'warn');
        addLog(`扫描路径: ${config.settings.authorizedPaths.join(', ')}`);
        addLog(`扫描深度: ${config.settings.scanDepth}`);
        setState((s) => ({
          ...s,
          isScanning: true,
          scanProgress: 0,
          scanCurrentPath: config.settings.authorizedPaths[0] || '',
        }));
        await startScanWith(config.settings);
        addLog('文件系统扫描完成');
      }
    };

    initialize().catch((error) => {
      clearTimeout(safetyTimer);
      if (cancelled) return;
      const message = error instanceof Error ? error.message : '启动初始化失败，请重启应用。';
      addLog(`初始化失败: ${message}`, 'error');
      setState((s) => ({ ...s, appStatus: 'error', initError: message }));
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI == null) {
      return undefined;
    }

    const unsubscribe = window.electronAPI.onScanProgress((progress) => {
      setState((s) => ({
        ...s,
        scanProgress: progress.progress ?? s.scanProgress,
        scanCurrentPath: progress.currentPath ?? s.scanCurrentPath,
      }));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (window.electronAPI == null || typeof window.electronAPI.onStartupLog !== 'function') {
      return undefined;
    }
    return window.electronAPI.onStartupLog((log) => {
      setState((s) => ({ ...s, startupLogs: [...s.startupLogs, log] }));
    });
  }, []);

  useEffect(() => {
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.theme]);

  useEffect(() => {
    const nextMap = new Map<string, SkillNode>();
    for (const node of flattenNodes(state.skills)) {
      nextMap.set(node.id, node);
    }
    setNodeMap(nextMap);
  }, [state.skills]);

  const setSettings = async (settings: Settings) => {
    setState((s) => ({ ...s, settings }));

    if (window.electronAPI != null) {
      await window.electronAPI.updateConfig({ settings });
      return;
    }

    localStorage.setItem('skills-settings', JSON.stringify(settings));
  };

  const setSelectedNodeId = (id: string | null) => {
    setState((s) => ({ ...s, selectedNodeId: id }));
  };

  const toggleNodeExpansion = (id: string) => {
    setState((s) => {
      const newExpanded = new Set(s.expandedNodeIds);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { ...s, expandedNodeIds: newExpanded };
    });
  };

  const startScan = async () => {
    if (state.isScanning) return;

    setState((s) => ({
      ...s,
      isScanning: true,
      scanProgress: 0,
      scanCurrentPath: s.settings.authorizedPaths[0] || '',
    }));

    try {
      await startScanWith(state.settings);
    } catch {
      setState((s) => ({
        ...s,
        isScanning: false,
        scanCurrentPath: '',
      }));
    }
  };

  const setShowSettings = (show: boolean) => {
    setState((s) => ({ ...s, showSettings: show }));
  };

  const setShowCreateSkill = (show: boolean) => {
    setState((s) => ({ ...s, showCreateSkill: show }));
  };

  const setShowOnboarding = async (show: boolean) => {
    setState((s) => ({ ...s, showOnboarding: show }));

    if (window.electronAPI != null) {
      await window.electronAPI.updateConfig({ onboardingDone: show === false });
      return;
    }

    if (show === false) {
      localStorage.setItem('skills-onboarded', 'true');
    }
  };

  const getNodeById = (id: string): SkillNode | null => nodeMap.get(id) || null;

  const openInSystem = async (targetPath: string) => {
    if (window.electronAPI == null) return;
    await window.electronAPI.openPath(targetPath);
  };

  const revealInFinder = async (targetPath: string) => {
    if (window.electronAPI == null) return;
    await window.electronAPI.revealPath(targetPath);
  };

  const getBinaryUrl = async (targetPath: string) => {
    if (window.electronAPI == null) return null;
    try {
      return await window.electronAPI.getFileUrl(targetPath);
    } catch {
      return null;
    }
  };

  const readTextContent = async (targetPath: string) => {
    if (window.electronAPI != null) {
      return window.electronAPI.readTextFile(targetPath);
    }
    return '';
  };

  const setCopySource = (sourcePath: string) => {
    setClipboard({ sourcePath, mode: 'copy' });
  };

  const setCutSource = (sourcePath: string) => {
    setClipboard({ sourcePath, mode: 'cut' });
  };

  const clearClipboard = () => {
    setClipboard(null);
  };

  const pasteToDirectory = async (targetDirectoryPath: string): Promise<boolean> => {
    if (clipboard == null || window.electronAPI == null) return false;
    await window.electronAPI.transferPath({
      sourcePath: clipboard.sourcePath,
      targetDirectoryPath,
      mode: clipboard.mode,
    });
    if (clipboard.mode === 'cut') {
      setClipboard(null);
    }
    return true;
  };

  const deletePathFromDisk = async (targetPath: string): Promise<boolean> => {
    if (window.electronAPI == null) return false;
    await window.electronAPI.deletePath(targetPath);

    if (clipboard != null) {
      const deleted = targetPath;
      const source = clipboard.sourcePath;
      if (source === deleted || source.startsWith(`${deleted}/`)) {
        setClipboard(null);
      }
    }

    setState((s) => ({
      ...s,
      selectedNodeId: s.selectedNodeId === targetPath ? null : s.selectedNodeId,
    }));
    return true;
  };

  const contextValue = useMemo(
    () => ({
      ...state,
      setSettings,
      setSelectedNodeId,
      toggleNodeExpansion,
      startScan,
      setShowSettings,
      setShowCreateSkill,
      setShowOnboarding,
      getNodeById,
      openInSystem,
      revealInFinder,
      getBinaryUrl,
      readTextContent,
      clipboard,
      setCopySource,
      setCutSource,
      clearClipboard,
      pasteToDirectory,
      deletePathFromDisk,
      refreshFromCache,
    }),
    [state, clipboard],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
