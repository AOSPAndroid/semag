import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: "es2022", minify: true,
    outDir: '../../public', emptyOutDir: false,
    lib: { entry: 'src/index.tsx', formats: ['es'], fileName: () => 'voxel-armory-ui.js', cssFileName: 'voxel-armory-ui' },
    rollupOptions: {
      external: id => /(?:^|\/)voxel-(?:weapons|melee|armory-preview)\.js$/.test(id),
      output: { paths: id => './' + id.split('/').at(-1) }
    }
  }
});
