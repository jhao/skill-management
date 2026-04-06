const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.yaml', '.yml', '.py', '.rb', '.go', '.java', '.kt', '.swift', '.rs',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.sh', '.zsh', '.bash', '.sql', '.xml', '.html', '.css', '.scss',
  '.vue', '.svelte', '.mdx', '.toml', '.ini', '.conf', '.dockerfile', '.makefile'
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pages', '.numbers', '.key']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const TEXT_EXTENSIONS = new Set(['.txt', '.log', '.csv']);

function normalizeHome(inputPath, homeDir) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return homeDir;
  if (inputPath.startsWith('~/')) return path.join(homeDir, inputPath.slice(2));
  return inputPath;
}

function determineLevel(absPath) {
  const normalized = absPath.replace(/\\/g, '/');
  // ~/.allskills 下的 skill 目录视为计算机级
  if (normalized.includes('/.allskills/') || normalized.endsWith('/.allskills')) return 'computer';
  const depth = normalized.split('/').filter(Boolean).length;
  if (depth <= 2) return 'computer';
  if (normalized.includes('/Application Support/') || normalized.includes('/Applications/')) return 'software';
  if (depth <= 4) return 'workdir';
  return 'project';
}

function detectFileType(extname) {
  const ext = extname.toLowerCase();
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (OFFICE_EXTENSIONS.has(ext)) return 'office';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  return 'unknown';
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeStat(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

async function safeLstat(targetPath) {
  try {
    return await fs.lstat(targetPath);
  } catch {
    return null;
  }
}

function extractSoftwareName(absPath) {
  const normalized = absPath.replace(/\\/g, '/');
  const match = normalized.match(/\/Applications\/([^/]+)\.app\//);
  if (match) return match[1];

  const supportMatch = normalized.match(/\/Application Support\/([^/]+)(?:\/|$)/);
  if (supportMatch) return supportMatch[1];

  return undefined;
}

function extractProjectName(absPath) {
  const normalized = absPath.replace(/\\/g, '/');
  const match = normalized.match(/\/([^/]+)\/\.claude(?:\/|$)/);
  return match ? match[1] : undefined;
}

function extractMetadata(rawContent) {
  if (!rawContent) return { skillName: undefined, description: undefined };
  const lines = rawContent.split(/\r?\n/);
  let skillName;
  let description;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!skillName && trimmed.startsWith('# ')) {
      skillName = trimmed.replace(/^#\s+/, '').trim();
    }
  }

  let paragraph = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (!trimmed || trimmed.startsWith('#')) continue;
      started = true;
      paragraph.push(trimmed);
    } else {
      if (!trimmed) break;
      paragraph.push(trimmed);
    }
  }

  if (paragraph.length > 0) {
    description = paragraph.join(' ').slice(0, 200);
  }

  return { skillName, description };
}

async function readSkillMetadata(rootDir) {
  const candidates = [path.join(rootDir, 'skill.md'), path.join(rootDir, 'README.md')];
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, 'utf-8');
      const metadata = extractMetadata(content);
      if (metadata.skillName || metadata.description) {
        return metadata;
      }
    } catch {
      // ignore and try the next candidate
    }
  }
  return { skillName: undefined, description: undefined };
}

