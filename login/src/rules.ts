/**
 * Regras do servidor, em pt e en: página /regras (o /rules do PS e o rodapé do
 * cliente apontam para ela).
 *
 * MANTER ATUALIZADO: todo modo de jogo novo, e toda mudança de regra de um modo
 * existente, precisa de uma seção aqui (e da data). As regras de cada desafio de
 * ginásio (configuradas pelo admin) aparecem na página do próprio desafio; aqui
 * ficam as regras que valem para todos.
 */
import type { Lang } from './i18n.ts';
import type { Notice } from './privacy.ts';

/** Textos das regras; {admin} vira o nome do administrador. */
export const RULES: { [lang in Lang]: Notice } = {
	pt: {
		title: 'Regras',
		updated: 'Atualizado em 18/10/2026.',
		sections: [
			{
				title: 'O servidor',
				paragraphs: [
					'Servidor casual de batalhas Pokémon, para jogar entre amigos. Só joga quem tem conta, e as contas são criadas com convite do administrador ({admin}). Sem conta, dá para assistir às batalhas públicas, mas não para jogar nem falar no chat.',
					'Dúvidas, problemas ou pedidos: mande uma mensagem privada ao administrador ({admin}) no jogo. O administrador pode moderar o chat e as batalhas com as ferramentas do Pokémon Showdown (advertência, silenciar, bloquear).',
				],
			},
			{
				title: 'Respeito',
				paragraphs: [
					'Trate todos com respeito, no chat, nas mensagens privadas e nas batalhas. Não são aceitos ofensas, assédio, discriminação ou discurso de ódio (por raça, cor, etnia, religião, gênero, orientação sexual, deficiência, origem ou qualquer outro motivo), ameaças nem conteúdo sexual ou violento.',
					'Isso vale também para nomes de usuário, nomes de times e apelidos de Pokémon, que aparecem para os outros jogadores.',
					'Não divulgue dados pessoais de ninguém (nome completo, endereço, telefone, fotos e afins), nem os seus.',
				],
			},
			{
				title: 'Boas práticas',
				paragraphs: [
					'Seja um bom jogador: cumprimente, aceite o resultado e não provoque quem perdeu. Não abandone batalhas no meio nem deixe o timer correr de propósito para irritar o adversário; se precisar sair, use o forfeit.',
					'Não faça spam, flood ou propaganda no chat, nem fique desafiando quem já recusou.',
					'A sua conta é só sua: não compartilhe a senha. Se achar um bug, avise o administrador em vez de usá-lo.',
				],
			},
			{
				title: 'Proibido: trapaça',
				paragraphs: [
					'É proibido qualquer tipo de trapaça, como:',
					'- usar bugs ou falhas do servidor para obter vantagem;',
					'- derrubar a conexão ou recarregar a página de propósito para escapar de uma derrota;',
					'- usar programas, scripts ou bots para jogar no seu lugar;',
					'- combinar resultados ou usar outra conta para manipular a ladder ou os desafios;',
					'- tentar invadir, sobrecarregar ou atrapalhar o servidor ou a conta de outra pessoa.',
				],
			},
			{
				title: 'Se as regras não forem cumpridas',
				paragraphs: [
					'Conforme a gravidade, o administrador pode advertir, silenciar, bloquear, anular resultados (por exemplo, encerrar uma jornada obtida com trapaça) ou remover o acesso ao servidor.',
				],
			},
			{
				title: 'Formatos oficiais e ladder',
				paragraphs: [
					'Os formatos oficiais do Pokémon Showdown seguem as regras da Smogon. As regras de um formato aparecem com /formathelp NOME DO FORMATO no chat.',
					'A ladder não junta dois jogadores conectados do mesmo IP (proteção contra abuso de ranking). Quem joga da mesma casa pode se desafiar diretamente.',
				],
			},
			{
				title: 'Desafio de Ginásios: como funciona',
				paragraphs: [
					'Cada desafio tem os seus ginásios, regras e formato próprios, mostrados na página do desafio (botão "Gym Challenge" na tela principal ou /ginasio). Os líderes, a Elite 4 e o Campeão são controlados pelo computador.',
					'Cada tentativa é uma jornada. Você tem uma jornada ativa por desafio, mas pode jogar vários desafios ao mesmo tempo. Para batalhar, escolha o formato "[Desafio] nome do desafio" e clique em "Battle!".',
					'Vencer um líder dá a insígnia dele. Na ordem livre, você escolhe na página do desafio o próximo ginásio; sem escolha, enfrenta o primeiro ainda não vencido. Se o desafio tiver ordem fixa, os ginásios seguem essa ordem.',
					'Em desafios com tipos sorteados, os tipos dos ginásios são sorteados no começo de cada jornada.',
					'Para enfrentar a Elite 4 (ou o Campeão, se o desafio não tiver Elite 4), é preciso ter todas as insígnias. A Elite 4 e o Campeão são enfrentados em sequência, como nos jogos: perder para qualquer um deles faz voltar ao primeiro membro da Elite 4.',
					'Vencer o Campeão vence o desafio, e a conquista vai para o seu perfil. Vencer o mesmo desafio de novo acumula conquistas.',
				],
			},
			{
				title: 'Desafio de Ginásios: batalhas',
				paragraphs: [
					'As batalhas contra os treinadores são sempre públicas: qualquer um pode assistir, e o Lobby anuncia a batalha.',
					'Empate não conta: nem vitória nem derrota. Você enfrenta o mesmo treinador de novo.',
					'Batalha interrompida sem terminar (por exemplo, se o servidor reiniciar) é anulada e não conta. Você enfrenta o mesmo treinador de novo.',
					'O timer fica ligado. Conforme o desafio, há um limite de tempo por turno ou tempo livre; o tempo total da batalha nunca é limitado.',
				],
			},
			{
				title: 'Desafio de Ginásios: time, derrotas e desistência',
				paragraphs: [
					'Se o desafio tiver trava de time, a jornada inteira usa o mesmo time: só o apelido e a ordem dos Pokémon podem mudar. Qualquer outra mudança (Pokémon, golpe, item, EVs etc.) exige desistir e começar uma nova jornada. Sem trava, você pode trocar de time entre as batalhas.',
					'As tentativas são ilimitadas, a não ser que o desafio tenha um limite de derrotas (ao atingir o limite, contando a jornada inteira, você é eliminado) ou elimine quem perde para a Elite 4 ou para o Campeão. Essas opções aparecem na página do desafio.',
					'Você pode desistir da jornada a qualquer momento. Desistir no meio de uma batalha conta como derrota nela e encerra a jornada na hora. Eliminação equivale a desistência.',
					'As insígnias são da jornada: ao desistir ou ser eliminado, elas ficam no histórico, mas a próxima jornada começa do zero. Por segurança, cada jogador pode começar até 5 jornadas a cada 10 minutos.',
					'O administrador pode encerrar uma jornada ou um desafio inteiro. O histórico é sempre mantido, e uma batalha que já estava em andamento conta normalmente. Desafios encerrados podem ser consultados e podem ser reabertos.',
				],
			},
			{
				title: 'Perfil e histórico',
				paragraphs: [
					'O seu perfil (conquistas, insígnias, placar e jornadas) e o seu histórico nos desafios ficam visíveis para os outros usuários logados. Veja o aviso de privacidade em /privacidade.',
				],
			},
		],
	},
	en: {
		title: 'Rules',
		updated: 'Last updated on 2026-10-18.',
		sections: [
			{
				title: 'The server',
				paragraphs: [
					'A casual Pokémon battle server for friends. Only account holders can play, and accounts are created with an invite from the administrator ({admin}). Without an account you can watch public battles, but you cannot play or chat.',
					'Questions, problems or requests: send a private message to the administrator ({admin}) in the game. The administrator can moderate chat and battles with the Pokémon Showdown tools (warn, mute, lock).',
				],
			},
			{
				title: 'Respect',
				paragraphs: [
					'Treat everyone with respect, in the chat, in private messages and in battles. Insults, harassment, discrimination or hate speech (based on race, colour, ethnicity, religion, gender, sexual orientation, disability, origin or any other reason), threats, and sexual or violent content are not allowed.',
					'This also applies to usernames, team names and Pokémon nicknames, which other players can see.',
					'Do not share anyone\'s personal data (full name, address, phone number, photos and the like), including your own.',
				],
			},
			{
				title: 'Good practices',
				paragraphs: [
					'Be a good sport: greet your opponent, accept the result and do not taunt whoever lost. Do not abandon battles midway or let the timer run on purpose to annoy your opponent; if you need to leave, forfeit.',
					'Do not spam, flood or advertise in the chat, and do not keep challenging someone who has already declined.',
					'Your account is yours alone: do not share your password. If you find a bug, tell the administrator instead of using it.',
				],
			},
			{
				title: 'Forbidden: cheating',
				paragraphs: [
					'Any kind of cheating is forbidden, such as:',
					'- using bugs or server flaws to gain an advantage;',
					'- dropping your connection or reloading the page on purpose to escape a loss;',
					'- using programs, scripts or bots to play for you;',
					'- fixing results or using another account to manipulate the ladder or the challenges;',
					'- trying to break into, overload or disrupt the server or someone else\'s account.',
				],
			},
			{
				title: 'If the rules are broken',
				paragraphs: [
					'Depending on how serious it is, the administrator can warn, mute, lock, void results (for example, close a journey won by cheating) or remove access to the server.',
				],
			},
			{
				title: 'Official formats and ladder',
				paragraphs: [
					'Official Pokémon Showdown formats follow Smogon\'s rules. Type /formathelp FORMAT NAME in the chat to see the rules of a format.',
					'The ladder does not match two players connected from the same IP address (protection against ranking abuse). Players in the same household can challenge each other directly.',
				],
			},
			{
				title: 'Gym Challenge: how it works',
				paragraphs: [
					'Each challenge has its own gyms, rules and format, shown on the challenge page ("Gym Challenge" button on the main menu, or /ginasio). Gym leaders, the Elite 4 and the Champion are controlled by the computer.',
					'Each attempt is a journey. You can have one active journey per challenge, and play several challenges at the same time. To battle, pick the "[Desafio] challenge name" format and click "Battle!".',
					'Beating a gym leader earns their badge. In free order, you pick the next gym on the challenge page; otherwise you face the first gym you have not beaten yet. If the challenge has a fixed order, gyms follow that order.',
					'In challenges with random types, gym types are drawn at the start of each journey.',
					'To face the Elite 4 (or the Champion, if the challenge has no Elite 4) you need every badge. The Elite 4 and the Champion are fought in a row, as in the games: losing to any of them sends you back to the first Elite 4 member.',
					'Beating the Champion wins the challenge, and the achievement goes to your profile. Winning the same challenge again adds another achievement.',
				],
			},
			{
				title: 'Gym Challenge: battles',
				paragraphs: [
					'Battles against trainers are always public: anyone can watch, and the Lobby announces them.',
					'A tie does not count as a win or a loss. You face the same trainer again.',
					'A battle interrupted before it ends (for example, if the server restarts) is void and does not count. You face the same trainer again.',
					'The timer is always on. Depending on the challenge, there is a per-turn time limit or no limit at all; the total battle time is never limited.',
				],
			},
			{
				title: 'Gym Challenge: team, losses and giving up',
				paragraphs: [
					'If the challenge has a team lock, the whole journey uses the same team: only nicknames and the order of your Pokémon may change. Any other change (Pokémon, move, item, EVs etc.) requires giving up and starting a new journey. Without a team lock, you can switch teams between battles.',
					'Attempts are unlimited, unless the challenge has a loss limit (when you reach it, counting the whole journey, you are eliminated) or eliminates players who lose to the Elite 4 or to the Champion. These options are shown on the challenge page.',
					'You can give up your journey at any time. Giving up during a battle counts as a loss in that battle and ends the journey immediately. Being eliminated is the same as giving up.',
					'Badges belong to the journey: when you give up or are eliminated, they stay in your history, but the next journey starts from scratch. For security, each player can start up to 5 journeys every 10 minutes.',
					'The administrator can close a journey or a whole challenge. History is always kept, and a battle already in progress counts as usual. Closed challenges can still be viewed and can be reopened.',
				],
			},
			{
				title: 'Profile and history',
				paragraphs: [
					'Your profile (achievements, badges, scores and journeys) and your challenge history are visible to other logged-in users. See the privacy notice at /privacidade.',
				],
			},
		],
	},
};
