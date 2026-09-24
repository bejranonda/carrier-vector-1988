import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Base path is the repo name so the production bundle resolves correctly
// when served from GitHub Pages at /<repo>/. Local dev is unaffected.
export default defineConfig({
    base: process.env.GITHUB_ACTIONS ? '/carrier-vector-1988/' : '/',
    define: {
        // Stamped on the briefing, the crash screen and every feedback report,
        // so a pilot's "it broke" always says which build it broke on.
        __APP_VERSION__: JSON.stringify(pkg.version)
    },
    build: {
        target: 'es2022',
        sourcemap: false
    }
});
