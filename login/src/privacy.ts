/**
 * Aviso de privacidade (LGPD) do servidor, em pt e en: página /privacidade.
 *
 * Reflete o inventário de dados de docs/revisao-seguranca-lgpd.md. Ao mudar o que
 * o projeto guarda ou compartilha, atualize este texto e a data.
 */
import type { Lang } from './i18n.ts';

export const PRIVACY_UPDATED = '2026-10-23';

interface Section {
	title: string;
	paragraphs: string[];
}

/** Página de texto (aviso de privacidade, regras) em seções. */
export interface Notice {
	title: string;
	updated: string;
	sections: Section[];
}

/** Textos do aviso; {admin} vira o nome do administrador. */
export const PRIVACY: { [lang in Lang]: Notice } = {
	pt: {
		title: 'Aviso de privacidade',
		updated: 'Atualizado em 23/10/2026.',
		sections: [
			{
				title: 'Quem somos',
				paragraphs: [
					'A Liga de Desafios (ligadesafios.com.br) é um servidor casual de batalhas Pokémon, sem fins lucrativos, para uso entre amigos, construído sobre o Pokémon Showdown. O responsável pelos dados (controlador, na LGPD) é o administrador do servidor, a conta {admin}.',
				],
			},
			{
				title: 'Dados que guardamos',
				paragraphs: [
					'Conta: o seu nome de usuário e um hash da sua senha (a senha em si nunca é guardada). Não pedimos e-mail nem nenhum outro dado pessoal.',
					'Sessão: um cookie (ps_session) que mantém você conectado por 30 dias, renovados a cada uso. No servidor fica só um hash desse cookie.',
					'Jogo: a sua posição no ranking (ladder), um eventual cargo de moderação e, no Desafio de Ginásios, as suas jornadas, insígnias e conquistas, com os Pokémon do time que venceu cada insígnia e o Campeão (só as espécies, sem itens, golpes ou outros detalhes). O seu perfil e histórico no Desafio de Ginásios ficam visíveis para os outros usuários logados.',
					'Expedição: as suas expedições (qual expedição, a semente do mapa, o caminho percorrido, o time com níveis, golpes, itens e estado, o sprite de treinador da expedição, os Pokémon do Computador, a mochila, o dinheiro, a dificuldade escolhida e o resultado), as suas insígnias do modo Completo e os seus desbloqueios de cada expedição. O seu perfil na Expedição (placar, conquistas, insígnias, últimas expedições com o time no fim e desbloqueios) fica visível para os outros usuários logados.',
					'Batalhas do Desafio de Ginásios e da Expedição em andamento: o estado da batalha (nomes, times e jogadas, sem as mensagens de chat), para que ela continue se for interrompida. Ele é apagado quando a batalha termina.',
					'Aprendizado da IA Mestre: das batalhas do Desafio de Ginásios, guardamos dados anônimos de cada turno, vistos pelo treinador e pelo jogador (números como o HP somado de cada lado, os Pokémon restantes, os boosts, os status e os hazards) e quem venceu. Eles não têm o seu nome, a sua conta, o desafio, a data nem os Pokémon do seu time, e não há como ligá-los a você. Servem só para a IA Mestre aprender a jogar melhor e ficam guardados sem prazo.',
					'Registros de batalhas da ladder: nomes dos jogadores e times usados, guardados por 30 dias. As batalhas são públicas enquanto acontecem.',
					'Registro de acesso ao site: o IP, a data e a hora, o endereço pedido (sem códigos de convite ou de redefinição), o resultado e o navegador (user agent) de cada acesso, guardados por 14 dias e apagados automaticamente. Ele serve só para a segurança do servidor (identificar ataques e abusos), não fica ligado à sua conta e só o administrador tem acesso.',
					'Registro de segurança do login: senhas erradas e bloqueios por excesso de tentativas, códigos de convite ou de redefinição inválidos, criação, troca de senha, redefinição e exclusão de conta, convites gerados e revogados e pedidos recusados (vindos de outro site ou em excesso), com a data, a conta envolvida e o IP. Ele fica 30 dias, inclusive depois da exclusão da conta, serve só para a segurança do servidor (detectar e investigar ataques a contas) e só o administrador tem acesso.',
					'Registros de moderação (modlog): as ações da equipe de moderação, como avisos e punições, com o nome de quem foi alvo, as contas ligadas a ele conhecidas na hora e o IP. Cada registro fica 6 meses, e o IP é apagado dele depois de 30 dias. As punições em vigor (por exemplo, um bloqueio) ficam até vencerem ou serem retiradas.',
					'Cópias de segurança: os dados acima (exceto o registro de acesso e os registros de batalhas) entram numa cópia de segurança diária criptografada, guardada por 14 dias e apagada automaticamente.',
					'Os times montados e as preferências ficam só no seu navegador; o servidor recebe o time só para a batalha, e o que fica guardado dele está descrito acima. O idioma escolhido também fica num cookie (ps_lang), só para as páginas de conta abrirem no mesmo idioma do jogo, e é informado ao servidor de jogo enquanto você está conectado.',
				],
			},
			{
				title: 'O que não guardamos',
				paragraphs: [
					'Fora do registro de acesso (14 dias), do registro de segurança do login (30 dias) e de um eventual registro de moderação (30 dias), o seu IP é usado apenas em memória, para manter a conexão e limitar tentativas de senha (por até 15 minutos). As conversas no chat não são registradas, e não guardamos as trocas de nome entre contas.',
				],
			},
			{
				title: 'Para que usamos',
				paragraphs: [
					'Para oferecer o serviço que você pediu ao criar a conta: entrar no jogo, jogar, participar do ranking, dos desafios e das expedições (LGPD, art. 7º, V). E para proteger o servidor e os jogadores: registro de acesso, registro de segurança do login, limite de tentativas de senha e moderação (legítimo interesse, art. 7º, IX). Os dados de aprendizado da IA Mestre são anônimos desde a coleta e, por isso, não são dados pessoais (LGPD, art. 12).',
				],
			},
			{
				title: 'Terceiros',
				paragraphs: [
					'Não vendemos nem compartilhamos os seus dados. As imagens e os sons do jogo ficam no nosso servidor (pacotes oficiais do Pokémon Showdown). Só o que faltar neles é buscado no site oficial do Pokémon Showdown, e esse pedido passa pelo nosso servidor, que não repassa o seu cookie, o seu IP nem a página de onde o pedido saiu. Links externos (Pokédex, fórum da Smogon e afins) só são acessados se você clicar neles.',
				],
			},
			{
				title: 'Por quanto tempo',
				paragraphs: [
					'Os dados da conta e do jogo ficam até você excluir a conta. Os registros de batalhas da ladder são apagados depois de 30 dias; o registro de acesso, depois de 14 dias; o registro de segurança do login, depois de 30 dias; os registros de moderação, depois de 6 meses (o IP deles, depois de 30 dias); e as cópias de segurança, depois de 14 dias. Os demais registros técnicos do servidor têm tamanho limitado e não guardam o seu IP.',
					'Ao excluir a conta em /conta, apagamos em poucos minutos: a conta, as sessões, o ranking, os cargos, as jornadas (com as batalhas salvas), as conquistas, as expedições (com as batalhas salvas), as insígnias e os desbloqueios da Expedição e os registros de batalhas em que você jogou. As batalhas em andamento terminam com a sua desistência. O registro de acesso não é ligado à conta e se apaga sozinho em 14 dias. Os registros de moderação sobre você (até 6 meses) e o registro de segurança do login (até 30 dias) ficam até o fim do prazo deles, pela segurança do servidor, e as cópias de segurança são substituídas em até 14 dias. Os dados anônimos de aprendizado da IA Mestre não ficam ligados à conta e, por isso, não há como separar os seus para apagar.',
				],
			},
			{
				title: 'Seus direitos',
				paragraphs: [
					'Pela LGPD (art. 18), você pode pedir a confirmação de que tratamos os seus dados, o acesso a eles, a correção, a eliminação e informações sobre o tratamento. A exclusão da conta e de todos os dados pode ser feita diretamente em /conta. Para os demais pedidos ou dúvidas, mande uma mensagem privada ao administrador ({admin}) no jogo.',
				],
			},
		],
	},
	en: {
		title: 'Privacy notice',
		updated: 'Last updated on 2026-10-23.',
		sections: [
			{
				title: 'Who we are',
				paragraphs: [
					'Liga de Desafios (ligadesafios.com.br) is a casual, non-profit Pokémon battle server for friends, built on Pokémon Showdown. The person responsible for the data (the controller, under Brazil\'s LGPD) is the server administrator, the {admin} account.',
				],
			},
			{
				title: 'Data we store',
				paragraphs: [
					'Account: your username and a hash of your password (the password itself is never stored). We do not ask for an e-mail address or any other personal data.',
					'Session: a cookie (ps_session) that keeps you logged in for 30 days, renewed whenever you use it. The server keeps only a hash of it.',
					'Game: your ladder ranking, any moderation rank and, in the Gym Challenge, your journeys, badges and achievements, with the Pokémon of the team that won each badge and the Champion (species only, without items, moves or other details). Your Gym Challenge profile and history are visible to other logged-in users.',
					'Expedition: your expeditions (which expedition, the map seed, the path taken, the team with levels, moves, items and condition, the trainer sprite of the expedition, the Pokémon in the Computer, the bag, the money, the chosen difficulty and the result), your Complete mode badges and your unlocks in each expedition. Your Expedition profile (scores, achievements, badges, latest expeditions with the final team, and unlocks) is visible to other logged-in users.',
					'Gym Challenge and Expedition battles in progress: the battle state (names, teams and moves, without chat messages), so the battle can continue if it is interrupted. It is deleted when the battle ends.',
					'Master AI learning: from Gym Challenge battles, we keep anonymous data about each turn, as seen by the trainer and by the player (numbers such as the total HP of each side, the remaining Pokémon, boosts, status conditions and hazards) and who won. It does not include your name, your account, the challenge, the date or the Pokémon in your team, and it cannot be linked to you. It is used only to help the Master AI learn to play better and is kept with no time limit.',
					'Ladder battle logs: player names and the teams used, kept for 30 days. Battles are public while they happen.',
					'Website access log: the IP address, date and time, requested address (without invite or reset codes), result and browser (user agent) of each access, kept for 14 days and deleted automatically. It is used only for the server\'s security (spotting attacks and abuse), is not linked to your account, and only the administrator can access it.',
					'Login security log: wrong passwords and blocks after too many attempts, invalid invite or reset codes, account creation, password changes, resets and account deletion, invites issued and revoked, and refused requests (from another site or too many), with the date, the account involved and the IP address. It is kept for 30 days, also after the account is deleted, is used only for the server\'s security (spotting and investigating attacks on accounts), and only the administrator can access it.',
					'Moderation records (modlog): actions taken by the moderation team, such as warnings and punishments, with the name of the target, the linked accounts known at the time and the IP address. Each record is kept for 6 months, and the IP address is removed from it after 30 days. Active punishments (for example, a lock) are kept until they expire or are lifted.',
					'Backups: the data above (except the access log and battle logs) goes into a daily encrypted backup, kept for 14 days and deleted automatically.',
					'The teams you build and your preferences stay in your browser only; the server receives a team only for the battle, and what is kept from it is described above. Your chosen language is also kept in a cookie (ps_lang), only so that the account pages open in the same language as the game, and it is sent to the game server while you are connected.',
				],
			},
			{
				title: 'What we do not store',
				paragraphs: [
					'Outside the access log (14 days), the login security log (30 days) and any moderation record (30 days), your IP address is only used in memory, to keep your connection and to limit password attempts (for up to 15 minutes). Chat messages are not logged, and we do not keep name changes between accounts.',
				],
			},
			{
				title: 'Why we use it',
				paragraphs: [
					'To provide the service you asked for when creating the account: logging in, playing, the ladder, the challenges and the expeditions (LGPD, art. 7, V). And to protect the server and its players: access log, login security log, password attempt limits and moderation (legitimate interest, art. 7, IX). The Master AI learning data is anonymous from the moment it is collected and is therefore not personal data (LGPD, art. 12).',
				],
			},
			{
				title: 'Third parties',
				paragraphs: [
					'We do not sell or share your data. Game images and sounds are stored on our server (official Pokémon Showdown packages). Only what is missing from them is fetched from the official Pokémon Showdown website, and that request goes through our server, which does not forward your cookie, your IP address or the page the request came from. External links (Pokédex, Smogon forum and the like) are only accessed if you click them.',
				],
			},
			{
				title: 'How long we keep it',
				paragraphs: [
					'Account and game data are kept until you delete your account. Ladder battle logs are deleted after 30 days; the access log after 14 days; the login security log after 30 days; moderation records after 6 months (their IP addresses after 30 days); and backups after 14 days. The server\'s other technical logs have a limited size and do not keep your IP address.',
					'When you delete your account at /conta, within a few minutes we delete: the account, sessions, ranking, ranks, journeys (with their saved battles), achievements, expeditions (with their saved battles), Expedition badges and unlocks and the battle logs you played in. Battles in progress end with your forfeit. The access log is not linked to your account and deletes itself after 14 days. Moderation records about you (up to 6 months) and the login security log (up to 30 days) are kept until the end of their period, for the server\'s security, and backups are replaced within 14 days. The anonymous Master AI learning data is not linked to your account, so there is no way to single out and delete yours.',
				],
			},
			{
				title: 'Your rights',
				paragraphs: [
					'Under the LGPD (art. 18), you may ask us to confirm that we process your data, to access, correct or delete it, and for information about how it is processed. You can delete your account and all your data directly at /conta. For other requests or questions, send a private message to the administrator ({admin}) in the game.',
				],
			},
		],
	},
};
