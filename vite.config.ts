
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const cwd = process.cwd();
  const env = loadEnv(mode, cwd, '');

  let apiKey = env.VITE_API_KEY || process.env.VITE_API_KEY || '';

  // FALLBACK: Try to read from visible env.js if API key is missing
  if (!apiKey) {
    try {
      const visibleEnvPath = path.resolve(cwd, 'env.js');
      if (fs.existsSync(visibleEnvPath)) {
        const content = fs.readFileSync(visibleEnvPath, 'utf-8');
        // Simple regex to extract the key from the file content
        const match = content.match(/VITE_API_KEY\s*=\s*["']([^"']+)["']/);
        if (match && match[1]) {
          apiKey = match[1];
          console.log('Loaded API Key from env.js');
        }
      }
    } catch (e) {
      console.warn('Failed to load env.js', e);
    }
  }

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    server: {
      proxy: {
        '/wp-api': {
          target: 'https://lifelikeplants.au',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/wp-api/, '/wp-json'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Forward Authorization header
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization);
              }
              console.log('Proxying:', req.method, req.url, '-> https://lifelikeplants.au' + proxyReq.path);
            });
          }
        },
        '/replicate-api': {
          target: 'https://api.replicate.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/replicate-api/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization);
              }
              // Replicate requires Content-Type application/json explicitly
              proxyReq.setHeader('Content-Type', 'application/json');
              console.log('Proxying Replicate:', req.method, req.url);
            });
          }
        }
      }
    }
  };
});
