import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings as SettingsIcon, Loader2, Moon, Sun, FilePlus } from 'lucide-react';

export const Topbar: React.FC = () => {
  const { settings, setSettings, isScanning, setShowSettings, setShowCreateSkill, selectedNodeId, getNodeById, skills } = useAppContext();

  const t = (zh: string, en: string) => settings.language === 'zh' ? zh : en;

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;

  const toggleTheme = () => {
    void setSettings({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' });
  };

  const toggleLanguage = () => {
    void setSettings({ ...settings, language: settings.language === 'zh' ? 'en' : 'zh' });
  };

  const skillCount = skills.length;

  return (
    <div className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e1e] flex items-center justify-between px-5 flex-shrink-0 select-none">
      {/* Left: Logo & Title */}
      <div className="flex items-center w-60 flex-shrink-0">
        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center mr-3">
          <span className="text-white font-bold text-xs">SM</span>
        </div>
        <span className="font-semibold text-gray-800 dark:text-gray-200">SKILL Management</span>
      </div>

      {/* Middle: Breadcrumb / Filename */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4">
        {selectedNode ? (
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {selectedNode.name}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {t('统一管理你的 Claude Code 技能', 'Manage your Claude Code skills')}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-4 flex-shrink-0">
        {!isScanning && skills.length > 0 && (
          <span className="text-xs text-gray-500 mr-2">
            {skillCount} {t('个技能', 'skills')}
          </span>
        )}
        {isScanning && (
          <span className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md">
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            {t('扫描中...', 'Scanning...')}
          </span>
        )}

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />

        <button
          onClick={() => setShowCreateSkill(true)}
          className="flex items-center px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
          title={t('新建SKILL', 'Create New SKILL')}
        >
          <FilePlus className="w-4 h-4 mr-1" />
          {t('新建', 'New')}
        </button>

        <button
          onClick={toggleLanguage}
          className="px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          {settings.language === 'zh' ? '中' : 'EN'}
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          {settings.theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