async function buildNode(absPath, maxDepth, skillRootsSet, parentId) {
  const lstat = await safeLstat(absPath);
  if (!lstat) return null;

  const isSymlink = lstat.isSymbolicLink();
  // 跟随软连接获取真实类型
  const stat = isSymlink ? await safeStat(absPath) : lstat;
  if (!stat) return null;

  const isDirectory = stat.isDirectory();
  const extension = isDirectory ? undefined : path.extname(absPath);
  const isSkillRoot = isDirectory && skillRootsSet.has(absPath);
  const metadata = isSkillRoot ? await readSkillMetadata(absPath) : { skillName: undefined, description: undefined };

  const node = {
    id: absPath,
    name: path.basename(absPath),
    path: absPath,
    type: isDirectory ? 'directory' : 'file',
    level: determineLevel(absPath),
    fileType: isDirectory ? undefined : detectFileType(extension),
    extension: extension || undefined,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    children: undefined,
    skillName: metadata.skillName,
    description: metadata.description,
    softwareName: extractSoftwareName(absPath),
    isSkillRoot,
    isSymlink,
    parentId,
  };

  if (!isDirectory || maxDepth <= 0) {
    return node;
  }

  const entries = await safeReadDir(absPath);
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const children = [];
  for (const entry of entries) {
    const childPath = path.join(absPath, entry.name);
    const childNode = await buildNode(childPath, maxDepth - 1, skillRootsSet, absPath);
    if (childNode) {
      children.push(childNode);
    }
  }

  node.children = children;
  return node;
}

function runFind(rootPath, depthLimit, onProgress) {
  return new Promise((resolve) => {
    // 跳过 .Trash 目录；保留 dot 目录（如 .claude）以确保能发现隐藏路径
    const args = [
      rootPath,
      '-maxdepth', String(depthLimit),
      '(', '-name', '.Trash', '-prune', ')',
      '-o',
      '(', '-iname', 'skill.md', '-print', ')',
    ];
    const foundRoots = new Set();

    let stdoutBuffer = '';
    const child = spawn('find', args, { stdio: ['ignore', 'pipe', 'ignore'] });

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf-8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const matchedPath = line.trim();
        if (!matchedPath) continue;

        foundRoots.add(path.dirname(matchedPath));

        if (onProgress) {
          onProgress({ currentPath: matchedPath, discoveredCount: foundRoots.size });
        }
      }
    });

    child.on('close', () => {
      resolve(foundRoots);
    });

    child.on('error', () => {
      resolve(foundRoots);
    });
  });
}

function getSecondLevelNameForSkillRoot(skillRootPath) {
  const baseName = path.basename(skillRootPath);
  if (baseName === '.claude') {
    return path.basename(path.dirname(skillRootPath));
  }
  return baseName;
}

function mergeSoftwareNodes(nodes) {
  const passthrough = [];
  const softwareGroups = new Map();
  const projectGroups = new Map();

  for (const node of nodes) {
    if (node.type !== 'directory') {
      passthrough.push(node);
      continue;
    }

    if (node.level === 'software') {
      const softwareKey = node.softwareName || node.name || 'Unknown Software';
      if (!softwareGroups.has(softwareKey)) {
        softwareGroups.set(softwareKey, []);
      }
      softwareGroups.get(softwareKey).push(node);
      continue;
    }

    if (node.level === 'project') {
      const projectKey = extractProjectName(node.path);
      if (!projectKey) {
        passthrough.push(node);
        continue;
      }
      if (!projectGroups.has(projectKey)) {
        projectGroups.set(projectKey, []);
      }
      projectGroups.get(projectKey).push(node);
      continue;
    }

    passthrough.push(node);
  }

  const mergedSoftwareNodes = Array.from(softwareGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([softwareName, roots]) => {
      const secondLevelChildren = roots
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((rootNode) => {
          const wrapperId = `${rootNode.id}::group`;

          return {
            id: wrapperId,
            name: getSecondLevelNameForSkillRoot(rootNode.path),
            path: rootNode.path,
            type: 'directory',
            level: 'software',
            size: rootNode.size,
            modifiedAt: rootNode.modifiedAt,
            children: rootNode.children,
            fileType: rootNode.fileType,
            extension: rootNode.extension,
            skillName: rootNode.skillName,
            description: rootNode.description,
            softwareName,
            isSkillRoot: rootNode.isSkillRoot,
            parentId: `software://${softwareName}`,
          };
        });

      const firstChild = secondLevelChildren[0];
      return {
        id: `software://${softwareName}`,
        name: softwareName,
        path: firstChild?.path || softwareName,
        type: 'directory',
        level: 'software',
        size: secondLevelChildren.reduce((acc, item) => acc + (item.size || 0), 0),
        modifiedAt: firstChild?.modifiedAt || new Date().toISOString(),
        children: secondLevelChildren,
        softwareName,
        isSkillRoot: false,
        parentId: undefined,
      };
    });

  const mergedProjectNodes = Array.from(projectGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([projectName, roots]) => {
      const projectChildren = roots
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((rootNode) => ({
          ...rootNode,
          parentId: `project://${projectName}`,
        }));

      const firstChild = projectChildren[0];
      return {
        id: `project://${projectName}`,
        name: projectName,
        path: firstChild?.path || projectName,
        type: 'directory',
        level: 'project',
        size: projectChildren.reduce((acc, item) => acc + (item.size || 0), 0),
        modifiedAt: firstChild?.modifiedAt || new Date().toISOString(),
        children: projectChildren,
        isSkillRoot: false,
        parentId: undefined,
      };
    });

  return [...passthrough, ...mergedSoftwareNodes, ...mergedProjectNodes];
}

