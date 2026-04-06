import React from 'react';
import { useAppContext } from '../context/AppContext';
import { SkillNode } from '../types';
import { ChevronRight, ChevronDown, Folder, FileText, FileCode, FileImage, File, Monitor, Box, Briefcase, FolderOpen, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'computer':
      return <Monitor className="w-4 h-4" />;
    case 'software':
      return <Box className="w-4 h-4" />;
    case 'workdir':
      return <Briefcase className="w-4 h-4" />;
    case 'project':
      return <FolderOpen className="w-4 h-4" />;
    default:
      return <Folder className="w-4 h-4" />;
  }
};

const getLevelColor = (level: string) => {
  switch (level) {
    case 'computer':
      return 'text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/50';
    case 'software':
      return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50';
    case 'workdir':
      return 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50';
    case 'project':
      return 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/50';
    default:
      return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
  }
};

const getLevelLabel = (level: string, lang: string) => {
  const labels: Record<string, Record<string, string>> = {
    computer: { zh: '计算机级', en: 'Computer Level' },
    software: { zh: '软件级', en: 'Software Level' },
    workdir: { zh: '工作目录', en: 'Work Directory' },
    project: { zh: '项目级', en: 'Project Level' },
  };
  return labels[level]?.[lang] || level;
};

const getFileIcon = (node: SkillNode) => {
  if (node.type === 'directory') return <Folder className="w-4 h-4 text-blue-500" />;
  switch (node.fileType) {
    case 'markdown':
      return <FileText className="w-4 h-4 text-blue-400" />;
    case 'code':
      return <FileCode className="w-4 h-4 text-yellow-500" />;
    case 'image':
      return <FileImage className="w-4 h-4 text-green-500" />;
    default:
      return <File className="w-4 h-4 text-gray-400" />;
  }
};

const getProjectNameFromSkillPath = (absPath: string) => {
  const normalized = absPath.replace(/\\/g, '/');
  const match = normalized.match(/\/([^/]+)\/\.claude\/skills(?:\/|$)/);
  return match?.[1];
};

type ContextMenuState = {
  node: SkillNode;
  x: number;
  y: number;
};

const TreeNode: React.FC<{
  node: SkillNode;
  depth: number;
  onRequestContextMenu: (event: React.MouseEvent, node: SkillNode) => void;
  renderLabel: (text: string) => React.ReactNode;
}> = ({ node, depth, onRequestContextMenu, renderLabel }) => {
  const { selectedNodeId, setSelectedNodeId, expandedNodeIds, toggleNodeExpansion } = useAppContext();
  const isExpanded = expandedNodeIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (hasChildren) {
      toggleNodeExpansion(node.id);
    }
  };

  const handleSelect = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
  };

  const displayName = (() => {
    if (depth === 1 && node.type === 'directory' && node.level === 'software' && node.softwareName) {
      return node.softwareName;
    }
    if (depth === 1 && node.type === 'directory' && node.level === 'project') {
      return getProjectNameFromSkillPath(node.path) || node.name;
    }
    return node.name;
  })();

  return (
    <div>
      <div
        className={cn(
          'flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-sm select-none group',
          isSelected && 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 relative',
          node.isSymlink && !isSelected && 'text-red-500 dark:text-red-400',
        )}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        onClick={handleSelect}
        onContextMenu={(event) => onRequestContextMenu(event, node)}
      >
        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
        <div className="w-4 h-4 flex items-center justify-center mr-1.5" onClick={handleToggle}>
          {hasChildren ? isExpanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" /> : null}
        </div>
        <div className="mr-2">{getFileIcon(node)}</div>
        <span className="truncate flex-1">{renderLabel(displayName)}</span>
        {node.isSymlink && (
          <span className="ml-2 text-[0.5625rem] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 font-mono">link</span>
        )}
        {node.isSkillRoot && (
          <span className="ml-1.5 text-[0.5625rem] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">root</span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onRequestContextMenu={onRequestContextMenu} renderLabel={renderLabel} />
          ))}
        </div>
      )}
    </div>
  );
};

