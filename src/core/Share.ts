/**
 * CARRIER VECTOR: 1988 - Getting a share out of the browser (v2.3.0)
 *
 * The challenge and the picture travel SEPARATELY. A single share holding a
 * picture, a message and a link reaches each chat app as separate items, and
 * the app keeps what it likes: WhatsApp on an iPhone keeps the text and
 * drops the picture; Facebook and Messenger on Android keep the picture and
 * drop the text - the link with it (see docs/reviews/v2.3.0). So:
 *
 *   - CHALLENGE A FRIEND sends the message with the link on its last line,
 *     as plain text. Not as `url`: some iPhone apps have been seen cutting
 *     the query string - the run itself - off a share's url field. As text,
 *     every app keeps it and builds its own preview card from the link;
 *   - SEND THE PICTURE sends the picture alone, no text and no title; the
 *     score, the name and the address are drawn on it;
 *   - with no share sheet at all (Facebook's and Messenger's in-app browser
 *     on Android, Firefox on a desktop, Chrome on Linux), the panel offers
 *     WhatsApp, LINE, a text message or an email, and the clipboard.
 *
 * Every call that opens a sheet or writes the clipboard must run inside the
 * tap that asked for it (a tap's permission lasts about five seconds and the
 * sheet spends it), so the picture is made before the panel's buttons are
 * pressed, never in response to them.
 *
 * Browser APIs come in through `ShareHost`, so the decisions are testable
 * with plain objects.
 */

import type { ShareContent } from './ShareCard';

export type ShareOutcome = 'SHARED' | 'CANCELLED' | 'FAILED';

/** The slice of `navigator` this module uses. */
export interface ShareHost {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
    clipboard?: {
        writeText?: (text: string) => Promise<void>;
        write?: (items: ClipboardItem[]) => Promise<void>;
    };
}

export interface ShareSupport {
    /** The system share sheet exists (it takes text). */
    sheet: boolean;
    /** ...and takes the picture as a file. */
    files: boolean;
    /** The clipboard takes text. */
    copy: boolean;
    /** The clipboard takes a picture. */
    copyPicture: boolean;
}

export function shareSupport(
    host: ShareHost | undefined,
    picture: File | null,
    clipboardItem: unknown = (globalThis as { ClipboardItem?: unknown }).ClipboardItem
): ShareSupport {
    const sheet = typeof host?.share === 'function';
    let files = false;
    if (sheet && picture && typeof host?.canShare === 'function') {
        try {
            files = host.canShare({ files: [picture] });
        } catch {
            files = false;
        }
    }
    return {
        sheet,
        files,
        copy: typeof host?.clipboard?.writeText === 'function',
        copyPicture: typeof host?.clipboard?.write === 'function' && typeof clipboardItem === 'function'
    };
}

/** The challenge: the message, with the link alone on its last line. */
export function linkPayload(content: ShareContent): ShareData {
    return { text: content.clipboard };
}

/** The picture alone: no text and no title, which some apps would keep instead. */
export function picturePayload(picture: File): ShareData {
    return { files: [picture] };
}

/**
 * Open the system share sheet. Call only from inside a tap or a key press.
 * SHARED means an app was chosen - not that a message went: the browser is
 * never told that, so nothing here may claim it.
 */
export async function shareToSheet(host: ShareHost, data: ShareData): Promise<ShareOutcome> {
    if (typeof host.share !== 'function') return 'FAILED';
    try {
        await host.share(data);
        return 'SHARED';
    } catch (error) {
        // Closing the sheet is a choice, not a failure: say nothing.
        return (error as { name?: string } | null)?.name === 'AbortError' ? 'CANCELLED' : 'FAILED';
    }
}

/** Put the message and the link on the clipboard. */
export async function copyToClipboard(host: ShareHost, content: ShareContent): Promise<boolean> {
    const write = host.clipboard?.writeText;
    if (typeof write !== 'function') return false;
    try {
        await write.call(host.clipboard, content.clipboard);
        return true;
    } catch {
        return false;
    }
}

/**
 * Put the picture on the clipboard. The write must start inside the click -
 * Safari refuses it after any await - so the picture may arrive as a promise.
 */
export async function copyPicture(
    host: ShareHost,
    picture: Blob | Promise<Blob>,
    Item: unknown = (globalThis as { ClipboardItem?: unknown }).ClipboardItem
): Promise<boolean> {
    const write = host.clipboard?.write;
    if (typeof write !== 'function' || typeof Item !== 'function') return false;
    try {
        const item = new (Item as typeof ClipboardItem)({ 'image/png': picture });
        await write.call(host.clipboard, [item]);
        return true;
    } catch {
        return false;
    }
}

export interface QuickLink {
    id: 'WHATSAPP' | 'LINE' | 'SMS' | 'EMAIL';
    label: string;
    href: string;
}

/**
 * Where there is no share sheet: the apps people actually send these with,
 * through their public share links. A text message on a phone; an email on a
 * computer - the two ways an older pilot is most likely to send anything.
 */
export function quickLinks(content: ShareContent, touch: boolean): QuickLink[] {
    const body = encodeURIComponent(content.clipboard);
    const links: QuickLink[] = [
        { id: 'WHATSAPP', label: 'WHATSAPP', href: `https://wa.me/?text=${body}` },
        { id: 'LINE', label: 'LINE', href: `https://line.me/R/share?text=${body}` }
    ];
    links.push(touch
        ? { id: 'SMS', label: 'TEXT MESSAGE', href: `sms:?&body=${body}` }
        : { id: 'EMAIL', label: 'EMAIL', href: `mailto:?subject=${encodeURIComponent(content.subject)}&body=${body}` });
    return links;
}

/** A file name that says what it is: "carrier-vector-1988-12345.png". */
export function pictureFileName(score: number): string {
    return `carrier-vector-1988-${Math.max(0, Math.round(score))}.png`;
}
