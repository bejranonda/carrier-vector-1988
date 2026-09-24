import { describe, it, expect } from 'vitest';
import { normalizeKey } from './Controls';

describe('normalizeKey - the stick cluster by position (Known Issues #41)', () => {
    it('is the identity on QWERTY', () => {
        for (const k of ['w', 'a', 's', 'd', 'q', 'e']) {
            expect(normalizeKey(k, `Key${k.toUpperCase()}`)).toBe(k);
        }
        expect(normalizeKey('M', 'KeyM')).toBe('m');
        expect(normalizeKey('ArrowUp', 'ArrowUp')).toBe('arrowup');
        expect(normalizeKey(' ', 'Space')).toBe(' ');
    });

    it('puts WASD under the same fingers on AZERTY', () => {
        // AZERTY: physical W reports "z", physical A reports "q", physical Q reports "a".
        expect(normalizeKey('z', 'KeyW')).toBe('w');
        expect(normalizeKey('q', 'KeyA')).toBe('a');
        expect(normalizeKey('a', 'KeyQ')).toBe('q');
        // AZERTY's "w" label sits where QWERTY's Z is: it must not pitch the jet.
        expect(normalizeKey('w', 'KeyZ')).toBe('label:w');
    });

    it('keeps mnemonic shortcuts on their labels', () => {
        // AZERTY's M sits on the Semicolon position; mute follows the label.
        expect(normalizeKey('m', 'Semicolon')).toBe('m');
        expect(normalizeKey('h', 'KeyH')).toBe('h');
    });

    it('still works when the browser supplies no code', () => {
        expect(normalizeKey('W')).toBe('w');
        expect(normalizeKey('Enter')).toBe('enter');
    });
});
