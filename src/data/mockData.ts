import { SkillNode } from '../types';

export const mockSkills: SkillNode[] = [
  {
    id: '1',
    name: '.claude',
    path: '/Users/demo/.claude',
    type: 'directory',
    level: 'computer',
    size: 4096,
    modifiedAt: '2024-01-15T10:00:00Z',
    isSkillRoot: true,
    children: [
      {
        id: '1-1',
        name: 'system-prompt.md',
        path: '/Users/demo/.claude/system-prompt.md',
        type: 'file',
        level: 'computer',
        fileType: 'markdown',
        extension: '.md',
        size: 1024,
        modifiedAt: '2024-01-15T10:05:00Z',
        skillName: 'System Prompt',
        description: 'Global system prompt for Claude.',
        parentId: '1',
        content: '# System Prompt\n\nYou are a helpful assistant.\n\n## Rules\n- Be concise\n- Be accurate\n\n```bash\necho "Hello World"\n```'
      }
    ]
  },
  {
    id: '2',
    name: 'Cursor',
    path: '/Applications/Cursor.app/Contents/Resources/.claude',
    type: 'directory',
    level: 'software',
    softwareName: 'Cursor',
    size: 4096,
    modifiedAt: '2024-02-20T14:30:00Z',
    isSkillRoot: true,
    children: [
      {
        id: '2-1',
        name: 'cursor-rules.md',
        path: '/Applications/Cursor.app/Contents/Resources/.claude/cursor-rules.md',
        type: 'file',
        level: 'software',
        fileType: 'markdown',
        extension: '.md',
        size: 2048,
        modifiedAt: '2024-02-20T14:35:00Z',
        skillName: 'Cursor Rules',
        description: 'Specific rules for Cursor IDE integration.',
        parentId: '2',
        content: '# Cursor Rules\n\nThese rules apply when using Claude within Cursor.\n\n```typescript\nconsole.log("Hello Cursor");\n```'
      }
    ]
  },
  {
    id: '3',
    name: 'my-project',
    path: '/Users/demo/workspace/my-project',
    type: 'directory',
    level: 'project',
    size: 4096,
    modifiedAt: '2024-03-10T09:15:00Z',
    children: [
      {
        id: '3-1',
        name: '.claude',
        path: '/Users/demo/workspace/my-project/.claude',
        type: 'directory',
        level: 'project',
        size: 4096,
        modifiedAt: '2024-03-10T09:16:00Z',
        isSkillRoot: true,
        parentId: '3',
        children: [
          {
            id: '3-1-1',
            name: 'frontend-skill.md',
            path: '/Users/demo/workspace/my-project/.claude/frontend-skill.md',
            type: 'file',
            level: 'project',
            fileType: 'markdown',
            extension: '.md',
            size: 3072,
            modifiedAt: '2024-03-10T09:20:00Z',
            skillName: 'Frontend Dev Skill',
            description: 'Guidelines for React and Tailwind CSS development.',
            parentId: '3-1',
            content: '# Frontend Dev Skill\n\nUse React and Tailwind CSS.\n\n## Components\nAlways use functional components.'
          },
          {
            id: '3-1-2',
            name: 'utils.ts',
            path: '/Users/demo/workspace/my-project/.claude/utils.ts',
            type: 'file',
            level: 'project',
            fileType: 'code',
            extension: '.ts',
            size: 512,
            modifiedAt: '2024-03-10T09:25:00Z',
            parentId: '3-1',
            content: 'export function add(a: number, b: number): number {\n  return a + b;\n}\n'
          }
        ]
      }
    ]
  },
  {
     id: '4',
     name: 'work-dir',
     path: '/Users/demo/workspace',
     type: 'directory',
     level: 'workdir',
     size: 4096,
     modifiedAt: '2024-04-01T10:00:00Z',
     children: [
        {
           id: '4-1',
           name: '.claude',
           path: '/Users/demo/workspace/.claude',
           type: 'directory',
           level: 'workdir',
           size: 4096,
           modifiedAt: '2024-04-01T10:01:00Z',
           isSkillRoot: true,
           parentId: '4',
           children: [
              {
                 id: '4-1-1',
                 name: 'git-hooks.md',
                 path: '/Users/demo/workspace/.claude/git-hooks.md',
                 type: 'file',
                 level: 'workdir',
                 fileType: 'markdown',
                 extension: '.md',
                 size: 1500,
                 modifiedAt: '2024-04-01T10:05:00Z',
                 skillName: 'Git Hooks',
                 description: 'Standard git hooks for all workspace projects.',
                 parentId: '4-1',
                 content: '# Git Hooks\n\nPre-commit and pre-push hooks.'
              }
           ]
        }
     ]
  }
];
