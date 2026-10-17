/** Mesma normalização de nomes do PS: minúsculas, apenas [a-z0-9]. */
export function toID(text: unknown): string {
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Regras de nome do PS: 1 a 18 caracteres no id, com pelo menos uma letra. */
export function validateUserid(userid: string): 'nameLength' | 'nameNeedsLetter' | null {
	if (userid.length < 1 || userid.length > 18) return 'nameLength';
	if (!/[a-z]/.test(userid)) return 'nameNeedsLetter';
	return null;
}

export function escapeHTML(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
