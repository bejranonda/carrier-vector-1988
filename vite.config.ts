import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Challenge links open /c/ (v2.3.0): the same page and the same bundle, with
 * a link preview that speaks to the friend who was sent it, and without the
 * og:url and canonical tags that point at the home page. Facebook treats
 * og:url as where a link really goes; a challenge posted there would land on
 * the home page without the ?c= that carries the run.
 */
export function challengePage(): Plugin {
    // "You have been challenged" reads like "you have been selected" - the
    // shape of a scam text (v2.3.0 UX review). Lead with the question and
    // with what the link is; a preview often cuts the description short.
    const title = 'Can you beat my score? Carrier Vector: 1988 - a free jet game';
    const description = 'Plays in your browser. No download, no sign-up, nothing to pay. EASY mode flies the plane - you tap FIRE.';
    return {
        name: 'challenge-page',
        apply: 'build',
        // After Vite has written index.html, base paths and all.
        enforce: 'post',
        generateBundle(_options, bundle) {
            const index = bundle['index.html'];
            // Loud, never silent: a /c/ page that kept og:url would send
            // every challenge posted on Facebook to the home page, and the
            // build would still pass (v2.3.0 review).
            if (!index || index.type !== 'asset') this.error('challenge-page: no index.html in the bundle');
            const html = String(index.source)
                .replace(/\s*<link rel="canonical"[^>]*>/, '')
                .replace(/\s*<meta property="og:url"[^>]*>/, '')
                .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
                .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, `$1${title}`)
                .replace(/(<meta (?:property="og:description"|name="twitter:description"|name="description") content=")[^"]*/g, `$1${description}`);
            if (/og:url|rel="canonical"/.test(html) || !html.includes(title) || !html.includes(description)) {
                this.error('challenge-page: index.html changed shape - /c/ would keep the home page\'s link preview');
            }
            this.emitFile({ type: 'asset', fileName: 'c/index.html', source: html });
        }
    };
}

// Base path is the repo name so the production bundle resolves correctly
// when served from GitHub Pages at /<repo>/. Local dev is unaffected.
export default defineConfig({
    base: process.env.GITHUB_ACTIONS ? '/carrier-vector-1988/' : '/',
    define: {
        // Stamped on the briefing, the crash screen and every feedback report,
        // so a pilot's "it broke" always says which build it broke on.
        __APP_VERSION__: JSON.stringify(pkg.version)
    },
    plugins: [challengePage()],
    build: {
        target: 'es2022',
        sourcemap: false
    }
});
