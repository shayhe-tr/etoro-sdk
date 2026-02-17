import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node18',
    outDir: 'dist/esm',
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    splitting: false,
    sourcemap: true,
    target: 'node18',
    outDir: 'dist/cjs',
  },
]);
