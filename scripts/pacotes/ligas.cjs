#!/usr/bin/env node
/**
 * Gera os pacotes das ligas de Kanto, Johto, Hoenn e Sinnoh (treinadores e desafios)
 * para importar pelo painel admin (Importar e exportar). Formato em docs/pacotes-ginasios.md.
 *
 * Uso (na raiz): node scripts/pacotes/ligas.cjs [pasta de saída, padrão pacotes/]
 *
 * Times competitivos inspirados nos dos jogos, completados até 6 com Pokémon do tipo
 * do treinador, no formato padrão dos desafios (Pokédex completa, Megaevolução sem
 * Tera, Z-Moves e Dynamax). Uma Mega por time, no máximo. Depois de mudar um time,
 * gere de novo e confira importando no ambiente local.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SPA = '252 SpA / 4 SpD / 252 Spe';
const ATK = '252 Atk / 4 SpD / 252 Spe';
const HPDEF = '252 HP / 252 Def / 4 SpD';
const HPSPD = '252 HP / 4 Def / 252 SpD';
const HPATK = '252 HP / 252 Atk / 4 SpD';
const HPSPA = '252 HP / 252 SpA / 4 SpD';
const MIXED = '252 Atk / 4 SpA / 252 Spe';

/** Um set no formato de exportação do teambuilder. */
function s(species, item, ability, nature, evs, moves, ivs) {
	return [
		`${species} @ ${item}`, `Ability: ${ability}`, `EVs: ${evs}`, `${nature} Nature`,
		...(ivs ? [`IVs: ${ivs}`] : []),
		...moves.map(move => `- ${move}`),
	].join('\n');
}

const trainers = {};
/** Registra o treinador e devolve o nome. */
function t(name, title, type, sprite, sets, doubles = false) {
	trainers[name] = { name, title, type, doubles, sprite, team: sets.join('\n\n') };
	return name;
}
const L = 'Gym Leader', E = 'Elite Four', C = 'Champion';

