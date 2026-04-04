import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Eye, Copy, ArrowRight, ArrowLeft, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Onboarding: React.FC = () => {
  const { showOnboarding, setShowOnboarding, startScan, settings, setSettings } = useAppContext();
  const [step, setStep] = useState(1);
  
  const [paths, setPaths] = useState([
    { path: '~/', label: '主目录', labelEn: 'Home', checked: true },
    { path: '/Applications', label: '应用程序', labelEn: 'Applications', checked: true },
    { path: '~/Documents', label: '文稿', labelEn: 'Documents', checked: true },
  ]);

  if (!showOnboarding) return null;

  const t = (zh: string, en: string) => settings.language === 'zh' ? zh : en;

  const handleComplete = async () => {
    const selectedPaths = paths.filter(p => p.checked).map(p => p.path);
    await setSettings({ ...settings, authorizedPaths: selectedPaths });
    await setShowOnboarding(false);
    await startScan();
  };

  const togglePath = (index: number) => {
    const newPaths = [...paths];
    newPaths[index].checked = !newPaths[index].checked;
    setPaths(newPaths);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 dark:bg-[#1e1e1e]">
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-2xl w-full p-8 flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/30">
              <span className="text-white font-bold text-3xl">SM</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Skills Manager</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-12">
              {t('统一管理你的 Claude Code 技能', 'Unify and manage your Claude Code skills')}
            </p>

            <div className="grid grid-cols-3 gap-6 w-full mb-12">
              <div className="bg-white dark:bg-[#2d2d2d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <Search className="w-8 h-8 text-indigo-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('发现技能', 'Discover')}</h3>
              </div>
              <div className="bg-white dark:bg-[#2d2d2d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <Eye className="w-8 h-8 text-indigo-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('预览内容', 'Preview')}</h3>
              </div>
              <div className="bg-white dark:bg-[#2d2d2d] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <Copy className="w-8 h-8 text-indigo-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('组织搬移', 'Organize')}</h3>
              </div>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="flex items-center px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-lg shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
            >
              {t('开始使用', 'Get Started')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-xl w-full bg-white dark:bg-[#2d2d2d] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('选择扫描范围', 'Select Scan Scope')}</h2>
              <button 
                onClick={() => setStep(1)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('返回', 'Back')}
              </button>
            </div>

            <div className="p-8">
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('选择你希望扫描的目录（可多选）：', 'Select directories you want to scan (multiple allowed):')}
              </p>

              <div className="space-y-3 mb-8">
                {paths.map((p, idx) => (
                  <label key={idx} className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors">
                    <input 
                      type="checkbox" 
                      checked={p.checked}
                      onChange={() => togglePath(idx)}
                      className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="ml-4 flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{t(p.label, p.labelEn)}</div>
                      <div className="text-sm text-gray-500 font-mono mt-0.5">{p.path}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-600 dark:text-gray-400">
                  {t(`已选择 ${paths.filter(p=>p.checked).length} 个目录`, `Selected ${paths.filter(p=>p.checked).length} directories`)}
                </span>
                <button 
                  onClick={() => void handleComplete()}
                  disabled={paths.filter(p=>p.checked).length === 0}
                  className="flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-colors"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {t('开始扫描', 'Start Scan')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
