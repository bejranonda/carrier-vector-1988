/**
 * CARRIER VECTOR: 1988 - Feedback and crash reports
 *
 * A pilot customer's report is only useful if it says which build, which
 * browser and which screen size. Every link the game offers for feedback is
 * built here, pre-filled with exactly that, as a GitHub "new issue" URL the
 * player reviews before sending - nothing leaves the browser on its own.
 *
 * Pure, so the URL is tested.
 */

export const REPO_ISSUES_URL = 'https://github.com/bejranonda/carrier-vector-1988/issues/new';

export interface ReportContext {
    version: string;
    userAgent: string;
    viewport: { width: number; height: number };
    /** Scenario being flown, if any. */
    scenario?: string;
    /** The error, for a crash report. */
    error?: string;
}

export function feedbackUrl(kind: 'feedback' | 'crash', ctx: ReportContext): string {
    const title = kind === 'crash'
        ? `Crash report (v${ctx.version})`
        : `Pilot feedback (v${ctx.version})`;
    const lines = [
        kind === 'crash'
            ? '**What were you doing when the game stopped?**\n\n\n'
            : '**What happened, and what did you expect?**\n\n\n',
        '---',
        `- Version: ${ctx.version}`,
        `- Viewport: ${ctx.viewport.width}x${ctx.viewport.height}`,
        `- Browser: ${ctx.userAgent}`
    ];
    if (ctx.scenario) lines.push(`- Mission: ${ctx.scenario}`);
    if (ctx.error) lines.push('', '```', ctx.error.slice(0, 1500), '```');
    const params = new URLSearchParams({ title, body: lines.join('\n') });
    return `${REPO_ISSUES_URL}?${params.toString()}`;
}
