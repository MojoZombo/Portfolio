import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

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
          req.on('end', () => {
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
                fs.writeFileSync(filePath, buffer);
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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), posterSavePlugin()],
  base: './', // Ensures assets load properly on GitHub Pages, Vercel, or custom domains
  server: {
    watch: {
      ignored: ['**/public/**', '**/dist/**', '**/*.png', '**/*.pdf', '**/*.zip'],
    },
  },
});
