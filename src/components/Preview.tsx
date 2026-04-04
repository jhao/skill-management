import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { FileText, Folder, ExternalLink, FolderOpen, FileCode2, Image, FileVideo, FileAudio, FileType2, FileArchive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SkillNode } from '../types';

const MarkdownPreview: React.FC<{ content: string; theme: string }> = ({ content, theme }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none p-6">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          return match ? (
            <SyntaxHighlighter style={theme === 'dark' ? vscDarkPlus : vs} language={match[1]} PreTag="div" {...props}>
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>;
        },
        th({ children }) {
          return <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 align-top">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const CodePreview: React.FC<{ content: string; language: string; theme: string }> = ({ content, language, theme }) => (
  <div className="h-full overflow-auto text-sm relative">
    <div className="absolute top-2 right-4 px-2 py-1 bg-gray-200 dark:bg-gray-800 text-xs rounded text-gray-600 dark:text-gray-400 font-mono z-10">
      {language}
    </div>
    <SyntaxHighlighter
      style={theme === 'dark' ? vscDarkPlus : vs}
      language={language}
      showLineNumbers
      customStyle={{ margin: 0, padding: '1.5rem', minHeight: '100%', background: 'transparent' }}
    >
      {content}
    </SyntaxHighlighter>
  </div>
);

const FileFallback: React.FC<{ fileType: SkillNode['fileType']; language: 'zh' | 'en' }> = ({ fileType, language }) => {
  const text = language === 'zh' ? '当前文件类型不支持内联文本预览。' : 'This file type is not available for inline text preview.';
  const actions = language === 'zh' ? '可使用右上角“打开”或“在 Finder 中显示”。' : 'Use "Open" or "Reveal in Finder" from the top-right.';
  const icon =
    fileType === 'office' ? <FileType2 className="w-6 h-6" /> : fileType === 'unknown' ? <FileArchive className="w-6 h-6" /> : <FileText className="w-6 h-6" />;

  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
      {icon}
      <p>{text}</p>
      <p className="text-sm">{actions}</p>
    </div>
  );
};

export const Preview: React.FC = () => {
  const { selectedNodeId, getNodeById, settings, openInSystem, revealInFinder, readTextContent, getBinaryUrl } = useAppContext();
  const [textContent, setTextContent] = useState<string>('');
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const t = (zh: string, en: string) => (settings.language === 'zh' ? zh : en);

  const node = selectedNodeId ? getNodeById(selectedNodeId) : null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (node == null || node.type === 'directory') {
        setTextContent('');
        setBinaryUrl(null);
        return;
      }

      setLoading(true);
      setBinaryUrl(null);
      setTextContent('');
      try {
        if (node.fileType === 'markdown' || node.fileType === 'code' || node.fileType === 'text' || node.fileType === 'unknown') {
          const content = await readTextContent(node.path);
          if (active) {
            setTextContent(content);
          }
        } else {
          const url = await getBinaryUrl(node.path);
          if (active) {
            setBinaryUrl(url);
          }
        }
      } catch {
        if (active) {
          setTextContent('');
          setBinaryUrl(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [selectedNodeId]);

  if (selectedNodeId == null || node == null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e] text-gray-400">
        <div className="w-16 h-16 mb-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-300 dark:text-gray-700" />
        </div>
        <p>{t('从左侧选择一个技能', 'Select a skill from the left')}</p>
        <p className="text-sm mt-2">{t('或在设置中点击“再次扫描”刷新技能列表', 'Or click "Rescan" in Settings to refresh skills')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#1e1e1e] min-w-[400px] overflow-hidden">
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-gray-50/50 dark:bg-[#2d2d2d]/50">
        <div className="flex items-center min-w-0">
          {node.type === 'directory' ? <Folder className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" /> : <FileText className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />}
          <div className="truncate">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{node.name}</div>
            <div className="text-xs text-gray-500 truncate" title={node.path}>
              {node.path}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
          <button
            className="flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            onClick={() => void openInSystem(node.path)}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {t('打开', 'Open')}
          </button>
          <button
            className="flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            onClick={() => void revealInFinder(node.path)}
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            Finder
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {node.type === 'directory' && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 p-6">
            <Folder className="w-7 h-7" />
            <p>{t('中间预览区仅用于预览文件。', 'Preview panel is only for files.')}</p>
            <p className="text-sm">{t('请在左侧选择具体文件。', 'Please choose a file from the left panel.')}</p>
          </div>
        )}
        {node.type === 'file' && loading && <div className="p-6 text-sm text-gray-500">{t('加载中...', 'Loading...')}</div>}

        {node.type === 'file' && loading === false && (node.fileType === 'markdown' || (node.fileType === 'unknown' && node.extension === '.md')) && (
          <MarkdownPreview content={textContent} theme={settings.theme} />
        )}

        {node.type === 'file' && loading === false && (node.fileType === 'code' || node.fileType === 'text') && (
          <CodePreview content={textContent} language={node.extension?.replace('.', '') || 'text'} theme={settings.theme} />
        )}

        {node.type === 'file' && loading === false && node.fileType === 'image' && binaryUrl != null && (
          <div className="h-full p-6 flex items-center justify-center bg-gray-50 dark:bg-[#1a1a1a]">
            <img src={binaryUrl} alt={node.name} className="max-h-full max-w-full object-contain rounded-lg shadow" />
          </div>
        )}

        {node.type === 'file' && loading === false && node.fileType === 'pdf' && binaryUrl != null && (
          <iframe title={node.name} src={binaryUrl} className="w-full h-full border-0" />
        )}

        {node.type === 'file' && loading === false && node.fileType === 'video' && binaryUrl != null && (
          <div className="h-full p-6 flex items-center justify-center bg-black">
            <video controls className="max-h-full max-w-full" src={binaryUrl}>
              {t('当前浏览器不支持视频播放。', 'Your browser does not support video playback.')}
            </video>
          </div>
        )}

        {node.type === 'file' && loading === false && node.fileType === 'audio' && binaryUrl != null && (
          <div className="h-full p-6 flex items-center justify-center">
            <div className="w-full max-w-xl border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex items-center gap-4">
              <FileAudio className="w-6 h-6 text-indigo-500" />
              <audio controls className="w-full" src={binaryUrl} />
            </div>
          </div>
        )}

        {node.type === 'file' && loading === false && node.fileType === 'office' && <FileFallback fileType={node.fileType} language={settings.language} />}

        {node.type === 'file' && loading === false && node.fileType === 'unknown' && textContent.length === 0 && <FileFallback fileType={node.fileType} language={settings.language} />}

        {node.type === 'file' && loading === false && node.fileType != null && ['image', 'pdf', 'video', 'audio'].includes(node.fileType) && binaryUrl == null && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
            {node.fileType === 'image' && <Image className="w-6 h-6" />}
            {node.fileType === 'video' && <FileVideo className="w-6 h-6" />}
            {node.fileType === 'audio' && <FileAudio className="w-6 h-6" />}
            {node.fileType === 'pdf' && <FileCode2 className="w-6 h-6" />}
            <p>{t('无法加载当前文件。', 'Failed to load this file.')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
