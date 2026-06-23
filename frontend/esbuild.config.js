import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import qrcode from 'qrcode-terminal';

const isProduction = process.argv.includes('--production');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let bestAddress = null;

  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vmware') || name.toLowerCase().includes('vbox')) continue;

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) {
          return iface.address;
        }
        if (!bestAddress) bestAddress = iface.address;
      }
    }
  }
  return bestAddress || 'localhost';
}

// 1. Limpiar carpeta dist antes de empezar
if (fs.existsSync('dist')) {
  console.log('🧹 Cleaning dist directory...');
  fs.rmSync('dist', { recursive: true, force: true });
}

const context = await esbuild.context({
  entryPoints: ['js/app.js'],
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  outdir: 'dist',
  chunkNames: 'chunks/[name]-[hash]',
  splitting: true,
  format: 'esm',
  target: ['es2020'],
  loader: {
    '.css': 'css',
  },
});

if (isProduction) {
  console.log('🚀 Building for production...');
  await context.rebuild();
  await context.dispose();
  console.log('✅ Build complete: dist/bundle.js');
} else {
  console.log('🛠️ Starting development mode...');

  await context.watch();
  console.log('👀 Watching for changes...');

  // Start a simple server using 'serve'
  const serveProcess = spawn('npx', ['serve', '.', '-l', '3000'], {
    stdio: 'inherit',
    shell: true,
  });

  serveProcess.on('close', (code) => {
    console.log(`📡 Server process exited with code ${code}`);
    context.dispose();
  });

  const localIp = getLocalIpAddress();
  const url = `http://${localIp}:3000`;

  console.log(`\n🌐 Server running locally at http://localhost:3000`);
  console.log(`📱 Access from mobile at: \x1b[36m${url}\x1b[0m\n`);

  if (localIp !== 'localhost') {
    qrcode.generate(url, { small: true }, function (qrcode) {
      console.log(qrcode);
    });
  }
}
