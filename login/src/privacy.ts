/**
 * Aviso de privacidade (LGPD) do servidor, em pt e en: página /privacidade.
 *
 * Reflete o inventário de dados de docs/revisao-seguranca-lgpd.md. Ao mudar o que
 * o projeto guarda ou compartilha, atualize este texto e a data.
 */
import type { Lang } from './i18n.ts';

export const PRIVACY_UPDATED = '2026-10-18';

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
		updated: 'Atualizado em 18/10/2026.',
		sections: [
			{
				title: 'Quem somos',
				paragraphs: [
					'Este é um servidor casual de batalhas Pokémon, sem fins lucrativos, para uso entre amigos, construído sobre o Pokémon Showdown. O responsável pelos dados (controlador, na LGPD) é o administrador do servidor, a conta {admin}.',
				],
			},
			{
				title: 'Dados que guardamos',
				paragraphs: [
					'Conta: o seu nome de usuário e um hash da sua senha (a senha em si nunca é guardada). Não pedimos e-mail nem nenhum outro dado pessoal.',
					'Sessão: um cookie (ps_session) que mantém você conectado por 30 dias, renovados a cada uso. No servidor fica só um hash desse cookie.',
					'Jogo: a sua posição no ranking (ladder), um eventual cargo de moderação e, no Desafio de Ginásios, as suas jornadas, insígnias e conquistas. O seu perfil e histórico no Desafio de Ginásios ficam visíveis para os outros usuários logados.',
					'Registros de batalhas da ladder: nomes dos jogadores e times usados, guardados por 30 dias. As batalhas são públicas enquanto acontecem.',
					'Registros de moderação: só se houver uma punição (por exemplo, um bloqueio), com o nome e o IP de quem foi punido, guardados enquanto forem necessários para a segurança do servidor.',
					'Times e preferências ficam só no seu navegador; não são enviados ao servidor.',
				],
			},
			{
				title: 'O que não guardamos',
				paragraphs: [
					'Não guardamos o seu IP em registros: ele é usado apenas temporariamente, em memória, para manter a conexão e limitar tentativas de senha (por até 15 minutos). As conversas no chat não são registradas.',
				],
			},
			{
				title: 'Para que usamos',
				paragraphs: [
					'Para oferecer o serviço que você pediu ao criar a conta: entrar no jogo, jogar, participar do ranking e dos desafios (LGPD, art. 7º, V). E para proteger o servidor e os jogadores: limite de tentativas de senha e moderação (legítimo interesse, art. 7º, IX).',
				],
			},
			{
				title: 'Terceiros',
				paragraphs: [
					'Não vendemos nem compartilhamos os seus dados. As imagens e os sons do jogo vêm do site oficial do Pokémon Showdown, mas passam pelo nosso servidor, que não repassa o seu cookie, o seu IP nem a página de onde o pedido saiu. Links externos (Pokédex, fórum da Smogon e afins) só são acessados se você clicar neles.',
				],
			},
			{
				title: 'Por quanto tempo',
				paragraphs: [
					'Os dados da conta e do jogo ficam até você excluir a conta. Os registros de batalhas da ladder são apagados depois de 30 dias. Os registros técnicos do servidor têm tamanho limitado e não guardam o seu IP.',
					'Ao excluir a conta em /conta, apagamos em poucos minutos: a conta, as sessões, o ranking, os cargos, as jornadas, as conquistas e os registros de batalhas em que você jogou.',
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
		updated: 'Last updated on 2026-10-18.',
		sections: [
			{
				title: 'Who we are',
				paragraphs: [
					'This is a casual, non-profit Pokémon battle server for friends, built on Pokémon Showdown. The person responsible for the data (the controller, under Brazil\'s LGPD) is the server administrator, the {admin} account.',
				],
			},
			{
				title: 'Data we store',
				paragraphs: [
					'Account: your username and a hash of your password (the password itself is never stored). We do not ask for an e-mail address or any other personal data.',
					'Session: a cookie (ps_session) that keeps you logged in for 30 days, renewed whenever you use it. The server keeps only a hash of it.',
					'Game: your ladder ranking, any moderation rank and, in the Gym Challenge, your journeys, badges and achievements. Your Gym Challenge profile and history are visible to other logged-in users.',
					'Ladder battle logs: player names and the teams used, kept for 30 days. Battles are public while they happen.',
					'Moderation records: only if there is a punishment (for example, a lock), with the name and IP of the punished user, kept while needed for the server\'s security.',
					'Teams and preferences stay in your browser only; they are not sent to the server.',
				],
			},
			{
				title: 'What we do not store',
				paragraphs: [
					'We do not keep your IP address in logs: it is only used temporarily, in memory, to keep your connection and to limit password attempts (for up to 15 minutes). Chat messages are not logged.',
				],
			},
			{
				title: 'Why we use it',
				paragraphs: [
					'To provide the service you asked for when creating the account: logging in, playing, the ladder and the challenges (LGPD, art. 7, V). And to protect the server and its players: password attempt limits and moderation (legitimate interest, art. 7, IX).',
				],
			},
			{
				title: 'Third parties',
				paragraphs: [
					'We do not sell or share your data. Game images and sounds come from the official Pokémon Showdown website, but they go through our server, which does not forward your cookie, your IP address or the page the request came from. External links (Pokédex, Smogon forum and the like) are only accessed if you click them.',
				],
			},
			{
				title: 'How long we keep it',
				paragraphs: [
					'Account and game data are kept until you delete your account. Ladder battle logs are deleted after 30 days. The server\'s technical logs have a limited size and do not keep your IP address.',
					'When you delete your account at /conta, within a few minutes we delete: the account, sessions, ranking, ranks, journeys, achievements and the battle logs you played in.',
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
