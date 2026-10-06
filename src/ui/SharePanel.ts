/**
 * CARRIER VECTOR: 1988 - The share panel (v2.3.0)
 *
 * Opened by SHARE on the debrief. Plain DOM (index.html #share) on purpose:
 * the pilot's name needs a real text field - a phone keyboard, any script,
 * the platform's own editing - and the share sheet, the clipboard and the
 * download each need a real button press of their own.
 *
 * Two shares, never one (see core/Share.ts): the challenge - the message
 * with the link - and the picture. Where the browser has no share sheet,
 * WhatsApp, LINE and a text message or an email take the challenge.
 *
 * The picture is drawn and encoded the moment the panel opens (and again a
 * beat after the name changes), so a button press opens the sheet inside
 * that press; a tap's permission to open it does not survive long.
 */

import type { GameLoop } from '../core/GameLoop';
import {
    copyPicture, copyToClipboard, linkPayload, pictureFileName, picturePayload, quickLinks, shareSupport, shareToSheet
} from '../core/Share';
import type { ShareHost, ShareOutcome } from '../core/Share';
import { textSizeSpec } from '../renderer/Theme';

export interface SharePanelHandle {
    isOpen(): boolean;
    close(): void;
}

export function setupSharePanel(game: GameLoop, canvas: HTMLCanvasElement): SharePanelHandle | null {
    const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
    const root = $('share');
    const picture = $<HTMLImageElement>('share-picture');
    const name = $<HTMLInputElement>('share-name');
    const send = $<HTMLButtonElement>('share-send');
    const sendPicture = $<HTMLButtonElement>('share-picture-send');
    const apps = $('share-apps');
    const appsLabel = $('share-apps-label');
    const copy = $<HTMLButtonElement>('share-copy');
    const copyPic = $<HTMLButtonElement>('share-copy-picture');
    const save = $<HTMLButtonElement>('share-save');
    const close = $<HTMLButtonElement>('share-close');
    const status = $('share-status');
    const message = $('share-message');
    if (!root || !picture || !name || !send || !sendPicture || !apps || !appsLabel || !copy || !copyPic || !save || !close || !status || !message) {
        return null;
    }

    const host = navigator as ShareHost;
    const touch = () => game.controlScheme === 'TOUCH';
    const offscreen = document.createElement('canvas');
    let file: File | null = null;
    let blob: Blob | null = null;
    let objectUrl: string | null = null;
    let version = 0;
    let nameTimer: number | undefined;
    let openedAt = 0;

    const say = (text: string) => { status.textContent = text; };

    /** The words, the buttons and the quick links, for the current name. */
    const refreshText = () => {
        const share = game.currentShare();
        if (!share) return;
        message.textContent = share.clipboard;
        const can = shareSupport(host, file);
        send.textContent = share.action;
        send.hidden = !can.sheet;
        sendPicture.hidden = !can.files;
        copy.hidden = !can.copy;
        copy.classList.toggle('share-primary', !can.sheet);
        // On a computer, a picture pasted into a chat is the easy way.
        copyPic.hidden = !can.copyPicture || can.files || touch();
        apps.hidden = can.sheet;
        appsLabel.hidden = can.sheet;
        apps.replaceChildren(...(can.sheet ? [] : quickLinks(share, touch()).map(link => {
            const a = document.createElement('a');
            a.href = link.href;
            a.textContent = link.label;
            a.target = '_blank';
            a.rel = 'noopener';
            a.addEventListener('click', () => {
                game.noteShareResult('SHARED');
                say(`Opening ${link.label.toLowerCase()} - send it from there.`);
            });
            return a;
        })));
    };

    /** Draw and encode the picture for the current name. */
    const refreshPicture = () => {
        const share = game.currentShare();
        if (!share || !game.drawSharePicture(offscreen)) return;
        const mine = ++version;
        picture.alt = `Your result card: ${share.picture.score.toLocaleString('en-US')} points, ${share.picture.stats.toLowerCase()}.`;
        offscreen.toBlob(png => {
            if (!png || mine !== version) return;
            blob = png;
            file = new File([png], pictureFileName(share.picture.score), { type: 'image/png' });
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = URL.createObjectURL(png);
            picture.src = objectUrl;
            refreshText();
        }, 'image/png');
    };

    const refresh = () => {
        refreshText();
        refreshPicture();
    };

    const open = () => {
        root.style.setProperty('--share-scale', String(Math.min(1.35, textSizeSpec(game.textSize).scale)));
        name.value = game.pilotName ?? '';
        openedAt = performance.now();
        file = null;
        blob = null;
        say('');
        root.hidden = false;
        refresh();
        (send.hidden ? (apps.querySelector('a') ?? copy) : send).focus();
    };

    const hide = () => {
        if (root.hidden) return;
        root.hidden = true;
        window.clearTimeout(nameTimer);
        canvas.focus();
    };

    const report = (outcome: ShareOutcome, thanks: string) => {
        if (outcome === 'SHARED') {
            // The browser only knows an app was chosen, never that a message
            // went - so thanks, not "sent".
            game.noteShareResult('SHARED');
            say(thanks);
        } else if (outcome === 'FAILED') {
            say('That did not work here. Try COPY MESSAGE.');
        }
    };

    send.addEventListener('click', () => {
        const share = game.currentShare();
        if (!share) return;
        // No await before this call: it must open inside the tap.
        void shareToSheet(host, linkPayload(share)).then(o => report(o, 'Thank you for sharing!'));
    });
    sendPicture.addEventListener('click', () => {
        if (!file) return;
        void shareToSheet(host, picturePayload(file)).then(o => report(o, 'Picture shared. The link goes with the button above.'));
    });
    copy.addEventListener('click', async () => {
        const share = game.currentShare();
        if (!share) return;
        if (await copyToClipboard(host, share)) {
            game.noteShareResult('COPIED');
            say('Copied. Paste it into a chat or an email.');
        } else {
            say('Could not copy here. The message is below - select it and copy.');
        }
    });
    copyPic.addEventListener('click', () => {
        if (!blob) return;
        void copyPicture(host, blob).then(ok => say(ok ? 'Picture copied. Paste it into a chat.' : 'Could not copy the picture here. Try SAVE PICTURE.'));
    });
    save.addEventListener('click', () => {
        const share = game.currentShare();
        if (!share || !objectUrl) return;
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = pictureFileName(share.picture.score);
        document.body.appendChild(a);
        a.click();
        a.remove();
        say('Picture saved. Post it anywhere - the link is in the message below.');
    });
    close.addEventListener('click', hide);

    name.addEventListener('input', () => {
        window.clearTimeout(nameTimer);
        nameTimer = window.setTimeout(() => {
            game.setPilotName(name.value);
            refresh();
        }, 250);
    });
    name.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            window.clearTimeout(nameTimer);
            game.setPilotName(name.value);
            refresh();
            (send.hidden ? copy : send).focus();
        }
    });
    // Keys typed here are the pilot's, not the game's: "Mike" must not mute
    // the sound (M) or switch the controls (K), and ESC must close the panel
    // without also leaving the debrief.
    root.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            hide();
        }
    });
    root.addEventListener('keyup', e => e.stopPropagation());
    // The tap that opened the panel was a pointerdown on the canvas; a phone
    // then sends that same tap's click to whatever is under the finger now -
    // which is this panel (it closed itself on CLOSE in the first build).
    // Clicks in the first moment after opening are that ghost, not a choice.
    root.addEventListener('click', e => {
        if (performance.now() - openedAt < 500) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);
    // A tap on the dimmed backdrop, outside the panel, closes it.
    root.addEventListener('pointerdown', e => {
        if (e.target === root) hide();
    });

    game.onShareRequest = open;
    return { isOpen: () => !root.hidden, close: hide };
}
