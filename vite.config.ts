import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from "@cloudflare/vite-plugin";

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        emptyOutDir: mode === 'client' || !process.env.VITE_SSR_BUILD,
      },
      plugins: [
        react(), 
        tailwindcss(), 
        cloudflare(),
        {
          name: 'generate-version-json',
          buildStart() {
            const versionData = JSON.stringify({ 
              version: packageJson.version,
              buildTime: new Date().toISOString()
            }, null, 2);
            
            if (!fs.existsSync('public')) {
              fs.mkdirSync('public', { recursive: true });
            }
            fs.writeFileSync('public/version.json', versionData);
          },
          closeBundle() {
            if (fs.existsSync('dist')) {
              const versionData = { 
                version: packageJson.version,
                buildTime: new Date().toISOString()
              };
              if (!fs.existsSync('dist/client')) {
                fs.mkdirSync('dist/client', { recursive: true });
              }
              fs.writeFileSync(path.resolve(__dirname, 'dist/client/version.json'), JSON.stringify(versionData, null, 2));
              console.log('✅ Generated version.json in public/ and dist/client/');
            }
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});