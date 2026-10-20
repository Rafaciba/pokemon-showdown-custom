#!/usr/bin/env node
/**
 * Gera o pacote da Liga Favoritos (pacotes/liga-favoritos.json): um treinador por tipo
 * ("<Tipo> Rafa") com os Pokémon favoritos do usuário daquele tipo, e o Campeão
 * "Favorite Rafa" com o time de favoritos do usuário, como ele montou. Nos times de
 * tipo, os Pokémon (e os apelidos do time Ground) são do usuário; as builds são nossas.
 *
 * Desafio de tipos sorteados: cada jornada sorteia 8 dos 18 treinadores de tipo.
 *
 * Uso (na raiz): node scripts/pacotes/favoritos.cjs [pasta de saída, padrão pacotes/]
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

/** Um set no formato de exportação do teambuilder. */
function s(species, item, ability, nature, evs, moves, ivs) {
	return [
		`${species} @ ${item}`, `Ability: ${ability}`, `EVs: ${evs}`, `${nature} Nature`,
		...(ivs ? [`IVs: ${ivs}`] : []),
		...moves.map(move => `- ${move}`),
	].join('\n');
}

/** Time de favoritos do usuário, sem mudanças. */
const FAVORITES = `
Pitanguinha (Steelix) (F) @ Leftovers
Ability: Sturdy
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Stealth Rock
- Earthquake
- Heavy Slam
- Toxic

Paraechinus (Sandslash) (M) @ Heavy-Duty Boots
Ability: Sand Rush
EVs: 248 HP / 252 Def / 8 SpD
Impish Nature
- Earthquake
- Rapid Spin
- Knock Off
- Spikes

Bátima (Gliscor) (M) @ Toxic Orb
Ability: Poison Heal
EVs: 244 HP / 244 SpD / 20 Spe
Jolly Nature
- Swords Dance
- Roost
- Earthquake
- Facade

Plutão (Houndoom) (M) @ Houndoominite
Ability: Flash Fire
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Nasty Plot
- Fire Blast
- Dark Pulse
- Sludge Bomb

Charlene (Charizard) (F) @ Heavy-Duty Boots
Ability: Blaze
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Toxic
- Roost
- Flamethrower
- Hurricane

Mel (Mightyena) (F) @ Life Orb
Ability: Moxie
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Crunch
- Sucker Punch
- Play Rough
- Iron Tail
`.trim();

