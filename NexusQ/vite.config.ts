import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@supabase/supabase-js')) return 'vendor-supabase';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';

          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
  }
});
