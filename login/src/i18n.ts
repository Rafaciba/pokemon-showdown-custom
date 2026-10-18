/**
 * Textos do login server em pt-BR e inglês.
 * O idioma vem do cabeçalho Accept-Language (pt* → pt-BR, demais → en).
 */

export type Lang = 'pt' | 'en';

const messages = {
	// Erros de validação
	nameInvalidChars: {
		pt: 'O nome não pode conter | , ; ou caracteres invisíveis.',
		en: 'Names cannot contain | , ; or invisible characters.',
	},
	nameTooLong: { pt: 'O nome pode ter no máximo 18 caracteres.', en: 'Names can be at most 18 characters long.' },
	nameLength: { pt: 'O nome precisa ter entre 1 e 18 letras ou números.', en: 'Names must have 1 to 18 letters or numbers.' },
	nameNeedsLetter: { pt: 'O nome precisa ter pelo menos uma letra.', en: 'Names must contain at least one letter.' },
	nameReserved: { pt: 'Esse nome é reservado.', en: 'That name is reserved.' },
	nameTaken: { pt: 'Esse nome já está em uso.', en: 'That name is already taken.' },
	nameReleasing: {
		pt: 'Esse nome é de uma conta excluída há pouco e ainda está sendo liberado. Tente de novo em alguns minutos.',
		en: 'That name belongs to a recently deleted account and is still being released. Try again in a few minutes.',
	},
	inviteInvalid: {
		pt: 'Código de convite inválido, já usado ou expirado.',
		en: 'Invalid, used or expired invite code.',
	},
	inviteForOtherName: {
		pt: 'Este convite foi gerado para outro nome de usuário.',
		en: 'This invite was issued for a different username.',
	},
	passwordMismatch: { pt: 'As senhas não conferem.', en: 'Passwords do not match.' },
	passwordTooShort: { pt: 'A senha precisa ter pelo menos 8 caracteres.', en: 'Passwords must be at least 8 characters long.' },
	passwordTooLong: { pt: 'A senha pode ter no máximo 128 caracteres.', en: 'Passwords can be at most 128 characters long.' },
	passwordIsName: { pt: 'A senha não pode ser igual ao nome.', en: 'Your password cannot be your username.' },
	wrongPassword: { pt: 'Nome ou senha incorretos.', en: 'Wrong username or password.' },
	resetInvalid: {
		pt: 'Código de redefinição inválido, expirado ou de outro usuário.',
		en: 'Invalid or expired reset code, or it belongs to another user.',
	},
	confirmDeletion: { pt: 'Marque a confirmação para excluir a conta.', en: 'Tick the confirmation box to delete your account.' },
	// Contrato com o cliente
	accountRequired: {
		pt: 'Este servidor exige conta. Peça um convite ao administrador e cadastre-se em https://{host}/cadastro',
		en: 'This server requires an account. Ask the administrator for an invite and sign up at https://{host}/cadastro',
	},
	registerInClient: {
		pt: 'O cadastro é feito com convite em https://{host}/cadastro',
		en: 'Sign up with an invite at https://{host}/cadastro',
	},
	corruptChallenge: { pt: 'Desafio de login corrompido. Recarregue a página.', en: 'Corrupt login challenge. Please reload the page.' },
	unknownKey: {
		pt: 'Chave de login desconhecida. O servidor está configurado incorretamente.',
		en: 'Unknown login key. The server is misconfigured.',
	},
	tooManyRequests: { pt: 'Muitas requisições. Aguarde um pouco.', en: 'Too many requests. Please wait a moment.' },
	tooManyLoginAttempts: {
		pt: 'Muitas tentativas de login. Aguarde alguns minutos.',
		en: 'Too many login attempts. Please wait a few minutes.',
	},
	notAvailable: { pt: 'Ainda não disponível neste servidor.', en: 'Not available on this server yet.' },
	unknownAction: { pt: 'Ação desconhecida.', en: 'Unknown action.' },
	badOrigin: { pt: 'Requisição de origem não permitida.', en: 'Request origin not allowed.' },
	internalError: { pt: 'Erro interno.', en: 'Internal error.' },
	// Páginas
	pageRegisterTitle: { pt: 'Cadastro', en: 'Sign up' },
	pageRegisterIntro: {
		pt: 'O cadastro é feito apenas com um código de convite, gerado pelo administrador.',
		en: 'Sign-up requires an invite code issued by the administrator.',
	},
	pageAccountTitle: { pt: 'Minha conta', en: 'My account' },
	pageResetTitle: { pt: 'Redefinir senha', en: 'Reset password' },
	pageResetIntro: {
		pt: 'Use o código de redefinição que o administrador te passou.',
		en: 'Use the reset code the administrator gave you.',
	},
	fieldInvite: { pt: 'Código de convite', en: 'Invite code' },
	fieldResetCode: { pt: 'Código de redefinição', en: 'Reset code' },
	fieldUsername: { pt: 'Nome de usuário', en: 'Username' },
	fieldPassword: { pt: 'Senha', en: 'Password' },
	fieldNewPassword: { pt: 'Nova senha', en: 'New password' },
	fieldConfirm: { pt: 'Confirme a senha', en: 'Confirm password' },
	fieldCurrentPassword: { pt: 'Senha atual', en: 'Current password' },
	hintUsername: {
		pt: 'Até 18 caracteres. É o nome que aparece no jogo.',
		en: 'Up to 18 characters. This is your in-game name.',
	},
	hintPassword: { pt: 'Mínimo de 8 caracteres.', en: 'At least 8 characters.' },
	buttonRegister: { pt: 'Criar conta', en: 'Create account' },
	buttonChangePassword: { pt: 'Trocar senha', en: 'Change password' },
	buttonReset: { pt: 'Redefinir senha', en: 'Reset password' },
	buttonDelete: { pt: 'Excluir minha conta', en: 'Delete my account' },
	buttonLogout: { pt: 'Sair', en: 'Log out' },
	linkPlay: { pt: 'Ir para o jogo', en: 'Go to the game' },
	privacyTitle: { pt: 'Privacidade', en: 'Privacy' },
	privacyText: {
		pt: 'A conta guarda apenas o seu nome de usuário e um hash da sua senha (a senha em si nunca é armazenada). Não pedimos e-mail. Você pode excluir sua conta e todos os seus dados a qualquer momento em /conta.',
		en: 'Your account only stores your username and a hash of your password (the password itself is never stored). We do not ask for an e-mail address. You can delete your account and all your data at any time at /conta.',
	},
	privacyLink: { pt: 'Aviso de privacidade completo', en: 'Full privacy notice' },
	registered: {
		pt: 'Conta criada! Você já está logado: abra o jogo para jogar.',
		en: 'Account created! You are logged in: open the game to play.',
	},
	passwordChanged: {
		pt: 'Senha alterada. As outras sessões foram encerradas.',
		en: 'Password changed. Your other sessions were logged out.',
	},
	passwordReset: { pt: 'Senha redefinida. Entre no jogo com a nova senha.', en: 'Password reset. Log in to the game with your new password.' },
	accountDeleted: { pt: 'Sua conta e seus dados foram excluídos.', en: 'Your account and your data have been deleted.' },
	loggedOut: { pt: 'Você saiu da sua conta.', en: 'You have logged out.' },
	accountNotLoggedIn: {
		pt: 'Você não está logado. Entre no jogo com seu nome e senha e depois volte a esta página.',
		en: 'You are not logged in. Log in to the game with your username and password, then come back to this page.',
	},
	accountLoggedInAs: { pt: 'Logado como {name}.', en: 'Logged in as {name}.' },
	deleteTitle: { pt: 'Excluir conta', en: 'Delete account' },
	deleteWarning: {
		pt: 'Atenção: a exclusão é definitiva. Serão apagados junto com a conta todos os seus dados no servidor, inclusive times salvos, conquistas e insígnias, histórico e placar dos desafios. Não é possível desfazer.',
		en: 'Warning: deletion is permanent. All your data on the server will be deleted along with the account, including saved teams, achievements and badges, challenge history and scores. This cannot be undone.',
	},
	deleteConfirm: {
		pt: 'Entendo que todos os meus dados serão excluídos definitivamente.',
		en: 'I understand that all my data will be permanently deleted.',
	},
	credits: {
		pt: 'Construído sobre o Pokémon Showdown, da comunidade Smogon.',
		en: 'Built on Pokémon Showdown by the Smogon community.',
	},
	fanDisclaimer: {
		pt: 'Projeto de fã, sem fins lucrativos. Pokémon e todos os nomes e imagens relacionados são marcas e propriedade da Nintendo, Creatures, Game Freak e The Pokémon Company.',
		en: 'Fan project, non-profit. Pokémon and all related names and images are trademarks and property of Nintendo, Creatures, Game Freak and The Pokémon Company.',
	},
} satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof messages;

export function t(lang: Lang, key: MessageKey, vars: Record<string, string> = {}): string {
	return messages[key][lang].replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

export function detectLang(acceptLanguage: string | undefined): Lang {
	const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
	return first.startsWith('pt') ? 'pt' : 'en';
}
