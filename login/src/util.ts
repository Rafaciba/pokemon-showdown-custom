/** Mesma normalização de nomes do PS: minúsculas, apenas [a-z0-9]. */
export function toID(text: unknown): string {
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Regras de nome do PS: 1 a 18 caracteres no id, com pelo menos uma letra. */
export function validateUserid(userid: string): string | null {
	if (userid.length < 1 || userid.length > 18) return 'O nome precisa ter entre 1 e 18 letras ou números.';
	if (!/[a-z]/.test(userid)) return 'O nome precisa ter pelo menos uma letra.';
	return null;
}
