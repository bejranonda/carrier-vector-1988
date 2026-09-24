import { describe, it, expect } from 'vitest';
import { REPO_ISSUES_URL, feedbackUrl } from './Feedback';

const ctx = { version: '1.10.0', userAgent: 'TestBrowser/1.0', viewport: { width: 1440, height: 900 } };

describe('feedbackUrl', () => {
    it('points at the repo issue tracker with version, viewport and browser', () => {
        const url = new URL(feedbackUrl('feedback', { ...ctx, scenario: 'TRAINING_SORTIE' }));
        expect(`${url.origin}${url.pathname}`).toBe(REPO_ISSUES_URL);
        expect(url.searchParams.get('title')).toBe('Pilot feedback (v1.10.0)');
        const body = url.searchParams.get('body') ?? '';
        expect(body).toContain('Version: 1.10.0');
        expect(body).toContain('1440x900');
        expect(body).toContain('TestBrowser/1.0');
        expect(body).toContain('TRAINING_SORTIE');
    });

    it('carries a bounded error for a crash report', () => {
        const url = new URL(feedbackUrl('crash', { ...ctx, error: 'x'.repeat(5000) }));
        expect(url.searchParams.get('title')).toBe('Crash report (v1.10.0)');
        const body = url.searchParams.get('body') ?? '';
        expect(body.length).toBeLessThan(2000);
    });
});
