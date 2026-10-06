import { describe, it, expect } from 'vitest';
import { normalizeKey, touchWording } from './Controls';

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

describe('touchWording (v2.2.0)', () => {
    it('turns every keyboard order the coach gives into one a thumb can follow', () => {
        expect(touchWording('FIRE NOW - PRESS SPACE OR CLICK')).toBe('FIRE NOW - TAP FIRE');
        expect(touchWording('ONE BOMBER AHEAD - PRESS SPACE TO FIRE')).toBe('ONE BOMBER AHEAD - TAP FIRE');
        expect(touchWording('FIRE NOW - PRESS SPACE')).toBe('FIRE NOW - TAP FIRE');
        expect(touchWording('TWO BOMBERS - TURN TOWARD THEM WITH A / D')).toBe('TWO BOMBERS - TURN TOWARD THEM WITH THE LEFT STICK');
        expect(touchWording('TARGET LOCKED - TURN TOWARD IT (A / D) UNTIL IT SAYS FIRE NOW'))
            .toBe('TARGET LOCKED - TURN TOWARD IT (LEFT STICK) UNTIL IT SAYS FIRE NOW');
        expect(touchWording('ENEMY BEHIND YOU - TURN HARD (HOLD A OR D), DO NOT FLY STRAIGHT'))
            .toBe('ENEMY BEHIND YOU - TURN HARD (STICK HARD LEFT OR RIGHT), DO NOT FLY STRAIGHT');
        expect(touchWording('ENEMY AHEAD - PRESS [T] TO LOCK ON')).toBe('ENEMY AHEAD - TAP TGT TO LOCK ON');
        expect(touchWording('STALL - PUSH NOSE DOWN [S] AND ADD POWER [SHIFT]')).toBe('STALL - PUSH NOSE DOWN AND ADD POWER');
        expect(touchWording('Press SPACE to fire the selected weapon.')).toBe('Tap FIRE to shoot.');
        expect(touchWording('Open this menu anytime (ESC) if you are not sure what to do.'))
            .toBe('Open this menu anytime (the menu button, top right) if you are not sure what to do.');
    });

    it('leaves words with nothing to translate alone', () => {
        expect(touchWording('SHOOT DOWN 2 PLANES')).toBe('SHOOT DOWN 2 PLANES');
        expect(touchWording('ENEMY BEHIND YOU - THE PLANE WILL TURN TO FIGHT')).toBe('ENEMY BEHIND YOU - THE PLANE WILL TURN TO FIGHT');
    });
});
