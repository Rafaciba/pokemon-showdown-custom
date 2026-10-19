/**
 * Auxiliares do teste de ponta a ponta: páginas do login (HTML comum) e páginas e
 * salas do cliente clássico do PS (manipuladas pelo objeto `app` do cliente).
 */
import { expect, type Page } from '@playwright/test';

export const ADMIN = 'E2E Admin';
export const PLAYER = 'E2E Jogador';

/** Cadastro em /cadastro com o convite; a sessão fica no contexto do navegador. */
export async function register(page: Page, invite: string, username: string, password: string) {
	await page.goto(`/cadastro?convite=${encodeURIComponent(invite)}`);
	await page.fill('input[name=username]', username);
	await page.fill('input[name=password]', password);
	await page.fill('input[name=confirm]', password);
	await page.click('form[action="/cadastro"] button[type=submit]');
	return page.locator('body').innerText();
}

/** Abre o cliente e espera o login automático pela sessão (cookie do login). */
export async function openClient(page: Page) {
	await page.goto('/');
	await page.waitForFunction(() => {
		const app = (window as any).app;
		return app?.user?.get('named') && app.rooms?.lobby;
	}, null, { timeout: 30_000 });
}

/** Texto de uma sala ou página do cliente (vazio se ela não está aberta). */
export function roomText(page: Page, roomid: string) {
	return page.evaluate(id => {
		const room = (window as any).app.rooms[id];
		return room ? room.$el.text().replace(/\s+/g, ' ') : '';
	}, roomid);
}

/** Espera o texto aparecer na sala ou página. */
export async function expectRoomText(page: Page, roomid: string, pattern: RegExp, timeout = 15_000) {
	await expect.poll(() => roomText(page, roomid), { timeout }).toMatch(pattern);
}

/** Abre uma página do servidor (view-...) e espera ela carregar. */
export async function openPsPage(page: Page, roomid: string, pattern: RegExp) {
	await page.evaluate(id => {
		const app = (window as any).app;
		if (app.rooms[id]) app.send('/join ' + id);
		else app.joinRoom(id);
	}, roomid);
	await expectRoomText(page, roomid, pattern);
}

/** Ids das salas abertas no cliente. */
export function roomIds(page: Page): Promise<string[]> {
	return page.evaluate(() => Object.keys((window as any).app.rooms));
}

/** Espera uma sala nova cujo id casa com o padrão e devolve o id. */
export async function waitNewRoom(page: Page, pattern: RegExp, before: string[], timeout = 20_000) {
	let found = '';
	await expect.poll(async () => {
		found = (await roomIds(page)).find(id => pattern.test(id) && !before.includes(id)) || '';
		return found;
	}, { timeout }).not.toBe('');
	return found;
}

/**
 * Preenche e envia um formulário de página do PS (data-submitsend). Os campos são
 * achados pelo name: input, select e textarea.
 */
export async function submitPsForm(page: Page, roomid: string, form: string, values: Record<string, string>) {
	await page.evaluate(([id, selector, fields]) => {
		const $form = (window as any).app.rooms[id].$el.find(selector);
		if (!$form.length) throw new Error(`formulário não encontrado: ${selector}`);
		for (const [name, value] of Object.entries(fields)) {
			const $field = $form.find(`[name="${name}"]`);
			if (!$field.length) throw new Error(`campo não encontrado: ${name}`);
			$field.val(value);
		}
		$form.find('button[type=submit]').click();
	}, [roomid, form, values] as const);
}

/** Clica num botão de uma página do PS. */
export async function clickPsButton(page: Page, roomid: string, selector: string) {
	await page.evaluate(([id, sel]) => {
		const $button = (window as any).app.rooms[id].$el.find(sel);
		if (!$button.length) throw new Error(`botão não encontrado: ${sel}`);
		$button.first().click();
	}, [roomid, selector] as const);
}

/** Texto dos popups abertos (avisos do servidor); fecha todos. */
export async function takePopups(page: Page) {
	return page.evaluate(() => {
		const $ = (window as any).$;
		const text = $('.ps-popup').map((i: number, el: Element) => $(el).text()).get().join(' | ').replace(/\s+/g, ' ');
		$('.ps-popup button[name=close]').click();
		return text;
	});
}

/** Espera um popup com o texto e o fecha. */
export async function expectPopup(page: Page, pattern: RegExp) {
	let text = '';
	await expect.poll(async () => {
		text = await page.evaluate(() => {
			const $ = (window as any).$;
			return $('.ps-popup').map((i: number, el: Element) => $(el).text()).get().join(' | ').replace(/\s+/g, ' ');
		});
		return text;
	}).toMatch(pattern);
	await takePopups(page);
	return text;
}

/**
 * Joga a batalha aberta na sala até o fim, sempre com o primeiro golpe (ou a ordem
 * padrão na escolha do time). Devolve o nome do vencedor.
 */
export async function playBattle(page: Page, roomid: string, timeout = 120_000) {
	let winner = '';
	await expect.poll(async () => {
		winner = await page.evaluate(id => {
			const room = (window as any).app.rooms[id];
			if (!room?.battle) return '';
			const queue: string[] = room.battle.stepQueue || [];
			const win = queue.find(line => line.startsWith('|win|'));
			if (win) return win.slice(5) || '(empate)';
			const request = room.request;
			if (request && !request.wait && room.e2eAnswered !== request.rqid) {
				room.e2eAnswered = request.rqid;
				const choice = request.teamPreview ? 'team 1' : 'move 1';
				room.send(`/choose ${choice}|${request.rqid}`);
			}
			return '';
		}, roomid);
		return winner;
	}, { timeout, intervals: [500] }).not.toBe('');
	return winner;
}
