import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  // level-private-state-provider reaches for Node builtins (events, stream,
  // buffer). Polyfilling them is what lets the same provider stack run in the
  // browser against the Lace connector.
  // No top-level-await plugin: the build targets esnext, where browsers
  // support top-level await natively. The plugin's SWC pass fails on this
  // dependency graph and is not needed at this target.
  plugins: [nodePolyfills(), wasm()],
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
