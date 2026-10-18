/**
 * Páginas HTML do login server: /cadastro, /redefinir e /conta.
 *
 * Identidade visual: as mesmas folhas de estilo e marcação das janelas do
 * cliente clássico do PS (battle.css + oldclient.css: .ps-overlay, .ps-popup,
 * .textbox, .button, .buttonbar), servidas pelo Caddy a partir do cliente.
 * Sem JavaScript, o que permite uma CSP bem restrita.
 */
import { t, type Lang, type MessageKey } from './i18n.ts';
import { escapeHTML as e } from './util.ts';
import type { User } from './accounts.ts';
import { PRIVACY, type Notice } from './privacy.ts';
import { RULES } from './rules.ts';

export interface PageMessage {
	kind: 'error' | 'success';
	key: MessageKey;
}

// Ajustes mínimos sobre o CSS do cliente (mensagens, créditos e dicas).
// Larguras da janela, dos rótulos e dos campos ficam exatamente como no cliente.
const EXTRA_STYLE = `
.ps-popup .label small { display: block; font-weight: normal; }
.ps-popup p.success { font-weight: bold; color: #228822; }
.ps-popup .credits { color: #555555; text-align: center; }
.ps-popup form.inline { display: inline; }
`;

function layout(lang: Lang, title: string, body: string): string {
	return `<!DOCTYPE html>
<html lang="${lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${e(title)} - Pokémon Showdown!</title>
<link rel="shortcut icon" href="/favicon.ico">
<link rel="stylesheet" href="/style/battle.css">
<link rel="stylesheet" href="/style/oldclient.css">
<style>${EXTRA_STYLE}</style>
</head>
<body>
<div class="ps-overlay">
<div class="ps-popup" role="main">
${body}
<p class="credits"><small>${e(t(lang, 'credits'))}
<a href="https://pokemonshowdown.com/credits">Pokémon Showdown</a> · <a href="https://www.smogon.com/">Smogon</a><br>
${e(t(lang, 'fanDisclaimer'))}</small></p>
</div>
</div>
</body>
</html>`;
}

function message(lang: Lang, msg: PageMessage | undefined): string {
	if (!msg) return '';
	return `<p class="${msg.kind}" role="${msg.kind === 'error' ? 'alert' : 'status'}">${e(t(lang, msg.key))}</p>`;
}

function field(
	name: string, label: string, type: 'text' | 'password', autocomplete: string,
	opts: { value?: string, hint?: string, maxlength?: number } = {}
): string {
	return `<p><label class="label">${e(label)}:
<input class="textbox" name="${name}" type="${type}" autocomplete="${autocomplete}" required
	${opts.maxlength ? `maxlength="${opts.maxlength}"` : ''} ${opts.value ? `value="${e(opts.value)}"` : ''}>
${opts.hint ? `<small>${e(opts.hint)}</small>` : ''}</label></p>`;
}

const playButton = (lang: Lang) => `<a class="button" href="/">${e(t(lang, 'linkPlay'))}</a>`;

function donePage(lang: Lang, title: string, msg: PageMessage | undefined): string {
	return layout(lang, title, `<h3>${e(title)}</h3>${message(lang, msg)}
<p class="buttonbar">${playButton(lang)}</p>`);
}

export function renderRegister(lang: Lang, opts: { msg?: PageMessage, invite?: string, username?: string, done?: boolean }): string {
	const title = t(lang, 'pageRegisterTitle');
	if (opts.done) return donePage(lang, title, opts.msg);
	return layout(lang, title, `<form method="post" action="/cadastro">
<h3>${e(title)}</h3>
<p>${e(t(lang, 'pageRegisterIntro'))}</p>
${message(lang, opts.msg)}
${field('invite', t(lang, 'fieldInvite'), 'text', 'off', { value: opts.invite, maxlength: 32 })}
${field('username', t(lang, 'fieldUsername'), 'text', 'username', { value: opts.username, hint: t(lang, 'hintUsername'), maxlength: 18 })}
${field('password', t(lang, 'fieldPassword'), 'password', 'new-password', { hint: t(lang, 'hintPassword'), maxlength: 128 })}
${field('confirm', t(lang, 'fieldConfirm'), 'password', 'new-password', { maxlength: 128 })}
<p class="buttonbar"><button type="submit" class="button"><strong>${e(t(lang, 'buttonRegister'))}</strong></button> ${playButton(lang)}</p>
</form>
<hr>
<p><strong>${e(t(lang, 'privacyTitle'))}</strong></p>
<p><small>${e(t(lang, 'privacyText'))} <a href="/privacidade">${e(t(lang, 'privacyLink'))}</a></small></p>`);
}

