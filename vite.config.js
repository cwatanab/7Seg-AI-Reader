import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

function serveOnnxStatic() {
  return {
    name: 'serve-onnx-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          const cleanUrl = req.url.split('?')[0].replace(/^\//, '');
          const filePath = path.resolve(process.cwd(), 'public', cleanUrl);

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (cleanUrl.endsWith('.onnx') || cleanUrl.endsWith('.ort')) {
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
              return fs.createReadStream(filePath).pipe(res);
            } else if (cleanUrl.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
              return fs.createReadStream(filePath).pipe(res);
            } else if (cleanUrl.endsWith('.mjs') || cleanUrl.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
              return fs.createReadStream(filePath).pipe(res);
            }
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  root: process.cwd(),
  plugins: [basicSsl(), serveOnnxStatic(), react()],
  server: {
    host: true,
    port: 3000,
    cors: true,
    fs: {
      strict: false,
      allow: ['.']
    },
    watch: {
      ignored: ['**/*.wasm', '**/*.onnx', '**/public/*.mjs', '**/node_modules/**']
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  }
});
