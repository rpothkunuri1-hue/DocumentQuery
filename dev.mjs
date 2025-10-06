import { spawn } from 'child_process';
import { build } from 'esbuild';
import fs from 'fs';

// Build client first
console.log('Building client...');

await build({
  entryPoints: ['client/src/main.tsx'],
  bundle: true,
  outfile: 'dist/public/app.js',
  platform: 'browser',
  target: 'es2020',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
  },
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  sourcemap: true,
});

// Copy static files
fs.mkdirSync('dist/public', { recursive: true });
fs.copyFileSync('client/index.html', 'dist/public/index.html');
fs.copyFileSync('client/src/styles.css', 'dist/public/styles.css');

// Add styles link to HTML
const htmlPath = 'dist/public/index.html';
let html = fs.readFileSync(htmlPath, 'utf-8');
if (!html.includes('styles.css')) {
  html = html.replace('</head>', '    <link rel="stylesheet" href="/styles.css">\n</head>');
  fs.writeFileSync(htmlPath, html);
}

console.log('Client built successfully!');
console.log('Starting server...\n');

// Start server
const server = spawn('tsx', ['server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

server.on('close', (code) => {
  process.exit(code);
});
