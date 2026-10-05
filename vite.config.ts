import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

const version = readFileSync('VERSION', 'utf-8').trim();

function versionPlugin() {
  return {
    name: 'version-inject',
    transformIndexHtml(html: string) {
      return html.replace(/__APP_VERSION__/g, version);
    },
  };
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
