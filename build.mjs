import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

const buildClient = async () => {
  const ctx = await esbuild.context({
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
    minify: !isWatch,
    sourcemap: isWatch,
  });

  if (isWatch) {
    console.log('Watching for changes...');
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }

  // Copy index.html and styles.css
  fs.mkdirSync('dist/public', { recursive: true });
  fs.copyFileSync('client/index.html', 'dist/public/index.html');
  fs.copyFileSync('client/src/styles.css', 'dist/public/styles.css');

  // Create a link tag for styles in HTML if not exists
  const htmlPath = 'dist/public/index.html';
  let html = fs.readFileSync(htmlPath, 'utf-8');
  if (!html.includes('styles.css')) {
    html = html.replace('</head>', '    <link rel="stylesheet" href="/styles.css">\n</head>');
    fs.writeFileSync(htmlPath, html);
  }

  console.log('Build complete!');
};

buildClient().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
