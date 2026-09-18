import { defineConfig } from 'vite';

// Base path is the repo name so the production bundle resolves correctly
// when served from GitHub Pages at /<repo>/. Local dev is unaffected.
export default defineConfig({
    base: process.env.GITHUB_ACTIONS ? '/carrier-vector-1988/' : '/',
    build: {
        target: 'es2022',
        sourcemap: false
    }
});
