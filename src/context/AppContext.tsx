import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Settings, SkillNode } from '../types';

interface AppContextType extends AppState {
  setSettings: (settings: Settings) => Promise<void>;
  setSelectedNodeId: (id: string | null) => void;
  toggleNodeExpansion: (id: string) => void;
  startScan: () => Promise<void>;
  setShowSettings: (show: boolean) => void;
  setShowOnboarding: (show: boolean) => Promise<void>;
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
    let mounted = true;

    const initialize = async () => {
      if (window.electronAPI == null) {
        const savedSettings = localStorage.getItem('skills-settings');
        const hasOnboarded = localStorage.getItem('skills-onboarded');
        if (mounted === false) return;
        if (savedSettings != null) {
          setState((s) => ({ ...s, settings: JSON.parse(savedSettings) }));
        }
        if (hasOnboarded != null) {
          setState((s) => ({ ...s, showOnboarding: false }));
        }
        return;
      }

      const config = await window.electronAPI.getConfig();
      if (mounted === false) return;

      setState((s) => ({
        ...s,
        settings: config.settings,
        showOnboarding: config.onboardingDone === false,
      }));

      if (config.onboardingDone) {
        const cachedSkills = await window.electronAPI.getCachedSkills({
          authorizedPaths: config.settings.authorizedPaths,
          scanDepth: config.settings.scanDepth,
        });
        if (Array.isArray(cachedSkills)) {
          applySkillsToState(cachedSkills);
          return;
        }
        await startScanWith(config.settings);
      }
    };

    initialize().catch(() => {
      // keep defaults when initialization fails
    });

    return () => {
      mounted = false;
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