/** Times de tipo: [tipo, sets]. */
const TYPES = [
	['Fire', [
		s('Houndoom', 'Houndoominite', 'Flash Fire', 'Timid', SPA, ['Nasty Plot', 'Fire Blast', 'Dark Pulse', 'Sludge Bomb'], '0 Atk'),
		s('Ninetales', 'Heat Rock', 'Drought', 'Timid', SPA, ['Nasty Plot', 'Fire Blast', 'Solar Beam', 'Will-O-Wisp'], '0 Atk'),
		s('Charizard', 'Heavy-Duty Boots', 'Solar Power', 'Timid', SPA, ['Fire Blast', 'Solar Beam', 'Air Slash', 'Focus Blast'], '0 Atk'),
		s('Typhlosion', 'Choice Specs', 'Flash Fire', 'Timid', SPA, ['Eruption', 'Fire Blast', 'Focus Blast', 'Solar Beam'], '0 Atk'),
		s('Centiskorch', 'Heavy-Duty Boots', 'Flash Fire', 'Adamant', HPATK, ['Coil', 'Fire Lash', 'Leech Life', 'Knock Off']),
		s('Rapidash', 'Life Orb', 'Flash Fire', 'Jolly', ATK, ['Flare Blitz', 'Wild Charge', 'High Horsepower', 'Morning Sun']),
	]],
	['Steel', [
		s('Mawile', 'Mawilite', 'Intimidate', 'Adamant', HPATK, ['Swords Dance', 'Play Rough', 'Iron Head', 'Sucker Punch']),
		s('Steelix', 'Leftovers', 'Sturdy', 'Impish', HPDEF, ['Stealth Rock', 'Earthquake', 'Heavy Slam', 'Roar']),
		s('Corviknight', 'Leftovers', 'Mirror Armor', 'Impish', HPDEF, ['Bulk Up', 'Brave Bird', 'Body Press', 'Roost']),
		s('Skarmory', 'Rocky Helmet', 'Sturdy', 'Impish', HPDEF, ['Spikes', 'Brave Bird', 'Roost', 'Whirlwind']),
		s('Scizor', 'Choice Band', 'Technician', 'Adamant', HPATK, ['Bullet Punch', 'U-turn', 'Knock Off', 'Superpower']),
		s('Sandslash-Alola', 'Life Orb', 'Slush Rush', 'Jolly', ATK, ['Triple Axel', 'Iron Head', 'Knock Off', 'Rapid Spin']),
	]],
	['Dark', [
		s('Sharpedo', 'Sharpedonite', 'Speed Boost', 'Adamant', ATK, ['Protect', 'Crunch', 'Waterfall', 'Psychic Fangs']),
		s('Houndoom', 'Choice Specs', 'Flash Fire', 'Timid', SPA, ['Fire Blast', 'Dark Pulse', 'Sludge Bomb', 'Overheat'], '0 Atk'),
		s('Honchkrow', 'Life Orb', 'Moxie', 'Adamant', ATK, ['Brave Bird', 'Sucker Punch', 'Superpower', 'Night Slash']),
		s('Mightyena', 'Choice Band', 'Intimidate', 'Jolly', ATK, ['Crunch', 'Sucker Punch', 'Play Rough', 'Iron Tail']),
		s('Shiftry', 'Focus Sash', 'Chlorophyll', 'Jolly', ATK, ['Swords Dance', 'Leaf Blade', 'Knock Off', 'Sucker Punch']),
		s('Crawdaunt', 'Life Orb', 'Adaptability', 'Adamant', ATK, ['Swords Dance', 'Crabhammer', 'Knock Off', 'Aqua Jet']),
	]],
	['Bug', [
		s('Scizor', 'Scizorite', 'Technician', 'Adamant', HPATK, ['Bullet Punch', 'U-turn', 'Swords Dance', 'Roost']),
		s('Heracross', 'Flame Orb', 'Guts', 'Jolly', ATK, ['Close Combat', 'Megahorn', 'Knock Off', 'Facade']),
		s('Ariados', 'Focus Sash', 'Insomnia', 'Jolly', '252 HP / 4 Atk / 252 Spe', ['Sticky Web', 'Toxic Spikes', 'Megahorn', 'Sucker Punch']),
		s('Beedrill', 'Life Orb', 'Sniper', 'Jolly', ATK, ['Poison Jab', 'U-turn', 'Drill Run', 'Knock Off']),
		s('Scolipede', 'Life Orb', 'Speed Boost', 'Jolly', ATK, ['Swords Dance', 'Megahorn', 'Poison Jab', 'Earthquake']),
		s('Vikavolt', 'Choice Specs', 'Levitate', 'Modest', HPSPA, ['Thunderbolt', 'Bug Buzz', 'Volt Switch', 'Energy Ball'], '0 Atk'),
	]],
	['Ground', [
		s('Poppy (Hippowdon) (M)', 'Leftovers', 'Sand Stream', 'Impish', HPDEF, ['Stealth Rock', 'Earthquake', 'Slack Off', 'Whirlwind']),
		s('Pitanguinha (Steelix) (F)', 'Steelixite', 'Sturdy', 'Adamant', HPATK, ['Earthquake', 'Heavy Slam', 'Stone Edge', 'Dragon Tail']),
		s('Bátima (Gliscor)', 'Toxic Orb', 'Poison Heal', 'Impish', HPDEF, ['Earthquake', 'Knock Off', 'Roost', 'Protect']),
		s('Donphan', 'Leftovers', 'Sturdy', 'Impish', HPDEF, ['Rapid Spin', 'Earthquake', 'Knock Off', 'Ice Shard']),
		s('Paraechinus (Sandslash) (M)', 'Life Orb', 'Sand Rush', 'Jolly', ATK, ['Swords Dance', 'Earthquake', 'Stone Edge', 'Knock Off']),
		s('Nidoking (M)', 'Life Orb', 'Sheer Force', 'Timid', SPA, ['Earth Power', 'Sludge Wave', 'Ice Beam', 'Flamethrower'], '0 Atk'),
	]],
	['Ice', [
		s('Glalie', 'Glalitite', 'Inner Focus', 'Jolly', ATK, ['Return', 'Earthquake', 'Explosion', 'Ice Shard']),
		s('Lapras', 'Leftovers', 'Water Absorb', 'Modest', HPSPA, ['Freeze-Dry', 'Surf', 'Thunderbolt', 'Psychic'], '0 Atk'),
		s('Mamoswine', 'Life Orb', 'Thick Fat', 'Jolly', ATK, ['Icicle Crash', 'Earthquake', 'Ice Shard', 'Stealth Rock']),
		s('Weavile', 'Choice Band', 'Pressure', 'Jolly', ATK, ['Triple Axel', 'Knock Off', 'Ice Shard', 'Low Kick']),
		s('Delibird', 'Heavy-Duty Boots', 'Vital Spirit', 'Jolly', '252 HP / 4 Def / 252 Spe', ['Spikes', 'Rapid Spin', 'Freeze-Dry', 'Memento']),
		s('Dewgong', 'Leftovers', 'Thick Fat', 'Bold', HPDEF, ['Surf', 'Ice Beam', 'Encore', 'Protect'], '0 Atk'),
	]],
	['Flying', [
		s('Pidgeot', 'Pidgeotite', 'Keen Eye', 'Timid', SPA, ['Hurricane', 'Heat Wave', 'U-turn', 'Roost']),
		s('Staraptor', 'Choice Band', 'Reckless', 'Jolly', ATK, ['Brave Bird', 'Double-Edge', 'Close Combat', 'U-turn']),
		s('Yanmega', 'Life Orb', 'Speed Boost', 'Timid', SPA, ['Protect', 'Bug Buzz', 'Air Slash', 'Giga Drain'], '0 Atk'),
		s('Ninjask', 'Focus Sash', 'Speed Boost', 'Jolly', ATK, ['Swords Dance', 'X-Scissor', 'Acrobatics', 'Protect']),
		s('Mantine', 'Heavy-Duty Boots', 'Water Absorb', 'Bold', HPDEF, ['Scald', 'Hurricane', 'Roost', 'Defog'], '0 Atk'),
		s('Noctowl', 'Heavy-Duty Boots', 'Tinted Lens', 'Timid', SPA, ['Hurricane', 'Hyper Voice', 'Roost', 'Calm Mind'], '0 Atk'),
	]],
	['Psychic', [
		s('Gardevoir', 'Gardevoirite', 'Trace', 'Timid', SPA, ['Calm Mind', 'Hyper Voice', 'Psyshock', 'Mystical Fire'], '0 Atk'),
		s('Alakazam', 'Life Orb', 'Magic Guard', 'Timid', SPA, ['Nasty Plot', 'Psychic', 'Shadow Ball', 'Focus Blast'], '0 Atk'),
		s('Rapidash-Galar', 'Life Orb', 'Pastel Veil', 'Jolly', ATK, ['Swords Dance', 'Play Rough', 'Zen Headbutt', 'High Horsepower']),
		s('Starmie', 'Leftovers', 'Natural Cure', 'Timid', SPA, ['Rapid Spin', 'Scald', 'Psyshock', 'Recover'], '0 Atk'),
		s('Grumpig', 'Leftovers', 'Thick Fat', 'Calm', HPSPD, ['Calm Mind', 'Psychic', 'Shadow Ball', 'Rest'], '0 Atk'),
		s('Oranguru', 'Mental Herb', 'Inner Focus', 'Quiet', HPSPA, ['Trick Room', 'Psychic', 'Focus Blast', 'Nasty Plot'], '0 Atk / 0 Spe'),
	]],
	['Normal', [
		s('Tauros (M)', 'Life Orb', 'Sheer Force', 'Jolly', ATK, ['Body Slam', 'Close Combat', 'Earthquake', 'Rock Slide']),
		s('Swellow', 'Flame Orb', 'Guts', 'Jolly', ATK, ['Facade', 'Brave Bird', 'U-turn', 'Protect']),
		s('Snorlax', 'Leftovers', 'Thick Fat', 'Careful', HPSPD, ['Body Slam', 'Curse', 'Rest', 'Sleep Talk']),
		s('Smeargle', 'Focus Sash', 'Own Tempo', 'Jolly', '252 HP / 4 Def / 252 Spe', ['Spore', 'Sticky Web', 'Stealth Rock', 'Whirlwind']),
		s('Dubwool', 'Leftovers', 'Fluffy', 'Impish', HPDEF, ['Cotton Guard', 'Body Press', 'Rest', 'Sleep Talk']),
		s('Girafarig', 'Eviolite', 'Inner Focus', 'Calm', HPSPD, ['Nasty Plot', 'Psychic', 'Hyper Voice', 'Shadow Ball'], '0 Atk'),
	]],
	['Grass', [
		s('Torterra', 'Leftovers', 'Shell Armor', 'Impish', HPDEF, ['Wood Hammer', 'Earthquake', 'Stealth Rock', 'Synthesis']),
		s('Tropius', 'Sitrus Berry', 'Harvest', 'Bold', HPDEF, ['Leech Seed', 'Substitute', 'Air Slash', 'Protect'], '0 Atk'),
		s('Ferrothorn', 'Leftovers', 'Iron Barbs', 'Relaxed', HPDEF, ['Spikes', 'Leech Seed', 'Power Whip', 'Gyro Ball'], '0 Spe'),
		s('Roserade', 'Focus Sash', 'Natural Cure', 'Timid', SPA, ['Leaf Storm', 'Sludge Bomb', 'Sleep Powder', 'Synthesis'], '0 Atk'),
		s('Breloom', 'Toxic Orb', 'Poison Heal', 'Adamant', HPATK, ['Spore', 'Seed Bomb', 'Mach Punch', 'Swords Dance']),
		s('Cacturne', 'Life Orb', 'Water Absorb', 'Jolly', ATK, ['Swords Dance', 'Seed Bomb', 'Sucker Punch', 'Drain Punch']),
	]],
	['Electric', [
		s('Ampharos', 'Ampharosite', 'Static', 'Modest', HPSPA, ['Thunderbolt', 'Dragon Pulse', 'Focus Blast', 'Volt Switch'], '0 Atk'),
		s('Toxtricity', 'Throat Spray', 'Punk Rock', 'Modest', SPA, ['Overdrive', 'Boomburst', 'Sludge Bomb', 'Volt Switch']),
		s('Electrode', 'Light Clay', 'Soundproof', 'Timid', '252 HP / 4 SpD / 252 Spe', ['Reflect', 'Light Screen', 'Thunderbolt', 'Volt Switch'], '0 Atk'),
		s('Manectric', 'Choice Specs', 'Lightning Rod', 'Timid', SPA, ['Thunderbolt', 'Volt Switch', 'Overheat', 'Snarl'], '0 Atk'),
		s('Galvantula', 'Focus Sash', 'Compound Eyes', 'Timid', SPA, ['Sticky Web', 'Thunder', 'Bug Buzz', 'Giga Drain'], '0 Atk'),
		s('Zebstrika', 'Life Orb', 'Lightning Rod', 'Jolly', ATK, ['Wild Charge', 'Flame Charge', 'High Horsepower', 'Volt Switch']),
	]],
	['Rock', [
		s('Shuckle', 'Mental Herb', 'Sturdy', 'Bold', HPDEF, ['Sticky Web', 'Stealth Rock', 'Encore', 'Infestation']),
		s('Rhydon', 'Eviolite', 'Lightning Rod', 'Adamant', HPATK, ['Swords Dance', 'Earthquake', 'Stone Edge', 'Megahorn']),
		s('Golem', 'Custap Berry', 'Sturdy', 'Adamant', HPATK, ['Earthquake', 'Stone Edge', 'Heavy Slam', 'Explosion']),
		s('Lycanroc-Dusk', 'Life Orb', 'Tough Claws', 'Jolly', ATK, ['Swords Dance', 'Accelerock', 'Stone Edge', 'Close Combat']),
		s('Armaldo', 'Leftovers', 'Battle Armor', 'Adamant', HPATK, ['Rapid Spin', 'Stone Edge', 'X-Scissor', 'Earthquake']),
		s('Kabutops', 'Life Orb', 'Swift Swim', 'Adamant', ATK, ['Swords Dance', 'Liquidation', 'Stone Edge', 'Aqua Jet']),
	]],
	['Dragon', [
		s('Garchomp', 'Garchompite', 'Rough Skin', 'Jolly', ATK, ['Swords Dance', 'Earthquake', 'Stone Edge', 'Fire Fang']),
		s('Haxorus', 'Life Orb', 'Mold Breaker', 'Jolly', ATK, ['Dragon Dance', 'Outrage', 'Earthquake', 'Poison Jab']),
		s('Noivern', 'Choice Specs', 'Infiltrator', 'Timid', SPA, ['Draco Meteor', 'Hurricane', 'Flamethrower', 'U-turn']),
		s('Flygon', 'Choice Scarf', 'Levitate', 'Jolly', ATK, ['Earthquake', 'Outrage', 'U-turn', 'Stone Edge']),
		s('Kingdra', 'Lum Berry', 'Sniper', 'Adamant', ATK, ['Dragon Dance', 'Waterfall', 'Outrage', 'Iron Head']),
		s('Dragonair', 'Eviolite', 'Shed Skin', 'Adamant', HPATK, ['Dragon Dance', 'Outrage', 'Extreme Speed', 'Waterfall']),
	]],
	['Poison', [
		s('Gengar', 'Gengarite', 'Cursed Body', 'Timid', SPA, ['Shadow Ball', 'Sludge Wave', 'Focus Blast', 'Destiny Bond'], '0 Atk'),
		s('Venusaur', 'Black Sludge', 'Overgrow', 'Calm', HPSPD, ['Giga Drain', 'Sludge Bomb', 'Synthesis', 'Leech Seed'], '0 Atk'),
		s('Arbok', 'Life Orb', 'Intimidate', 'Jolly', ATK, ['Coil', 'Gunk Shot', 'Sucker Punch', 'Earthquake']),
		s('Toxicroak', 'Life Orb', 'Dry Skin', 'Jolly', ATK, ['Swords Dance', 'Gunk Shot', 'Drain Punch', 'Sucker Punch']),
		s('Drapion', 'Leftovers', 'Battle Armor', 'Jolly', ATK, ['Swords Dance', 'Knock Off', 'Poison Jab', 'Earthquake']),
		s('Crobat', 'Heavy-Duty Boots', 'Infiltrator', 'Jolly', ATK, ['Brave Bird', 'U-turn', 'Roost', 'Defog']),
	]],
	['Fairy', [
		s('Azumarill', 'Choice Band', 'Huge Power', 'Adamant', HPATK, ['Aqua Jet', 'Liquidation', 'Play Rough', 'Knock Off']),
		s('Granbull', 'Leftovers', 'Intimidate', 'Impish', HPDEF, ['Play Rough', 'Earthquake', 'Thunder Wave', 'Heal Bell']),
		s('Mr. Mime', 'Life Orb', 'Filter', 'Timid', SPA, ['Nasty Plot', 'Psychic', 'Dazzling Gleam', 'Focus Blast'], '0 Atk'),
		s('Ninetales-Alola', 'Light Clay', 'Snow Warning', 'Timid', SPA, ['Aurora Veil', 'Blizzard', 'Moonblast', 'Freeze-Dry'], '0 Atk'),
		s('Wigglytuff', 'Leftovers', 'Competitive', 'Calm', HPSPD, ['Dazzling Gleam', 'Fire Blast', 'Thunder Wave', 'Protect'], '0 Atk'),
		s('Togetic', 'Eviolite', 'Serene Grace', 'Bold', HPDEF, ['Dazzling Gleam', 'Wish', 'Roost', 'Thunder Wave'], '0 Atk'),
	]],
	['Water', [
		s('Swampert', 'Swampertite', 'Torrent', 'Adamant', ATK, ['Rain Dance', 'Waterfall', 'Earthquake', 'Ice Punch']),
		s('Kingler', 'Life Orb', 'Sheer Force', 'Adamant', ATK, ['Swords Dance', 'Crabhammer', 'Knock Off', 'Rock Slide']),
		s('Walrein', 'Leftovers', 'Thick Fat', 'Bold', HPDEF, ['Surf', 'Ice Beam', 'Protect', 'Roar'], '0 Atk'),
		s('Feraligatr', 'Life Orb', 'Sheer Force', 'Jolly', ATK, ['Dragon Dance', 'Liquidation', 'Crunch', 'Ice Punch']),
		s('Cloyster', 'White Herb', 'Skill Link', 'Jolly', ATK, ['Shell Smash', 'Icicle Spear', 'Rock Blast', 'Rapid Spin']),
		s('Qwilfish', 'Black Sludge', 'Intimidate', 'Impish', HPDEF, ['Spikes', 'Toxic Spikes', 'Waterfall', 'Taunt']),
	]],
	['Ghost', [
		s('Banette', 'Banettite', 'Insomnia', 'Adamant', HPATK, ['Destiny Bond', 'Will-O-Wisp', 'Shadow Claw', 'Knock Off']),
		s('Chandelure', 'Choice Specs', 'Flash Fire', 'Timid', SPA, ['Shadow Ball', 'Fire Blast', 'Energy Ball', 'Trick'], '0 Atk'),
		s('Mismagius', 'Life Orb', 'Levitate', 'Timid', SPA, ['Nasty Plot', 'Shadow Ball', 'Dazzling Gleam', 'Thunderbolt'], '0 Atk'),
		s('Marowak-Alola', 'Thick Club', 'Lightning Rod', 'Adamant', HPATK, ['Swords Dance', 'Flare Blitz', 'Shadow Bone', 'Bonemerang']),
		s('Annihilape', 'Leftovers', 'Defiant', 'Adamant', HPATK, ['Bulk Up', 'Drain Punch', 'Rage Fist', 'Taunt']),
		s('Froslass (F)', 'Focus Sash', 'Cursed Body', 'Timid', SPA, ['Spikes', 'Taunt', 'Ice Beam', 'Poltergeist']),
	]],
	['Fighting', [
		s('Machamp', 'Assault Vest', 'No Guard', 'Adamant', HPATK, ['Dynamic Punch', 'Knock Off', 'Bullet Punch', 'Ice Punch']),
		s('Toxicroak', 'Life Orb', 'Dry Skin', 'Jolly', ATK, ['Swords Dance', 'Gunk Shot', 'Drain Punch', 'Sucker Punch']),
		s("Sirfetch'd", 'Leek', 'Scrappy', 'Jolly', ATK, ['Swords Dance', 'Close Combat', 'Brave Bird', 'Knock Off']),
		s('Conkeldurr', 'Flame Orb', 'Guts', 'Adamant', HPATK, ['Mach Punch', 'Drain Punch', 'Knock Off', 'Ice Punch']),
		s('Poliwrath', 'Leftovers', 'Water Absorb', 'Adamant', HPATK, ['Bulk Up', 'Drain Punch', 'Waterfall', 'Ice Punch']),
		s('Hitmonchan (M)', 'Life Orb', 'Iron Fist', 'Jolly', ATK, ['Drain Punch', 'Ice Punch', 'Thunder Punch', 'Mach Punch']),
	]],
];

