import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { createAuthMiddleware } from './server/authApi.ts';
import { createPlatformApi } from './server/platformApi.ts';

export default defineConfig(({ mode }) => {
  const authEnvironment = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  const authApi = {
    name: 'movement-firsts-auth-api',
    configureServer(server: { middlewares: { use: (middleware: (...args: any[]) => any) => void } }) {
      server.middlewares.use(createPlatformApi(authEnvironment));
      server.middlewares.use(createAuthMiddleware(authEnvironment));
    },
    configurePreviewServer(server: { middlewares: { use: (middleware: (...args: any[]) => any) => void } }) {
      server.middlewares.use(createPlatformApi(authEnvironment));
      server.middlewares.use(createAuthMiddleware(authEnvironment));
    },
  };

  return {
    plugins: [authApi, react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
