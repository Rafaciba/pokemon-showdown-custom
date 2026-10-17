/**
 * Páginas HTML do login server: /cadastro, /redefinir e /conta.
 * Sem JavaScript: formulários simples, o que permite uma CSP bem restrita.
 */
import { t, type Lang, type MessageKey } from './i18n.ts';
import { escapeHTML as e } from './util.ts';
import type { User } from './accounts.ts';

export interface PageMessage {
	kind: 'error' | 'success';
	key: MessageKey;
}

const STYLE = `
:root { color-scheme: light dark; --bg: #f4f6fb; --card: #fff; --fg: #1d2433; --muted: #5b6475; --accent: #2f6fd0;
	--border: #d6dbe6; --error-bg: #fde8e8; --error-fg: #9b1c1c; --ok-bg: #e5f6ea; --ok-fg: #1e6b34; --danger: #c0392b; }
@media (prefers-color-scheme: dark) { :root { --bg: #11151d; --card: #1a202b; --fg: #e6e9f0; --muted: #9aa3b5;
	--accent: #6ea1ff; --border: #2c3442; --error-bg: #3a1d1d; --error-fg: #ffb4b4; --ok-bg: #173323; --ok-fg: #9fe0b0; --danger: #ff7b6b; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 440px; margin: 0 auto; padding: 32px 16px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 16px; }
h1 { font-size: 1.5rem; margin: 0 0 8px; } h2 { font-size: 1.15rem; margin: 0 0 12px; }
p { margin: 0 0 12px; } .muted { color: var(--muted); font-size: .9rem; }
label { display: block; font-weight: 600; margin: 14px 0 4px; }
input[type=text], input[type=password] { width: 100%; padding: 10px 12px; font: inherit; color: inherit;
	background: transparent; border: 1px solid var(--border); border-radius: 8px; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.check { display: flex; gap: 8px; align-items: flex-start; font-weight: 400; }
button { margin-top: 18px; width: 100%; padding: 11px; font: inherit; font-weight: 600; color: #fff; background: var(--accent);
	border: 0; border-radius: 8px; cursor: pointer; }
button.danger { background: var(--danger); } button.link { background: none; color: var(--accent); width: auto; padding: 0; margin: 0; }
.msg { padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; }
.msg.error { background: var(--error-bg); color: var(--error-fg); } .msg.success { background: var(--ok-bg); color: var(--ok-fg); }
a { color: var(--accent); } footer { text-align: center; }
`;

function layout(lang: Lang, title: string, body: string): string {
	return `<!doctype html>
<html lang="${lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
<footer class="muted">
<p><a href="/">${e(t(lang, 'linkPlay'))}</a></p>
<p>${e(t(lang, 'credits'))} <a href="https://pokemonshowdown.com/credits">Pokémon Showdown</a> · <a href="https://www.smogon.com/">Smogon</a></p>
</footer>
</main>
</body>
</html>`;
}

function message(lang: Lang, msg: PageMessage | undefined): string {
	if (!msg) return '';
	return `<p class="msg ${msg.kind}" role="${msg.kind === 'error' ? 'alert' : 'status'}">${e(t(lang, msg.key))}</p>`;
}

function field(
	name: string, label: string, type: 'text' | 'password', autocomplete: string,
	opts: { value?: string, hint?: string, maxlength?: number } = {}
): string {
	const hintId = opts.hint ? `${name}-hint` : '';
	return `<label for="${name}">${e(label)}</label>
<input id="${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" required
	${opts.maxlength ? `maxlength="${opts.maxlength}"` : ''} ${opts.value ? `value="${e(opts.value)}"` : ''}
	${hintId ? `aria-describedby="${hintId}"` : ''}>
${opts.hint ? `<p class="muted" id="${hintId}">${e(opts.hint)}</p>` : ''}`;
}

