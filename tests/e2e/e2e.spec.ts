/**
 * Teste de ponta a ponta do ambiente local (scripts/e2e.sh): páginas do site, contas e
 * login, página de convites e uma jornada completa do Desafio de Ginásios.
 *
 * Tudo o que é criado aqui usa o prefixo E2E e é apagado pelo scripts/e2e.sh no fim,
 * passe ou falhe. O admin temporário (E2E Admin) é preparado pelo script.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
	ADMIN, PLAYER, clickPsButton, expectPopup, expectRoomText, openClient, openPsPage, playBattle,
	register, roomIds, submitPsForm, waitNewRoom,
} from './helpers';

const HOST = process.env.PS_HOST || 'ps.localhost';
const ADMIN_INVITE = process.env.E2E_ADMIN_INVITE || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const NEW_PASSWORD = `${PASSWORD}-nova`;
const SERVER_WS = 'ws://server:8000/showdown/websocket';

// O validador do formato recusa sets sem EVs
const TRAINER_TEAM = 'Magikarp\nAbility: Swift Swim\nEVs: 1 HP\n- Splash';
// Campeão em dupla: dois Pokémon (a cláusula de espécie impede dois Magikarp)
const DOUBLES_TEAM = `${TRAINER_TEAM}\n\nFeebas\nAbility: Swift Swim\nEVs: 1 HP\n- Splash`;
const PLAYER_TEAM = 'Pikachu||LightBall|Static|Thunderbolt|Timid|,,,252,4,252|||||]' +
	'Raichu||LifeOrb|Static|Thunderbolt|Timid|,,,252,4,252|||||';

test.describe.configure({ mode: 'serial' });

let admin: Page;
let player: Page;
let playerInvite = '';
let challengeId = 0;
let formatId = '';

async function newPage(browser: Browser): Promise<[BrowserContext, Page]> {
	const context = await browser.newContext({
		baseURL: `https://${HOST}`, ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
	});
	return [context, await context.newPage()];
}

test.beforeAll(async ({ browser }) => {
	expect(ADMIN_INVITE, 'rode pelo scripts/e2e.sh').not.toBe('');
	expect(PASSWORD).not.toBe('');
	[, admin] = await newPage(browser);
	[, player] = await newPage(browser);
});

test('páginas do site: privacidade, regras e cabeçalhos de segurança', async ({ request }) => {
	const pages = [
		['pt-BR', /Aviso de privacidade/, /Regras/, /Expedição: como funciona/, /Expedição: as suas expedições/],
		['en-US', /Privacy notice/, /Rules/, /Expedition: how it works/, /Expedition: your expeditions/],
	] as const;
	for (const [lang, title, rules, expeditionRules, expeditionData] of pages) {
		const privacy = await request.get('/privacidade', { headers: { 'Accept-Language': lang } });
		expect(privacy.status()).toBe(200);
		const privacyText = await privacy.text();
		expect(privacyText).toMatch(title);
		// A Expedição no aviso de privacidade e nas regras
		expect(privacyText).toMatch(expeditionData);
		const page = await request.get('/regras', { headers: { 'Accept-Language': lang } });
		const rulesText = await page.text();
		expect(rulesText).toMatch(rules);
		expect(rulesText).toMatch(expeditionRules);
	}
	const signup = await request.get('/cadastro');
	expect(signup.headers()['content-security-policy']).toContain("default-src 'none'");
	// Botão de ver a senha: script próprio, da mesma origem
	expect(signup.headers()['content-security-policy']).toContain("script-src 'self'");
	expect((await request.get('/conta.js')).status()).toBe(200);
	expect(signup.headers()['strict-transport-security']).toContain('max-age=');
	const client = await request.get('/');
	expect(client.status()).toBe(200);
	expect(client.headers()['strict-transport-security']).toContain('max-age=');
});

test('contas: cadastro do admin, convite usado e intruso bloqueados', async ({ request }) => {
	expect(await register(admin, ADMIN_INVITE, ADMIN, PASSWORD)).toMatch(/Account created|Conta criada/);
	// O mesmo convite não serve duas vezes
	const [, other] = await newPage(admin.context().browser()!);
	expect(await register(other, ADMIN_INVITE, 'E2E Outro', PASSWORD)).toMatch(/Invalid, used or expired|inválido, já usado/);
	await other.context().close();
	// Nome sem conta não recebe assertion (o servidor exige conta)
	const intruder = await request.post('/~~custom/action.php', {
		form: { act: 'getassertion', userid: 'e2eintruso', challstr: '1|abc' },
	});
	expect(await intruder.text()).toMatch(/^;;.*\/cadastro/);
	// O admin entra no jogo pela sessão e abre o painel
	await openClient(admin);
	await openPsPage(admin, 'view-ginasiosadmin', /Gym Challenge: admin panel|Desafio de Ginásios: painel/);
});

test('contas: assertion forjada é recusada pelo servidor de jogo', async () => {
	const reply = await new Promise<string>((resolve) => {
		const ws = new WebSocket(SERVER_WS);
		const timer = setTimeout(() => resolve('sem resposta'), 10_000);
		ws.onmessage = ({ data }) => {
			for (const line of String(data).split('\n')) {
				if (line.startsWith('|challstr|')) {
					const challenge = line.slice(10).split('|')[1];
					const forged = `${challenge},e2eforjado,2,${Math.floor(Date.now() / 1000)},${HOST};${'ab'.repeat(192)}`;
					ws.send(`|/trn E2E Forjado,0,${forged}`);
				}
				if (line.startsWith('|nametaken|') || line.startsWith('|updateuser|')) {
					if (line.startsWith('|updateuser|') && !line.includes('E2E Forjado')) continue;
					clearTimeout(timer);
					ws.close();
					resolve(line);
				}
			}
		};
	});
	expect(reply).toMatch(/^\|nametaken\|/);
});

test('convites: gerar, código só uma vez, revogar e redefinir senha', async () => {
	const id = 'view-ginasiosadmin-convites';
	await openPsPage(admin, 'view-ginasiosadmin', /Invites|Convites/);
	await clickPsButton(admin, 'view-ginasiosadmin', `button[value="${id}"]`);
	await expectRoomText(admin, id, /Pending invites|Convites pendentes/);

	// Convite aberto: é o que o jogador usa no cadastro
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin gerarconvite"]', { username: '' });
	await expectRoomText(admin, id, /Invite code|Código de convite/);
	playerInvite = (await admin.evaluate(rid => (window as any).app.rooms[rid].$el.find('.infobox code').text(), id));
	expect(playerInvite).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
	// Ao recarregar, o código não aparece de novo. O texto "Pending invites" já está na página
	// antiga: espera a versão nova, que não pode ter o código
	await openPsPage(admin, id, /Pending invites|Convites pendentes/);
	await expect.poll(() => admin.evaluate(rid => (window as any).app.rooms[rid].$el.text(), id)).not.toContain(playerInvite);

	// Convite reservado: aparece na lista com o nome e pode ser revogado
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin gerarconvite"]', { username: 'E2E Reservado' });
	await expectRoomText(admin, id, /e2ereservado/);
	const revoke = await admin.evaluate(rid => {
		const $room = (window as any).app.rooms[rid].$el;
		const $row = $room.find('tr').filter((i: number, tr: Element) => tr.textContent!.includes('e2ereservado'));
		return $row.find('button[name=send]').attr('value');
	}, id);
	expect(revoke).toMatch(/^\/ginasioadmin revogarconvite \d+$/);
	await clickPsButton(admin, id, `button[value="${revoke}"]`);
	await expect.poll(async () => (await admin.evaluate(rid => (window as any).app.rooms[rid].$el.find('tr').text(), id)))
		.not.toContain('e2ereservado');

	// Nome já em uso é recusado com aviso
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin gerarconvite"]', { username: ADMIN });
	await expectPopup(admin, /already taken|já está em uso/);

	// Redefinição de senha: jogador inexistente e o próprio admin
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin redefinirsenha"]', { username: 'e2eninguem' });
	await expectPopup(admin, /User not found|Usuário não encontrado/);
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin redefinirsenha"]', { username: ADMIN });
	await expectRoomText(admin, id, /Password reset code for|Código de redefinição/);
});

test('segurança: a trilha mostra os eventos do login, com filtro por conta', async ({ request }) => {
	// Uma senha errada para a conta do admin entra na trilha
	await request.post('/~~custom/action.php', { form: { act: 'login', name: ADMIN, pass: 'senha-errada', challstr: '1|abc' } });
	const id = 'view-ginasiosadmin-seguranca';
	await openPsPage(admin, 'view-ginasiosadmin', /Security|Segurança/);
	await clickPsButton(admin, 'view-ginasiosadmin', `button[value="${id}"]`);
	await expectRoomText(admin, id, /Last 24 hours|Últimas 24 horas/);
	await expectRoomText(admin, id, /Invite issued|Convite gerado/);

	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin filtrarseguranca"]', { tipo: '', conta: ADMIN });
	const filtered = 'view-ginasiosadmin-seguranca-todos-e2eadmin-0';
	await expectRoomText(admin, filtered, /Wrong password|Senha errada/);
	await expectRoomText(admin, filtered, /Account created|Conta criada/);
	const accounts = await admin.evaluate(rid => {
		const $ = (window as any).$;
		return (window as any).app.rooms[rid].$el.find('table').last().find('tr td:nth-child(3)')
			.map((i: number, td: Element) => $(td).text().trim()).get();
	}, filtered);
	expect(accounts.length).toBeGreaterThan(0);
	expect(new Set(accounts)).toEqual(new Set(['e2eadmin']));
});

test('contas: o admin troca o nome de uma conta, e a senha continua valendo', async ({ browser, request }) => {
	// Conta nova com um convite gerado pelo painel
	const id = 'view-ginasiosadmin-convites';
	await openPsPage(admin, id, /Pending invites|Convites pendentes/);
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin gerarconvite"]', { username: '' });
	await expectRoomText(admin, id, /Invite code|Código de convite/);
	const invite = await admin.evaluate(rid => (window as any).app.rooms[rid].$el.find('.infobox code').text(), id);
	const [context, page] = await newPage(browser);
	expect(await register(page, invite, 'E2E Jos', PASSWORD)).toMatch(/Account created|Conta criada/);

	await admin.evaluate(() => (window as any).app.send('/renomearconta E2E Jos, E2E Jose', 'lobby'));
	await expectRoomText(admin, 'lobby', /e2ejos renamed to E2E Jose|e2ejos renomeada para E2E Jose/);
	// A sessão do nome antigo acabou; o nome novo entra com a mesma senha
	await page.goto('/conta');
	await expect(page.locator('body')).toContainText(/not logged in|não está logado/);
	const login = await request.post('/~~custom/action.php', {
		form: { act: 'login', name: 'E2E Jose', pass: PASSWORD, challstr: '1|abc' },
	});
	expect(JSON.parse((await login.text()).slice(1)).actionsuccess).toBe(true);
	const old = await request.post('/~~custom/action.php', { form: { act: 'getassertion', userid: 'e2ejos', challstr: '1|abc' } });
	expect(await old.text()).toMatch(/^;;/);
	await context.close();
});

test('contas: nome com acento mantém a letra no jogo', async ({ browser }) => {
	const id = 'view-ginasiosadmin-convites';
	await openPsPage(admin, id, /Pending invites|Convites pendentes/);
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin gerarconvite"]', { username: '' });
	await expectRoomText(admin, id, /Invite code|Código de convite/);
	const invite = await admin.evaluate(rid => (window as any).app.rooms[rid].$el.find('.infobox code').text(), id);
	const [context, page] = await newPage(browser);
	expect(await register(page, invite, 'E2E ZéPe', PASSWORD)).toMatch(/Account created|Conta criada/);
	await openClient(page);
	const [name, userid] = await page.evaluate(() => {
		const user = (window as any).app.user;
		return [user.get('name'), user.get('userid')];
	});
	expect(name.normalize('NFC')).toBe('E2E ZéPe');
	expect(userid).toBe('e2ezepe');
	await context.close();
});

test('desafio: o admin cria treinadores e um desafio e o abre', async () => {
	const trainerIds: number[] = [];
	for (const [name, type, doubles] of [['E2E Lider', 'Water', 'no'], ['E2E Campeao', '', 'yes']]) {
		const before = await roomIds(admin);
		await openPsPage(admin, 'view-ginasiosadmin-treinador-novo', /Save trainer|Salvar treinador/);
		await submitPsForm(admin, 'view-ginasiosadmin-treinador-novo', 'form[data-submitsend^="/ginasioadmin salvartreinador"]', {
			name, title: 'E2E', type, doubles, team: doubles === 'yes' ? DOUBLES_TEAM : TRAINER_TEAM,
		});
		const saved = await waitNewRoom(admin, /^view-ginasiosadmin-treinador-\d+$/, before);
		trainerIds.push(Number(saved.split('-').pop()));
	}

	const before = await roomIds(admin);
	await openPsPage(admin, 'view-ginasiosadmin-desafio-novo', /Save challenge|Salvar desafio/);
	await submitPsForm(admin, 'view-ginasiosadmin-desafio-novo', 'form[data-submitsend^="/ginasioadmin salvardesafio"]', {
		// IA Mestre: o líder joga com a busca em individual, e o Campeão, com a busca em dupla
		name: 'E2E Desafio', gyms: '1', elite: 'no', lock: 'no', level: 'master',
	});
	const page = await waitNewRoom(admin, /^view-ginasiosadmin-desafio-\d+$/, before);
	challengeId = Number(page.split('-').pop());

	// Líder no ginásio 1 e o Campeão
	await expectRoomText(admin, page, /Save trainers|Salvar treinadores/);
	await admin.evaluate(([rid, [leader, champion]]) => {
		const $form = (window as any).app.rooms[rid].$el.find('form[data-submitsend^="/ginasioadmin salvaretapas"]');
		$form.find('select').filter((i: number, el: HTMLSelectElement) => /^gym[a-z]+$/.test(el.name)).val(String(leader));
		$form.find('select').filter((i: number, el: HTMLSelectElement) => /^champion[a-z]+$/.test(el.name)).val(String(champion));
		$form.find('button[type=submit]').click();
	}, [page, trainerIds] as const);
	await expectRoomText(admin, page, /Everything is ready|Tudo pronto/);
	await clickPsButton(admin, page, `button[value="/ginasioadmin abrirdesafio ${challengeId}"]`);
	await expectRoomText(admin, page, /Close challenge|Encerrar desafio/);
	formatId = 'gen9desafioe2edesafio';
});

test('desafio sorteado: busca, filtros e ordenação dos treinadores', async () => {
	const before = await roomIds(admin);
	await openPsPage(admin, 'view-ginasiosadmin-desafio-novo', /Save challenge|Salvar desafio/);
	await submitPsForm(admin, 'view-ginasiosadmin-desafio-novo', 'form[data-submitsend^="/ginasioadmin salvardesafio"]', {
		name: 'E2E Sorteio', typemode: 'random', gyms: '1', elite: 'no', lock: 'no',
	});
	const page = await waitNewRoom(admin, /^view-ginasiosadmin-desafio-\d+$/, before);
	await expectRoomText(admin, page, /Click a column title to sort|Clique no título de uma coluna/);
	const result = await admin.evaluate(rid => {
		const $ = (window as any).jQuery;
		const $room = (window as any).app.rooms[rid].$el;
		const $table = $room.find('table.gym-pool');
		const rows = () => $table.find('tr').filter((i: number, tr: HTMLElement) => !$(tr).children('th').length);
		const visible = () => rows().filter(':visible').map((i: number, tr: HTMLElement) => ({
			name: $(tr).find('.gym-pool-name').text(), type: $(tr).find('.gym-pool-type').attr('title'),
			checked: $(tr).find('input[type=checkbox]').prop('checked'),
		})).get();
		const set = (selector: string, value: string) => $room.find(selector).val(value).trigger('input').trigger('change');
		const out: any = { total: rows().length };
		set('.gym-filter-text', 'e2e lider');
		out.byName = visible().map((row: any) => row.name);
		set('.gym-filter-text', 'magikarp'); // Pokémon do time do líder E2E
		out.byPokemon = visible().map((row: any) => row.name);
		set('.gym-filter-text', '');
		set('.gym-filter-type', 'Water');
		out.types = [...new Set(visible().map((row: any) => row.type))];
		set('.gym-filter-type', '');
		rows().filter((i: number, tr: HTMLElement) => $(tr).find('.gym-pool-name').text() === 'E2E Lider')
			.find('input[type=checkbox]').prop('checked', true);
		set('.gym-filter-checked', 'checked');
		out.checked = visible();
		set('.gym-filter-checked', '');
		$room.find('button[name=gymSort][value=name]').click();
		const names = visible().map((row: any) => row.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
		out.sorted = names.every((name: string, i: number) => i === 0 || names[i - 1] <= name);
		$room.find('button[name=gymSort][value=checked]').click();
		out.firstAfterSelectedSort = visible()[0]?.name;
		out.stillChecked = rows().filter((i: number, tr: HTMLElement) => $(tr).find('.gym-pool-name').text() === 'E2E Lider')
			.find('input[type=checkbox]').prop('checked');
		// Campeão: a busca por nome deixa na lista só "nenhum" e os treinadores que combinam
		const $champion = $room.find('select[name^=champion]').filter((i: number, el: HTMLSelectElement) => !/level$/.test(el.name));
		$champion.prevAll('.gym-select-filter').first().val('e2e campeao').trigger('input');
		out.championOptions = $champion.find('option').map((i: number, o: HTMLOptionElement) => $(o).text()).get();
		return out;
	}, page);
	expect(result.total, 'treinadores com tipo na tabela').toBeGreaterThanOrEqual(1);
	expect(result.byName).toEqual(['E2E Lider']);
	expect(result.byPokemon).toContain('E2E Lider');
	expect(result.types).toEqual(['Water']);
	expect(result.checked.map((row: any) => row.name)).toEqual(['E2E Lider']);
	expect(result.sorted, 'ordem alfabética').toBe(true);
	expect(result.firstAfterSelectedSort, 'selecionados primeiro').toBe('E2E Lider');
	expect(result.stillChecked, 'ordenar não perde a marcação').toBe(true);
	expect(result.championOptions).toHaveLength(2);
	expect(result.championOptions[1]).toContain('E2E Campeao');
});

test('sprites: a galeria troca de página na mesma aba e escolhe quantos sprites mostrar', async () => {
	const prefix = 'view-ginasiosadmin-sprites-novo-';
	const galleryTabs = () => admin.evaluate(p => Object.keys((window as any).app.rooms).filter(id => id.startsWith(p)), prefix);
	const spriteCount = (rid: string) => admin.evaluate(id => (window as any).app.rooms[id].$el
		.find('button[name=gymPickSprite]').filter((i: number, b: HTMLButtonElement) => b.value !== '').length, rid);
	await openPsPage(admin, `${prefix}1-48`, /Sprites per page|Sprites por página/);
	expect(await spriteCount(`${prefix}1-48`)).toBe(48);
	// Próxima página: a aba é trocada, sem abrir outra
	await clickPsButton(admin, `${prefix}1-48`, 'button[value="/ginasioadmin paginasprite novo,2,48,"]');
	await expectRoomText(admin, `${prefix}2-48`, /Page 2 of|Página 2 de/);
	expect(await galleryTabs()).toEqual([`${prefix}2-48`]);
	// 96 por página (volta para a página 1)
	await clickPsButton(admin, `${prefix}2-48`, 'button[value="/ginasioadmin paginasprite novo,1,96,"]');
	await expectRoomText(admin, `${prefix}1-96`, /Page 1 of|Página 1 de/);
	expect(await spriteCount(`${prefix}1-96`)).toBe(96);
	expect(await galleryTabs()).toEqual([`${prefix}1-96`]);
	// A busca mantém a quantidade por página e também fica na mesma aba
	await submitPsForm(admin, `${prefix}1-96`, 'form[data-submitsend^="/ginasioadmin buscarsprite"]', { q: 'brock' });
	await expectRoomText(admin, `${prefix}1-96-brock`, /brock/);
	expect(await galleryTabs()).toEqual([`${prefix}1-96-brock`]);
	await admin.evaluate(id => (window as any).app.leaveRoom(id), `${prefix}1-96-brock`);
});

test('pacotes: o admin exporta o desafio e importa um pacote com um treinador novo', async () => {
	const id = 'view-ginasiosadmin-pacotes';
	await openPsPage(admin, 'view-ginasiosadmin', /Import and export|Importar e exportar/);
	await clickPsButton(admin, 'view-ginasiosadmin', `button[value="${id}"]`);
	await expectRoomText(admin, id, /Preview import|Ver prévia da importação/);

	// Exporta o desafio E2E: os treinadores dele vão junto
	let before = await roomIds(admin);
	await admin.evaluate(rid => {
		const $form = (window as any).app.rooms[rid].$el.find('form[data-submitsend^="/ginasioadmin exportarpacote"]');
		$form.find('tr').filter((i: number, tr: Element) => tr.textContent!.includes('E2E Desafio'))
			.find('input[type=checkbox]').prop('checked', true);
		$form.find('button[type=submit]').click();
	}, id);
	const exported = await waitNewRoom(admin, /^view-ginasiosadmin-exportar-\d+-0$/, before);
	await expectRoomText(admin, exported, /1 challenge\(s\) and 2 trainer\(s\)|1 desafio\(s\) e 2 treinador\(es\)/);
	const pack = JSON.parse(await admin.evaluate(rid => (window as any).app.rooms[rid].$el.find('textarea').val(), exported));
	expect(pack.challenges.map((c: any) => c.name)).toEqual(['E2E Desafio']);
	expect(pack.trainers.map((t: any) => t.name)).toEqual(['E2E Campeao', 'E2E Lider']);

	// Importa uma cópia com outro nome e um líder novo; o Campeão já está no banco e é reaproveitado
	pack.trainers.push({ name: 'E2E Importado', title: 'E2E', type: 'Water', team: TRAINER_TEAM });
	pack.challenges[0].name = 'E2E Importado';
	pack.challenges[0].stages.find((s: any) => s.kind === 'gym').trainer = 'E2E Importado';
	before = await roomIds(admin);
	await submitPsForm(admin, id, 'form[data-submitsend^="/ginasioadmin previaimportacao"]', {
		pacote: JSON.stringify(pack, null, '\t'),
	});
	const preview = 'view-ginasiosadmin-importar';
	await expectRoomText(admin, preview, /Confirm import|Confirmar importação/);
	await expectRoomText(admin, preview, /Already in the bank: skipped|Já está no banco: pulado/);
	await expectRoomText(admin, preview, /Ready to open|Pronto para abrir/);
	await clickPsButton(admin, preview, 'button[value="/ginasioadmin confirmarimportacao"]');
	await expectRoomText(admin, preview, /1 trainer\(s\) and 1 challenge\(s\)|1 treinador\(es\) e 1 desafio\(s\)/);

	// O desafio importado é um rascunho pronto para abrir
	const button = await admin.evaluate(rid => (
		(window as any).app.rooms[rid].$el.find('.infobox button[value^="view-ginasiosadmin-desafio-"]').attr('value')
	), preview);
	await openPsPage(admin, button, /Everything is ready|Tudo pronto/);
	await expectRoomText(admin, button, /Status: Draft|Situação: Rascunho/);
});

test('desafio: o jogador vence o ginásio e o Campeão em dupla, e o perfil mostra os times', async () => {
	expect(await register(player, playerInvite, PLAYER, PASSWORD)).toMatch(/Account created|Conta criada/);
	await openClient(player);
	const page = `view-ginasios-desafio-${challengeId}`;
	await openPsPage(player, page, /Start journey|Começar jornada/);
	await clickPsButton(player, page, `button[value="/ginasio iniciar ${challengeId}"]`);
	await expectRoomText(player, page, /Badges: 0\/1|Insígnias: 0\/1/);

	for (const stage of ['ginásio', 'Campeão']) {
		const before = await roomIds(player);
		// O mesmo que o botão Battle! faz com o formato e o time escolhidos
		await player.evaluate(([team, format]) => {
			const app = (window as any).app;
			app.send('/utm ' + team);
			app.send('/search ' + format);
		}, [PLAYER_TEAM, formatId] as const);
		const battle = await waitNewRoom(player, new RegExp(`^battle-${formatId}(dupla)?-\\d+$`), before);
		// O Campeão de teste batalha em dupla, na variante em dupla do formato
		expect(battle.includes(`${formatId}dupla-`), `formato da batalha contra o ${stage}`).toBe(stage === 'Campeão');
		const winner = await playBattle(player, battle);
		expect(winner, `vencedor contra o ${stage}`).toBe(PLAYER);
		// Com a batalha terminada, o cliente já leu o tipo dela
		const gameType = await player.evaluate(rid => (window as any).app.rooms[rid].battle.gameType, battle);
		expect(gameType, `tipo da batalha contra o ${stage}`).toBe(stage === 'Campeão' ? 'doubles' : 'singles');
	}

	await openPsPage(player, page, /Won|Vencida/);
	const profile = 'view-ginasios-perfil-e2ejogador';
	await openPsPage(player, profile, /Winning teams|Times vencedores/);
	const rows = await player.evaluate(rid => {
		const $ = (window as any).$;
		return (window as any).app.rooms[rid].$el.find('details tr').map((i: number, tr: Element) => ({
			text: $(tr).text().replace(/\s+/g, ' ').trim(),
			icons: $(tr).find('psicon, .picon, span[style*="pokemonicons"]').length,
		})).get();
	}, profile);
	// Cabeçalho, o ginásio e o Campeão, cada um com os ícones do Pikachu e do Raichu
	expect(rows).toHaveLength(3);
	expect(rows[1].icons).toBe(2);
	expect(rows[2].text).toMatch(/Champion|Campeão/);
	expect(rows[2].icons).toBe(2);
});

test('IA Mestre: a página mostra os modelos, as batalhas coletadas e a força dos níveis', async () => {
	const id = 'view-ginasiosadmin-mestre';
	await openPsPage(admin, 'view-ginasiosadmin', /Master AI|IA Mestre/);
	await clickPsButton(admin, 'view-ginasiosadmin', `button[value="${id}"]`);
	await expectRoomText(admin, id, /Model in use|Modelo em uso/);
	const text = await admin.evaluate(rid => (window as any).app.rooms[rid].$el.text(), id);
	// As batalhas contra o líder (individual) e o Campeão (dupla) entraram nos dados de aprendizado, cada uma no seu tipo
	const counts = [...text.matchAll(/(\d+) (?:battles and|batalhas e) \d+/g)].map(match => Number(match[1]));
	expect(counts, 'batalhas coletadas em individual e em dupla').toHaveLength(2);
	expect(counts[0], 'batalhas individuais').toBeGreaterThanOrEqual(1);
	expect(counts[1], 'batalhas em dupla').toBeGreaterThanOrEqual(1);
	expect(text).toMatch(/Retrain now|Retreinar agora/);
	expect(text).toMatch(/Strength of the levels|Força dos níveis/);
});

test('expedição: o admin começa a expedição de teste, escolhe o time, batalha e perde', async () => {
	const list = 'view-expedicao';
	const id = 'view-expedicao-run-teste';
	await openPsPage(admin, list, /Test expedition|Expedição de teste/);
	await clickPsButton(admin, list, `button[value="${id}"]`);
	await expectRoomText(admin, id, /Start expedition|Começar a expedição/);
	await clickPsButton(admin, id, 'button[value="/expedicao iniciar teste"]');
	await expectRoomText(admin, id, /Choose your starting team|Escolha o seu time inicial/);
	// Três times de três iniciais
	const options = await admin.evaluate(rid => (window as any).app.rooms[rid].$el
		.find('button[value^="/expedicao inicial teste,"]').length, id);
	expect(options).toBe(3);
	await clickPsButton(admin, id, 'button[value="/expedicao inicial teste,0"]');
	await expectRoomText(admin, id, /Choose the next node on the map|Escolha o próximo ponto no mapa/);
	// O time mostra o item de cada Pokémon (a mochila aparece quando houver itens)
	// Dinheiro inicial da variação de teste (loja: etapa 3, parte 2)
	await expectRoomText(admin, id, /Money: 1,000 ₽|Dinheiro: 1\.000 ₽/);
	await expectRoomText(admin, id, /Held item.*No item|Item.*Sem item/);
	// Tooltip de cada Pokémon do time: escondido, com atributos e golpes, e visível no hover
	const tip = admin.locator(`#room-${id} td .exp-tip`).first();
	await expect(tip.locator('.exp-tip-body')).toBeHidden();
	await tip.hover();
	await expect(tip.locator('.exp-tip-body')).toBeVisible();
	await expect(tip.locator('.exp-tip-body')).toContainText(/Atk/);
	await admin.mouse.move(5, 5);
	// Primeiro andar (sempre selvagem): o encontro aparece, no nível inicial
	const first = await admin.evaluate(rid => (window as any).app.rooms[rid].$el
		.find('button[value^="/expedicao avancar teste,"]').map((i: number, b: HTMLButtonElement) => b.value).get(), id);
	expect(first.length, 'nós do primeiro andar').toBeGreaterThanOrEqual(2);
	await clickPsButton(admin, id, `button[value="${first[0]}"]`);
	await expectRoomText(admin, id, /\(Lv\. [3-7]\) appeared!|\(Nv\. [3-7]\) apareceu!/);
	// A batalha abre numa sala; a desistência (forfeit) é derrota e encerra a expedição
	const before = await roomIds(admin);
	await clickPsButton(admin, id, 'button[value="/expedicao escolha teste,battle"]');
	const battleRoom = await waitNewRoom(admin, /^battle-gen9expeditionteste-\d+/, before);
	// Uma aba só: com a batalha aberta, a aba da expedição fecha
	await expect.poll(() => admin.evaluate(rid => !!(window as any).app.rooms[rid], id)).toBe(false);
	// O lado do selvagem tem o mato alto como avatar (sprite próprio, servido pelo Caddy)
	await expect.poll(() => admin.evaluate(rid => (window as any).app.rooms[rid].battle?.p2?.avatar, battleRoom))
		.toBe('#expeditiongrass');
	const grass = await admin.request.get('/sprites/trainers-custom/expeditiongrass.png');
	expect(grass.status()).toBe(200);
	expect(grass.headers()['content-type']).toContain('image/png');
	await admin.evaluate(rid => (window as any).app.send('/forfeit', rid), battleRoom);
	// No fim, a sala da batalha mostra o resultado e o botão de volta para a expedição
	await expectRoomText(admin, battleRoom, /Defeat\. The expedition is over\.|Derrota\. A expedição acabou\./);
	await clickPsButton(admin, battleRoom, 'button[name="expeditionReturn"][value="view-expedicao-run-teste"]');
	// Uma aba só: a da batalha fecha, e a da expedição volta
	await expect.poll(() => admin.evaluate(() => (window as any).app.curRoom?.id)).toBe(id);
	expect(await admin.evaluate(rid => !!(window as any).app.rooms[rid], battleRoom)).toBe(false);
	// A página resume a run: quem venceu, até onde chegou e o time no fim
	await expectRoomText(admin, id, /Your last expedition: defeated|Sua última expedição: derrota/);
	await expectRoomText(admin, id, /Defeated by Wild|Derrotado por Wild/);
	await expectRoomText(admin, id, /floor 1 of act 1 of 1|o andar 1 do ato 1 de 1/);
	await expectRoomText(admin, id, /Start expedition|Começar a expedição/);
});

test('expedição: painel do admin (variações, histórico) e seção no perfil', async () => {
	const panel = 'view-expedicao-admin';
	await openPsPage(admin, 'view-ginasiosadmin', /Master AI|IA Mestre/);
	await clickPsButton(admin, 'view-ginasiosadmin', `button[value="${panel}"]`);
	await expectRoomText(admin, panel, /Variants|Variações/);
	// Números ajustáveis da variação de teste, com os limites
	await expectRoomText(admin, panel, /Floors per act|Andares por ato/);
	const fields = await admin.evaluate(id => (window as any).app.rooms[id].$el
		.find('form[data-submitsend^="/expedicaoadmin ajustar teste"] input[type=number]').length, panel);
	expect(fields).toBeGreaterThan(5);
	// Desligar e religar a variação
	await clickPsButton(admin, panel, 'button[value="/expedicaoadmin desligar teste"]');
	await expectRoomText(admin, panel, /Turn on|Ligar/);
	await clickPsButton(admin, panel, 'button[value="/expedicaoadmin ligar teste"]');
	await expectRoomText(admin, panel, /Turn off|Desligar/);
	// A derrota do passo anterior aparece no histórico e no perfil
	await expectRoomText(admin, panel, /e2eadmin.*(Defeated|Derrota)/);
	const profile = 'view-ginasios-perfil-e2eadmin';
	await openPsPage(admin, profile, /Player profile|Perfil do jogador/);
	await expectRoomText(admin, profile, /Expedition|Expedição/);
	await expectRoomText(admin, profile, /Latest expeditions|Últimas expedições/);
});

test('contas: troca de senha e exclusão apagam os dados de jogo', async () => {
	await player.goto('/conta');
	await player.fill('form[action="/conta/senha"] input[name=current]', PASSWORD);
	await player.fill('form[action="/conta/senha"] input[name=password]', NEW_PASSWORD);
	await player.fill('form[action="/conta/senha"] input[name=confirm]', NEW_PASSWORD);
	await player.click('form[action="/conta/senha"] button[type=submit]');
	await expect(player.locator('body')).toContainText(/Password changed|Senha alterada/);

	await player.fill('form[action="/conta/excluir"] input[name=password]', NEW_PASSWORD);
	await player.check('form[action="/conta/excluir"] input[name=confirm]');
	await player.click('form[action="/conta/excluir"] button[type=submit]');
	await expect(player.locator('body')).toContainText(/have been deleted|foram excluídos/);

	// O servidor de jogo apaga as jornadas em até um minuto (fila do login)
	const profile = 'view-ginasios-perfil-e2ejogador';
	await expect.poll(async () => {
		await openPsPage(admin, profile, /Player profile|Perfil do jogador/);
		return admin.evaluate(rid => (window as any).app.rooms[rid].$el.text(), profile);
	}, { timeout: 100_000, intervals: [10_000] }).toMatch(/No journeys yet|Nenhuma jornada/);
});