export function renderReset(lang: Lang, opts: { msg?: PageMessage, username?: string, done?: boolean }): string {
	const title = t(lang, 'pageResetTitle');
	if (opts.done) return donePage(lang, title, opts.msg);
	return layout(lang, title, `<form method="post" action="/redefinir">
<h3>${e(title)}</h3>
<p>${e(t(lang, 'pageResetIntro'))}</p>
${message(lang, opts.msg)}
${field('code', t(lang, 'fieldResetCode'), 'text', 'off', { maxlength: 32 })}
${field('username', t(lang, 'fieldUsername'), 'text', 'username', { value: opts.username, maxlength: 18 })}
${field('password', t(lang, 'fieldNewPassword'), 'password', 'new-password', { hint: t(lang, 'hintPassword'), maxlength: 128 })}
${field('confirm', t(lang, 'fieldConfirm'), 'password', 'new-password', { maxlength: 128 })}
<p class="buttonbar"><button type="submit" class="button"><strong>${e(t(lang, 'buttonReset'))}</strong></button> ${playButton(lang)}</p>
</form>`);
}

export function renderAccount(lang: Lang, opts: { user: User | null, msg?: PageMessage }): string {
	const title = t(lang, 'pageAccountTitle');
	if (!opts.user) {
		return layout(lang, title, `<h3>${e(title)}</h3>${message(lang, opts.msg)}
<p>${e(t(lang, 'accountNotLoggedIn'))}</p>
<p class="buttonbar">${playButton(lang)}</p>`);
	}
	const user = opts.user;
	return layout(lang, title, `<h3>${e(title)}</h3>
<p>${e(t(lang, 'accountLoggedInAs', { name: user.username }))}</p>
${message(lang, opts.msg)}
<p class="buttonbar">${playButton(lang)}
<form class="inline" method="post" action="/conta/sair"><button type="submit" class="button">${e(t(lang, 'buttonLogout'))}</button></form></p>
<hr>
<form method="post" action="/conta/senha">
<p><strong>${e(t(lang, 'buttonChangePassword'))}</strong></p>
<input type="text" name="username" value="${e(user.username)}" autocomplete="username" hidden>
${field('current', t(lang, 'fieldCurrentPassword'), 'password', 'current-password', { maxlength: 128 })}
${field('password', t(lang, 'fieldNewPassword'), 'password', 'new-password', { hint: t(lang, 'hintPassword'), maxlength: 128 })}
${field('confirm', t(lang, 'fieldConfirm'), 'password', 'new-password', { maxlength: 128 })}
<p class="buttonbar"><button type="submit" class="button"><strong>${e(t(lang, 'buttonChangePassword'))}</strong></button></p>
</form>
<hr>
<form method="post" action="/conta/excluir">
<p><strong>${e(t(lang, 'deleteTitle'))}</strong></p>
<p class="error">${e(t(lang, 'deleteWarning'))}</p>
${field('password', t(lang, 'fieldPassword'), 'password', 'current-password', { maxlength: 128 })}
<p><label><input type="checkbox" name="confirm" value="yes" required> ${e(t(lang, 'deleteConfirm'))}</label></p>
<p class="buttonbar"><button type="submit" class="button"><strong>${e(t(lang, 'buttonDelete'))}</strong></button></p>
</form>
<hr>
<p><strong>${e(t(lang, 'privacyTitle'))}</strong></p>
<p><small>${e(t(lang, 'privacyText'))} <a href="/privacidade">${e(t(lang, 'privacyLink'))}</a></small></p>`);
}

/** Aviso de privacidade (LGPD), em pt ou en conforme o navegador. */
export function renderPrivacy(lang: Lang, adminName: string): string {
	return renderNotice(lang, PRIVACY[lang], adminName);
}

/** Regras do servidor e dos modos de jogo, em pt ou en conforme o navegador. */
export function renderRules(lang: Lang, adminName: string): string {
	return renderNotice(lang, RULES[lang], adminName);
}

function renderNotice(lang: Lang, notice: Notice, adminName: string): string {
	const admin = `<strong>${e(adminName)}</strong>`;
	const text = (paragraph: string) => e(paragraph).split('{admin}').join(admin);
	const sections = notice.sections.map(section => `<p><strong>${e(section.title)}</strong></p>\n` +
		section.paragraphs.map(paragraph => `<p><small>${text(paragraph)}</small></p>`).join('\n')).join('\n');
	return layout(lang, notice.title, `<h3>${e(notice.title)}</h3>
${sections}
<p><small><em>${e(notice.updated)}</em></small></p>
<p class="buttonbar">${playButton(lang)}</p>`);
}
