import React from 'react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { cn } from '../lib/utils';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const Details: React.FC = () => {
  const { selectedNodeId, getNodeById, settings, openInSystem, revealInFinder } = useAppContext();

  if (!selectedNodeId) {
    return (
      <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1e1e1e] flex-shrink-0" />
    );
  }

  const node = getNodeById(selectedNodeId);
  if (!node) return null;

  const t = (zh: string, en: string) => settings.language === 'zh' ? zh : en;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'computer': return 'text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/50';
      case 'software': return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50';
      case 'workdir': return 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50';
      case 'project': return 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/50';
      default: return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    }
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, Record<string, string>> = {
      computer: { zh: '计算机级', en: 'Computer Level' },
      software: { zh: '软件级', en: 'Software Level' },
      workdir: { zh: '工作目录', en: 'Work Directory' },
      project: { zh: '项目级', en: 'Project Level' },
    };
    return labels[level]?.[settings.language] || level;
  };

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#2d2d2d] flex-shrink-0 overflow-y-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-center w-16 h-16 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-xl mb-4 shadow-sm mx-auto">
          <span className="text-3xl">
            {node.type === 'directory' ? '📁' : node.fileType === 'markdown' ? '📄' : node.fileType === 'code' ? '📝' : '📄'}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-center text-gray-900 dark:text-gray-100 break-all mb-2">
          {node.name}
        </h2>
        <div className="flex justify-center">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium flex items-center", getLevelColor(node.level))}>
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
            {getLevelLabel(node.level)}
          </span>
        </div>
      </div>

      {(node.skillName || node.description) && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('描述', 'Description')}</h3>
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
            {node.skillName && <div className="font-medium mb-1">{node.skillName}</div>}
            {node.description && <div className="text-gray-500 dark:text-gray-400">{node.description}</div>}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('信息', 'Information')}</h3>
        <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
          <div className="flex border-b border-gray-100 dark:border-gray-800 p-3">
            <span className="w-20 text-gray-500">{t('类型', 'Type')}</span>
            <span className="flex-1 text-gray-900 dark:text-gray-100 font-medium">{node.type === 'directory' ? 'Folder' : node.fileType || 'File'}</span>
          </div>
          {node.extension && (
            <div className="flex border-b border-gray-100 dark:border-gray-800 p-3">
              <span className="w-20 text-gray-500">{t('扩展名', 'Extension')}</span>
              <span className="flex-1 text-gray-900 dark:text-gray-100 font-medium">{node.extension}</span>
            </div>
          )}
          <div className="flex border-b border-gray-100 dark:border-gray-800 p-3">
            <span className="w-20 text-gray-500">{t('大小', 'Size')}</span>
            <span className="flex-1 text-gray-900 dark:text-gray-100 font-medium">{formatBytes(node.size)}</span>
          </div>
          <div className="flex p-3">
            <span className="w-20 text-gray-500">{t('修改时间', 'Modified')}</span>
            <span className="flex-1 text-gray-900 dark:text-gray-100 font-medium">{format(new Date(node.modifiedAt), 'yyyy-MM-dd HH:mm')}</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('路径', 'Path')}</h3>
        <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 break-all font-mono">
          {node.path}
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => void openInSystem(node.path)}
          className="w-full flex items-center justify-center px-4 py-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {t('在应用中打开', 'Open in App')}
        </button>
        <button
          onClick={() => void revealInFinder(node.path)}
          className="w-full flex items-center justify-center px-4 py-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          {t('在 Finder 中显示', 'Reveal in Finder')}
        </button>
      </div>
    </div>
  );
};
