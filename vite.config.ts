import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

async function writeFileWithRetry(filePath: string, buffer: Buffer, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.writeFileSync(filePath, buffer);
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt));
    }
  }
}

function posterSavePlugin(): Plugin {
  return {
    name: 'poster-save-plugin',
    configureServer(server) {
      server.middlewares.use('/api/save-poster', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { filename, dataUrl } = JSON.parse(body);
              if (filename && dataUrl) {
                const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const postersDir = path.resolve(__dirname, 'public/posters');
                if (!fs.existsSync(postersDir)) {
                  fs.mkdirSync(postersDir, { recursive: true });
                }
                const filePath = path.join(postersDir, filename);
                await writeFileWithRetry(filePath, buffer);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: filename }));
                return;
              }
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
          });
        }
      });
    },
  };
}

function posterVersionPlugin(): Plugin {
  return {
    name: 'poster-version-plugin',
    transformIndexHtml(html) {
      let version = '20261120-v2';
      try {
        const managerPath = path.resolve(__dirname, 'src/canvas/ModelPreloadManager.ts');
        const content = fs.readFileSync(managerPath, 'utf-8');
        const match = content.match(/POSTER_VERSION\s*=\s*'([^']+)'/);
        if (match?.[1]) {
          version = match[1];
        }
      } catch {
        // Fallback to default poster version if file read fails
      }
      return html.replace(/%POSTER_VERSION%/g, version);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), posterSavePlugin(), posterVersionPlugin()],
  base: './', // Ensures assets load properly on GitHub Pages, Vercel, or custom domains
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'three-vendor';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  server: {
    watch: {
      ignored: [
        '**/public/posters/**',
        '**/dist/**',
        '**/cad-workspace/**',
        '**/*.mp4',
        '**/*.webm',
        '**/*.pdf',
        '**/*.zip',
        '**/*.glb',
      ],
    },
  },
});

