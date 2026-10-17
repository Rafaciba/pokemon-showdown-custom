/**
 * Testes de integração do login server (node:test, sem dependências).
 * Rodar: docker compose run --rm --no-deps login npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createVerify } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { openDatabase, type Database } from '../src/db.ts';
import { ensureKeyPair } from '../src/keys.ts';
import type { LoginConfig } from '../src/config.ts';

const HOST = 'ps.test';
const ORIGIN = `https://${HOST}`;
const TOKEN = 'token-de-teste';
const CHALLENGE = 'abc123def456';
const CHALLSTR = `1|${CHALLENGE}`;

let server: Server;
let base = '';
let db: Database;
let tmp = '';
let publicPem = '';

before(async () => {
	tmp = mkdtempSync(join(tmpdir(), 'login-test-'));
	const config: LoginConfig = {
		port: 0, privateKeyDir: join(tmp, 'private'), sharedDir: join(tmp, 'shared'), databasePath: ':memory:',
		keyId: 1, serverHost: HOST, publicOrigin: ORIGIN, cookieSecure: true,
	};
	db = openDatabase(':memory:');
	const privateKey = ensureKeyPair(config.privateKeyDir, config.sharedDir);
	publicPem = readFileSync(join(config.sharedDir, 'public.pem'), 'utf8');
	const handle = createApp({
		db, config, assertion: { privateKey, keyId: 1, serverHost: HOST }, internalToken: TOKEN,
		// Todas as requisições do teste vêm do mesmo IP
		limits: { requestsPerMinute: 10_000, formsPerMinute: 10_000 },
	});
	server = createServer((req, res) => void handle(req, res));
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (typeof address !== 'object' || !address) throw new Error('sem endereço');
	base = `http://127.0.0.1:${address.port}`;
});

after(() => {
	server.close();
	db.close();
	rmSync(tmp, { recursive: true, force: true });
});

// --- auxiliares -----------------------------------------------------------

interface Reply { status: number, text: string, cookie: string | null, json: any }

async function post(path: string, form: Record<string, string>, opts: { cookie?: string, origin?: string | null } = {}): Promise<Reply> {
	const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Language': 'pt-BR' };
	if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
	if (opts.cookie) headers.Cookie = opts.cookie;
	const res = await fetch(base + path, { method: 'POST', headers, body: new URLSearchParams(form) });
	const text = await res.text();
	const setCookie = res.headers.get('set-cookie');
	let json: any = null;
	if (text.startsWith(']')) json = JSON.parse(text.slice(1));
	return { status: res.status, text, cookie: setCookie, json };
}

const action = (act: string, form: Record<string, string> = {}, cookie?: string) =>
	post('/~~custom/action.php', { act, ...form }, { cookie });

async function internal(path: string, body: unknown, token = TOKEN) {
	const res = await fetch(base + path, {
		method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
	});
	return { status: res.status, json: await res.json().catch(() => null) as any };
}

/** Extrai "ps_session=..." de um Set-Cookie. */
const sessionOf = (setCookie: string | null) => setCookie?.split(';')[0] ?? '';

function verifyAssertion(assertion: string, userid: string, userType: string) {
	const [data, signature] = assertion.split(';');
	const [challenge, signedUserid, signedType, , host] = data.split(',');
	assert.equal(challenge, CHALLENGE);
	assert.equal(signedUserid, userid);
	assert.equal(signedType, userType);
	assert.equal(host, HOST);
	const verifier = createVerify('RSA-SHA256');
	verifier.update(data);
	assert.ok(verifier.verify(publicPem, signature, 'hex'), 'assinatura RSA deve ser válida');
}

async function newInvite(username?: string): Promise<string> {
	const res = await internal('/internal/invite', username ? { username } : {});
	assert.equal(res.status, 200);
	return res.json.code;
}

async function registerUser(name: string, password = 'senha-forte-1') {
	const invite = await newInvite();
	const res = await post('/cadastro', { invite, username: name, password, confirm: password });
	assert.equal(res.status, 200);
	assert.match(res.text, /Conta criada/);
	return sessionOf(res.cookie);
}

// --- testes ---------------------------------------------------------------

test('nome sem conta não recebe assertion (servidor exige conta)', async () => {
	const res = await action('getassertion', { userid: 'ninguem', challstr: CHALLSTR });
	assert.match(res.text, /^;;.*\/cadastro/);
});

