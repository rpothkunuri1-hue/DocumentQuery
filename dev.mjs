import { spawn } from 'child_process';
import { context } from 'esbuild';
import fs from 'fs';
import { watch } from 'fs';

function copyStaticFiles() {
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
}

// Build client with watch mode
console.log('Building client with watch mode...');

const ctx = await context({
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

// Initial build
await ctx.rebuild();
copyStaticFiles();

// Watch for changes
await ctx.watch();
console.log('Watching for file changes...');

// Watch for HTML and CSS changes
watch('client/index.html', () => {
  console.log('HTML changed, copying...');
  copyStaticFiles();
});

watch('client/src/styles.css', () => {
  console.log('CSS changed, copying...');
  copyStaticFiles();
});

console.log('Client built successfully!');
console.log('Starting server...\n');

// Start server
const server = spawn('tsx', ['server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

server.on('close', (code) => {
  ctx.dispose();
  process.exit(code);
});
