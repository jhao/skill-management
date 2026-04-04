import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ScanOverlay: React.FC = () => {
  const { isScanning, scanProgress, scanCurrentPath, settings } = useAppContext();

  const t = (zh: string, en: string) => settings.language === 'zh' ? zh : en;

  return (
    <AnimatePresence>
      {isScanning && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-[480px] bg-white dark:bg-[#2d2d2d] rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex flex-col items-center text-center">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('正在扫描技能...', 'Scanning for skills...')}
              </h2>
              
              <div className="w-full mt-6 mb-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500 dark:text-gray-400 font-mono truncate max-w-[80%] text-left">
                    {scanCurrentPath}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {Math.round(scanProgress)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-200 ease-out"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                {t('请稍候，这可能需要几秒钟时间。', 'Please wait, this might take a few seconds.')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