test('cadastro com convite cria conta, sessão e cookie seguro', async () => {
	const invite = await newInvite();
	const res = await post('/cadastro', { invite, username: 'Ash Ketchum', password: 'pikachu123', confirm: 'pikachu123' });
	assert.match(res.text, /Conta criada/);
	assert.ok(res.cookie);
	for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000']) assert.ok(res.cookie.includes(flag), flag);

	const upkeep = await action('upkeep', { challstr: CHALLSTR }, sessionOf(res.cookie));
	assert.equal(upkeep.json.loggedin, true);
	assert.equal(upkeep.json.username, 'Ash Ketchum');
	verifyAssertion(upkeep.json.assertion, 'ashketchum', '2');

	// Com a sessão, getassertion do próprio nome é assinada como registrado
	const own = await action('getassertion', { userid: 'ashketchum', challstr: CHALLSTR }, sessionOf(res.cookie));
	verifyAssertion(own.text, 'ashketchum', '2');
});

test('convite é de uso único e nome não pode repetir', async () => {
	const invite = await newInvite();
	const first = await post('/cadastro', { invite, username: 'Misty', password: 'agua-forte', confirm: 'agua-forte' });
	assert.match(first.text, /Conta criada/);
	const reuse = await post('/cadastro', { invite, username: 'Misty2', password: 'agua-forte', confirm: 'agua-forte' });
	assert.match(reuse.text, /inválido, já usado ou expirado/);
	const dup = await post('/cadastro', { invite: await newInvite(), username: 'misty', password: 'agua-forte', confirm: 'agua-forte' });
	assert.match(dup.text, /já está em uso/);
});

test('convite reservado só serve para o nome indicado', async () => {
	const invite = await newInvite('Brock');
	const wrong = await post('/cadastro', { invite, username: 'Gary', password: 'pedra-dura1', confirm: 'pedra-dura1' });
	assert.match(wrong.text, /outro nome de usuário/);
	const right = await post('/cadastro', { invite, username: 'Brock', password: 'pedra-dura1', confirm: 'pedra-dura1' });
	assert.match(right.text, /Conta criada/);
});

test('política de senha e nomes reservados', async () => {
	const invite = await newInvite();
	const short = await post('/cadastro', { invite, username: 'Oak', password: 'curta', confirm: 'curta' });
	assert.match(short.text, /pelo menos 8/);
	const mismatch = await post('/cadastro', { invite, username: 'Oak', password: 'senha-longa', confirm: 'outra-senha' });
	assert.match(mismatch.text, /não conferem/);
	const same = await post('/cadastro', { invite, username: 'Professor Oak', password: 'professoroak', confirm: 'professoroak' });
	assert.match(same.text, /igual ao nome/);
	const guest = await post('/cadastro', { invite, username: 'Guest 123', password: 'senha-longa', confirm: 'senha-longa' });
	assert.match(guest.text, /reservado/);
	const pipe = await post('/cadastro', { invite, username: 'a|b', password: 'senha-longa', confirm: 'senha-longa' });
	assert.match(pipe.text, /não pode conter/);
});

test('login pelo cliente: conta sem sessão pede senha; senha certa devolve assertion', async () => {
	await registerUser('Dawn', 'piplup-azul');
	const ask = await action('getassertion', { userid: 'dawn', challstr: CHALLSTR });
	assert.equal(ask.text, ';');

	const wrong = await action('login', { name: 'Dawn', pass: 'errada!!', challstr: CHALLSTR });
	assert.equal(wrong.json.actionsuccess, false);
	assert.match(wrong.json.error, /incorretos/);

	const ok = await action('login', { name: 'Dawn', pass: 'piplup-azul', challstr: CHALLSTR });
	assert.equal(ok.json.actionsuccess, true);
	assert.deepEqual(ok.json.curuser, { loggedin: true, username: 'Dawn', userid: 'dawn' });
	verifyAssertion(ok.json.assertion, 'dawn', '2');
	assert.ok(ok.cookie?.includes('HttpOnly'));

	const logout = await action('logout', { userid: 'dawn' }, sessionOf(ok.cookie));
	assert.equal(logout.json.actionsuccess, true);
	const after = await action('upkeep', { challstr: CHALLSTR }, sessionOf(ok.cookie));
	assert.equal(after.json.loggedin, false);
});

test('POST de outra origem é recusado (CSRF)', async () => {
	const res = await post('/~~custom/action.php', { act: 'upkeep' }, { origin: 'https://site-malicioso.example' });
	assert.equal(res.status, 403);
	const page = await post('/conta/excluir', { password: 'x', confirm: 'yes' }, { origin: 'null' });
	assert.equal(page.status, 403);
});