const LevelGroup: React.FC<{
  level: string;
  nodes: SkillNode[];
  onRequestContextMenu: (event: React.MouseEvent, node: SkillNode) => void;
  renderLabel: (text: string) => React.ReactNode;
}> = ({ level, nodes, onRequestContextMenu, renderLabel }) => {
  const { settings } = useAppContext();
  const [isExpanded, setIsExpanded] = React.useState(true);

  if (nodes.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center px-3 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500 mr-2" /> : <ChevronRight className="w-4 h-4 text-gray-500 mr-2" />}
        <div className={cn('flex items-center px-2 py-0.5 rounded-md text-xs font-medium mr-2', getLevelColor(level))}>
          <span className="mr-1.5">{getLevelIcon(level)}</span>
          {getLevelLabel(level, settings.language)}
        </div>
        <span className="text-xs text-gray-400 ml-auto">[{nodes.length}]</span>
      </div>
      {isExpanded && (
        <div className="mt-1">
          {nodes.map((node) => (
            <TreeNode key={node.id} node={node} depth={1} onRequestContextMenu={onRequestContextMenu} renderLabel={renderLabel} />
          ))}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ label: string; onClick: () => void; disabled?: boolean }> = ({ label, onClick, disabled }) => (
  <button
    className={cn(
      'w-full text-left px-3 py-1.5 text-sm rounded',
      disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
    )}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

export const Sidebar: React.FC = () => {
  const {
    skills,
    settings,
    setSettings,
    setSelectedNodeId,
    openInSystem,
    revealInFinder,
    setCopySource,
    setCutSource,
    pasteToDirectory,
    deletePathFromDisk,
    clipboard,
    refreshFromCache,
    startScan,
  } = useAppContext();
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState<'all' | 'computer' | 'software' | 'workdir' | 'project'>('all');
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  const t = (zh: string, en: string) => (settings.language === 'zh' ? zh : en);

  React.useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
    };
  }, []);

  React.useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const hit = isMac ? event.metaKey && event.key.toLowerCase() === 'f' : event.ctrlKey && event.key.toLowerCase() === 'f';
      if (!hit) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const filterNode = React.useCallback((node: SkillNode, normalizedQuery: string): SkillNode | null => {
    if (normalizedQuery.length === 0) return node;

    const selfMatched = node.name.toLowerCase().includes(normalizedQuery) || node.path.toLowerCase().includes(normalizedQuery);
    const filteredChildren = node.children
      ?.map((child) => filterNode(child, normalizedQuery))
      .filter((child): child is SkillNode => child != null);

    if (selfMatched || (filteredChildren != null && filteredChildren.length > 0)) {
      return {
        ...node,
        children: filteredChildren,
      };
    }
    return null;
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSkills = React.useMemo(() => {
    return skills
      .map((node) => filterNode(node, normalizedQuery))
      .filter((node): node is SkillNode => node != null);
  }, [skills, filterNode, normalizedQuery]);

  const groupedSkills = filteredSkills.reduce((acc, skill) => {
    if (levelFilter !== 'all' && skill.level !== levelFilter) {
      return acc;
    }
    if (!acc[skill.level]) acc[skill.level] = [];
    acc[skill.level].push(skill);
    return acc;
  }, {} as Record<string, SkillNode[]>);

  const highlight = React.useCallback(
    (text: string) => {
      if (normalizedQuery.length === 0) return text;
      const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'ig');
      const parts = text.split(regex);
      return parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery ? (
          <mark key={`${part}-${index}`} className="bg-yellow-200 dark:bg-yellow-700/70 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        ),
      );
    },
    [normalizedQuery],
  );

  const handleRequestContextMenu = (event: React.MouseEvent, node: SkillNode) => {
    event.preventDefault();
    setSelectedNodeId(node.id);
    setContextMenu({ node, x: event.clientX, y: event.clientY });
  };

  const handleAddManualPath = async () => {
    if (window.electronAPI == null) return;
    let selectedPath: string | null = null;
    try {
      selectedPath = await window.electronAPI.selectDirectory();
    } catch {
      window.alert(t('当前进程未加载目录选择器，请重启应用后重试。', 'Directory picker is unavailable in current process. Please restart the app and try again.'));
      return;
    }
    if (selectedPath == null) return;
    if (settings.authorizedPaths.includes(selectedPath)) return;
    await setSettings({
      ...settings,
      authorizedPaths: [...settings.authorizedPaths, selectedPath],
    });
  };

  const handlePaste = async () => {
    if (contextMenu == null) return;
    if (contextMenu.node.type !== 'directory') return;
    try {
      await pasteToDirectory(contextMenu.node.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('粘贴失败', 'Paste failed');
      window.alert(message);
    }
    setContextMenu(null);
  };

  const handleRefreshFromCache = async () => {
    try {
      const ok = await refreshFromCache();
      if (!ok) {
        window.alert(t('未找到可用扫描缓存，请先执行一次“再次扫描"。', 'No cached scan result found. Please run one full rescan first.'));
      }
    } catch {
      window.alert(t('刷新失败，请稍后重试。', 'Refresh failed. Please try again later.'));
    }
  };

  const canPaste = contextMenu?.node.type === 'directory' && clipboard != null;

  const handleDelete = async () => {
    if (contextMenu == null) return;
    const confirmed = window.confirm(
      t('确认删除该文件或目录吗？此操作不可恢复。', 'Delete this file or folder? This action cannot be undone.'),
    );
    if (!confirmed) return;

    try {
      await deletePathFromDisk(contextMenu.node.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('删除失败', 'Delete failed');
      window.alert(message);
    } finally {
      setContextMenu(null);
    }
  };

  const handlePromoteToComputer = async () => {
    if (contextMenu == null || contextMenu.node.type !== 'directory') return;
    if (window.electronAPI == null) {
      window.alert(t('此功能仅在桌面版中可用。', 'This feature is only available in the desktop app.'));
      setContextMenu(null);
      return;
    }

    const nodePath = contextMenu.node.path;
    setContextMenu(null);

    const confirmed = window.confirm(
      t(
        '这个动作会将当前目录文件移至用户目录下的 .allskills 目录下，并在现在的位置创建一个文件夹的软连接。\n\n确认执行吗？',
        'This will move the current directory to ~/.allskills and create a symlink at its original location.\n\nProceed?',
      ),
    );
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.promoteToComputer(nodePath);

      if (!result.success) {
        const openBing = window.confirm(
          t(
            '当前系统不支持软连接，无法完成操作。\n\n是否打开浏览器搜索如何开启软连接功能？',
            'Symlinks are not supported on this system. Unable to complete the operation.\n\nOpen browser to search for how to enable symlinks?',
          ),
        );
        if (openBing) {
          await window.electronAPI.openExternal('https://cn.bing.com/search?q=%E8%BD%AF%E8%BF%9E%E6%8E%A5%E5%AE%9A%E4%B9%89');
        }
        return;
      }

      window.alert(
        t(
          `提升成功！\n\n文件已移至: ${result.destPath}\n原位置已创建软连接。\n\n即将重新扫描以刷新技能列表。`,
          `Promotion succeeded!\n\nMoved to: ${result.destPath}\nA symlink was created at the original location.\n\nRescanning to refresh the skill list.`,
        ),
      );
      await startScan();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('操作失败，请重试。', 'Operation failed, please try again.');
      window.alert(t(`提升失败: ${message}`, `Failed: ${message}`));
    }
  };

  const visibleCount =
    (groupedSkills.computer?.length || 0) +
    (groupedSkills.software?.length || 0) +
    (groupedSkills.workdir?.length || 0) +
    (groupedSkills.project?.length || 0);

  const filterTabs: Array<{ key: 'all' | 'computer' | 'software' | 'workdir' | 'project'; labelZh: string; labelEn: string }> = [
    { key: 'all', labelZh: '全部', labelEn: 'All' },
    { key: 'computer', labelZh: '计算机', labelEn: 'Computer' },
    { key: 'software', labelZh: '软件', labelEn: 'Software' },
    { key: 'workdir', labelZh: '工作目录', labelEn: 'Workdir' },
    { key: 'project', labelZh: '项目', labelEn: 'Project' },
  ];

  return (
    <div className="relative w-70 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1e1e1e] overflow-y-auto flex flex-col h-full">
      <div className="p-4 sticky top-0 bg-gray-50/90 dark:bg-[#1e1e1e]/90 backdrop-blur z-10 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <input
            type="text"
            placeholder="Search skills... (⌘F)"
            value={searchQuery}
            ref={searchInputRef}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-white dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
          />
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="mt-3">
          <div className="flex items-stretch gap-2">
            <button
              onClick={() => void handleAddManualPath()}
              className="flex-1 inline-flex items-center justify-center px-2 py-2 text-xs rounded border border-indigo-600 bg-indigo-600 text-white"
            >
              <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
              {t('选择目录并添加路径', 'Choose Folder to Add')}
            </button>
            <button
              title={t('从已扫描结果刷新左侧列表', 'Refresh sidebar from cached scan result')}
              onClick={() => void handleRefreshFromCache()}
              className="inline-flex items-center justify-center w-9 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[0.6875rem] text-gray-500 dark:text-gray-400">
          {t('添加后请在设置里点击"再次扫描"更新左侧分类。', 'After adding, click “Rescan" in Settings to refresh categories.')}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              className={cn(
                'px-2.5 py-1 text-xs rounded border',
                levelFilter === tab.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700',
              )}
              onClick={() => setLevelFilter(tab.key)}
            >
              {t(tab.labelZh, tab.labelEn)}
            </button>
          ))}
        </div>
      </div>
      <div className="py-3">
        <LevelGroup level="computer" nodes={groupedSkills.computer || []} onRequestContextMenu={handleRequestContextMenu} renderLabel={highlight} />
        <LevelGroup level="software" nodes={groupedSkills.software || []} onRequestContextMenu={handleRequestContextMenu} renderLabel={highlight} />
        <LevelGroup level="workdir" nodes={groupedSkills.workdir || []} onRequestContextMenu={handleRequestContextMenu} renderLabel={highlight} />
        <LevelGroup level="project" nodes={groupedSkills.project || []} onRequestContextMenu={handleRequestContextMenu} renderLabel={highlight} />
        {visibleCount === 0 && (
          <div className="px-4 py-8 text-sm text-gray-500 text-center">{t('无匹配结果', 'No results')}</div>
        )}
      </div>

      {contextMenu != null && (
        <div
          className="fixed z-50 min-w-48 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-xl p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <MenuItem
            label={t('打开', 'Open')}
            onClick={() => {
              void openInSystem(contextMenu.node.path);
              setContextMenu(null);
            }}
          />
          <MenuItem
            label={t('在 Finder 中显示', 'Reveal in Finder')}
            onClick={() => {
              void revealInFinder(contextMenu.node.path);
              setContextMenu(null);
            }}
          />
          <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
          <MenuItem
            label={t('复制', 'Copy')}
            onClick={() => {
              setCopySource(contextMenu.node.path);
              setContextMenu(null);
            }}
          />
          <MenuItem
            label={t('剪切', 'Cut')}
            onClick={() => {
              setCutSource(contextMenu.node.path);
              setContextMenu(null);
            }}
          />
          <MenuItem
            label={t('粘贴', 'Paste')}
            disabled={!canPaste}
            onClick={() => {
              void handlePaste();
            }}
          />
          <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
          <MenuItem
            label={t('删除', 'Delete')}
            onClick={() => {
              void handleDelete();
            }}
          />
          {contextMenu.node.type === 'directory' && contextMenu.node.level !== 'computer' && (
            <>
              <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
              <MenuItem
                label={t('提升至计算机级别', 'Promote to Computer Level')}
                onClick={() => {
                  void handlePromoteToComputer();
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
