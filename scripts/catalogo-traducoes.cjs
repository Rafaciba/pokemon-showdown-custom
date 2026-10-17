#!/usr/bin/env node
/**
 * Atualiza os catálogos de tradução dos nossos plugins no fork do servidor:
 *   server/translations/en-template/pokemon-showdown-custom.ts  (modelo, valores null)
 *   server/translations/pt/pokemon-showdown-custom.ts           (traduções pt-BR)
 *
 * Uso (na raiz do repo):
 *   node scripts/catalogo-traducoes.cjs novas-chaves.json
 *
 * O JSON mapeia a chave em inglês (como o `node build translations` mostra,
 * com {nomeDaVariavel} ou {0}) para a tradução em português. Chaves já
 * existentes são preservadas na ordem; as novas entram no fim.
 * Depois, confira com: docker compose exec server node build translations
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [, , ptJson] = process.argv;
if (!ptJson) {
	console.error('Uso: node scripts/catalogo-traducoes.cjs novas-chaves.json');
	process.exit(1);
}
const root = path.resolve(__dirname, '..', 'server', 'translations');
const templatePath = path.join(root, 'en-template', 'pokemon-showdown-custom.ts');
const ptPath = path.join(root, 'pt', 'pokemon-showdown-custom.ts');

function parse(file) {
	const out = new Map();
	if (!fs.existsSync(file)) return out;
	const re = /^\t("(?:[^"\\]|\\.)*"): (null|"(?:[^"\\]|\\.)*"),$/gm;
	for (const m of fs.readFileSync(file, 'utf8').matchAll(re)) {
		out.set(JSON.parse(m[1]), m[2] === 'null' ? null : JSON.parse(m[2]));
	}
	return out;
}

const pt = parse(ptPath);
for (const [key, value] of Object.entries(JSON.parse(fs.readFileSync(ptJson, 'utf8')))) pt.set(key, value);
const keys = [...parse(templatePath).keys()];
for (const key of pt.keys()) if (!keys.includes(key)) keys.push(key);

const header = `import type { TranslationCatalog } from '../../server/chat';\n\n` +
	`/** pokemon-showdown-custom: textos dos nossos plugins (custom-accounts, gym-challenge) */\n` +
	`export const translations: TranslationCatalog = {\n`;
const body = valueOf => keys.map(key => `\t${JSON.stringify(key)}: ${valueOf(key)},`).join('\n');
fs.writeFileSync(templatePath, header + body(() => 'null') + '\n};\n');
fs.writeFileSync(ptPath, header + body(key => (pt.get(key) ? JSON.stringify(pt.get(key)) : 'null')) + '\n};\n');

const missing = keys.filter(key => !pt.get(key));
console.log(`Chaves: ${keys.length}. Sem tradução pt: ${missing.length}`);
for (const key of missing) console.log(`  - ${key}`);
