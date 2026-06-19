import { escapeXml } from '@/lib/xml';

describe('escapeXml', () => {
	it('escapes the five XML special characters', () => {
		expect(escapeXml(`a & b <c> "d" 'e'`)).toBe(
			'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;',
		);
	});

	it('escapes & before introducing entity ampersands (no double-escape)', () => {
		expect(escapeXml('<')).toBe('&lt;');
		expect(escapeXml('&lt;')).toBe('&amp;lt;');
	});

	it('leaves ordinary strings untouched', () => {
		expect(escapeXml('https://cdn.example.com/app/config.json')).toBe(
			'https://cdn.example.com/app/config.json',
		);
	});
});