async function scanSkillTrees(options) {
  const { authorizedPaths, scanDepth, homeDir, onProgress } = options;

  // 自动将 ~/.allskills 加入扫描路径（如果存在），且去重
  const allSkillsDir = path.join(homeDir, '.allskills');
  const rawPaths = [...authorizedPaths];
  const allSkillsStat = await safeStat(allSkillsDir);
  if (allSkillsStat && allSkillsStat.isDirectory() && !rawPaths.includes(allSkillsDir) && !rawPaths.includes('~/.allskills')) {
    rawPaths.push(allSkillsDir);
  }

  const resolvedRoots = rawPaths
    .map((p) => normalizeHome(p, homeDir))
    .map((p) => path.resolve(p));

  const existingRoots = [];
  for (const rootPath of resolvedRoots) {
    const stat = await safeStat(rootPath);
    if (stat && stat.isDirectory()) {
      existingRoots.push(rootPath);
    }
  }

  const allSkillRoots = new Set();

  for (let i = 0; i < existingRoots.length; i += 1) {
    const rootPath = existingRoots[i];
    const partialBase = Math.floor((i / existingRoots.length) * 80);

    if (onProgress) {
      onProgress({
        progress: partialBase,
        currentPath: rootPath,
        discoveredCount: allSkillRoots.size,
      });
    }

    const foundInRoot = await runFind(rootPath, scanDepth, ({ currentPath, discoveredCount }) => {
      if (!onProgress) return;
      onProgress({
        progress: Math.min(partialBase + 70 / Math.max(existingRoots.length, 1), 90),
        currentPath,
        discoveredCount: allSkillRoots.size + discoveredCount,
      });
    });

    for (const root of foundInRoot) {
      allSkillRoots.add(path.resolve(root));
    }

    if (onProgress) {
      const progress = Math.floor(((i + 1) / existingRoots.length) * 85);
      onProgress({ progress, currentPath: rootPath, discoveredCount: allSkillRoots.size });
    }
  }

  const sortedRoots = Array.from(allSkillRoots).sort((a, b) => a.localeCompare(b));
  const skillRootsSet = new Set(sortedRoots);

  const resultNodes = [];
  for (let i = 0; i < sortedRoots.length; i += 1) {
    const rootPath = sortedRoots[i];
    const node = await buildNode(rootPath, scanDepth, skillRootsSet, undefined);
    if (node) {
      resultNodes.push(node);
    }
    if (onProgress) {
      const progress = 85 + Math.floor(((i + 1) / Math.max(sortedRoots.length, 1)) * 15);
      onProgress({ progress: Math.min(progress, 100), currentPath: rootPath, discoveredCount: sortedRoots.length });
    }
  }

  return mergeSoftwareNodes(resultNodes);
}

module.exports = {
  scanSkillTrees,
  detectFileType,
  normalizeHome,
};
