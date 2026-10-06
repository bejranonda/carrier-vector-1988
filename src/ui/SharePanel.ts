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
 * that press; a tap's permission to open it does not survive long. Until
 * the picture for this run and this name is ready, its buttons wait: the
 * first build could save the LAST run's picture under this run's score.
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
    /** A key that reached the page from outside the open panel (main.ts). */
    strayKey(e: KeyboardEvent): void;
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
    // Whether the sheet takes a picture depends on its type, not its bytes:
    // asking with an empty PNG keeps the buttons from jumping about while
    // the real one is still being encoded.
    let probe: File | null = null;
    try {
        probe = new File([], 'picture.png', { type: 'image/png' });
    } catch {
        probe = null;
    }
    let file: File | null = null;
    let blob: Blob | null = null;
    let objectUrl: string | null = null;
    /** The picture on show is the one for this run and this name. */
    let ready = false;
    let version = 0;
    let nameTimer: number | undefined;
    let openedAt = 0;
    // The picture is offered after the challenge has gone (or the sheet was
    // closed): offered side by side, the picture invites the first press -
    // and a picture alone carries no link (v2.3.0 UX review).
    let pictureOffered = false;
    // The sheet refused the challenge: the download and the clipboard stay.
    let sheetFailed = false;
    let appsKey = '';

    const say = (text: string) => { status.textContent = text; };
    const support = () => shareSupport(host, file ?? probe);

    /** The words, the buttons and the quick links, for the current name. */
    const refreshText = () => {
        const share = game.currentShare();
        if (!share) return;
        message.textContent = share.clipboard;
        const can = support();
        send.textContent = share.action;
        send.hidden = !can.sheet;
        sendPicture.hidden = !can.files || !pictureOffered;
        // On a phone the share sheet saves to Photos ("Save Image"); a
        // download lands in Files, where nobody looks for a picture.
        sendPicture.textContent = touch() ? 'ALSO SEND OR SAVE THE PICTURE' : 'ALSO SEND THE PICTURE';
        save.hidden = can.files && touch() && !sheetFailed;
        copy.hidden = !can.copy;
        copy.classList.toggle('share-primary', !can.sheet);
        // On a computer, a picture pasted into a chat is the easy way.
        copyPic.hidden = !can.copyPicture || can.files || touch();
        for (const b of [sendPicture, save, copyPic]) b.disabled = !ready;
        apps.hidden = can.sheet;
        appsLabel.hidden = can.sheet;
        const links = can.sheet ? [] : quickLinks(share, touch());
        const key = links.map(l => l.id).join(' ');
        if (key !== appsKey) {
            // Rebuilt only when the set of apps changes: rebuilding on every
            // refresh dropped the keyboard focus, and could swap a link out
            // from under the tap that was following it.
            appsKey = key;
            apps.replaceChildren(...links.map(link => {
                const a = document.createElement('a');
                a.target = '_blank';
                a.rel = 'noopener';
                a.addEventListener('click', () => {
                    // A name typed a moment ago goes on this link too: the
                    // refresh updates this same element before it navigates.
                    flushName();
                    game.noteShareResult('SHARED');
                    const app = { WHATSAPP: 'WhatsApp', LINE: 'LINE', SMS: 'your messages', EMAIL: 'your email' }[link.id];
                    say(`Opening ${app} - send it from there.`);
                });
                return a;
            }));
        }
        links.forEach((link, i) => {
            const a = apps.children[i] as HTMLAnchorElement | undefined;
            if (!a) return;
            a.href = link.href;
            a.textContent = link.label;
        });
    };

    /** Draw and encode the picture for the current name. */
    const refreshPicture = () => {
        const share = game.currentShare();
        if (!share || !game.drawSharePicture(offscreen)) return;
        const mine = ++version;
        ready = false;
        offscreen.toBlob(png => {
            if (mine !== version) return;
            if (!png) {
                say('The picture could not be made here - the message still works.');
                return;
            }
            blob = png;
            file = new File([png], pictureFileName(share.picture.score), { type: 'image/png' });
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = URL.createObjectURL(png);
            picture.src = objectUrl;
            picture.alt = `Your picture to share - ${share.picture.headline.toLowerCase()} - `
                + `${share.picture.score.toLocaleString('en-US')} points.`;
            ready = true;
            refreshText();
        }, 'image/png');
    };

    const refresh = () => {
        refreshPicture();
        refreshText();
    };

    /** Apply a name still waiting out its typing pause. True if it changed anything. */
    const flushName = (): boolean => {
        if (nameTimer === undefined) return false;
        window.clearTimeout(nameTimer);
        nameTimer = undefined;
        game.setPilotName(name.value);
        refresh();
        return true;
    };

    const focusPrimary = () => {
        const first = apps.querySelector<HTMLElement>('a');
        (!send.hidden ? send : first ?? (!copy.hidden ? copy : close)).focus();
    };

    const open = () => {
        root.style.setProperty('--share-scale', String(Math.min(1.35, textSizeSpec(game.textSize).scale)));
        name.value = game.pilotName ?? '';
        openedAt = performance.now();
        pictureOffered = false;
        sheetFailed = false;
        // Nothing of the last run's picture survives into this one.
        version++;
        file = null;
        blob = null;
        ready = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        picture.removeAttribute('src');
        picture.alt = '';
        say('');
        root.hidden = false;
        refresh();
        focusPrimary();
        // A mouse press that opened the panel ends by focusing the canvas
        // under it (the canvas takes focus): take it back once that is done.
        window.setTimeout(() => {
            if (!root.hidden && !root.contains(document.activeElement)) focusPrimary();
        }, 0);
    };

    const hide = () => {
        if (root.hidden) return;
        // A name typed just before closing is still kept.
        flushName();
        root.hidden = true;
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
        flushName();
        const share = game.currentShare();
        if (!share) return;
        // No await before this call: it must open inside the tap.
        void shareToSheet(host, linkPayload(share)).then(o => {
            // A double tap's second press: the first sheet answers for both.
            if (o === 'BUSY') return;
            if (o === 'FAILED') sheetFailed = true;
            // Offered after a failure too: the picture must never become
            // unreachable on a phone, where SAVE is otherwise hidden.
            pictureOffered = true;
            report(o, support().files ? 'Thank you for sharing! You can send the picture too.' : 'Thank you for sharing!');
            refreshText();
        });
    });
    /** Hold a picture button until this run's picture, with this name, is ready. */
    const pictureWait = () => {
        flushName();
        if (ready) return false;
        say('One moment - the picture is still being drawn.');
        return true;
    };
    sendPicture.addEventListener('click', () => {
        if (pictureWait() || !file) return;
        void shareToSheet(host, picturePayload(file)).then(o => {
            if (o !== 'BUSY') report(o, 'Thank you!');
        });
    });
    copy.addEventListener('click', async () => {
        flushName();
        const share = game.currentShare();
        if (!share) return;
        if (await copyToClipboard(host, share)) {
            game.noteShareResult('COPIED');
            say('Copied. Paste it into a chat or an email.');
        } else {
            say('Could not copy here. Try another button.');
        }
    });
    copyPic.addEventListener('click', () => {
        if (pictureWait() || !blob) return;
        void copyPicture(host, blob).then(ok => say(ok ? 'Picture copied. Paste it into a chat.' : 'Could not copy the picture here. Try SAVE PICTURE.'));
    });
    save.addEventListener('click', () => {
        if (pictureWait()) return;
        const share = game.currentShare();
        if (!share || !objectUrl) return;
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = pictureFileName(share.picture.score);
        document.body.appendChild(a);
        a.click();
        a.remove();
        say(touch() ? 'Picture saved.' : 'Picture saved to your downloads.');
    });
    close.addEventListener('click', hide);

    name.addEventListener('input', () => {
        window.clearTimeout(nameTimer);
        nameTimer = window.setTimeout(() => {
            nameTimer = undefined;
            game.setPilotName(name.value);
            refresh();
        }, 250);
    });
    name.addEventListener('change', () => { flushName(); });
    name.addEventListener('keydown', e => {
        // ENTER that confirms a Japanese or Chinese conversion is part of
        // typing the name, not "done".
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            flushName();
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
    return {
        isOpen: () => !root.hidden,
        close: hide,
        strayKey: e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                hide();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                focusPrimary();
            }
        }
    };
}
