/**
 * Teste de ponta a ponta do ambiente local. Rode com scripts/e2e.sh, que prepara o
 * admin temporário, roda este teste num container do Playwright e limpa tudo no fim.
 * Ver docs/testes-e2e.md.
 */
import { defineConfig } from '@playwright/test';

const host = process.env.PS_HOST || 'ps.localhost';
const out = process.env.E2E_OUT || 'results';

export default defineConfig({
	testDir: '.',
	testMatch: '*.spec.ts',
	// Os passos dependem uns dos outros (o admin cria o desafio que o jogador joga)
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 180_000,
	expect: { timeout: 15_000 },
	outputDir: `${out}/artifacts`,
	reporter: [['list'], ['html', { outputFolder: `${out}/report`, open: 'never' }]],
	use: {
		baseURL: `https://${host}`,
		// CA local do Caddy em *.localhost
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 },
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		launchOptions: {
			// Dentro da rede do Docker, o domínio do site é o serviço "web" (Caddy)
			args: [`--host-resolver-rules=MAP ${host} web`],
		},
	},
});