// --- Kanto -------------------------------------------------------------------
const kanto = {
	gyms: [
		[t('Brock', L, 'Rock', 'brock-gen3', [
			s('Aerodactyl', 'Aerodactylite', 'Unnerve', 'Jolly', ATK, ['Stone Edge', 'Earthquake', 'Fire Fang', 'Roost']),
			s('Golem', 'Custap Berry', 'Sturdy', 'Adamant', HPATK, ['Stealth Rock', 'Earthquake', 'Stone Edge', 'Explosion']),
			s('Kabutops', 'Life Orb', 'Swift Swim', 'Adamant', ATK, ['Swords Dance', 'Liquidation', 'Stone Edge', 'Rapid Spin']),
			s('Omastar', 'White Herb', 'Shell Armor', 'Modest', SPA, ['Shell Smash', 'Hydro Pump', 'Ice Beam', 'Earth Power'], '0 Atk'),
			s('Tyranitar', 'Lum Berry', 'Sand Stream', 'Jolly', ATK, ['Dragon Dance', 'Stone Edge', 'Crunch', 'Earthquake']),
			s('Gigalith', 'Leftovers', 'Sand Force', 'Adamant', HPATK, ['Stone Edge', 'Earthquake', 'Superpower', 'Heavy Slam']),
		]), 'kanto-boulder'],
		[t('Misty', L, 'Water', 'misty-gen3', [
			s('Starmie', 'Life Orb', 'Analytic', 'Timid', SPA, ['Hydro Pump', 'Psyshock', 'Ice Beam', 'Thunderbolt'], '0 Atk'),
			s('Gyarados', 'Gyaradosite', 'Intimidate', 'Jolly', ATK, ['Dragon Dance', 'Waterfall', 'Crunch', 'Earthquake']),
			s('Politoed', 'Damp Rock', 'Drizzle', 'Bold', HPDEF, ['Scald', 'Ice Beam', 'Encore', 'Perish Song'], '0 Atk'),
			s('Golduck', 'Life Orb', 'Swift Swim', 'Timid', SPA, ['Hydro Pump', 'Ice Beam', 'Focus Blast', 'Grass Knot'], '0 Atk'),
			s('Quagsire', 'Leftovers', 'Unaware', 'Impish', HPDEF, ['Earthquake', 'Scald', 'Recover', 'Haze']),
			s('Vaporeon', 'Leftovers', 'Water Absorb', 'Bold', HPDEF, ['Scald', 'Wish', 'Protect', 'Haze'], '0 Atk'),
		]), 'kanto-cascade'],
		[t('Lt. Surge', L, 'Electric', 'ltsurge-gen3', [
			s('Raichu', 'Life Orb', 'Lightning Rod', 'Timid', SPA, ['Nasty Plot', 'Thunderbolt', 'Focus Blast', 'Grass Knot'], '0 Atk'),
			s('Electrode', 'Light Clay', 'Aftermath', 'Timid', '252 HP / 4 SpD / 252 Spe', ['Reflect', 'Light Screen', 'Thunderbolt', 'Volt Switch'], '0 Atk'),
			s('Magnezone', 'Air Balloon', 'Magnet Pull', 'Modest', HPSPA, ['Thunderbolt', 'Flash Cannon', 'Volt Switch', 'Body Press']),
			s('Electivire', 'Expert Belt', 'Motor Drive', 'Naive', MIXED, ['Wild Charge', 'Ice Punch', 'Earthquake', 'Flamethrower']),
			s('Jolteon', 'Choice Specs', 'Volt Absorb', 'Timid', SPA, ['Thunderbolt', 'Volt Switch', 'Shadow Ball', 'Hyper Voice'], '0 Atk'),
			s('Ampharos', 'Ampharosite', 'Static', 'Modest', HPSPA, ['Thunderbolt', 'Dragon Pulse', 'Focus Blast', 'Volt Switch'], '0 Atk'),
		]), 'kanto-thunder'],
		[t('Erika', L, 'Grass', 'erika-gen3', [
			s('Venusaur', 'Venusaurite', 'Chlorophyll', 'Calm', HPSPD, ['Giga Drain', 'Sludge Bomb', 'Synthesis', 'Leech Seed'], '0 Atk'),
			s('Vileplume', 'Black Sludge', 'Effect Spore', 'Bold', HPDEF, ['Giga Drain', 'Sludge Bomb', 'Moonblast', 'Sleep Powder'], '0 Atk'),
			s('Victreebel', 'Life Orb', 'Chlorophyll', 'Adamant', ATK, ['Swords Dance', 'Power Whip', 'Poison Jab', 'Sucker Punch']),
			s('Bellossom', 'Leftovers', 'Healer', 'Timid', SPA, ['Quiver Dance', 'Giga Drain', 'Moonblast', 'Sleep Powder'], '0 Atk'),
			s('Tangrowth', 'Rocky Helmet', 'Regenerator', 'Bold', HPDEF, ['Giga Drain', 'Knock Off', 'Sleep Powder', 'Synthesis']),
			s('Jumpluff', 'Leftovers', 'Infiltrator', 'Jolly', '252 HP / 4 Def / 252 Spe', ['Sleep Powder', 'Leech Seed', 'U-turn', 'Encore']),
		]), 'kanto-rainbow'],
		[t('Koga', L, 'Poison', 'koga-gen3', [
			s('Weezing', 'Black Sludge', 'Levitate', 'Bold', HPDEF, ['Sludge Bomb', 'Will-O-Wisp', 'Pain Split', 'Fire Blast'], '0 Atk'),
			s('Muk', 'Assault Vest', 'Poison Touch', 'Adamant', HPATK, ['Gunk Shot', 'Knock Off', 'Drain Punch', 'Shadow Sneak']),
			s('Crobat', 'Heavy-Duty Boots', 'Infiltrator', 'Jolly', ATK, ['Brave Bird', 'U-turn', 'Roost', 'Taunt']),
			s('Venomoth', 'Heavy-Duty Boots', 'Tinted Lens', 'Timid', SPA, ['Quiver Dance', 'Bug Buzz', 'Sludge Bomb', 'Sleep Powder'], '0 Atk'),
			s('Tentacruel', 'Black Sludge', 'Liquid Ooze', 'Calm', HPSPD, ['Rapid Spin', 'Scald', 'Sludge Bomb', 'Toxic Spikes'], '0 Atk'),
			s('Beedrill', 'Beedrillite', 'Swarm', 'Jolly', ATK, ['Swords Dance', 'U-turn', 'Poison Jab', 'Drill Run']),
		]), 'kanto-soul'],
		[t('Sabrina', L, 'Psychic', 'sabrina-gen3', [
			s('Alakazam', 'Alakazite', 'Magic Guard', 'Timid', SPA, ['Psychic', 'Shadow Ball', 'Focus Blast', 'Nasty Plot'], '0 Atk'),
			s('Mr. Mime', 'Light Clay', 'Filter', 'Timid', '252 HP / 4 SpA / 252 Spe', ['Reflect', 'Light Screen', 'Psychic', 'Dazzling Gleam'], '0 Atk'),
			s('Espeon', 'Life Orb', 'Magic Bounce', 'Timid', SPA, ['Calm Mind', 'Psychic', 'Shadow Ball', 'Dazzling Gleam'], '0 Atk'),
			s('Slowbro', 'Leftovers', 'Regenerator', 'Bold', HPDEF, ['Scald', 'Psyshock', 'Slack Off', 'Thunder Wave'], '0 Atk'),
			s('Hypno', 'Leftovers', 'Insomnia', 'Calm', HPSPD, ['Psychic', 'Foul Play', 'Thunder Wave', 'Protect'], '0 Atk'),
			s('Gardevoir', 'Choice Scarf', 'Trace', 'Timid', SPA, ['Moonblast', 'Psychic', 'Focus Blast', 'Healing Wish'], '0 Atk'),
		]), 'kanto-marsh'],
		[t('Blaine', L, 'Fire', 'blaine-gen3', [
			s('Arcanine', 'Heavy-Duty Boots', 'Intimidate', 'Impish', HPDEF, ['Flare Blitz', 'Extreme Speed', 'Will-O-Wisp', 'Morning Sun']),
			s('Charizard', 'Charizardite X', 'Blaze', 'Jolly', ATK, ['Dragon Dance', 'Flare Blitz', 'Dragon Claw', 'Earthquake']),
			s('Magmortar', 'Life Orb', 'Flame Body', 'Modest', SPA, ['Fire Blast', 'Thunderbolt', 'Focus Blast', 'Psychic'], '0 Atk'),
			s('Rapidash', 'Heavy-Duty Boots', 'Flash Fire', 'Jolly', ATK, ['Flare Blitz', 'Wild Charge', 'High Horsepower', 'Morning Sun']),
			s('Ninetales', 'Heat Rock', 'Drought', 'Timid', SPA, ['Nasty Plot', 'Fire Blast', 'Solar Beam', 'Extrasensory'], '0 Atk'),
			s('Magcargo', 'Leftovers', 'Flame Body', 'Bold', HPDEF, ['Lava Plume', 'Stealth Rock', 'Recover', 'Earth Power'], '0 Atk'),
		]), 'kanto-volcano'],
		[t('Giovanni', L, 'Ground', 'giovanni-gen3', [
			s('Nidoking', 'Life Orb', 'Sheer Force', 'Timid', SPA, ['Earth Power', 'Sludge Wave', 'Ice Beam', 'Flamethrower'], '0 Atk'),
			s('Nidoqueen', 'Black Sludge', 'Sheer Force', 'Modest', HPSPA, ['Earth Power', 'Sludge Wave', 'Ice Beam', 'Stealth Rock'], '0 Atk'),
			s('Rhyperior', 'Weakness Policy', 'Solid Rock', 'Adamant', HPATK, ['Earthquake', 'Stone Edge', 'Megahorn', 'Ice Punch']),
			s('Dugtrio', 'Focus Sash', 'Arena Trap', 'Jolly', ATK, ['Earthquake', 'Stone Edge', 'Sucker Punch', 'Memento']),
			s('Marowak', 'Thick Club', 'Rock Head', 'Adamant', HPATK, ['Swords Dance', 'Earthquake', 'Stone Edge', 'Knock Off']),
			s('Steelix', 'Steelixite', 'Sturdy', 'Adamant', HPATK, ['Stealth Rock', 'Earthquake', 'Heavy Slam', 'Stone Edge']),
		]), 'kanto-earth'],
	],
	elite4: [
		t('Lorelei', E, 'Ice', 'lorelei-gen3', [
			s('Lapras', 'Leftovers', 'Water Absorb', 'Modest', HPSPA, ['Freeze-Dry', 'Surf', 'Thunderbolt', 'Psychic'], '0 Atk'),
			s('Cloyster', 'White Herb', 'Skill Link', 'Jolly', ATK, ['Shell Smash', 'Icicle Spear', 'Rock Blast', 'Rapid Spin']),
			s('Dewgong', 'Leftovers', 'Thick Fat', 'Bold', HPDEF, ['Surf', 'Ice Beam', 'Encore', 'Protect'], '0 Atk'),
			s('Jynx', 'Choice Specs', 'Dry Skin', 'Timid', SPA, ['Ice Beam', 'Psychic', 'Focus Blast', 'Energy Ball'], '0 Atk'),
			s('Mamoswine', 'Life Orb', 'Thick Fat', 'Jolly', ATK, ['Icicle Crash', 'Earthquake', 'Ice Shard', 'Stealth Rock']),
			s('Abomasnow', 'Abomasite', 'Snow Warning', 'Mild', '4 Atk / 252 SpA / 252 HP', ['Blizzard', 'Giga Drain', 'Ice Shard', 'Earthquake']),
		]),
		t('Bruno', E, 'Fighting', 'bruno-gen3', [
			s('Machamp', 'Assault Vest', 'No Guard', 'Adamant', HPATK, ['Dynamic Punch', 'Knock Off', 'Bullet Punch', 'Ice Punch']),
			s('Hitmonlee', 'Life Orb', 'Reckless', 'Jolly', ATK, ['High Jump Kick', 'Knock Off', 'Stone Edge', 'Poison Jab']),
			s('Hitmonchan', 'Assault Vest', 'Iron Fist', 'Adamant', HPATK, ['Drain Punch', 'Ice Punch', 'Thunder Punch', 'Mach Punch']),
			s('Poliwrath', 'Leftovers', 'Water Absorb', 'Adamant', HPATK, ['Bulk Up', 'Drain Punch', 'Waterfall', 'Ice Punch']),
			s('Conkeldurr', 'Flame Orb', 'Guts', 'Adamant', HPATK, ['Mach Punch', 'Drain Punch', 'Knock Off', 'Ice Punch']),
			s('Lucario', 'Lucarionite', 'Inner Focus', 'Timid', SPA, ['Nasty Plot', 'Aura Sphere', 'Flash Cannon', 'Vacuum Wave'], '0 Atk'),
		]),
		t('Agatha', E, 'Ghost', 'agatha-gen3', [
			s('Gengar', 'Gengarite', 'Cursed Body', 'Timid', SPA, ['Shadow Ball', 'Sludge Wave', 'Focus Blast', 'Destiny Bond'], '0 Atk'),
			s('Mismagius', 'Life Orb', 'Levitate', 'Timid', SPA, ['Nasty Plot', 'Shadow Ball', 'Dazzling Gleam', 'Thunderbolt'], '0 Atk'),
			s('Dusknoir', 'Leftovers', 'Frisk', 'Impish', HPDEF, ['Shadow Sneak', 'Ice Punch', 'Will-O-Wisp', 'Pain Split']),
			s('Marowak-Alola', 'Thick Club', 'Rock Head', 'Adamant', HPATK, ['Flare Blitz', 'Shadow Bone', 'Bonemerang', 'Swords Dance']),
			s('Chandelure', 'Choice Specs', 'Flash Fire', 'Timid', SPA, ['Shadow Ball', 'Fire Blast', 'Energy Ball', 'Trick'], '0 Atk'),
			s('Aegislash', 'Leftovers', 'Stance Change', 'Quiet', '252 HP / 4 Atk / 252 SpA', ['Shadow Ball', 'Flash Cannon', 'Shadow Sneak', "King's Shield"]),
		]),
		t('Lance', E, 'Dragon', 'lance-gen3', [
			s('Dragonite', 'Heavy-Duty Boots', 'Multiscale', 'Adamant', ATK, ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch']),
			s('Kingdra', 'Choice Specs', 'Sniper', 'Timid', SPA, ['Draco Meteor', 'Hydro Pump', 'Ice Beam', 'Dragon Pulse'], '0 Atk'),
			s('Salamence', 'Salamencite', 'Intimidate', 'Adamant', ATK, ['Dragon Dance', 'Double-Edge', 'Earthquake', 'Roost']),
			s('Garchomp', 'Choice Scarf', 'Rough Skin', 'Jolly', ATK, ['Outrage', 'Earthquake', 'Stone Edge', 'Fire Fang']),
			s('Haxorus', 'Life Orb', 'Mold Breaker', 'Jolly', ATK, ['Dragon Dance', 'Outrage', 'Earthquake', 'Poison Jab']),
			s('Hydreigon', 'Choice Specs', 'Levitate', 'Timid', SPA, ['Draco Meteor', 'Dark Pulse', 'Flamethrower', 'U-turn']),
		]),
	],
	champion: t('Blue', C, null, 'blue-gen3champion', [
		s('Blastoise', 'Blastoisinite', 'Torrent', 'Modest', SPA, ['Shell Smash', 'Water Pulse', 'Dark Pulse', 'Aura Sphere'], '0 Atk'),
		s('Pidgeot', 'Heavy-Duty Boots', 'Keen Eye', 'Timid', SPA, ['Hurricane', 'Heat Wave', 'U-turn', 'Roost'], '0 Atk'),
		s('Alakazam', 'Focus Sash', 'Magic Guard', 'Timid', SPA, ['Psychic', 'Shadow Ball', 'Focus Blast', 'Nasty Plot'], '0 Atk'),
		s('Rhydon', 'Eviolite', 'Rock Head', 'Adamant', HPATK, ['Stealth Rock', 'Earthquake', 'Stone Edge', 'Megahorn']),
		s('Arcanine', 'Choice Band', 'Intimidate', 'Adamant', ATK, ['Flare Blitz', 'Extreme Speed', 'Close Combat', 'Wild Charge']),
		s('Exeggutor', 'Sitrus Berry', 'Harvest', 'Modest', HPSPA, ['Sleep Powder', 'Leech Seed', 'Giga Drain', 'Psychic'], '0 Atk'),
	]),
};

// --- Johto -------------------------------------------------------------------
const johto = {
	gyms: [
		[t('Falkner', L, 'Flying', 'falkner', [
			s('Pidgeot', 'Pidgeotite', 'Keen Eye', 'Timid', SPA, ['Hurricane', 'Heat Wave', 'U-turn', 'Roost']),
			s('Noctowl', 'Heavy-Duty Boots', 'Tinted Lens', 'Timid', SPA, ['Hurricane', 'Hyper Voice', 'Roost', 'Calm Mind'], '0 Atk'),
			s('Skarmory', 'Rocky Helmet', 'Sturdy', 'Impish', HPDEF, ['Spikes', 'Brave Bird', 'Roost', 'Whirlwind']),
			s('Togekiss', 'Leftovers', 'Serene Grace', 'Timid', SPA, ['Air Slash', 'Dazzling Gleam', 'Nasty Plot', 'Roost'], '0 Atk'),
			s('Staraptor', 'Choice Band', 'Reckless', 'Jolly', ATK, ['Brave Bird', 'Double-Edge', 'Close Combat', 'U-turn']),
			s('Gliscor', 'Toxic Orb', 'Poison Heal', 'Impish', HPDEF, ['Earthquake', 'Knock Off', 'Roost', 'Protect']),
		]), 'johto-zephyr'],
		[t('Bugsy', L, 'Bug', 'bugsy', [
			s('Scizor', 'Scizorite', 'Technician', 'Adamant', HPATK, ['Bullet Punch', 'U-turn', 'Swords Dance', 'Roost']),
			s('Heracross', 'Flame Orb', 'Guts', 'Jolly', ATK, ['Close Combat', 'Megahorn', 'Knock Off', 'Facade']),
			s('Forretress', 'Leftovers', 'Sturdy', 'Relaxed', HPDEF, ['Spikes', 'Rapid Spin', 'Volt Switch', 'Gyro Ball'], '0 Spe'),
			s('Volcarona', 'Heavy-Duty Boots', 'Flame Body', 'Timid', SPA, ['Quiver Dance', 'Fiery Dance', 'Bug Buzz', 'Giga Drain'], '0 Atk'),
			s('Yanmega', 'Choice Specs', 'Tinted Lens', 'Timid', SPA, ['Bug Buzz', 'Air Slash', 'Giga Drain', 'U-turn']),
			s('Galvantula', 'Focus Sash', 'Compound Eyes', 'Timid', SPA, ['Sticky Web', 'Thunder', 'Bug Buzz', 'Giga Drain'], '0 Atk'),
		]), 'johto-hive'],
		[t('Whitney', L, 'Normal', 'whitney', [
			s('Miltank', 'Leftovers', 'Thick Fat', 'Impish', HPDEF, ['Body Slam', 'Milk Drink', 'Earthquake', 'Heal Bell']),
			s('Blissey', 'Heavy-Duty Boots', 'Natural Cure', 'Bold', HPDEF, ['Seismic Toss', 'Soft-Boiled', 'Thunder Wave', 'Stealth Rock'], '0 Atk'),
			s('Lopunny', 'Lopunnite', 'Limber', 'Jolly', ATK, ['Fake Out', 'High Jump Kick', 'Return', 'Ice Punch']),
			s('Snorlax', 'Leftovers', 'Thick Fat', 'Careful', HPSPD, ['Body Slam', 'Curse', 'Rest', 'Sleep Talk']),
			s('Porygon-Z', 'Choice Specs', 'Adaptability', 'Timid', SPA, ['Tri Attack', 'Shadow Ball', 'Ice Beam', 'Trick'], '0 Atk'),
			s('Ursaluna', 'Flame Orb', 'Guts', 'Brave', HPATK, ['Facade', 'Headlong Rush', 'Fire Punch', 'Swords Dance'], '0 Spe'),
		]), 'johto-plain'],
		[t('Morty', L, 'Ghost', 'morty', [
			s('Banette', 'Banettite', 'Cursed Body', 'Adamant', HPATK, ['Destiny Bond', 'Will-O-Wisp', 'Shadow Claw', 'Knock Off']),
			s('Gengar', 'Life Orb', 'Cursed Body', 'Timid', SPA, ['Shadow Ball', 'Sludge Bomb', 'Focus Blast', 'Thunderbolt'], '0 Atk'),
			s('Mismagius', 'Leftovers', 'Levitate', 'Timid', '252 HP / 4 SpA / 252 Spe', ['Will-O-Wisp', 'Hex', 'Pain Split', 'Taunt'], '0 Atk'),
			s('Drifblim', 'Sitrus Berry', 'Unburden', 'Timid', SPA, ['Shadow Ball', 'Will-O-Wisp', 'Defog', 'Thunderbolt'], '0 Atk'),
			s('Sableye', 'Leftovers', 'Prankster', 'Careful', HPSPD, ['Knock Off', 'Recover', 'Will-O-Wisp', 'Foul Play']),
			s('Dragapult', 'Choice Specs', 'Infiltrator', 'Timid', SPA, ['Shadow Ball', 'Draco Meteor', 'Flamethrower', 'U-turn']),
		]), 'johto-fog'],
		[t('Chuck', L, 'Fighting', 'chuck', [
			s('Poliwrath', 'Leftovers', 'Water Absorb', 'Adamant', HPATK, ['Bulk Up', 'Drain Punch', 'Waterfall', 'Ice Punch']),
			s('Annihilape', 'Leftovers', 'Defiant', 'Adamant', HPATK, ['Bulk Up', 'Drain Punch', 'Rage Fist', 'Taunt']),
			s('Medicham', 'Medichamite', 'Pure Power', 'Jolly', ATK, ['Fake Out', 'High Jump Kick', 'Zen Headbutt', 'Ice Punch']),
			s('Breloom', 'Focus Sash', 'Technician', 'Jolly', ATK, ['Spore', 'Mach Punch', 'Bullet Seed', 'Rock Tomb']),
			s('Infernape', 'Life Orb', 'Iron Fist', 'Jolly', ATK, ['Close Combat', 'Flare Blitz', 'Mach Punch', 'Swords Dance']),
			s('Gallade', 'Choice Band', 'Sharpness', 'Jolly', ATK, ['Sacred Sword', 'Psycho Cut', 'Leaf Blade', 'Night Slash']),
		]), 'johto-storm'],
		[t('Jasmine', L, 'Steel', 'jasmine', [
			s('Steelix', 'Steelixite', 'Sturdy', 'Impish', HPDEF, ['Stealth Rock', 'Earthquake', 'Heavy Slam', 'Roar']),
			s('Magnezone', 'Choice Specs', 'Magnet Pull', 'Modest', HPSPA, ['Thunderbolt', 'Flash Cannon', 'Volt Switch', 'Tri Attack'], '0 Atk'),
			s('Corviknight', 'Leftovers', 'Pressure', 'Impish', HPDEF, ['Brave Bird', 'Roost', 'Defog', 'U-turn']),
			s('Metagross', 'Life Orb', 'Clear Body', 'Jolly', ATK, ['Meteor Mash', 'Zen Headbutt', 'Earthquake', 'Bullet Punch']),
			s('Ferrothorn', 'Leftovers', 'Iron Barbs', 'Relaxed', HPDEF, ['Spikes', 'Leech Seed', 'Power Whip', 'Gyro Ball'], '0 Spe'),
			s('Excadrill', 'Air Balloon', 'Mold Breaker', 'Jolly', ATK, ['Earthquake', 'Iron Head', 'Rapid Spin', 'Swords Dance']),
		]), 'johto-mineral'],
		[t('Pryce', L, 'Ice', 'pryce', [
			s('Mamoswine', 'Choice Band', 'Thick Fat', 'Adamant', ATK, ['Icicle Crash', 'Earthquake', 'Ice Shard', 'Stone Edge']),
			s('Glalie', 'Glalitite', 'Inner Focus', 'Jolly', ATK, ['Return', 'Earthquake', 'Explosion', 'Ice Shard']),
			s('Weavile', 'Choice Band', 'Pressure', 'Jolly', ATK, ['Triple Axel', 'Knock Off', 'Ice Shard', 'Low Kick']),
			s('Walrein', 'Leftovers', 'Thick Fat', 'Calm', HPSPD, ['Surf', 'Ice Beam', 'Rest', 'Sleep Talk'], '0 Atk'),
			s('Ninetales-Alola', 'Light Clay', 'Snow Warning', 'Timid', SPA, ['Aurora Veil', 'Blizzard', 'Moonblast', 'Freeze-Dry'], '0 Atk'),
			s('Froslass', 'Focus Sash', 'Cursed Body', 'Timid', SPA, ['Spikes', 'Taunt', 'Destiny Bond', 'Ice Beam'], '0 Atk'),
		]), 'johto-glacier'],
		[t('Clair', L, 'Dragon', 'clair', [
			s('Kingdra', 'Lum Berry', 'Sniper', 'Adamant', ATK, ['Dragon Dance', 'Waterfall', 'Outrage', 'Iron Head']),
			s('Dragonite', 'Choice Band', 'Multiscale', 'Adamant', ATK, ['Extreme Speed', 'Outrage', 'Earthquake', 'Fire Punch']),
			s('Altaria', 'Altarianite', 'Natural Cure', 'Adamant', ATK, ['Dragon Dance', 'Return', 'Earthquake', 'Roost']),
			s('Flygon', 'Choice Scarf', 'Levitate', 'Jolly', ATK, ['Earthquake', 'Outrage', 'U-turn', 'Stone Edge']),
			s('Goodra', 'Assault Vest', 'Sap Sipper', 'Modest', HPSPA, ['Draco Meteor', 'Fire Blast', 'Sludge Bomb', 'Thunderbolt']),
			s('Kommo-o', 'Lum Berry', 'Bulletproof', 'Jolly', ATK, ['Dragon Dance', 'Close Combat', 'Dragon Claw', 'Poison Jab']),
		]), 'johto-rising'],
	],
	elite4: [
		t('Will', E, 'Psychic', 'will', [
			s('Xatu', 'Leftovers', 'Magic Bounce', 'Bold', HPDEF, ['Psychic', 'Roost', 'U-turn', 'Thunder Wave']),
			s('Slowking', 'Leftovers', 'Regenerator', 'Calm', HPSPD, ['Scald', 'Future Sight', 'Slack Off', 'Thunder Wave'], '0 Atk'),
			s('Exeggutor', 'Choice Specs', 'Harvest', 'Modest', HPSPA, ['Leaf Storm', 'Psyshock', 'Sludge Bomb', 'Psychic'], '0 Atk'),
			s('Bronzong', 'Leftovers', 'Levitate', 'Relaxed', HPDEF, ['Stealth Rock', 'Gyro Ball', 'Earthquake', 'Explosion'], '0 Spe'),
			s('Gallade', 'Galladite', 'Justified', 'Jolly', ATK, ['Swords Dance', 'Close Combat', 'Zen Headbutt', 'Knock Off']),
			s('Hatterene', 'Life Orb', 'Magic Bounce', 'Quiet', HPSPA, ['Trick Room', 'Psychic', 'Dazzling Gleam', 'Mystical Fire'], '0 Atk / 0 Spe'),
		]),
		t('Koga (Johto)', E, 'Poison', 'koga', [
			s('Crobat', 'Heavy-Duty Boots', 'Infiltrator', 'Jolly', ATK, ['Brave Bird', 'U-turn', 'Roost', 'Defog']),
			s('Muk-Alola', 'Assault Vest', 'Poison Touch', 'Adamant', HPATK, ['Knock Off', 'Poison Jab', 'Drain Punch', 'Shadow Sneak']),
			s('Toxapex', 'Black Sludge', 'Regenerator', 'Bold', HPDEF, ['Scald', 'Recover', 'Toxic Spikes', 'Haze'], '0 Atk'),
			s('Toxicroak', 'Life Orb', 'Dry Skin', 'Jolly', ATK, ['Swords Dance', 'Gunk Shot', 'Drain Punch', 'Sucker Punch']),
			s('Drapion', 'Leftovers', 'Battle Armor', 'Jolly', ATK, ['Swords Dance', 'Knock Off', 'Poison Jab', 'Earthquake']),
			s('Glimmora', 'Focus Sash', 'Toxic Debris', 'Timid', SPA, ['Mortal Spin', 'Power Gem', 'Sludge Wave', 'Earth Power']),
		]),
		t('Bruno (Johto)', E, 'Fighting', 'bruno', [
			s('Machamp', 'Choice Band', 'No Guard', 'Adamant', HPATK, ['Dynamic Punch', 'Knock Off', 'Stone Edge', 'Bullet Punch']),
			s('Hitmontop', 'Leftovers', 'Intimidate', 'Impish', HPDEF, ['Rapid Spin', 'Close Combat', 'Sucker Punch', 'Bulk Up']),
			s('Hitmonlee', 'Choice Scarf', 'Limber', 'Jolly', ATK, ['Close Combat', 'Knock Off', 'Stone Edge', 'Blaze Kick']),
			s('Hitmonchan', 'Life Orb', 'Iron Fist', 'Jolly', ATK, ['Drain Punch', 'Ice Punch', 'Thunder Punch', 'Mach Punch']),
			s('Hawlucha', 'Sitrus Berry', 'Unburden', 'Jolly', ATK, ['Swords Dance', 'Close Combat', 'Acrobatics', 'Substitute']),
			s('Heracross', 'Heracronite', 'Guts', 'Jolly', ATK, ['Swords Dance', 'Rock Blast', 'Pin Missile', 'Close Combat']),
		]),
		t('Karen', E, 'Dark', 'karen', [
			s('Umbreon', 'Leftovers', 'Synchronize', 'Calm', HPSPD, ['Foul Play', 'Wish', 'Protect', 'Yawn'], '0 Atk'),
			s('Houndoom', 'Houndoominite', 'Flash Fire', 'Timid', SPA, ['Nasty Plot', 'Fire Blast', 'Dark Pulse', 'Sludge Bomb'], '0 Atk'),
			s('Honchkrow', 'Life Orb', 'Moxie', 'Adamant', ATK, ['Brave Bird', 'Sucker Punch', 'Superpower', 'Night Slash']),
			s('Kingambit', 'Black Glasses', 'Supreme Overlord', 'Adamant', HPATK, ['Swords Dance', 'Kowtow Cleave', 'Iron Head', 'Sucker Punch']),
			s('Krookodile', 'Choice Scarf', 'Intimidate', 'Jolly', ATK, ['Earthquake', 'Knock Off', 'Stone Edge', 'Superpower']),
			s('Hydreigon', 'Choice Specs', 'Levitate', 'Timid', SPA, ['Draco Meteor', 'Dark Pulse', 'Flamethrower', 'Earth Power'], '0 Atk'),
		]),
	],
	champion: t('Lance (Johto)', C, null, 'lance', [
		s('Dragonite', 'Lum Berry', 'Multiscale', 'Adamant', ATK, ['Dragon Dance', 'Outrage', 'Extreme Speed', 'Earthquake']),
		s('Gyarados', 'Gyaradosite', 'Moxie', 'Jolly', ATK, ['Dragon Dance', 'Waterfall', 'Crunch', 'Earthquake']),
		s('Charizard', 'Heavy-Duty Boots', 'Blaze', 'Timid', SPA, ['Fire Blast', 'Air Slash', 'Focus Blast', 'Roost'], '0 Atk'),
		s('Aerodactyl', 'Focus Sash', 'Unnerve', 'Jolly', ATK, ['Stealth Rock', 'Taunt', 'Stone Edge', 'Earthquake']),
		s('Garchomp', 'Life Orb', 'Rough Skin', 'Jolly', ATK, ['Swords Dance', 'Earthquake', 'Dragon Claw', 'Fire Fang']),
		s('Noivern', 'Choice Specs', 'Infiltrator', 'Timid', SPA, ['Draco Meteor', 'Hurricane', 'Flamethrower', 'U-turn']),
	]),
};

// --- Hoenn -------------------------------------------------------------------
const hoenn = {
	gyms: [
		[t('Roxanne', L, 'Rock', 'roxanne-gen3', [
			s('Probopass', 'Leftovers', 'Sturdy', 'Calm', HPSPD, ['Stealth Rock', 'Volt Switch', 'Power Gem', 'Earth Power'], '0 Atk'),
			s('Tyranitar', 'Tyranitarite', 'Sand Stream', 'Jolly', ATK, ['Dragon Dance', 'Stone Edge', 'Crunch', 'Earthquake']),
			s('Cradily', 'Leftovers', 'Storm Drain', 'Calm', HPSPD, ['Giga Drain', 'Recover', 'Earth Power', 'Ancient Power'], '0 Atk'),
			s('Armaldo', 'Leftovers', 'Battle Armor', 'Adamant', HPATK, ['Rapid Spin', 'Stone Edge', 'X-Scissor', 'Earthquake']),
			s('Relicanth', 'Choice Band', 'Rock Head', 'Adamant', HPATK, ['Head Smash', 'Waterfall', 'Earthquake', 'Double-Edge']),
			s('Lycanroc-Dusk', 'Life Orb', 'Tough Claws', 'Jolly', ATK, ['Swords Dance', 'Accelerock', 'Stone Edge', 'Close Combat']),
		]), 'hoenn-stone'],
		[t('Brawly', L, 'Fighting', 'brawly-gen3', [
			s('Hariyama', 'Flame Orb', 'Guts', 'Adamant', HPATK, ['Close Combat', 'Knock Off', 'Bullet Punch', 'Facade']),
			s('Medicham', 'Medichamite', 'Pure Power', 'Jolly', ATK, ['Fake Out', 'High Jump Kick', 'Zen Headbutt', 'Bullet Punch']),
			s('Breloom', 'Toxic Orb', 'Poison Heal', 'Adamant', HPATK, ['Spore', 'Seed Bomb', 'Mach Punch', 'Swords Dance']),
			s('Blaziken', 'Life Orb', 'Speed Boost', 'Adamant', ATK, ['Swords Dance', 'Flare Blitz', 'High Jump Kick', 'Protect']),
			s('Lucario', 'Life Orb', 'Justified', 'Adamant', ATK, ['Swords Dance', 'Close Combat', 'Meteor Mash', 'Extreme Speed']),
			s('Machamp', 'Life Orb', 'No Guard', 'Adamant', HPATK, ['Dynamic Punch', 'Knock Off', 'Ice Punch', 'Bullet Punch']),
		]), 'hoenn-knuckle'],
		[t('Wattson', L, 'Electric', 'wattson-gen3', [
			s('Manectric', 'Manectite', 'Lightning Rod', 'Timid', SPA, ['Thunderbolt', 'Volt Switch', 'Overheat', 'Snarl'], '0 Atk'),
			s('Magnezone', 'Choice Scarf', 'Magnet Pull', 'Timid', SPA, ['Thunderbolt', 'Flash Cannon', 'Volt Switch', 'Tri Attack'], '0 Atk'),
			s('Rotom-Wash', 'Leftovers', 'Levitate', 'Bold', HPDEF, ['Volt Switch', 'Hydro Pump', 'Will-O-Wisp', 'Pain Split'], '0 Atk'),
			s('Toxtricity', 'Throat Spray', 'Punk Rock', 'Modest', SPA, ['Overdrive', 'Boomburst', 'Sludge Bomb', 'Volt Switch']),
			s('Vikavolt', 'Choice Specs', 'Levitate', 'Modest', HPSPA, ['Thunderbolt', 'Bug Buzz', 'Volt Switch', 'Energy Ball'], '0 Atk'),
			s('Eelektross', 'Assault Vest', 'Levitate', 'Quiet', '252 HP / 4 Atk / 252 SpA', ['Thunderbolt', 'Flamethrower', 'Knock Off', 'Giga Drain']),
		]), 'hoenn-dynamo'],
		[t('Flannery', L, 'Fire', 'flannery-gen3', [
			s('Torkoal', 'Heat Rock', 'Drought', 'Bold', HPDEF, ['Lava Plume', 'Stealth Rock', 'Rapid Spin', 'Yawn']),
			s('Camerupt', 'Cameruptite', 'Solid Rock', 'Modest', HPSPA, ['Fire Blast', 'Earth Power', 'Solar Beam', 'Will-O-Wisp'], '0 Atk'),
			s('Volcarona', 'Leftovers', 'Flame Body', 'Timid', '252 HP / 4 SpA / 252 Spe', ['Quiver Dance', 'Fiery Dance', 'Bug Buzz', 'Roost'], '0 Atk'),
			s('Charizard', 'Heavy-Duty Boots', 'Solar Power', 'Timid', SPA, ['Fire Blast', 'Solar Beam', 'Air Slash', 'Focus Blast'], '0 Atk'),
			s('Talonflame', 'Heavy-Duty Boots', 'Gale Wings', 'Jolly', ATK, ['Brave Bird', 'Flare Blitz', 'U-turn', 'Roost']),
			s('Cinderace', 'Heavy-Duty Boots', 'Libero', 'Jolly', ATK, ['Pyro Ball', 'High Jump Kick', 'U-turn', 'Sucker Punch']),
		]), 'hoenn-heat'],
		[t('Norman', L, 'Normal', 'norman-gen3', [
			s('Slaking', 'Choice Band', 'Truant', 'Adamant', ATK, ['Double-Edge', 'Earthquake', 'Knock Off', 'Fire Punch']),
			s('Vigoroth', 'Eviolite', 'Vital Spirit', 'Impish', HPDEF, ['Bulk Up', 'Knock Off', 'Slack Off', 'Body Slam']),
			s('Linoone', 'Salac Berry', 'Gluttony', 'Adamant', ATK, ['Belly Drum', 'Extreme Speed', 'Shadow Claw', 'Seed Bomb']),
			s('Kangaskhan', 'Kangaskhanite', 'Scrappy', 'Adamant', ATK, ['Fake Out', 'Return', 'Sucker Punch', 'Power-Up Punch']),
			s('Swellow', 'Flame Orb', 'Guts', 'Jolly', ATK, ['Facade', 'Brave Bird', 'U-turn', 'Protect']),
			s('Zangoose', 'Toxic Orb', 'Toxic Boost', 'Jolly', ATK, ['Facade', 'Close Combat', 'Knock Off', 'Quick Attack']),
		]), 'hoenn-balance'],
		[t('Winona', L, 'Flying', 'winona-gen3', [
			s('Altaria', 'Altarianite', 'Natural Cure', 'Modest', HPSPA, ['Hyper Voice', 'Fire Blast', 'Roost', 'Will-O-Wisp'], '0 Atk'),
			s('Pelipper', 'Damp Rock', 'Drizzle', 'Bold', HPDEF, ['Scald', 'Hurricane', 'U-turn', 'Roost']),
			s('Skarmory', 'Leftovers', 'Sturdy', 'Impish', HPDEF, ['Stealth Rock', 'Brave Bird', 'Roost', 'Whirlwind']),
			s('Tropius', 'Sitrus Berry', 'Harvest', 'Bold', HPDEF, ['Leech Seed', 'Substitute', 'Air Slash', 'Protect'], '0 Atk'),
			s('Braviary', 'Choice Scarf', 'Sheer Force', 'Jolly', ATK, ['Brave Bird', 'Close Combat', 'U-turn', 'Rock Slide']),
			s('Mandibuzz', 'Leftovers', 'Overcoat', 'Bold', HPDEF, ['Foul Play', 'Roost', 'Defog', 'U-turn']),
		]), 'hoenn-feather'],
		[t('Tate e Liza', L, 'Psychic', 'tateandliza-gen3', [
			s('Solrock', 'Mental Herb', 'Levitate', 'Relaxed', HPATK, ['Trick Room', 'Rock Slide', 'Zen Headbutt', 'Will-O-Wisp'], '0 Spe'),
			s('Lunatone', 'Leftovers', 'Levitate', 'Quiet', HPSPA, ['Trick Room', 'Psychic', 'Earth Power', 'Protect'], '0 Atk / 0 Spe'),
			s('Gardevoir', 'Gardevoirite', 'Trace', 'Modest', HPSPA, ['Hyper Voice', 'Psyshock', 'Mystical Fire', 'Protect'], '0 Atk'),
			s('Claydol', 'Leftovers', 'Levitate', 'Quiet', HPSPA, ['Earth Power', 'Psychic', 'Ice Beam', 'Protect'], '0 Atk / 0 Spe'),
			s('Hatterene', 'Life Orb', 'Magic Bounce', 'Quiet', HPSPA, ['Dazzling Gleam', 'Psychic', 'Mystical Fire', 'Protect'], '0 Atk / 0 Spe'),
			s('Indeedee-F', 'Psychic Seed', 'Psychic Surge', 'Bold', HPDEF, ['Follow Me', 'Helping Hand', 'Protect', 'Psychic'], '0 Atk'),
		], true), 'hoenn-mind'],
		[t('Wallace', L, 'Water', 'wallace-gen3rs', [
			s('Milotic', 'Leftovers', 'Competitive', 'Bold', HPDEF, ['Scald', 'Recover', 'Ice Beam', 'Haze'], '0 Atk'),
			s('Swampert', 'Swampertite', 'Torrent', 'Adamant', ATK, ['Rain Dance', 'Waterfall', 'Earthquake', 'Ice Punch']),
			s('Ludicolo', 'Life Orb', 'Swift Swim', 'Modest', SPA, ['Hydro Pump', 'Giga Drain', 'Ice Beam', 'Rain Dance'], '0 Atk'),
			s('Kingdra', 'Choice Specs', 'Swift Swim', 'Modest', SPA, ['Draco Meteor', 'Hydro Pump', 'Ice Beam', 'Surf'], '0 Atk'),
			s('Crawdaunt', 'Life Orb', 'Adaptability', 'Adamant', ATK, ['Crabhammer', 'Knock Off', 'Aqua Jet', 'Swords Dance']),
			s('Gastrodon', 'Leftovers', 'Storm Drain', 'Calm', HPSPD, ['Scald', 'Earth Power', 'Recover', 'Clear Smog'], '0 Atk'),
		]), 'hoenn-rain'],
	],
	elite4: [
		t('Sidney', E, 'Dark', 'sidney-gen3', [
			s('Absol', 'Absolite', 'Justified', 'Jolly', ATK, ['Swords Dance', 'Sucker Punch', 'Knock Off', 'Play Rough']),
			s('Shiftry', 'Life Orb', 'Chlorophyll', 'Jolly', ATK, ['Swords Dance', 'Leaf Blade', 'Knock Off', 'Sucker Punch']),
			s('Sharpedo', 'Life Orb', 'Speed Boost', 'Adamant', ATK, ['Protect', 'Waterfall', 'Crunch', 'Close Combat']),
			s('Grimmsnarl', 'Light Clay', 'Prankster', 'Careful', HPSPD, ['Reflect', 'Light Screen', 'Spirit Break', 'Thunder Wave']),
			s('Zoroark', 'Life Orb', 'Illusion', 'Timid', SPA, ['Nasty Plot', 'Dark Pulse', 'Flamethrower', 'Focus Blast'], '0 Atk'),
			s('Scrafty', 'Leftovers', 'Intimidate', 'Careful', HPSPD, ['Drain Punch', 'Knock Off', 'Bulk Up', 'Rest']),
		]),
		t('Phoebe', E, 'Ghost', 'phoebe-gen3', [
			s('Dusclops', 'Eviolite', 'Frisk', 'Relaxed', HPDEF, ['Night Shade', 'Will-O-Wisp', 'Pain Split', 'Trick Room'], '0 Atk / 0 Spe'),
			s('Banette', 'Banettite', 'Frisk', 'Adamant', HPATK, ['Destiny Bond', 'Will-O-Wisp', 'Shadow Claw', 'Knock Off']),
			s('Shedinja', 'Heavy-Duty Boots', 'Wonder Guard', 'Adamant', ATK, ['X-Scissor', 'Shadow Sneak', 'Will-O-Wisp', 'Swords Dance']),
			s('Ceruledge', 'Life Orb', 'Flash Fire', 'Adamant', ATK, ['Bitter Blade', 'Poltergeist', 'Swords Dance', 'Shadow Sneak']),
			s('Golurk', 'Choice Band', 'Iron Fist', 'Adamant', HPATK, ['Earthquake', 'Shadow Punch', 'Drain Punch', 'Ice Punch']),
			s('Spiritomb', 'Leftovers', 'Pressure', 'Careful', HPSPD, ['Foul Play', 'Will-O-Wisp', 'Pain Split', 'Sucker Punch']),
		]),
		t('Glacia', E, 'Ice', 'glacia-gen3', [
			s('Glalie', 'Glalitite', 'Inner Focus', 'Jolly', ATK, ['Return', 'Earthquake', 'Explosion', 'Ice Shard']),
			s('Walrein', 'Leftovers', 'Thick Fat', 'Bold', HPDEF, ['Surf', 'Ice Beam', 'Protect', 'Roar'], '0 Atk'),
			s('Froslass', 'Focus Sash', 'Cursed Body', 'Timid', SPA, ['Spikes', 'Taunt', 'Destiny Bond', 'Ice Beam'], '0 Atk'),
			s('Abomasnow', 'Leftovers', 'Snow Warning', 'Mild', '4 Atk / 252 SpA / 252 HP', ['Blizzard', 'Giga Drain', 'Earthquake', 'Ice Shard']),
			s('Baxcalibur', 'Loaded Dice', 'Thermal Exchange', 'Jolly', ATK, ['Dragon Dance', 'Glaive Rush', 'Icicle Spear', 'Earthquake']),
			s('Avalugg', 'Rocky Helmet', 'Sturdy', 'Impish', HPDEF, ['Avalanche', 'Body Press', 'Recover', 'Rapid Spin']),
		]),
		t('Drake', E, 'Dragon', 'drake-gen3', [
			s('Salamence', 'Salamencite', 'Intimidate', 'Adamant', ATK, ['Dragon Dance', 'Double-Edge', 'Earthquake', 'Roost']),
			s('Flygon', 'Choice Band', 'Levitate', 'Jolly', ATK, ['Outrage', 'Earthquake', 'U-turn', 'Fire Punch']),
			s('Garchomp', 'Rocky Helmet', 'Rough Skin', 'Impish', HPDEF, ['Stealth Rock', 'Earthquake', 'Dragon Tail', 'Fire Fang']),
			s('Haxorus', 'Choice Scarf', 'Mold Breaker', 'Jolly', ATK, ['Outrage', 'Earthquake', 'Close Combat', 'Poison Jab']),
			s('Dragalge', 'Black Sludge', 'Adaptability', 'Modest', HPSPA, ['Draco Meteor', 'Sludge Bomb', 'Focus Blast', 'Toxic Spikes'], '0 Atk'),
			s('Tyrantrum', 'Life Orb', 'Rock Head', 'Jolly', ATK, ['Dragon Dance', 'Head Smash', 'Earthquake', 'Outrage']),
		]),
	],
	champion: t('Steven', C, null, 'steven-gen3', [
		s('Metagross', 'Metagrossite', 'Clear Body', 'Jolly', ATK, ['Meteor Mash', 'Zen Headbutt', 'Earthquake', 'Bullet Punch']),
		s('Aggron', 'Leftovers', 'Rock Head', 'Adamant', HPATK, ['Head Smash', 'Heavy Slam', 'Earthquake', 'Stealth Rock']),
		s('Skarmory', 'Rocky Helmet', 'Sturdy', 'Impish', HPDEF, ['Spikes', 'Brave Bird', 'Roost', 'Whirlwind']),
		s('Claydol', 'Leftovers', 'Levitate', 'Bold', HPDEF, ['Rapid Spin', 'Earth Power', 'Psychic', 'Stealth Rock']),
		s('Cradily', 'Leftovers', 'Storm Drain', 'Adamant', HPATK, ['Swords Dance', 'Seed Bomb', 'Stone Edge', 'Recover']),
		s('Armaldo', 'Choice Band', 'Battle Armor', 'Adamant', HPATK, ['X-Scissor', 'Stone Edge', 'Earthquake', 'Aqua Tail']),
	]),
};

// --- Sinnoh ------------------------------------------------------------------
const sinnoh = {
	gyms: [
		[t('Roark', L, 'Rock', 'roark', [
			s('Rampardos', 'Choice Scarf', 'Mold Breaker', 'Jolly', ATK, ['Head Smash', 'Earthquake', 'Rock Slide', 'Fire Punch']),
			s('Golem', 'Custap Berry', 'Sturdy', 'Adamant', HPATK, ['Stealth Rock', 'Earthquake', 'Stone Edge', 'Explosion']),
			s('Probopass', 'Air Balloon', 'Magnet Pull', 'Modest', HPSPA, ['Volt Switch', 'Power Gem', 'Earth Power', 'Flash Cannon'], '0 Atk'),
			s('Aerodactyl', 'Aerodactylite', 'Unnerve', 'Jolly', ATK, ['Stone Edge', 'Earthquake', 'Fire Fang', 'Roost']),
			s('Garganacl', 'Leftovers', 'Purifying Salt', 'Careful', HPSPD, ['Salt Cure', 'Recover', 'Protect', 'Body Press']),
			s('Tyranitar', 'Choice Band', 'Sand Stream', 'Adamant', HPATK, ['Stone Edge', 'Crunch', 'Earthquake', 'Fire Punch']),
		]), 'sinnoh-coal'],
		[t('Gardenia', L, 'Grass', 'gardenia', [
			s('Roserade', 'Focus Sash', 'Natural Cure', 'Timid', SPA, ['Spikes', 'Leaf Storm', 'Sludge Bomb', 'Sleep Powder'], '0 Atk'),
			s('Torterra', 'Leftovers', 'Shell Armor', 'Impish', HPDEF, ['Wood Hammer', 'Earthquake', 'Stealth Rock', 'Synthesis']),
			s('Tangrowth', 'Assault Vest', 'Regenerator', 'Sassy', HPSPD, ['Giga Drain', 'Knock Off', 'Earthquake', 'Sludge Bomb']),
			s('Leafeon', 'Life Orb', 'Chlorophyll', 'Jolly', ATK, ['Swords Dance', 'Leaf Blade', 'X-Scissor', 'Synthesis']),
			s('Sceptile', 'Sceptilite', 'Overgrow', 'Timid', SPA, ['Leaf Storm', 'Dragon Pulse', 'Focus Blast', 'Earthquake']),
			s('Rillaboom', 'Choice Band', 'Grassy Surge', 'Adamant', ATK, ['Grassy Glide', 'Wood Hammer', 'Knock Off', 'U-turn']),
		]), 'sinnoh-forest'],
		[t('Maylene', L, 'Fighting', 'maylene', [
			s('Lucario', 'Lucarionite', 'Justified', 'Jolly', ATK, ['Swords Dance', 'Close Combat', 'Meteor Mash', 'Extreme Speed']),
			s('Medicham', 'Choice Band', 'Pure Power', 'Jolly', ATK, ['High Jump Kick', 'Zen Headbutt', 'Ice Punch', 'Bullet Punch']),
			s('Toxicroak', 'Life Orb', 'Dry Skin', 'Jolly', ATK, ['Swords Dance', 'Gunk Shot', 'Drain Punch', 'Sucker Punch']),
			s('Gallade', 'Life Orb', 'Sharpness', 'Jolly', ATK, ['Swords Dance', 'Sacred Sword', 'Psycho Cut', 'Leaf Blade']),
			s('Quaquaval', 'Life Orb', 'Moxie', 'Jolly', ATK, ['Aqua Step', 'Close Combat', 'Knock Off', 'Roost']),
			s('Conkeldurr', 'Flame Orb', 'Guts', 'Adamant', HPATK, ['Mach Punch', 'Drain Punch', 'Knock Off', 'Ice Punch']),
		]), 'sinnoh-cobble'],
		[t('Crasher Wake', L, 'Water', 'crasherwake', [
			s('Floatzel', 'Life Orb', 'Water Veil', 'Jolly', ATK, ['Waterfall', 'Ice Punch', 'Crunch', 'Aqua Jet']),
			s('Gyarados', 'Gyaradosite', 'Intimidate', 'Jolly', ATK, ['Dragon Dance', 'Waterfall', 'Crunch', 'Earthquake']),
			s('Quagsire', 'Leftovers', 'Unaware', 'Impish', HPDEF, ['Earthquake', 'Scald', 'Recover', 'Haze']),
			s('Empoleon', 'Leftovers', 'Torrent', 'Modest', HPSPA, ['Hydro Pump', 'Flash Cannon', 'Ice Beam', 'Stealth Rock'], '0 Atk'),
			s('Dondozo', 'Leftovers', 'Unaware', 'Impish', HPDEF, ['Wave Crash', 'Curse', 'Rest', 'Sleep Talk']),
			s('Primarina', 'Choice Specs', 'Liquid Voice', 'Modest', HPSPA, ['Hyper Voice', 'Moonblast', 'Psychic', 'Energy Ball'], '0 Atk'),
		]), 'sinnoh-fen'],
		[t('Fantina', L, 'Ghost', 'fantina', [
			s('Mismagius', 'Life Orb', 'Levitate', 'Timid', SPA, ['Nasty Plot', 'Shadow Ball', 'Dazzling Gleam', 'Thunderbolt'], '0 Atk'),
			s('Drifblim', 'Sitrus Berry', 'Unburden', 'Timid', SPA, ['Shadow Ball', 'Will-O-Wisp', 'Defog', 'Thunderbolt'], '0 Atk'),
			s('Gengar', 'Gengarite', 'Cursed Body', 'Timid', SPA, ['Shadow Ball', 'Sludge Wave', 'Focus Blast', 'Taunt'], '0 Atk'),
			s('Rotom', 'Choice Scarf', 'Levitate', 'Timid', SPA, ['Volt Switch', 'Shadow Ball', 'Thunderbolt', 'Trick'], '0 Atk'),
			s('Dusknoir', 'Leftovers', 'Frisk', 'Impish', HPDEF, ['Shadow Sneak', 'Ice Punch', 'Will-O-Wisp', 'Pain Split']),
			s('Typhlosion-Hisui', 'Choice Specs', 'Blaze', 'Timid', SPA, ['Eruption', 'Shadow Ball', 'Fire Blast', 'Focus Blast'], '0 Atk'),
		]), 'sinnoh-relic'],
		[t('Byron', L, 'Steel', 'byron', [
			s('Bastiodon', 'Leftovers', 'Sturdy', 'Relaxed', HPDEF, ['Stealth Rock', 'Body Press', 'Iron Defense', 'Roar'], '0 Spe'),
			s('Steelix', 'Steelixite', 'Sturdy', 'Adamant', HPATK, ['Earthquake', 'Heavy Slam', 'Stone Edge', 'Dragon Tail']),
			s('Corviknight', 'Leftovers', 'Pressure', 'Impish', HPDEF, ['Brave Bird', 'Roost', 'Defog', 'Bulk Up']),
			s('Tinkaton', 'Leftovers', 'Mold Breaker', 'Jolly', ATK, ['Swords Dance', 'Gigaton Hammer', 'Play Rough', 'Knock Off']),
			s('Klefki', 'Light Clay', 'Prankster', 'Bold', HPDEF, ['Reflect', 'Light Screen', 'Spikes', 'Thunder Wave']),
			s('Magnezone', 'Choice Specs', 'Magnet Pull', 'Modest', HPSPA, ['Thunderbolt', 'Flash Cannon', 'Volt Switch', 'Tri Attack'], '0 Atk'),
		]), 'sinnoh-mine'],
		[t('Candice', L, 'Ice', 'candice', [
			s('Abomasnow', 'Abomasite', 'Snow Warning', 'Mild', '4 Atk / 252 SpA / 252 HP', ['Blizzard', 'Giga Drain', 'Earthquake', 'Ice Shard']),
			s('Froslass', 'Focus Sash', 'Cursed Body', 'Timid', SPA, ['Spikes', 'Taunt', 'Destiny Bond', 'Ice Beam'], '0 Atk'),
			s('Weavile', 'Life Orb', 'Pressure', 'Jolly', ATK, ['Swords Dance', 'Triple Axel', 'Knock Off', 'Ice Shard']),
			s('Mamoswine', 'Life Orb', 'Thick Fat', 'Adamant', ATK, ['Stealth Rock', 'Icicle Crash', 'Earthquake', 'Ice Shard']),
			s('Glaceon', 'Choice Specs', 'Ice Body', 'Modest', SPA, ['Ice Beam', 'Blizzard', 'Shadow Ball', 'Water Pulse'], '0 Atk'),
			s('Cetitan', 'Choice Band', 'Thick Fat', 'Adamant', HPATK, ['Icicle Crash', 'Earthquake', 'Liquidation', 'Ice Shard']),
		]), 'sinnoh-icicle'],
		[t('Volkner', L, 'Electric', 'volkner', [
			s('Luxray', 'Choice Band', 'Intimidate', 'Adamant', ATK, ['Wild Charge', 'Crunch', 'Ice Fang', 'Volt Switch']),
			s('Electivire', 'Life Orb', 'Motor Drive', 'Naive', MIXED, ['Wild Charge', 'Ice Punch', 'Earthquake', 'Flamethrower']),
			s('Jolteon', 'Life Orb', 'Volt Absorb', 'Timid', SPA, ['Thunderbolt', 'Volt Switch', 'Shadow Ball', 'Hyper Voice'], '0 Atk'),
			s('Raichu-Alola', 'Life Orb', 'Surge Surfer', 'Timid', SPA, ['Nasty Plot', 'Thunderbolt', 'Psychic', 'Focus Blast'], '0 Atk'),
			s('Rotom-Heat', 'Leftovers', 'Levitate', 'Bold', HPDEF, ['Volt Switch', 'Overheat', 'Will-O-Wisp', 'Pain Split'], '0 Atk'),
			s('Ampharos', 'Ampharosite', 'Static', 'Modest', HPSPA, ['Thunderbolt', 'Dragon Pulse', 'Focus Blast', 'Volt Switch'], '0 Atk'),
		]), 'sinnoh-beacon'],
	],
	elite4: [
		t('Aaron', E, 'Bug', 'aaron', [
			s('Heracross', 'Heracronite', 'Guts', 'Jolly', ATK, ['Swords Dance', 'Rock Blast', 'Pin Missile', 'Close Combat']),
			s('Vespiquen', 'Leftovers', 'Pressure', 'Impish', HPDEF, ['Attack Order', 'Defend Order', 'Heal Order', 'U-turn']),
			s('Scizor', 'Choice Band', 'Technician', 'Adamant', HPATK, ['Bullet Punch', 'U-turn', 'Knock Off', 'Superpower']),
			s('Yanmega', 'Life Orb', 'Speed Boost', 'Timid', SPA, ['Protect', 'Bug Buzz', 'Air Slash', 'Giga Drain'], '0 Atk'),
			s('Volcarona', 'Heavy-Duty Boots', 'Flame Body', 'Timid', SPA, ['Quiver Dance', 'Fiery Dance', 'Bug Buzz', 'Giga Drain'], '0 Atk'),
			s('Kleavor', 'Focus Sash', 'Sharpness', 'Jolly', ATK, ['Stone Axe', 'X-Scissor', 'Close Combat', 'U-turn']),
		]),
		t('Bertha', E, 'Ground', 'bertha', [
			s('Hippowdon', 'Leftovers', 'Sand Stream', 'Impish', HPDEF, ['Stealth Rock', 'Earthquake', 'Slack Off', 'Whirlwind']),
			s('Gliscor', 'Toxic Orb', 'Poison Heal', 'Jolly', ATK, ['Swords Dance', 'Earthquake', 'Knock Off', 'Roost']),
			s('Rhyperior', 'Weakness Policy', 'Solid Rock', 'Adamant', HPATK, ['Rock Polish', 'Earthquake', 'Stone Edge', 'Megahorn']),
			s('Whiscash', 'Leftovers', 'Oblivious', 'Adamant', HPATK, ['Dragon Dance', 'Waterfall', 'Earthquake', 'Stone Edge']),
			s('Excadrill', 'Life Orb', 'Sand Rush', 'Adamant', ATK, ['Swords Dance', 'Earthquake', 'Iron Head', 'Rapid Spin']),
			s('Donphan', 'Leftovers', 'Sturdy', 'Impish', HPDEF, ['Rapid Spin', 'Earthquake', 'Knock Off', 'Ice Shard']),
		]),
		t('Flint', E, 'Fire', 'flint', [
			s('Infernape', 'Life Orb', 'Iron Fist', 'Naive', MIXED, ['Flare Blitz', 'Close Combat', 'Mach Punch', 'Grass Knot']),
			s('Houndoom', 'Houndoominite', 'Flash Fire', 'Timid', SPA, ['Nasty Plot', 'Fire Blast', 'Dark Pulse', 'Sludge Bomb'], '0 Atk'),
			s('Flareon', 'Flame Orb', 'Guts', 'Adamant', ATK, ['Flare Blitz', 'Facade', 'Superpower', 'Quick Attack']),
			s('Rapidash', 'Heavy-Duty Boots', 'Flash Fire', 'Jolly', ATK, ['Flare Blitz', 'Wild Charge', 'High Horsepower', 'Morning Sun']),
			s('Magmortar', 'Choice Specs', 'Flame Body', 'Modest', SPA, ['Fire Blast', 'Thunderbolt', 'Focus Blast', 'Psychic'], '0 Atk'),
			s('Arcanine-Hisui', 'Choice Band', 'Rock Head', 'Adamant', ATK, ['Head Smash', 'Flare Blitz', 'Extreme Speed', 'Close Combat']),
		]),
		t('Lucian', E, 'Psychic', 'lucian', [
			s('Bronzong', 'Leftovers', 'Levitate', 'Relaxed', HPDEF, ['Trick Room', 'Gyro Ball', 'Earthquake', 'Stealth Rock'], '0 Spe'),
			s('Alakazam', 'Alakazite', 'Magic Guard', 'Timid', SPA, ['Psychic', 'Shadow Ball', 'Focus Blast', 'Calm Mind'], '0 Atk'),
			s('Mr. Mime', 'Light Clay', 'Filter', 'Timid', '252 HP / 4 SpA / 252 Spe', ['Reflect', 'Light Screen', 'Psychic', 'Dazzling Gleam'], '0 Atk'),
			s('Farigiraf', 'Sitrus Berry', 'Armor Tail', 'Modest', HPSPA, ['Nasty Plot', 'Psychic', 'Hyper Voice', 'Shadow Ball'], '0 Atk'),
			s('Gardevoir', 'Choice Scarf', 'Trace', 'Timid', SPA, ['Moonblast', 'Psychic', 'Mystical Fire', 'Trick'], '0 Atk'),
			s('Espeon', 'Life Orb', 'Magic Bounce', 'Timid', SPA, ['Calm Mind', 'Psychic', 'Dazzling Gleam', 'Morning Sun'], '0 Atk'),
		]),
	],
	champion: t('Cynthia', C, null, 'cynthia', [
		s('Garchomp', 'Garchompite', 'Rough Skin', 'Jolly', ATK, ['Swords Dance', 'Earthquake', 'Stone Edge', 'Fire Fang']),
		s('Spiritomb', 'Leftovers', 'Infiltrator', 'Careful', HPSPD, ['Foul Play', 'Will-O-Wisp', 'Pain Split', 'Sucker Punch']),
		s('Roserade', 'Life Orb', 'Natural Cure', 'Timid', SPA, ['Leaf Storm', 'Sludge Bomb', 'Shadow Ball', 'Synthesis'], '0 Atk'),
		s('Togekiss', 'Leftovers', 'Serene Grace', 'Timid', SPA, ['Nasty Plot', 'Air Slash', 'Aura Sphere', 'Roost'], '0 Atk'),
		s('Lucario', 'Life Orb', 'Justified', 'Timid', SPA, ['Nasty Plot', 'Aura Sphere', 'Flash Cannon', 'Vacuum Wave'], '0 Atk'),
		s('Milotic', 'Flame Orb', 'Marvel Scale', 'Bold', HPDEF, ['Scald', 'Recover', 'Ice Beam', 'Haze'], '0 Atk'),
	]),
};

/** Desafio com as configurações padrão do servidor (rascunho na importação). */
function challenge(name, league) {
	return {
		name,
		baseFormat: 'gen9nationaldexag',
		customRules: 'Standard NatDex, Terastal Clause, Z-Move Clause, Dynamax Clause',
		typeMode: 'fixed', gymCount: league.gyms.length, orderMode: 'free', hasElite4: true, teamLock: false,
		baseAILevel: 'medium', timerMode: 'free', turnSeconds: null, lossLimit: null,
		eliminateOnElite4Loss: false, eliminateOnChampionLoss: false,
		stages: [
			...league.gyms.map(([trainer, badge], i) => ({ kind: 'gym', position: i + 1, trainer, aiLevel: null, badge })),
			...league.elite4.map((trainer, i) => ({ kind: 'elite4', position: i + 1, trainer, aiLevel: null, badge: null })),
			{ kind: 'champion', position: 1, trainer: league.champion, aiLevel: null, badge: null },
		],
		pool: [],
	};
}

const out = process.argv[2] || path.join(__dirname, '..', '..', 'pacotes');
fs.mkdirSync(out, { recursive: true });
for (const [file, name, league] of [
	['liga-kanto.json', 'Liga Kanto', kanto], ['liga-johto.json', 'Liga Johto', johto],
	['liga-hoenn.json', 'Liga Hoenn', hoenn], ['liga-sinnoh.json', 'Liga Sinnoh', sinnoh],
]) {
	const names = [...league.gyms.map(([trainer]) => trainer), ...league.elite4, league.champion];
	const pack = {
		type: 'liga-desafios/ginasios', version: 1,
		trainers: names.map(n => trainers[n]),
		challenges: [challenge(name, league)],
	};
	const json = JSON.stringify(pack, null, '\t') + '\n';
	fs.writeFileSync(path.join(out, file), json);
	console.log(`${file}: ${pack.trainers.length} treinadores, ${Math.ceil(json.length / 1024)} KB`);
}
