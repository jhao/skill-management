const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  authorizedPaths: ['~/'],
  scanDepth: 8,
  theme: 'light',
  language: 'zh',
};

const DEFAULT_CONFIG = {
  settings: DEFAULT_SETTINGS,
  onboardingDone: false,
};

function getConfigFilePath(app) {
  return path.join(app.getPath('userData'), 'config.json');
}

async function readConfig(app) {
  const configFilePath = getConfigFilePath(app);
  try {
    const raw = await fs.readFile(configFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
      onboardingDone: Boolean(parsed.onboardingDone),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function writeConfig(app, nextConfig) {
  const configFilePath = getConfigFilePath(app);
  const merged = {
    settings: {
      ...DEFAULT_SETTINGS,
      ...(nextConfig.settings || {}),
    },
    onboardingDone: Boolean(nextConfig.onboardingDone),
  };

  await fs.mkdir(path.dirname(configFilePath), { recursive: true });
  await fs.writeFile(configFilePath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

module.exports = {
  DEFAULT_SETTINGS,
  DEFAULT_CONFIG,
  readConfig,
  writeConfig,
};
