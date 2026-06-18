import {
	canArchive,
	canDelete,
	deleteBlockReason,
	type FlagLifecycleInput,
	isPublished,
	isReleasedWhileArchived,
} from '@/lib/flag-lifecycle';

const base: FlagLifecycleInput = {
	archived: false,
	archivedAt: null,
	firstPublishedAt: null,
	lastPublishedAt: null,
};

describe('flag-lifecycle', () => {
	describe('never published', () => {
		const flag = { ...base };
		it('is not published', () => expect(isPublished(flag)).toBe(false));
		it('cannot be archived', () => expect(canArchive(flag)).toBe(false));
		it('can be deleted directly', () => expect(canDelete(flag)).toBe(true));
		it('has no delete block reason', () =>
			expect(deleteBlockReason(flag)).toBeNull());
	});

	describe('published and active', () => {
		const flag: FlagLifecycleInput = {
			...base,
			firstPublishedAt: '2026-06-01T00:00:00Z',
			lastPublishedAt: '2026-06-01T00:00:00Z',
		};
		it('can be archived', () => expect(canArchive(flag)).toBe(true));
		it('cannot be deleted', () => expect(canDelete(flag)).toBe(false));
		it('is blocked: archive first', () =>
			expect(deleteBlockReason(flag)).toBe('archive-first'));
	});

	describe('archived, not yet released while archived', () => {
		const flag: FlagLifecycleInput = {
			archived: true,
			archivedAt: '2026-06-10T00:00:00Z',
			firstPublishedAt: '2026-06-01T00:00:00Z',
			lastPublishedAt: '2026-06-05T00:00:00Z', // before archivedAt
		};
		it('not released while archived', () =>
			expect(isReleasedWhileArchived(flag)).toBe(false));
		it('cannot be archived again', () => expect(canArchive(flag)).toBe(false));
		it('cannot be deleted', () => expect(canDelete(flag)).toBe(false));
		it('is blocked: publish archived first', () =>
			expect(deleteBlockReason(flag)).toBe('publish-archived-first'));
	});

	describe('archived and released while archived', () => {
		const flag: FlagLifecycleInput = {
			archived: true,
			archivedAt: '2026-06-10T00:00:00Z',
			firstPublishedAt: '2026-06-01T00:00:00Z',
			lastPublishedAt: '2026-06-11T00:00:00Z', // after archivedAt
		};
		it('released while archived', () =>
			expect(isReleasedWhileArchived(flag)).toBe(true));
		it('can be deleted', () => expect(canDelete(flag)).toBe(true));
		it('has no delete block reason', () =>
			expect(deleteBlockReason(flag)).toBeNull());
	});

	it('accepts Date instances as well as ISO strings', () => {
		const flag: FlagLifecycleInput = {
			archived: true,
			archivedAt: new Date('2026-06-10T00:00:00Z'),
			firstPublishedAt: new Date('2026-06-01T00:00:00Z'),
			lastPublishedAt: new Date('2026-06-11T00:00:00Z'),
		};
		expect(isReleasedWhileArchived(flag)).toBe(true);
	});
});
