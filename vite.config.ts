import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function removeCrossoriginPlugin() {
  return {
    name: 'remove-crossorigin-plugin',
    transformIndexHtml(html: string) {
      return html.replace(/ crossorigin(=("[^"]*"|'[^']*'|[^>\s]+))?/g, '');
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), removeCrossoriginPlugin()],
    build: {
      emptyOutDir: true,
      target: 'es2018',
      modulePreload: false,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          format: 'iife' as const,
          inlineDynamicImports: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR === 'true' ? false : true,
      watch: process.env.DISABLE_HMR === 'true' ? { ignored: ['**/*'] } : {},
    },
  };
});