test('API interna exige token', async () => {
	assert.equal((await internal('/internal/invite', {}, 'token-errado')).status, 401);
	const reset = await internal('/internal/reset', { username: 'naoexiste' });
	assert.equal(reset.status, 404);
	const res = await internal('/internal/invite', {});
	assert.match(res.json.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	assert.ok(res.json.url.startsWith(`https://${HOST}/cadastro?convite=`));
});

test('troca de senha encerra as outras sessões', async () => {
	const sessionA = await registerUser('Serena', 'fennekin-01');
	const login = await action('login', { name: 'Serena', pass: 'fennekin-01', challstr: CHALLSTR });
	const sessionB = sessionOf(login.cookie);

	const change = await action('changepassword', { oldpassword: 'fennekin-01', password: 'braixen-02', cpassword: 'braixen-02' }, sessionA);
	assert.equal(change.json.actionsuccess, true);
	assert.equal((await action('upkeep', {}, sessionA)).json.loggedin, true);
	assert.equal((await action('upkeep', {}, sessionB)).json.loggedin, false);
	const relogin = await action('login', { name: 'Serena', pass: 'braixen-02', challstr: CHALLSTR });
	assert.equal(relogin.json.actionsuccess, true);
});

test('redefinição por código do admin', async () => {
	const session = await registerUser('Iris', 'axew-dragao');
	const { json } = await internal('/internal/reset', { username: 'Iris' });
	const wrongUser = await post('/redefinir', { code: json.code, username: 'Dawn', password: 'nova-senha-1', confirm: 'nova-senha-1' });
	assert.match(wrongUser.text, /inválido/);
	const ok = await post('/redefinir', { code: json.code, username: 'Iris', password: 'nova-senha-1', confirm: 'nova-senha-1' });
	assert.match(ok.text, /Senha redefinida/);
	assert.equal((await action('upkeep', {}, session)).json.loggedin, false, 'sessão antiga encerrada');
	const reuse = await post('/redefinir', { code: json.code, username: 'Iris', password: 'outra-senha-2', confirm: 'outra-senha-2' });
	assert.match(reuse.text, /inválido/);
	assert.equal((await action('login', { name: 'Iris', pass: 'nova-senha-1', challstr: CHALLSTR })).json.actionsuccess, true);
});

test('exclusão de conta exige confirmação e senha, e apaga tudo', async () => {
	const session = await registerUser('Cilan', 'pansage-verde');
	const page = await fetch(`${base}/conta`, { headers: { Cookie: session, 'Accept-Language': 'pt-BR' } }).then(r => r.text());
	assert.match(page, /inclusive times salvos, conquistas e insígnias/);

	const noConfirm = await post('/conta/excluir', { password: 'pansage-verde' }, { cookie: session });
	assert.match(noConfirm.text, /Marque a confirmação/);
	const wrong = await post('/conta/excluir', { password: 'errada-123', confirm: 'yes' }, { cookie: session });
	assert.match(wrong.text, /incorretos/);
	const ok = await post('/conta/excluir', { password: 'pansage-verde', confirm: 'yes' }, { cookie: session });
	assert.match(ok.text, /foram excluídos/);

	assert.equal((await action('upkeep', {}, session)).json.loggedin, false);
	assert.match((await action('getassertion', { userid: 'cilan', challstr: CHALLSTR })).text, /^;;/);
	const left = db.prepare('SELECT (SELECT COUNT(*) FROM users WHERE userid = ?) + (SELECT COUNT(*) FROM sessions WHERE userid = ?) AS n')
		.get('cilan', 'cilan') as { n: number };
	assert.equal(left.n, 0);
});

test('limite de tentativas de senha por conta', async () => {
	await registerUser('Lance', 'dragonite-9');
	for (let i = 0; i < 10; i++) await action('login', { name: 'Lance', pass: `errada-${i}`, challstr: CHALLSTR });
	const blocked = await action('login', { name: 'Lance', pass: 'dragonite-9', challstr: CHALLSTR });
	assert.equal(blocked.json.actionsuccess, false);
	assert.match(blocked.json.error, /Muitas tentativas/);
});

test('cadastro pelo cliente aponta para a página de convite', async () => {
	const res = await action('register', { username: 'x', password: 'y', cpassword: 'y', captcha: 'pikachu' });
	assert.equal(res.json.actionsuccess, false);
	assert.match(res.json.actionerror, /\/cadastro/);
});
