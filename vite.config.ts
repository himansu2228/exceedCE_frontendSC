import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.API_URL || 'http://localhost:3000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/notifications/stream': {
          target: apiUrl,
          changeOrigin: true,
          // Disable buffering for SSE - critical for real-time streaming
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Remove content-length to prevent buffering
              delete proxyRes.headers['content-length'];
            });
          },
        },
        '/api/pipeline/events': {
          target: apiUrl,
          changeOrigin: true,
          // Disable buffering for SSE - critical for real-time streaming
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Remove content-length to prevent buffering
              delete proxyRes.headers['content-length'];
            });
          },
        },
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
