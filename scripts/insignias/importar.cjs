#!/usr/bin/env node
/**
 * Importa as insígnias de ginásio da página "Badge" da Bulbapedia salva no disco
 * (Ctrl+S, "Página da Web, completa"; ver docs/insignias.md).
 *
 * Uso: node scripts/insignias/importar.cjs "<página>.htm"
 *
 * - Gera o catálogo server/server/chat-plugins/gym-challenge/badge-catalog.ts (no fork
 *   do servidor): id, nome, região, líderes, cidade, tipo e arquivo da imagem.
 * - Copia as imagens para assets/badges/<id>.png (fora do git: são da Nintendo; o
 *   Caddy serve a pasta em /badges/).
 *
 * Só entram os ginásios das ligas dos jogos principais (Indigo até Paldea; em Paldea,
 * só a Victory Road). A página não diz o tipo em texto: ele vem da cor do quadro de
 * cada insígnia, que segue a paleta de tipos da Bulbapedia. Insígnias repetidas
 * entre Black/White e Black 2/White 2 (mesma imagem) viram uma só, com os líderes
 * juntos. A Trio Badge não tem tipo fixo (Cilan/Grass, Chili/Fire, Cress/Water).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CATALOG = path.join(ROOT, 'server/server/chat-plugins/gym-challenge/badge-catalog.ts');
const IMAGES = path.join(ROOT, 'assets/badges');

const TYPE_COLORS = {
	'9fa19f': 'Normal', 'e62829': 'Fire', '2980ef': 'Water', 'fac000': 'Electric', '3fa129': 'Grass',
	'3dcef3': 'Ice', 'ff8000': 'Fighting', '9141cb': 'Poison', '915121': 'Ground', '81b9ef': 'Flying',
	'ef4179': 'Psychic', '91a119': 'Bug', 'afa981': 'Rock', '704170': 'Ghost', '5060e1': 'Dragon',
	'624d4e': 'Dark', '60a1b8': 'Steel', 'ef70ef': 'Fairy',
};
/** Insígnias entregues por líderes de tipos diferentes, conforme a escolha do jogador. */
const NO_FIXED_TYPE = new Set(['unova-trio']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
	if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1));
	return ENTITIES[e] ?? m;
});
const text = fragment => decode(fragment.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const all = (re, s) => [...s.matchAll(re)];

function extract(page) {
	const html = fs.readFileSync(page, 'utf8');
	const start = html.indexOf('id="Indigo_League"');
	const end = html.indexOf('<h4><span id=".E2.98.85_Starfall_Street');
	if (start < 0 || end < 0) throw new Error('Página inesperada: salve a página Badge completa (ver docs/insignias.md).');
	const section = html.slice(start, end);
	const filesDir = page.replace(/\.html?$/i, '_files');

	const leagues = all(/<th colspan="2"[^>]*>([\s\S]*?)<\/th>\s*<\/tr>\s*<tr>\s*<th[^>]*>[\s\S]*?Badges:[\s\S]*?Region:<\/span><\/a>\s*([\s\S]*?)<\/th>/g, section)
		.map(m => ({ pos: m.index, region: text(m[2]) }));
	const regionAt = pos => leagues.filter(l => l.pos < pos).pop()?.region;

	const starts = all(/<span typeof="mw:File"><a href="https:\/\/bulbapedia\.bulbagarden\.net\/wiki\/File:([^"]+)" class="mw-file-description">(<img [^>]+>)/g, section);
	const badges = new Map();
	const errors = [];
	starts.forEach((m, i) => {
		const [, filePage, img] = m;
		const block = section.slice(m.index + m[0].length, i + 1 < starts.length ? starts[i + 1].index : section.length);
		const before = section.slice(Math.max(0, m.index - 4000), m.index);
		const named = /^<\/a><\/span><br><b>([^<]+)<\/b>/.exec(block);
		const paldea = /^SVbadge_VictoryRoad_([A-Za-z]+)\.png$/.exec(filePage);
		const name = named ? decode(named[1]).trim() : paldea ? `${paldea[1]} Badge` : null;
		if (!name?.includes('Badge')) return;

		const srcset = /srcset="([^"]*)"/.exec(img);
		const candidates = srcset ? all(/_files\/([^ ,"]+)/g, srcset[1]).map(x => x[1]) : [];
		const image = decodeURIComponent(candidates.pop() || /_files\/([^"]+)"/.exec(img)[1]);
		const colors = all(/background: rgb\((\d+), (\d+), (\d+)\); border: 4px/g, before);
		const color = colors.length ? colors.pop().slice(1).map(n => (+n).toString(16).padStart(2, '0')).join('') : '';
		const cityMatch = /<\/i><br>([\s\S]*?)<\/table>/.exec(block) || /<small>([\s\S]*?)<\/small>/.exec(block);
		const giver = /Giver<\/span>[\s\S]*?<td[^>]*colspan="2"[^>]*>([\s\S]*?)<\/td>/.exec(block);
		const others = /Others in the games<\/span>[\s\S]*?<td[^>]*colspan="2"[^>]*>([\s\S]*?)<\/td>/.exec(block);
		const region = regionAt(m.index);
		const id = `${slug(region)}-${slug(name.replace(/ Badge$/, ''))}`;
		let type = TYPE_COLORS[color] || null;
		if (NO_FIXED_TYPE.has(id)) type = null;
		else if (!type) errors.push(`${name} (${region}): cor ${color || '?'} sem tipo`);

		const leaders = [giver && text(giver[1])];
		// Trio Badge: os três irmãos entregam a mesma insígnia
		if (NO_FIXED_TYPE.has(id) && others) leaders.push(...text(others[1]).split(/,\s*|\s+and\s+/));
		const existing = badges.get(id);
		if (existing) {
			// Mesma insígnia em Black/White e Black 2/White 2
			if (existing.source !== image) errors.push(`${id}: imagens diferentes (${existing.source}, ${image})`);
			for (const leader of leaders) if (leader && !existing.leaders.includes(leader)) existing.leaders.push(leader);
			return;
		}
		badges.set(id, {
			id, name, region, leaders: leaders.filter(Boolean), city: cityMatch ? text(cityMatch[1]) : '', type,
			image: `${id}.png`, source: image, sourcePath: path.join(filesDir, image),
		});
	});
	if (errors.length) throw new Error(`Problemas na extração:\n- ${errors.join('\n- ')}`);
	return [...badges.values()];
}

function writeCatalog(badges) {
	// Mesmo estilo do código do PS (aspas simples, linhas até 120 caracteres)
	const q = s => s === null ? 'null' : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
	const rows = badges.map(b => `\t{\n\t\tid: ${q(b.id)}, name: ${q(b.name)}, region: ${q(b.region)}, city: ${q(b.city)},\n` +
		`\t\tleaders: [${b.leaders.map(q).join(', ')}], type: ${q(b.type)}, image: ${q(b.image)},\n\t},`);
	const source = `/**
 * pokemon-showdown-custom: catálogo das insígnias de ginásio dos jogos principais.
 *
 * GERADO por scripts/insignias/importar.cjs (repo pokemon-showdown-custom) a partir da
 * página "Badge" da Bulbapedia; não edite à mão. As imagens (/badges/<image>) não ficam
 * no git: ver docs/insignias.md.
 *
 * @license MIT
 */

export interface BadgeInfo {
	id: string;
	name: string;
	region: string;
	/** Quem entrega a insígnia nos jogos. */
	leaders: string[];
	city: string;
	/** Tipo do ginásio; null quando varia (Trio Badge). */
	type: string | null;
	image: string;
}

export const BADGES: readonly BadgeInfo[] = [
${rows.join('\n')}
];
`;
	fs.writeFileSync(CATALOG, source.replace(/\r\n/g, '\n'));
}

function copyImages(badges) {
	fs.mkdirSync(IMAGES, { recursive: true });
	for (const badge of badges) {
		if (!fs.existsSync(badge.sourcePath)) throw new Error(`Imagem não encontrada: ${badge.sourcePath}`);
		fs.copyFileSync(badge.sourcePath, path.join(IMAGES, badge.image));
	}
}

const page = process.argv[2];
if (!page) {
	console.error('Uso: node scripts/insignias/importar.cjs "<página Badge salva>.htm"');
	process.exit(1);
}
const badges = extract(path.resolve(page));
copyImages(badges);
writeCatalog(badges);
const byRegion = {};
for (const b of badges) byRegion[b.region] = (byRegion[b.region] || 0) + 1;
console.log(`${badges.length} insígnias: ${Object.entries(byRegion).map(([r, n]) => `${r} ${n}`).join(', ')}`);
console.log(`Catálogo: ${path.relative(ROOT, CATALOG)}; imagens: ${path.relative(ROOT, IMAGES)}/`);
