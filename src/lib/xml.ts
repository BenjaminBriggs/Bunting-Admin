/**
 * Escape a string for safe interpolation into XML text/attribute content.
 *
 * `&` must be replaced first so the entity ampersands introduced by the later
 * replacements are not double-escaped.
 */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
