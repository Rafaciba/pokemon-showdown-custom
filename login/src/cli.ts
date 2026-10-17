/**
 * Comandos administrativos pelo terminal (dentro do container do login):
 *
 *   docker compose exec login node src/cli.ts convite [--nome NOME]
 *   docker compose exec login node src/cli.ts redefinir NOME
 *   docker compose exec login node src/cli.ts usuarios
 *
 * "convite --nome" reserva o convite para um nome específico (ex.: a conta
 * do próprio admin no primeiro uso: a senha é escolhida na página de cadastro,
 * nunca passa pelo terminal).
 */
import { loadConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { issueCode, countPendingCodes, INVITE_TTL_SECONDS, RESET_TTL_SECONDS } from './codes.ts';
import { getUser, normalizeUsername } from './accounts.ts';
import { t } from './i18n.ts';
import { toID } from './util.ts';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const [command, ...args] = process.argv.slice(2);

const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function fail(message: string): never {
	console.error(`Erro: ${message}`);
	process.exit(1);
}

switch (command) {
case 'convite': {
	let userid: string | null = null;
	const nameIndex = args.indexOf('--nome');
	if (nameIndex >= 0) {
		const name = normalizeUsername(args[nameIndex + 1] ?? '');
		if (!name.ok) fail(t('pt', name.error));
		if (getUser(db, name.value.userid)) fail(t('pt', 'nameTaken'));
		userid = name.value.userid;
	}
	const { code, expiresAt } = issueCode(db, 'invite', userid, INVITE_TTL_SECONDS);
	console.log(`Código de convite: ${code}`);
	if (userid) console.log(`Reservado para o nome: ${userid}`);
	console.log(`Válido até: ${formatDate(expiresAt)} (uso único)`);
	console.log(`Link de cadastro: https://${config.serverHost}/cadastro?convite=${code}`);
	break;
}
case 'redefinir': {
	const user = getUser(db, toID(args[0]));
	if (!user) fail('usuário não encontrado.');
	const { code, expiresAt } = issueCode(db, 'reset', user.userid, RESET_TTL_SECONDS);
	console.log(`Código de redefinição para ${user.username}: ${code}`);
	console.log(`Válido até: ${formatDate(expiresAt)} (uso único)`);
	console.log(`Página: https://${config.serverHost}/redefinir`);
	break;
}
case 'usuarios': {
	const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
	console.log(`Contas: ${n}`);
	console.log(`Convites pendentes: ${countPendingCodes(db, 'invite')}`);
	break;
}
default:
	console.log('Uso: node src/cli.ts convite [--nome NOME] | redefinir NOME | usuarios');
	process.exitCode = command ? 1 : 0;
}
db.close();
