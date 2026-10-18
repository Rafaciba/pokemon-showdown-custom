// Funções comuns das ferramentas de tradução pt-BR (ver docs/traducao-pt-br.md).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const PATHS = {
	textEn: path.join(ROOT, 'server/dist/data/text'),
	textPt: path.join(ROOT, 'server/dist/data/text/pt'),
	textPtSource: path.join(ROOT, 'server/data/text/pt'),
	uiTemplate: path.join(ROOT, 'server/data/text/ui-template.ts'),
	uiServer: path.join(ROOT, 'server/data/text/pt/ui.ts'),
	uiClient: path.join(ROOT, 'client/translations/pt.ts'),
	dictionary: path.join(ROOT, 'client/play.pokemonshowdown.com/src/oldclient/client-i18n-pt.js'),
	server: path.join(ROOT, 'server'),
};

// Tabelas de batalha: arquivo, export e se o "name" fica de fora (nomes em inglês)
const TABLES = [
	{ file: 'moves', exportName: 'MovesText', type: '{ [id: IDEntry]: Partial<MoveText> }', table: 'Moves' },
	{ file: 'abilities', exportName: 'AbilitiesText', type: '{ [id: IDEntry]: Partial<AbilityText> }', table: 'Abilities' },
	{ file: 'items', exportName: 'ItemsText', type: '{ [id: IDEntry]: Partial<ItemText> }', table: 'Items' },
	{ file: 'default', exportName: 'DefaultText', type: '{ [id: IDEntry]: DefaultText }', table: 'Default' },
];
const NAME_TABLES = ['StatNames', 'StatMediumNames', 'StatusNames', 'TargetNames', 'GenderNames', 'ColorNames'];
const SKIP_KEYS = new Set(['name', 'grammar', 'articleRule', 'classified']);
const STAT_GRAMMAR = {
	hp: 'ms', atk: 'ms', def: 'fs', spa: 'ms', spd: 'fs', spe: 'fs', accuracy: 'fs', evasion: 'fs', spc: 'ms', stats: 'mp',
};

function requireFresh(file) {
	try {
		delete require.cache[require.resolve(file)];
		return require(file);
	} catch (e) {
		if (e.code === 'MODULE_NOT_FOUND') return {};
		throw e;
	}
}

/** Textos traduzíveis de uma tabela de batalha: { "Moves|id|campo[|sub]": texto } */
function collectTexts(tableName, table, out = {}) {
	for (const [id, entry] of Object.entries(table || {})) {
		const walk = (obj, prefix) => {
			for (const [key, value] of Object.entries(obj)) {
				if (SKIP_KEYS.has(key)) continue;
				const keyPath = prefix ? `${prefix}|${key}` : key;
				if (typeof value === 'string') {
					if (value.startsWith('#') || !/[A-Za-z]{2}/.test(value)) continue;
					out[`${tableName}|${id}|${keyPath}`] = value;
				} else if (value && typeof value === 'object') {
					walk(value, keyPath);
				}
			}
		};
		walk(entry, '');
	}
	return out;
}

/** Todos os textos de batalha em inglês e em português (do código compilado do servidor). */
function loadBattleTexts() {
	const en = {}, pt = {};
	for (const { file, exportName, table } of TABLES) {
		collectTexts(table, requireFresh(`${PATHS.textEn}/${file}`)[exportName], en);
		collectTexts(table, requireFresh(`${PATHS.textPt}/${file}`)[exportName], pt);
	}
	const namesEn = requireFresh(`${PATHS.textEn}/names`), namesPt = requireFresh(`${PATHS.textPt}/names`);
	for (const table of NAME_TABLES) {
		for (const [id, value] of Object.entries(namesEn[table] || {})) en[`${table}|${id}`] = value;
		for (const [id, value] of Object.entries(namesPt[table] || {})) {
			if (!id.includes(':') && typeof value === 'string') pt[`${table}|${id}`] = value;
		}
	}
	const tagsEn = requireFresh(`${PATHS.textEn}/tags`).TagsText || {};
	const tagsPt = requireFresh(`${PATHS.textPt}/tags`).TagsText || {};
	for (const [target, tags] of [[en, tagsEn], [pt, tagsPt]]) {
		for (const [id, entry] of Object.entries(tags)) {
			for (const field of ['name', 'hint', 'desc']) if (entry[field]) target[`Tags|${id}|${field}`] = entry[field];
		}
	}
	return { en, pt };
}

