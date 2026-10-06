import { describe, expect, it } from 'vitest';
import { copyPicture, copyToClipboard, linkPayload, pictureFileName, picturePayload, quickLinks, shareSupport, shareToSheet } from './Share';
import type { ShareHost } from './Share';
import { shareContent } from './ShareCard';

const content = shareContent({
    score: 5000, waves: 4, kills: 9, bestChain: 2, stars: 1, easy: false, isNewBest: true,
    name: 'Tom', versus: null, url: 'https://example.org/game/c/?c=1.5000.4#n=Tom'
});
const picture = { name: 'card.png' } as unknown as File;
class FakeItem {
    data: Record<string, unknown>;
    constructor(data: Record<string, unknown>) { this.data = data; }
}

describe('shareSupport (v2.3.0)', () => {
    it('offers only what the browser can do', () => {
        expect(shareSupport(undefined, picture, undefined)).toEqual({ sheet: false, files: false, copy: false, copyPicture: false });
        expect(shareSupport({ clipboard: { writeText: async () => {} } }, picture, undefined).copy).toBe(true);
        const share = async () => {};
        expect(shareSupport({ share }, picture, undefined)).toMatchObject({ sheet: true, files: false });
        expect(shareSupport({ share, canShare: () => true }, picture).files).toBe(true);
        expect(shareSupport({ share, canShare: () => true }, null).files).toBe(false);
        expect(shareSupport({ share, canShare: () => false }, picture).files).toBe(false);
        expect(shareSupport({ share, canShare: () => { throw new Error('no'); } }, picture).files).toBe(false);
        expect(shareSupport({ clipboard: { write: async () => {} } }, null, FakeItem).copyPicture).toBe(true);
        expect(shareSupport({ clipboard: { write: async () => {} } }, null, undefined).copyPicture).toBe(false);
    });
});

describe('what goes to the share sheet (v2.3.0)', () => {
    it('sends the challenge as text with the link on its last line - never as `url`', () => {
        const data = linkPayload(content);
        expect(data).toEqual({ text: content.clipboard });
        expect(data.url).toBeUndefined();
        expect(String(data.text).split('\n').pop()).toBe('https://example.org/game/c/?c=1.5000.4#n=Tom');
    });

    it('sends the picture alone - no text or title for an app to keep instead', () => {
        expect(picturePayload(picture)).toEqual({ files: [picture] });
    });
});

describe('shareToSheet (v2.3.0)', () => {
    it('reports an app chosen, a closed sheet and a failure differently', async () => {
        const sent: ShareData[] = [];
        expect(await shareToSheet({ share: async d => { sent.push(d); } }, picturePayload(picture))).toBe('SHARED');
        expect(sent[0].files).toEqual([picture]);
        const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
        expect(await shareToSheet({ share: async () => { throw abort; } }, linkPayload(content))).toBe('CANCELLED');
        expect(await shareToSheet({ share: async () => { throw new Error('denied'); } }, linkPayload(content))).toBe('FAILED');
        expect(await shareToSheet({}, linkPayload(content))).toBe('FAILED');
        // A double tap: the second call finds the first sheet still up.
        const busy = Object.assign(new Error('pending'), { name: 'InvalidStateError' });
        expect(await shareToSheet({ share: async () => { throw busy; } }, linkPayload(content))).toBe('BUSY');
    });
});

describe('the clipboard (v2.3.0)', () => {
    it('copies the message and the link, and says so only when it did', async () => {
        const copied: string[] = [];
        const host: ShareHost = { clipboard: { writeText: async t => { copied.push(t); } } };
        expect(await copyToClipboard(host, content)).toBe(true);
        expect(copied).toEqual([content.clipboard]);
        expect(await copyToClipboard({ clipboard: { writeText: async () => { throw new Error('no'); } } }, content)).toBe(false);
        expect(await copyToClipboard({}, content)).toBe(false);
    });

    it('copies the picture as a PNG item, accepting the picture as a promise', async () => {
        const written: unknown[][] = [];
        const host: ShareHost = { clipboard: { write: async items => { written.push(items); } } };
        const blob = Promise.resolve({} as Blob);
        expect(await copyPicture(host, blob, FakeItem)).toBe(true);
        expect((written[0][0] as FakeItem).data['image/png']).toBe(blob);
        expect(await copyPicture(host, blob, undefined)).toBe(false);
        expect(await copyPicture({}, blob, FakeItem)).toBe(false);
    });
});

describe('quickLinks (v2.3.0)', () => {
    it('offers WhatsApp and LINE everywhere, a text message on a phone and an email on a computer', () => {
        const phone = quickLinks(content, true);
        expect(phone.map(l => l.id)).toEqual(['WHATSAPP', 'LINE', 'SMS']);
        expect(phone[0].href).toBe(`https://wa.me/?text=${encodeURIComponent(content.clipboard)}`);
        expect(phone[1].href.startsWith('https://line.me/R/share?text=')).toBe(true);
        expect(phone[2].href.startsWith('sms:?&body=')).toBe(true);
        const desk = quickLinks(content, false);
        expect(desk.map(l => l.id)).toEqual(['WHATSAPP', 'LINE', 'EMAIL']);
        expect(desk[2].href).toContain(`subject=${encodeURIComponent(content.subject)}`);
        // The whole message, link included, survives the encoding.
        expect(decodeURIComponent(desk[0].href.split('text=')[1])).toBe(content.clipboard);
    });
});

describe('pictureFileName', () => {
    it('names the file after the game and the score', () => {
        expect(pictureFileName(12345.4)).toBe('carrier-vector-1988-12345.png');
        expect(pictureFileName(-5)).toBe('carrier-vector-1988-0.png');
    });
});
