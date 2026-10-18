// Aplica os lotes traduzidos de <pasta>/out nos arquivos pt-BR dos forks.
//   node scripts/traducao/aplicar.cjs <pasta>
// - batalha-*.json → server/data/text/pt/{moves,abilities,items,default,names,tags}.ts
//   (junta com o que já está traduzido; a ordem segue os arquivos em inglês)
// - ui-01.json     → client/translations/pt.ts e server/data/text/pt/ui.ts
// - regras-*.json e dicionario-*.json → client/.../oldclient/client-i18n-pt.js
// Depois: `docker compose exec server node build` e, no client-build, `node build translations && node build`.
'use strict';
const fs = require('fs');
const path = require('path');
const {
	PATHS, TABLES, NAME_TABLES, STAT_GRAMMAR, requireFresh, loadBattleTexts, loadDictionary, writeDictionary, walkCatalog,
} = require('./comum.cjs');

const dir = process.argv[2];
if (!dir) {
	console.log('Uso: node scripts/traducao/aplicar.cjs <pasta>');
	process.exit(1);
}
const outDir = path.join(dir, 'out');
const outFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.json')).sort();
const readOut = file => JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'));

/*********************************************************
 * Textos de batalha
 *********************************************************/

const batchFiles = outFiles.filter(f => /^batalha-\d+\.json$/.test(f));
if (batchFiles.length) {
	const { pt } = loadBattleTexts();
	for (const file of batchFiles) Object.assign(pt, readOut(file));

	const tables = {};
	for (const [key, value] of Object.entries(pt)) {
		const parts = key.split('|');
		let node = tables;
		for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ||= {};
		node[parts[parts.length - 1]] = value;
	}
	const ordered = (english, localized) => {
		if (!localized) return {};
		const result = {};
		for (const key of Object.keys(english || {})) {
			if (!(key in localized)) continue;
			const value = localized[key];
			result[key] = value && typeof value === 'object' ? ordered(english[key], value) : value;
		}
		for (const key of Object.keys(localized)) if (!(key in result)) result[key] = localized[key];
		return result;
	};
	const ident = key => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key));
	const serialize = (value, indent) => {
		if (typeof value === 'string') return JSON.stringify(value);
		const pad = '\t'.repeat(indent + 1);
		const lines = Object.entries(value).map(([k, v]) => `${pad}${ident(k)}: ${serialize(v, indent + 1)},`);
		return `{\n${lines.join('\n')}\n${'\t'.repeat(indent)}}`;
	};
	const HEADER = `// pt-BR (pokemon-showdown-custom). Nomes de Pokémon, golpes, habilidades, itens, naturezas e
//   tipos ficam em inglês (nada de "name" aqui: cai no inglês). Tipos sempre depois de
//   "tipo/tipos", porque o cliente troca esse trecho pelo selo do tipo. Atributos por extenso
//   em português, abreviações em inglês. Vírgula decimal. Gerado por scripts/traducao/aplicar.cjs
//   (repositório raiz); ver docs/traducao-pt-br.md.
`;
	fs.mkdirSync(PATHS.textPtSource, { recursive: true });
	for (const { file, exportName, type, table } of TABLES) {
		const english = requireFresh(`${PATHS.textEn}/${file}`)[exportName];
		const body = serialize(ordered(english, tables[table]), 0);
		fs.writeFileSync(path.join(PATHS.textPtSource, `${file}.ts`), `${HEADER}\nexport const ${exportName}: ${type} = ${body};\n`);
	}
	const tagsEnglish = requireFresh(`${PATHS.textEn}/tags`).TagsText;
	fs.writeFileSync(path.join(PATHS.textPtSource, 'tags.ts'),
		`${HEADER}\nexport const TagsText: { [id: string]: TagText } = ${serialize(ordered(tagsEnglish, tables.Tags), 0)};\n`);

	const names = requireFresh(`${PATHS.textEn}/names`);
	let buf = HEADER;
	for (const table of NAME_TABLES) {
		const entries = ordered(names[table], tables[table]);
		if (table === 'StatNames') {
			const withGrammar = {};
			for (const [id, value] of Object.entries(entries)) {
				withGrammar[id] = value;
				if (STAT_GRAMMAR[id]) withGrammar[`${id}:grammar`] = STAT_GRAMMAR[id];
			}
			buf += `\n// Gênero gramatical dos atributos, para {INFLECT:STAT:...} nas mensagens de batalha\n` +
				`export const StatNames: { [id: string]: TranslationString } = ${serialize(withGrammar, 0)};\n`;
		} else {
			buf += `\nexport const ${table}: { [id: string]: TranslationString } = ${serialize(entries, 0)};\n`;
		}
	}
	fs.writeFileSync(path.join(PATHS.textPtSource, 'names.ts'), buf);
	console.log(`textos de batalha: ${batchFiles.join(', ')} aplicados`);
}

/*********************************************************
 * Catálogos de interface
 *********************************************************/

if (outFiles.includes('ui-01.json')) {
	const tr = readOut('ui-01.json');
	// Cliente: preenche as entradas null do pt.ts (mantido em sincronia pelo --sync)
	let filled = 0;
	let lines = walkCatalog(fs.readFileSync(PATHS.uiClient, 'utf8'), (i, lines, key, context, value) => {
		const value2 = tr[context === null ? `client::${key}` : `client::${key}::${context}`];
		if (value !== null || typeof value2 !== 'string' || !value2) return;
		lines[i] = lines[i].replace(/: null,.*$/, `: ${JSON.stringify(value2)},`);
		filled++;
	});
	fs.writeFileSync(PATHS.uiClient, lines.join('\n'));
	// Servidor: refaz o ui.ts a partir do modelo, com as traduções antigas e as novas
	const existing = {};
	if (fs.existsSync(PATHS.uiServer)) {
		walkCatalog(fs.readFileSync(PATHS.uiServer, 'utf8'), (i, l, key, context, value) => {
			if (value !== null) existing[context === null ? key : `${key}::${context}`] = value;
		});
	}
	lines = walkCatalog(fs.readFileSync(PATHS.uiTemplate, 'utf8'), (i, lines, key, context) => {
		const id = context === null ? key : `${key}::${context}`;
		const value = tr[`server::${id}`] || existing[id];
		if (typeof value === 'string' && value) lines[i] = lines[i].replace(/: null,.*$/, `: ${JSON.stringify(value)},`);
	});
	fs.writeFileSync(PATHS.uiServer, lines.join('\n')
		.replace(/^import type .*\n/, "import type { TranslationCatalog } from '../../../sim/dex-text';\n"));
	console.log(`catálogos de interface: ${filled} novos no cliente; ui.ts do servidor refeito`);
}

/*********************************************************
 * Dicionário da interface clássica
 *********************************************************/

const dictFiles = outFiles.filter(f => /^(regras|dicionario)-\d+\.json$/.test(f));
if (dictFiles.length) {
	const dict = loadDictionary();
	for (const file of dictFiles) {
		const data = readOut(file);
		if (file.startsWith('regras')) {
			for (const [en, pt] of Object.entries(data)) dict.exact[en] = pt;
			continue;
		}
		Object.assign(dict.exact, data.exact || {});
		for (const pattern of data.patterns || []) {
			dict.patterns = dict.patterns.filter(p => p.en !== pattern.en);
			dict.patterns.push(pattern);
		}
		Object.assign(dict.html, data.html || {});
	}
	writeDictionary(dict);
	console.log(`dicionário da interface clássica: ${dictFiles.join(', ')} aplicados`);
}
