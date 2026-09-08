import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  // level-private-state-provider reaches for Node builtins (events, stream,
  // buffer). Polyfilling them is what lets the same provider stack run in the
  // browser against the Lace connector.
  plugins: [nodePolyfills(), wasm(), topLevelAwait()],
  server: { port: 5173 },
  optimizeDeps: {
    // The WASM packages must not be pre-bundled; esbuild cannot handle their
    // wasm imports. Everything else is pre-bundled so Vite performs the
    // CommonJS to ESM interop that compact-runtime's dependencies need.
    exclude: ['@midnight-ntwrk/ledger-v8', '@midnight-ntwrk/onchain-runtime-v3'],
    include: ['object-inspect'],
  },
  build: { target: 'esnext' },
});
