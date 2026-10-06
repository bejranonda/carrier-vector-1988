// `npm run balance` - the headless balance sim (scripts/balance/balance.sim.ts).
// Kept out of `npm test`: it plays minutes of game per seed.
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export default defineConfig({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    test: {
        include: ['scripts/balance/**/*.sim.ts'],
        testTimeout: 3_600_000
    }
});
