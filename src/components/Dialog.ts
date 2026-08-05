// Promise-based in-DOM replacements for window.alert/confirm/prompt.
// Some WebView browsers (e.g. iOS Web MIDI browser apps) don't implement the
// native dialogs at all — they silently return without showing anything.

interface DialogOptions {
    message: string;
    title?: string;
    okText?: string;
    /** null = no cancel button (alert-style dialog) */
    cancelText?: string | null;
    input?: { value?: string; placeholder?: string };
}

function openDialog(opts: DialogOptions): Promise<{ ok: boolean; value: string }> {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);' +
            'z-index:99999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText =
            'width:360px;max-width:90%;padding:20px;display:flex;flex-direction:column;gap:14px;border:1px solid var(--border);';

        if (opts.title) {
            const h = document.createElement('h3');
            h.textContent = opts.title;
            h.style.cssText = 'margin:0;font-size:16px;color:var(--text);';
            card.appendChild(h);
        }

        const msg = document.createElement('div');
        msg.textContent = opts.message;
        msg.style.cssText = 'font-size:14px;color:var(--text-muted);line-height:1.5;white-space:pre-wrap;';
        card.appendChild(msg);

        let inputEl: HTMLInputElement | null = null;
        if (opts.input) {
            inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.value = opts.input.value ?? '';
            inputEl.placeholder = opts.input.placeholder ?? '';
            inputEl.style.cssText =
                'padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--cream);font-size:14px;width:100%;box-sizing:border-box;';
            card.appendChild(inputEl);
        }

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(false);
            else if (e.key === 'Enter') close(true);
        };

        const close = (ok: boolean) => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve({ ok, value: inputEl?.value ?? '' });
        };

        if (opts.cancelText !== null) {
            const btnCancel = document.createElement('button');
            btnCancel.className = 'pmBtn secondary';
            btnCancel.textContent = opts.cancelText ?? 'Cancel';
            btnCancel.onclick = () => close(false);
            row.appendChild(btnCancel);
        }

        const btnOk = document.createElement('button');
        btnOk.className = 'pmBtn primary';
        btnOk.textContent = opts.okText ?? 'OK';
        btnOk.onclick = () => close(true);
        row.appendChild(btnOk);

        card.appendChild(row);
        overlay.appendChild(card);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        (inputEl ?? btnOk).focus();
    });
}

export async function showAlert(message: string, title?: string): Promise<void> {
    await openDialog({ message, title, cancelText: null });
}

export async function showConfirm(message: string, title?: string, okText?: string, cancelText?: string): Promise<boolean> {
    return (await openDialog({ message, title, okText, cancelText })).ok;
}

export async function showPrompt(message: string, defaultValue = '', title?: string): Promise<string | null> {
    const res = await openDialog({ message, title, input: { value: defaultValue } });
    return res.ok ? res.value : null;
}
