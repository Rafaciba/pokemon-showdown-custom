// Valida um lote traduzido: node scripts/traducao/validar.cjs <pasta> <lote>
//   <lote> = nome sem .json (ex.: batalha-01, ui-01, regras-01, dicionario-01).
// Compara <pasta>/src/<lote>.json (inglês) com <pasta>/out/<lote>.json (pt-BR). Os lotes
// "dicionario-*" (textos da interface clássica, levantados à mão) só têm out/.
'use strict';
const fs = require('fs');
const path = require('path');

const [dir, name] = process.argv.slice(2);
if (!dir || !name) {
	console.log('Uso: node scripts/traducao/validar.cjs <pasta> <lote>');
	process.exit(1);
}
const errors = [], warnings = [];
const readJSON = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
let out;
try {
	out = readJSON(`out/${name}.json`);
} catch (e) {
	console.log(`ERRO: out/${name}.json ausente ou JSON inválido: ${e.message}`);
	process.exit(1);
}

if (name.startsWith('dicionario')) {
	validateDictionary(out);
} else {
	validateBatch(readJSON(`src/${name}.json`), out);
}

function validateBatch(src, translated) {
	const TYPES = 'Normal|Fire|Water|Electric|Grass|Ice|Fighting|Poison|Ground|Flying|Psychic|Bug|Rock|Ghost|Dragon|Dark|Steel|Fairy|Stellar';
	const PT_TYPES = /\btipos? (Fogo|Água|Agua|Planta|Grama|Elétrico|Eletrico|Gelo|Lutador|Luta|Venenoso|Veneno|Terrestre|Terra|Voador|Psíquico|Inseto|Pedra|Fantasma|Dragão|Sombrio|Noturno|Aço|Fada|Estelar)\b/i;
	const tokens = s => (s.match(/\[[A-Z][A-Z0-9]*(?::[^\]]*)?\]|\{(?!INFLECT)[A-Z][A-Z0-9]*(?::[^}]*)?\}/g) || [])
		.map(t => t.replace(/:.*(?=[\]}])/, '')).sort().join(' ');
	const loose = new RegExp(`(?<!tipos? (?:(?:${TYPES}|\\?\\?\\?)(?:, | e | ou |/))*)\\b(${TYPES})\\b(?![ -][A-Z])`, 'g');
	for (const key of Object.keys(src)) {
		if (!(key in translated)) { errors.push(`faltando: ${key}`); continue; }
		let en = src[key];
		const pt = translated[key];
		if (typeof pt !== 'string' || !pt.trim()) { errors.push(`vazio ou não-texto: ${key}`); continue; }
		if (name.startsWith('ui') && /^\[.*\]$/.test(en)) {
			// Botões do catálogo de interface: a tradução vai SEM os colchetes
			if (/^\[.*\]$/.test(pt)) errors.push(`botão com colchetes (tire-os) em ${key}`);
			en = en.slice(1, -1);
		}
		if (tokens(en) !== tokens(pt)) errors.push(`placeholders diferentes em ${key}: [${tokens(en)}] -> [${tokens(pt)}]`);
		if (/^\s*/.exec(en)[0] !== /^\s*/.exec(pt)[0]) errors.push(`espaços iniciais diferentes em ${key}`);
		if (/\{[A-Z]+:(definite|indefinite|accusative|nominative|a|de|capitalize)/.test(pt) ||
			(/\[[A-Z]+:/.test(pt) && !/\[[A-Z]+:/.test(en))) {
			errors.push(`modificador não suportado em ${key}: ${pt}`);
		}
		if (PT_TYPES.test(pt)) errors.push(`tipo traduzido (use o nome em inglês) em ${key}: ${pt}`);
		if (new RegExp(`\\b(${TYPES})[- ]type`).test(en)) {
			for (const m of pt.matchAll(loose)) warnings.push(`tipo sem "tipo" antes? ${key}: "${m[1]}" em: ${pt}`);
		}
		if (key.split('|').pop() === 'shortDesc') {
			const limit = key.startsWith('Moves|') ? 55 : 85;
			if (pt.length > Math.max(limit, en.length + 5)) warnings.push(`shortDesc longo (${pt.length}) ${key}: ${pt}`);
		}
		if (/[\u0000-\u0008\u000b-\u001f]/.test(pt)) errors.push(`caractere de controle em ${key}`);
	}
	for (const key of Object.keys(translated)) if (!(key in src)) errors.push(`chave extra: ${key}`);
}

function validateDictionary(dict) {
	const norm = s => s.replace(/\s+/g, ' ').trim();
	const slots = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
	if (!dict.exact || typeof dict.exact !== 'object') errors.push('falta "exact"');
	if (!Array.isArray(dict.patterns)) errors.push('"patterns" deve ser uma lista');
	for (const [en, pt] of Object.entries(dict.exact || {})) {
		if (typeof pt !== 'string' || !pt.trim()) errors.push(`exact vazio: ${en}`);
		else if (en !== norm(en)) errors.push(`exact com espaços nas pontas ou duplicados (normalize): "${en}"`);
		else if (/[<>]/.test(en) || /[<>]/.test(pt)) errors.push(`exact não pode ter tags (use "html"): ${en}`);
		else if (/&[a-z]+;|&#\d+;/.test(en)) errors.push(`exact com entidade HTML (decodifique): ${en}`);
		else if (/\{\d+\}/.test(en)) errors.push(`exact com {n} (use "patterns"): ${en}`);
		else if (!/[A-Za-z]{2}/.test(en)) errors.push(`exact sem palavra: ${en}`);
	}
	for (const p of dict.patterns || []) {
		if (!p || typeof p.en !== 'string' || typeof p.pt !== 'string') { errors.push('pattern inválido: ' + JSON.stringify(p)); continue; }
		if (!/\{\d+\}/.test(p.en)) errors.push(`pattern sem {n} (use "exact"): ${p.en}`);
		if (slots(p.en) !== slots(p.pt)) errors.push(`pattern com {n} diferentes: ${p.en} -> ${p.pt}`);
		if (p.en !== norm(p.en)) errors.push(`pattern não normalizado: "${p.en}"`);
		if (/[<>]/.test(p.en + p.pt)) errors.push(`pattern não pode ter tags: ${p.en}`);
		if (/^\{\d+\}$/.test(p.en)) errors.push(`pattern só com variável: ${p.en}`);
	}
	for (const [en, pt] of Object.entries(dict.html || {})) {
		if (/\{\d+\}|\$\{|' \+|" \+/.test(en + pt)) errors.push(`html não pode ter variáveis: ${en}`);
		const tags = s => (s.match(/<\/?[a-z][^>]*>/gi) || []).map(t => t.replace(/\s.*>/, '>').toLowerCase()).join('');
		if (tags(en) !== tags(pt)) errors.push(`html com tags diferentes: ${en}`);
		if (/<script|on[a-z]+=|javascript:/i.test(pt)) errors.push(`html proibido (script/evento): ${pt}`);
	}
}

console.log(`${name}: ${errors.length} erros, ${warnings.length} avisos`);
for (const e of errors.slice(0, 80)) console.log('ERRO: ' + e);
for (const w of warnings.slice(0, 80)) console.log('AVISO: ' + w);
process.exit(errors.length ? 1 : 0);
