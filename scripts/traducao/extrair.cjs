// Extrai, em lotes JSON, os textos em inglês que ainda não têm tradução pt-BR.
//   node scripts/traducao/extrair.cjs <pasta>
// Antes: `docker compose exec server node build` (lê o código compilado do servidor) e,
// se o catálogo do cliente mudou, `node build translations --sync` no client-build.
// Gera <pasta>/src/*.json; traduza para <pasta>/out/<mesmo nome>.json (ver docs/traducao-pt-br.md).
'use strict';
const fs = require('fs');
const path = require('path');
const { PATHS, loadBattleTexts, loadDictionary, ruleDescriptions, walkCatalog } = require('./comum.cjs');

const dir = process.argv[2];
if (!dir) {
	console.log('Uso: node scripts/traducao/extrair.cjs <pasta>');
	process.exit(1);
}
const srcDir = path.join(dir, 'src');
fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });

function writeChunks(name, entries, maxChars = 38000) {
	let part = 1, current = {}, size = 0, lastId = '';
	const flush = () => {
		if (!Object.keys(current).length) return;
		const file = path.join(srcDir, `${name}-${String(part).padStart(2, '0')}.json`);
		fs.writeFileSync(file, JSON.stringify(current, null, '\t'));
		console.log(path.basename(file), Object.keys(current).length, 'textos');
		part++; current = {}; size = 0;
	};
	for (const [key, value] of Object.entries(entries)) {
		const id = key.split('|')[1];
		if (size > maxChars && id !== lastId) flush();
		current[key] = value; size += value.length; lastId = id;
	}
	flush();
}

// 1. Textos de batalha (descrições, mensagens, nomes de atributos, tags)
const { en, pt } = loadBattleTexts();
const battle = {};
for (const [key, value] of Object.entries(en)) if (!(key in pt)) battle[key] = value;
writeChunks('batalha', battle);

// 2. Catálogos de interface (cliente e compartilhado com o servidor)
const ui = {}, notes = {};
walkCatalog(fs.readFileSync(PATHS.uiClient, 'utf8'), (i, lines, key, context, value, note) => {
	if (value !== null) return;
	const id = context === null ? `client::${key}` : `client::${key}::${context}`;
	ui[id] = key;
	if (note.length) notes[id] = note.join(' / ');
});
const serverDone = new Set();
if (fs.existsSync(PATHS.uiServer)) {
	walkCatalog(fs.readFileSync(PATHS.uiServer, 'utf8'), (i, lines, key, context, value) => {
		if (value !== null) serverDone.add(context === null ? key : `${key}::${context}`);
	});
}
walkCatalog(fs.readFileSync(PATHS.uiTemplate, 'utf8'), (i, lines, key, context, value, note) => {
	if (serverDone.has(context === null ? key : `${key}::${context}`)) return;
	const id = context === null ? `server::${key}` : `server::${key}::${context}`;
	ui[id] = key;
	if (note.length || context !== null) notes[id] = [...note, ...(context !== null ? [`contexto: "${context}"`] : [])].join(' / ');
});
if (Object.keys(ui).length) {
	fs.writeFileSync(path.join(srcDir, 'ui-01.json'), JSON.stringify(ui, null, '\t'));
	fs.writeFileSync(path.join(dir, 'ui-01.notes.json'), JSON.stringify(notes, null, '\t'));
	console.log('ui-01.json', Object.keys(ui).length, 'textos');
}

// 3. Descrições das regras de formato (entram no dicionário da interface clássica)
const dict = loadDictionary();
const rules = {};
for (const desc of ruleDescriptions()) if (!(desc in dict.exact)) rules[desc] = desc;
if (Object.keys(rules).length) {
	fs.writeFileSync(path.join(srcDir, 'regras-01.json'), JSON.stringify(rules, null, '\t'));
	console.log('regras-01.json', Object.keys(rules).length, 'textos');
}
console.log('Interface clássica (src/oldclient/*.js): textos novos são levantados à mão; ver docs/traducao-pt-br.md.');
