import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Two dev servers run side by side (see Dockerfile):
//   http://localhost:3000        – plain HTTP (camera/GPS work because localhost is a secure context)
//   https://<lan-ip>:3443        – HTTPS for phones/other devices, which need a secure context for camera/GPS
const useHttps = process.env.HTTPS === 'true';

export default defineConfig({
  plugins: useHttps ? [react(), basicSsl()] : [react()],
  // Separate dep-optimizer caches so the two servers don't clobber each other.
  cacheDir: useHttps ? 'node_modules/.vite-https' : 'node_modules/.vite',
  server: {
    host: '0.0.0.0',
    port: useHttps ? 3443 : 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://backend:4000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://backend:4000',
        ws: true,
        changeOrigin: true
      }
    }
  },
});
