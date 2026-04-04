import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { X, Trash2, FolderOpen, Palette, Search, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SettingsModal: React.FC = () => {
  const { settings, setSettings, showSettings, setShowSettings, startScan, isScanning } = useAppContext();
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<'appearance' | 'scan' | 'about'>('appearance');

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, showSettings]);

  if (!showSettings) return null;

  const t = (zh: string, en: string) => localSettings.language === 'zh' ? zh : en;

  const handleSave = async () => {
    await setSettings(localSettings);
    setShowSettings(false);
  };

  const handleRescan = async () => {
    await startScan();
  };

  const addPath = (selectedPath: string) => {
    if (selectedPath && !localSettings.authorizedPaths.includes(selectedPath)) {
      setLocalSettings({
        ...localSettings,
        authorizedPaths: [...localSettings.authorizedPaths, selectedPath]
      });
    }
  };

  const pickPath = async () => {
    if (window.electronAPI == null) return;
    let selectedPath: string | null = null;
    try {
      selectedPath = await window.electronAPI.selectDirectory();
    } catch {
      window.alert(t('当前进程未加载目录选择器，请重启应用后重试。', 'Directory picker is unavailable in current process. Please restart the app and try again.'));
      return;
    }
    if (selectedPath == null) return;
    addPath(selectedPath);
  };

  const removePath = (pathToRemove: string) => {
    setLocalSettings({
      ...localSettings,
      authorizedPaths: localSettings.authorizedPaths.filter(p => p !== pathToRemove)
    });
  };

  const tabs: Array<{
    key: 'appearance' | 'scan' | 'about';
    labelZh: string;
    labelEn: string;
    icon: React.ReactNode;
  }> = [
    { key: 'appearance', labelZh: '外观', labelEn: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { key: 'scan', labelZh: '扫描', labelEn: 'Scan', icon: <Search className="w-4 h-4" /> },
    { key: 'about', labelZh: '关于', labelEn: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-[860px] max-w-[96vw] bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <span className="mr-2">⚙</span> {t('设置', 'Settings')}
            </h2>
            <button 
              onClick={() => setShowSettings(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex min-h-[520px] max-h-[70vh]">
            <aside className="w-56 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181818] p-3">
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.key
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {t(tab.labelZh, tab.labelEn)}
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'appearance' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{t('外观', 'Appearance')}</h3>
                  <div className="bg-gray-50 dark:bg-[#2d2d2d] rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('语言', 'Language')}</span>
                      <select 
                        value={localSettings.language}
                        onChange={(e) => setLocalSettings({...localSettings, language: e.target.value as 'zh'|'en'})}
                        className="bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-gray-600 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                      >
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('主题', 'Theme')}</span>
                      <div className="flex bg-gray-200 dark:bg-[#1e1e1e] rounded-lg p-1">
                        <button 
                          onClick={() => setLocalSettings({...localSettings, theme: 'light'})}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${localSettings.theme === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                          {t('浅色', 'Light')}
                        </button>
                        <button 
                          onClick={() => setLocalSettings({...localSettings, theme: 'dark'})}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${localSettings.theme === 'dark' ? 'bg-[#2d2d2d] text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                          {t('深色', 'Dark')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'scan' && (
                <div className="space-y-8">
                  <section>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{t('扫描范围', 'Scan Scope')}</h3>
                    <div className="bg-gray-50 dark:bg-[#2d2d2d] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {localSettings.authorizedPaths.map((path, idx) => (
                          <li key={idx} className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{path}</span>
                            <button 
                              onClick={() => removePath(path)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-gray-700 flex items-center justify-end">
                        <button
                          onClick={() => void pickPath()}
                          className="flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        >
                          <FolderOpen className="w-4 h-4 mr-1" />
                          {t('选择目录并添加', 'Choose Folder')}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('仅点击“再次扫描”才会触发扫描。', 'Only clicking "Rescan" will trigger scanning.')}
                      </p>
                      <button
                        onClick={() => void handleRescan()}
                        disabled={isScanning}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        {isScanning ? t('扫描中...', 'Scanning...') : t('再次扫描', 'Rescan')}
                      </button>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{t('扫描深度', 'Scan Depth')}</h3>
                    <div className="bg-gray-50 dark:bg-[#2d2d2d] rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center space-x-4">
                        <span className="text-xs text-gray-500">2</span>
                        <input 
                          type="range" 
                          min="2" 
                          max="15" 
                          value={localSettings.scanDepth}
                          onChange={(e) => setLocalSettings({...localSettings, scanDepth: parseInt(e.target.value)})}
                          className="flex-1 accent-indigo-600"
                        />
                        <span className="text-xs text-gray-500">15</span>
                      </div>
                      <div className="text-center mt-3 text-sm text-gray-600 dark:text-gray-400">
                        {t('当前值: ', 'Current: ')} <span className="font-semibold text-indigo-600 dark:text-indigo-400">{localSettings.scanDepth}</span>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'about' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{t('关于', 'About')}</h3>
                  <div className="bg-gray-50 dark:bg-[#2d2d2d] rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{t('作者', 'Author')}：</span>
                      <span className="ml-1 font-mono">hao.jin@live.cn</span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{t('项目地址', 'Project URL')}：</span>
                      <a
                        href="https://github.com/jhao/skill-management"
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-indigo-600 dark:text-indigo-400 underline break-all"
                      >
                        https://github.com/jhao/skill-management
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#2d2d2d] flex justify-end space-x-3">
            <button 
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('取消', 'Cancel')}
            </button>
            <button 
              onClick={() => void handleSave()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              {t('保存设置', 'Save Settings')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