/** Lê o dicionário da interface clássica (window.PSCustomI18nPT). */
function loadDictionary() {
	const sandbox = { window: {} };
	vm.runInNewContext(fs.readFileSync(PATHS.dictionary, 'utf8'), sandbox);
	return sandbox.window.PSCustomI18nPT;
}

function writeDictionary(dict) {
	const sorted = { exact: {}, patterns: dict.patterns, html: dict.html };
	for (const key of Object.keys(dict.exact).sort()) sorted.exact[key] = dict.exact[key];
	// Padrões mais específicos (mais texto fixo) primeiro
	sorted.patterns.sort((a, b) => b.en.replace(/\{\d+\}/g, '').length - a.en.replace(/\{\d+\}/g, '').length);
	fs.writeFileSync(PATHS.dictionary, `/**
 * pokemon-showdown-custom: dicionário pt-BR da interface do cliente clássico.
 * Usado por client-i18n.js (ver o formato lá). Gerado a partir do levantamento dos
 * textos de src/oldclient/*.js e index-old.html; edite aqui para corrigir traduções.
 * Ferramentas e regras: docs/traducao-pt-br.md (repositório raiz).
 *
 * @license MIT
 */
window.PSCustomI18nPT = ${JSON.stringify(sorted, null, '\t')};
`);
}

/** Descrições das regras de formato que aparecem no log ("|rule|Nome: descrição"). */
function ruleDescriptions() {
	const out = new Set();
	const decode = s => s.replace(/&eacute;/g, 'é').replace(/\s+/g, ' ').trim();
	for (const rule of Object.values(requireFresh(`${PATHS.server}/dist/data/rulesets`).Rulesets || {})) {
		if (rule.desc && /[A-Za-z]{2}/.test(rule.desc)) out.add(decode(rule.desc));
	}
	const files = ['data/rulesets.ts', 'config/formats.ts'];
	for (const mod of fs.readdirSync(`${PATHS.server}/data/mods`)) {
		if (fs.existsSync(`${PATHS.server}/data/mods/${mod}/rulesets.ts`)) files.push(`data/mods/${mod}/rulesets.ts`);
	}
	const re = /add\(\s*'rule',\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g;
	for (const file of files) {
		const source = fs.readFileSync(`${PATHS.server}/${file}`, 'utf8');
		let match;
		while ((match = re.exec(source))) {
			if (match[1].startsWith('`') && match[1].includes('${')) continue;
			const text = vm.runInNewContext(match[1]);
			const index = text.indexOf(': ');
			if (index >= 0 && /[A-Za-z]{2}/.test(text.slice(index + 2))) out.add(decode(text.slice(index + 2)));
		}
	}
	return [...out];
}

/**
 * Percorre um catálogo de interface (TranslationCatalog) e chama
 * visit(índice, linhas, chave, contexto|null, valor|null, notas).
 */
function walkCatalog(source, visit) {
	const lines = source.split('\n');
	let parent = null;
	const notes = [];
	lines.forEach((line, i) => {
		let m;
		if ((m = /^\s*\/\/ TRANSLATORS: (.*)$/.exec(line))) { notes.push(m[1]); return; }
		if ((m = /^\t"((?:[^"\\]|\\.)*)": \{\s*$/.exec(line))) { parent = JSON.parse(`"${m[1]}"`); return; }
		if (parent !== null && /^\t\},?\s*$/.test(line)) { parent = null; notes.length = 0; return; }
		if ((m = /^\t+"((?:[^"\\]|\\.)*)": (null|"(?:[^"\\]|\\.)*"),/.exec(line))) {
			const key = JSON.parse(`"${m[1]}"`);
			const value = m[2] === 'null' ? null : JSON.parse(m[2]);
			visit(i, lines, parent === null ? key : parent, parent === null ? null : key, value, notes.splice(0));
			return;
		}
		if (line.trim() && !line.trim().startsWith('//')) notes.length = 0;
	});
	return lines;
}

module.exports = {
	ROOT, PATHS, TABLES, NAME_TABLES, STAT_GRAMMAR, requireFresh, collectTexts, loadBattleTexts,
	loadDictionary, writeDictionary, ruleDescriptions, walkCatalog,
};
