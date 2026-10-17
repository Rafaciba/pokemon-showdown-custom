/** @type {import('../play.pokemonshowdown.com/src/client-main').PSConfig} */
// Configuração do cliente (pokemon-showdown-custom).
// Template: __PS_HOST__ é substituído pelo build.sh com o valor de PS_HOST.
// O build do cliente acrescenta automaticamente Config.version e Config.routes
// (a partir de config/routes.json) ao final deste arquivo.
var Config = Config || {};

/* version */ Config.version = "0";

Config.bannedHosts = [];

// Domínios cujos links abrem sem aviso no chat
Config.whitelist = [
	'wikipedia.org',
	'smogon.com',
	'pokemonshowdown.com',
	'github.com'
];

// Servidor de jogo: o mesmo domínio do site, via proxy em /showdown (wss na 443).
// "httpport" preenchido faz o cliente novo usar https/wss na "port";
// o cliente clássico usa https quando port === 443.
// "id" aparece nas URLs do login (/~~custom/action.php).
// ATENÇÃO: o host não pode ser exatamente "localhost" (o cliente clássico
// força ws:// sem TLS nesse caso); em dev usamos ps.localhost.
Config.defaultserver = {
	id: 'custom',
	host: '__PS_HOST__',
	port: 443,
	httpport: 8000,
	altport: 80,
	registered: true
};

Config.roomsFirstOpenScript = function () {
};

Config.customcolors = {};