const trainers = TYPES.map(([type, sets]) => ({
	name: `${type} Rafa`, title: 'Gym Leader', type, doubles: false, sprite: '', team: sets.join('\n\n'),
}));
const champion = { name: 'Favorite Rafa', title: 'Champion', type: null, doubles: false, sprite: '', team: FAVORITES };

const pack = {
	type: 'liga-desafios/ginasios', version: 1,
	trainers: [...trainers, champion],
	challenges: [{
		name: 'Liga Favoritos',
		baseFormat: 'gen9nationaldexag',
		customRules: 'Standard NatDex, Terastal Clause, Z-Move Clause, Dynamax Clause',
		typeMode: 'random', gymCount: 8, orderMode: 'free', hasElite4: false, teamLock: false,
		baseAILevel: 'medium', timerMode: 'free', turnSeconds: null, lossLimit: null,
		eliminateOnElite4Loss: false, eliminateOnChampionLoss: false,
		stages: [{ kind: 'champion', position: 1, trainer: champion.name, aiLevel: null, badge: null }],
		pool: trainers.map(trainer => ({ trainer: trainer.name, aiLevel: null, badge: null })),
	}],
};

const out = process.argv[2] || path.join(__dirname, '..', '..', 'pacotes');
fs.mkdirSync(out, { recursive: true });
const json = JSON.stringify(pack, null, '\t') + '\n';
fs.writeFileSync(path.join(out, 'liga-favoritos.json'), json);
console.log(`liga-favoritos.json: ${pack.trainers.length} treinadores, ${Math.ceil(json.length / 1024)} KB`);
