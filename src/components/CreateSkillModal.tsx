import React, { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  X, 
  Sparkles, 
  Folder, 
  FileText, 
  Plus, 
  Upload, 
  ChevronRight, 
  ChevronDown,
  Trash2,
  AlertCircle,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  path: string;
  children?: FileNode[];
}

interface CreateSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SKILL_CREATOR_PROMPT = `# Skill Creator

You are a skilled developer tasked with creating a comprehensive SKILL.md file and associated resources for a new skill.

## Input Format
The user will provide:
1. Skill name
2. Skill description
3. Target location (local computer / software / project)

## Output Structure
You must generate:

### 1. SKILL.md
A comprehensive markdown file containing:
- Skill overview and purpose
- Installation/setup instructions
- Usage examples
- Configuration options
- Troubleshooting guide

### 2. references/ (optional)
Any reference files, documentation, or sample data needed

### 3. scripts/ (optional)
Executable scripts for:
- Installation
- Setup
- Automation tasks

### 4. assets/ (optional)
Static files like:
- Images
- Configuration templates
- Sample data files

## Guidelines
- Write clear, concise documentation
- Include practical examples
- Consider edge cases
- Follow best practices for the target platform
- Make scripts executable and well-commented

Please create the skill based on the provided information.`;

export const CreateSkillModal: React.FC<CreateSkillModalProps> = ({ isOpen, onClose }) => {
  const { settings, skills } = useAppContext();
  const [step, setStep] = useState<'info' | 'editor'>('info');
  
  // Form fields
  const [location, setLocation] = useState<'computer' | 'software' | 'project'>('computer');
  const [selectedPath, setSelectedPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  
  // AI dialog
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // File tree
  const [fileTree, setFileTree] = useState<FileNode[]>([
    { id: '1', name: 'SKILL.md', type: 'file', path: 'SKILL.md', content: '' },
    { id: '2', name: 'references', type: 'directory', path: 'references', children: [] },
    { id: '3', name: 'scripts', type: 'directory', path: 'scripts', children: [] },
    { id: '4', name: 'assets', type: 'directory', path: 'assets', children: [] },
  ]);
  const [selectedFileId, setSelectedFileId] = useState('1');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['2', '3', '4']));
  
  const t = (zh: string, en: string) => settings.language === 'zh' ? zh : en;

  // Get available software/project paths from skills
  const availablePaths = skills
    .filter(s => location === 'software' ? s.level === 'software' : s.level === 'project')
    .map(s => ({ name: s.name, path: s.path }));

  const checkAIConfig = () => {
    const aiConfig = settings.aiConfig;
    if (!aiConfig?.apiKey || !aiConfig?.baseUrl) {
      alert(t('请先配置AI设置（API Key和Base URL）', 'Please configure AI settings (API Key and Base URL) first'));
      return false;
    }
    return true;
  };

  const handleAIButtonClick = () => {
    if (!name.trim() || !description.trim()) {
      alert(t('请先填写SKILL名称和描述', 'Please fill in SKILL name and description first'));
      return;
    }
    
    if (!checkAIConfig()) return;
    
    const prompt = `我要使用skill-creator技能完成名字是"${name}"，描述是"${description}"的技能，请按照目标进行内容生成，需要运行的脚本放到scripts目录下，需要参考的文件放到references下，需要使用的静态文件放到assets目录下。`;
    setAiPrompt(prompt);
    setShowAIDialog(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const aiConfig = settings.aiConfig;
      if (!aiConfig?.apiKey || !aiConfig?.baseUrl) {
        throw new Error('AI config not found');
      }

      const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'gpt-4',
          messages: [
            { role: 'system', content: SKILL_CREATOR_PROMPT },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedContent = data.choices[0]?.message?.content || '';
      
      // Parse the generated content and update file tree
      // For now, we'll just update the SKILL.md content
      setFileTree(prev => {
        const newTree = [...prev];
        const skillMd = findNode(newTree, '1');
        if (skillMd) {
          skillMd.content = generatedContent;
        }
        return newTree;
      });
      
      // Update current content if SKILL.md is selected
      if (selectedFileId === '1') {
        setContent(generatedContent);
      }
      
      setShowAIDialog(false);
    } catch (error) {
      alert(t('生成失败: ', 'Generation failed: ') + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleDir = (id: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addFile = (parentId: string) => {
    const fileName = prompt(t('请输入文件名', 'Enter file name'));
    if (!fileName) return;
    
    setFileTree(prev => {
      const newTree = [...prev];
      const parent = findNode(newTree, parentId);
      if (parent && parent.children) {
        parent.children.push({
          id: Date.now().toString(),
          name: fileName,
          type: 'file',
          path: `${parent.path}/${fileName}`,
          content: ''
        });
      }
      return newTree;
    });
  };

  const findNode = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleFileSelect = (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedFileId(node.id);
      setContent(node.content || '');
    }
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id}>
        <div
          className={`flex items-center px-3 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
            selectedFileId === node.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => node.type === 'directory' ? toggleDir(node.id) : handleFileSelect(node)}
        >
          {node.type === 'directory' ? (
            <>
              {expandedDirs.has(node.id) ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
              <Folder className="w-4 h-4 mr-2 text-blue-500" />
            </>
          ) : (
            <>
              <span className="w-4 mr-1" />
              <FileText className="w-4 h-4 mr-2 text-gray-500" />
            </>
          )}
          <span className="text-sm flex-1">{node.name}</span>
          {node.type === 'directory' && (
            <button
              onClick={(e) => { e.stopPropagation(); addFile(node.id); }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
        {node.type === 'directory' && expandedDirs.has(node.id) && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const handleNext = () => {
    if (!folderName.trim() || !name.trim() || !description.trim()) {
      alert(t('请填写所有必填字段', 'Please fill in all required fields'));
      return;
    }
    if (location !== 'computer' && !selectedPath) {
      alert(t('请选择所在位置', 'Please select a location'));
      return;
    }
    setStep('editor');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-[90vw] h-[90vh] max-w-6xl bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <Bot className="w-5 h-5 mr-2 text-indigo-600" />
              {t('新建SKILL', 'Create New SKILL')}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {step === 'info' ? (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Location Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    {t('所在位置', 'Location')} *
                  </label>
                  <div className="flex space-x-3">
                    {(['computer', 'software', 'project'] as const).map((loc) => (
                      <button
                        key={loc}
                        onClick={() => setLocation(loc)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          location === loc
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {loc === 'computer' && t('本地计算机', 'Local Computer')}
                        {loc === 'software' && t('某个软件', 'Software')}
                        {loc === 'project' && t('项目', 'Project')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Path Selection for Software/Project */}
                {location !== 'computer' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                      {t('选择', 'Select')} {location === 'software' ? t('软件', 'Software') : t('项目', 'Project')} *
                    </label>
                    <select
                      value={selectedPath}
                      onChange={(e) => setSelectedPath(e.target.value)}
                      className="w-full bg-white dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-700 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                    >
                      <option value="">{t('请选择...', 'Please select...')}</option>
                      {availablePaths.map((p) => (
                        <option key={p.path} value={p.path}>{p.name}</option>
                      ))}
                    </select>
                    {availablePaths.length === 0 && (
                      <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {t('暂无可用选项，请先扫描', 'No options available, please scan first')}
                      </p>
                    )}
                  </div>
                )}

                {/* Folder Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('SKILL文件夹名称', 'SKILL Folder Name')} *
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder={t('例如: my-awesome-skill', 'e.g., my-awesome-skill')}
                    className="w-full bg-white dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-700 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('名称 (Name)', 'Name')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('技能的名称', 'Skill name')}
                    className="w-full bg-white dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-700 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('描述 (Description)', 'Description')} *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('简要描述这个技能的功能', 'Briefly describe what this skill does')}
                    rows={4}
                    className="w-full bg-white dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-700 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200 resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Sidebar - File Tree */}
              <div className="w-60 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#181818] flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('文件', 'Files')}</h3>
                </div>
                <div className="flex-1 overflow-auto py-2">
                  {renderFileTree(fileTree)}
                </div>
              </div>

              {/* Middle - Editor */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#2d2d2d]">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {findNode(fileTree, selectedFileId)?.path || 'SKILL.md'}
                  </span>
                  <button
                    onClick={handleAIButtonClick}
                    className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    {t('AI生成', 'AI Generate')}
                  </button>
                </div>
                <div className="flex-1 flex">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 p-4 bg-white dark:bg-[#1e1e1e] text-sm font-mono text-gray-800 dark:text-gray-200 resize-none focus:outline-none border-r border-gray-200 dark:border-gray-800"
                    placeholder={t('在此输入SKILL内容...', 'Enter SKILL content here...')}
                  />
                  <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#1e1e1e]">
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content || t('预览区域', 'Preview')}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#2d2d2d] flex justify-between">
            {step === 'editor' && (
              <button
                onClick={() => setStep('info')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('上一步', 'Back')}
              </button>
            )}
            <div className="flex-1" />
            <div className="space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('取消', 'Cancel')}
              </button>
              {step === 'info' ? (
                <button
                  onClick={handleNext}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  {t('下一步', 'Next')}
                </button>
              ) : (
                <button
                  onClick={() => {}}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  {t('创建SKILL', 'Create SKILL')}
                </button>
              )}
            </div>
          </div>

          {/* AI Dialog */}
          {showAIDialog && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-[600px] max-w-[90vw] bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
              >
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                    {t('AI生成内容', 'AI Generate Content')}
                  </h3>
                </div>
                <div className="p-6">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={6}
                    className="w-full bg-gray-50 dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-700 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200 resize-none"
                  />
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {t('提示：AI将根据名称和描述生成SKILL内容。您可以在发送前修改上面的提示词。', 
                       'Tip: AI will generate SKILL content based on name and description. You can modify the prompt above before sending.')}
                  </p>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#2d2d2d] flex justify-end space-x-3">
                  <button
                    onClick={() => setShowAIDialog(false)}
                    disabled={isGenerating}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {t('取消', 'Cancel')}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center"
                  >
                    {isGenerating && <Sparkles className="w-4 h-4 mr-1.5 animate-spin" />}
                    {isGenerating ? t('生成中...', 'Generating...') : t('开始生成', 'Start Generate')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
