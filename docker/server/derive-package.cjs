/**
 * Gera, a partir do package.json do fork, o package.json usado para instalar as
 * dependências no container (docker/server/setup.sh). O package.json do fork não muda,
 * para não conflitar com as atualizações da Smogon.
 *
 * Saem as dependências que o servidor não usa com a nossa configuração (menos código e
 * menos vulnerabilidades instaladas; ver docs/revisao-seguranca-lgpd.md):
 *   - mysql2, pg: bancos externos (usamos SQLite). O mysql2 fica só como dependência de
 *     desenvolvimento: o lib/database.ts da Smogon importa os tipos dele, e sem eles a
 *     checagem de tipos (tsc) falha. Ele nunca é carregado (o PS só o carrega com MySQL
 *     configurado);
 *   - sqlite, sqlite3: não são usados pelo código (o PS usa o better-sqlite3); traziam o
 *     tar e o node-gyp com vulnerabilidades;
 *   - nodemailer: e-mail de erros (não configurado);
 *   - githubhook: notificações do GitHub (plugin não usado);
 *   - cloud-env: hospedagem em nuvem (não usada);
 *   - probe-image-size: o servidor baixava qualquer URL para medir imagens do /show.
 *     Sem ele, o /show com imagem é recusado ("Images not supported"): nada de buscar URLs
 *     arbitrárias (SSRF) nem de expor o IP dos jogadores ao site da imagem.
 *
 * better-sqlite3 (modlog): a 11.10.0 travada pela Smogon não tem binário pronto para o
 * Node 24 e o container não tem compilador. Fica fixa numa versão com binário pronto.
 *
 * Uso: node derive-package.cjs <package.json> > saída
 */
'use strict';

const fs = require('fs');

const REMOVED = ['mysql2', 'pg', 'sqlite', 'sqlite3', 'nodemailer', 'githubhook', 'cloud-env', 'probe-image-size'];
// Saem das dependências de execução, mas ficam para o desenvolvimento (tipos)
const DEV_ONLY = ['mysql2'];
const PINNED = { 'better-sqlite3': '12.11.1' };
// Dependências transitivas com versão mínima corrigida (usadas só na instalação)
const OVERRIDES = { 'tar-fs': '^2.1.4' };

const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const name of REMOVED) {
	const version = pkg.dependencies?.[name] || pkg.optionalDependencies?.[name];
	delete pkg.dependencies?.[name];
	delete pkg.optionalDependencies?.[name];
	if (DEV_ONLY.includes(name) && version) pkg.devDependencies = { ...pkg.devDependencies, [name]: version };
}
for (const [name, version] of Object.entries(PINNED)) {
	if (pkg.dependencies?.[name]) pkg.dependencies[name] = version;
	else pkg.optionalDependencies[name] = version;
}
pkg.overrides = { ...pkg.overrides, ...OVERRIDES };
process.stdout.write(JSON.stringify(pkg, null, 2) + '\n');