export function renderRegister(lang: Lang, opts: { msg?: PageMessage, invite?: string, username?: string, done?: boolean }): string {
	const title = t(lang, 'pageRegisterTitle');
	if (opts.done) {
		return layout(lang, title, `<div class="card"><h1>${e(title)}</h1>${message(lang, opts.msg)}
<p><a href="/">${e(t(lang, 'linkPlay'))}</a></p></div>`);
	}
	return layout(lang, title, `<div class="card">
<h1>${e(title)}</h1>
<p class="muted">${e(t(lang, 'pageRegisterIntro'))}</p>
${message(lang, opts.msg)}
<form method="post" action="/cadastro">
${field('invite', t(lang, 'fieldInvite'), 'text', 'off', { value: opts.invite, maxlength: 32 })}
${field('username', t(lang, 'fieldUsername'), 'text', 'username', { value: opts.username, hint: t(lang, 'hintUsername'), maxlength: 18 })}
${field('password', t(lang, 'fieldPassword'), 'password', 'new-password', { hint: t(lang, 'hintPassword'), maxlength: 128 })}
${field('confirm', t(lang, 'fieldConfirm'), 'password', 'new-password', { maxlength: 128 })}
<button type="submit">${e(t(lang, 'buttonRegister'))}</button>
</form>
</div>
<div class="card"><h2>${e(t(lang, 'privacyTitle'))}</h2><p class="muted">${e(t(lang, 'privacyText'))}</p></div>`);
}

export function renderReset(lang: Lang, opts: { msg?: PageMessage, username?: string, done?: boolean }): string {
	const title = t(lang, 'pageResetTitle');
	if (opts.done) {
		return layout(lang, title, `<div class="card"><h1>${e(title)}</h1>${message(lang, opts.msg)}
<p><a href="/">${e(t(lang, 'linkPlay'))}</a></p></div>`);
	}
	return layout(lang, title, `<div class="card">
<h1>${e(title)}</h1>
<p class="muted">${e(t(lang, 'pageResetIntro'))}</p>
${message(lang, opts.msg)}
<form method="post" action="/redefinir">
${field('code', t(lang, 'fieldResetCode'), 'text', 'off', { maxlength: 32 })}
${field('username', t(lang, 'fieldUsername'), 'text', 'username', { value: opts.username, maxlength: 18 })}
${field('password', t(lang, 'fieldNewPassword'), 'password', 'new-password', { hint: t(lang, 'hintPassword'), maxlength: 128 })}
${field('confirm', t(lang, 'fieldConfirm'), 'password', 'new-password', { maxlength: 128 })}
<button type="submit">${e(t(lang, 'buttonReset'))}</button>
</form>
</div>`);
}

export function renderAccount(lang: Lang, opts: { user: User | null, msg?: PageMessage }): string {
	const title = t(lang, 'pageAccountTitle');
	if (!opts.user) {
		return layout(lang, title, `<div class="card"><h1>${e(title)}</h1>${message(lang, opts.msg)}
<p>${e(t(lang, 'accountNotLoggedIn'))}</p></div>`);
	}
	const user = opts.user;
	return layout(lang, title, `<div class="card">
<h1>${e(title)}</h1>
<p>${e(t(lang, 'accountLoggedInAs', { name: user.username }))}</p>
${message(lang, opts.msg)}
<form method="post" action="/conta/sair"><button type="submit" class="link">${e(t(lang, 'buttonLogout'))}</button></form>
</div>
<div class="card">
<h2>${e(t(lang, 'buttonChangePassword'))}</h2>
<form method="post" action="/conta/senha">
<input type="text" name="username" value="${e(user.username)}" autocomplete="username" hidden>
${field('current', t(lang, 'fieldCurrentPassword'), 'password', 'current-password', { maxlength: 128 })}
${field('password', t(lang, 'fieldNewPassword'), 'password', 'new-password', { hint: t(lang, 'hintPassword'), maxlength: 128 })}
${field('confirm', t(lang, 'fieldConfirm'), 'password', 'new-password', { maxlength: 128 })}
<button type="submit">${e(t(lang, 'buttonChangePassword'))}</button>
</form>
</div>
<div class="card">
<h2>${e(t(lang, 'deleteTitle'))}</h2>
<p class="msg error">${e(t(lang, 'deleteWarning'))}</p>
<form method="post" action="/conta/excluir">
${field('password', t(lang, 'fieldPassword'), 'password', 'current-password', { maxlength: 128 })}
<label class="check"><input type="checkbox" name="confirm" value="yes" required> ${e(t(lang, 'deleteConfirm'))}</label>
<button type="submit" class="danger">${e(t(lang, 'buttonDelete'))}</button>
</form>
</div>
<div class="card"><h2>${e(t(lang, 'privacyTitle'))}</h2><p class="muted">${e(t(lang, 'privacyText'))}</p></div>`);
}
