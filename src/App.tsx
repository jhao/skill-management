import React from 'react';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './context/AppContext';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { Preview } from './components/Preview';
import { Details } from './components/Details';
import { SettingsModal } from './components/SettingsModal';
import { Onboarding } from './components/Onboarding';
import { ScanOverlay } from './components/ScanOverlay';

function AppContent() {
  const { selectedNodeId, getNodeById, deletePathFromDisk, settings } = useAppContext();

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      if (selectedNodeId == null) return;
      const node = getNodeById(selectedNodeId);
      if (node == null) return;

      event.preventDefault();
      const confirmed = window.confirm(
        settings.language === 'zh'
          ? '确认删除该文件或目录吗？此操作不可恢复。'
          : 'Delete this file or folder? This action cannot be undone.',
      );
      if (!confirmed) return;

      void deletePathFromDisk(node.path).catch((error) => {
        const message = error instanceof Error ? error.message : settings.language === 'zh' ? '删除失败' : 'Delete failed';
        window.alert(message);
      });
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, settings.language, getNodeById, deletePathFromDisk]);

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Preview />
        <Details />
      </div>
      <SettingsModal />
      <Onboarding />
      <ScanOverlay />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
