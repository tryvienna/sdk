#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const pluginName = process.argv[2];

if (!pluginName) {
  console.error('Usage: node create-plugin.mjs <plugin-name>');
  console.error('Example: node create-plugin.mjs my-plugin');
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
  console.error('Plugin name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens.');
  process.exit(1);
}

const pluginId = pluginName.replace(/-/g, '_');
const displayName = pluginName
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const pluginDir = path.resolve(process.cwd(), pluginName);

if (fs.existsSync(pluginDir)) {
  console.error(`Directory "${pluginName}" already exists.`);
  process.exit(1);
}

// Create directories
fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });

// package.json
fs.writeFileSync(
  path.join(pluginDir, 'package.json'),
  JSON.stringify(
    {
      name: pluginName,
      version: '0.0.1',
      private: true,
      description: `${displayName} plugin for Vienna`,
      type: 'module',
      exports: {
        '.': './src/index.ts',
      },
      scripts: {
        typecheck: 'tsc --noEmit',
      },
      dependencies: {},
      devDependencies: {
        '@types/react': '^19.0.0',
        typescript: '^5.9.3',
      },
    },
    null,
    2,
  ) + '\n',
);

// tsconfig.json
fs.writeFileSync(
  path.join(pluginDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        outDir: 'dist',
        rootDir: 'src',
        noEmit: true,
        jsx: 'react-jsx',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true,
        noImplicitAny: false,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2,
  ) + '\n',
);

// src/index.ts
fs.writeFileSync(
  path.join(pluginDir, 'src', 'index.ts'),
  `import { definePlugin } from '@tryvienna/sdk';

export default definePlugin({
  id: '${pluginId}',
  name: '${displayName}',
  description: 'A Vienna plugin',
  icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' },

  integrations: [],
  entities: [],

  canvases: {
    drawer: {
      component: PluginDrawer,
      label: '${displayName}',
    },
  },
});

function PluginDrawer() {
  return (
    <div style={{ padding: 16 }}>
      <h2>${displayName}</h2>
      <p>Edit src/index.ts to get started.</p>
    </div>
  );
}
`,
);

console.log(`\nCreated plugin "${pluginName}" at ./${pluginName}/\n`);
console.log('Generated files:');
console.log(`  ${pluginName}/package.json`);
console.log(`  ${pluginName}/tsconfig.json`);
console.log(`  ${pluginName}/src/index.ts`);
console.log('\nNext steps:');
console.log(`  cd ${pluginName}`);
console.log('  npm install');
console.log('  # Start editing src/index.ts');
console.log('');
