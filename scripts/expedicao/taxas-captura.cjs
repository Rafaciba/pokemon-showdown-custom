#!/usr/bin/env node
/**
 * Gera a tabela de taxas de captura das espécies para a Expedição (captura com chance,
 * etapa 8), a partir do pokemon_species.csv do PokéAPI (o PS não tem esse dado).
 *
 * Uso: node scripts/expedicao/taxas-captura.cjs <pokemon_species.csv>
 *   O arquivo vem de
 *   https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
 *
 * Gera server/server/chat-plugins/expedition/catch-rates.ts (no fork do servidor), com
 * a taxa de cada espécie pelo número da Pokédex nacional. O PokéAPI é distribuído sob a
 * licença BSD de 3 cláusulas: o arquivo gerado leva o aviso de copyright e a licença.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'server/server/chat-plugins/expedition/catch-rates.ts');

const [, , csvPath] = process.argv;
if (!csvPath) {
	console.error('Uso: node scripts/expedicao/taxas-captura.cjs <pokemon_species.csv>');
	process.exit(1);
}
const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
const header = lines.shift().split(',');
const idCol = header.indexOf('id');
const rateCol = header.indexOf('capture_rate');
if (idCol < 0 || rateCol < 0) throw new Error('colunas id e capture_rate não encontradas');
const rates = [];
for (const line of lines) {
	const cols = line.split(',');
	const id = Number(cols[idCol]);
	const rate = Number(cols[rateCol]);
	if (!Number.isInteger(id) || !Number.isInteger(rate) || rate < 1 || rate > 255) continue;
	rates[id] = rate;
}
const body = [];
for (let id = 1; id < rates.length; id += 20) {
	body.push('\t' + rates.slice(id, id + 20).map(rate => String(rate ?? 0)).join(', ') + ',');
}
const out = `/**
 * pokemon-showdown-custom: taxas de captura das espécies (captura com chance da Expedição).
 *
 * GERADO por scripts/expedicao/taxas-captura.cjs (repo pokemon-showdown-custom) a partir
 * do pokemon_species.csv do PokéAPI; não edite à mão. Índice = número da Pokédex
 * nacional (o 0 não é usado); 0 = sem dado.
 *
 * Dados do PokéAPI, distribuídos sob a licença abaixo (texto integral):
 *
 * Copyright (c) © 2013–2023 Paul Hallett and PokéAPI contributors
 * (https://github.com/PokeAPI/pokeapi#contributing). Pokémon and Pokémon character names
 * are trademarks of Nintendo.
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are
 * permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * * Neither the name of PokéAPI nor the names of its contributors may be used to endorse
 * or promote products derived from this software without specific prior written
 * permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
 * WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
 * DAMAGE.
 *
 * @license MIT (o código); os dados seguem a licença acima
 */

export const CATCH_RATES: readonly number[] = [
	0,
${body.join('\n')}
];
`;
fs.writeFileSync(OUT, out);
console.log(`${rates.filter(Boolean).length} espécies -> ${path.relative(ROOT, OUT)}`);
