// Single source of truth for the flag lifecycle, consumed by both the API routes
// (enforcement) and the UI (affordances) so server and client never disagree.
//
// States:
//   - never published  → delete directly (as if it never existed); can't archive
//   - published, active → must archive before delete
//   - archived          → kept in the artifact marked `deprecated`; deletable only
//                         after at least one release while archived
//   - unarchive (archived → active) is always allowed as a safety valve

/** The lifecycle-relevant fields of a flag (dates may be Date or ISO string). */
export interface FlagLifecycleInput {
	archived: boolean;
	archivedAt: Date | string | null;
	firstPublishedAt: Date | string | null;
	lastPublishedAt: Date | string | null;
}

function ms(value: Date | string | null): number | null {
	if (value == null) {
		return null;
	}
	const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(t) ? null : t;
}

/** Has the flag ever appeared in a published artifact? */
export function isPublished(flag: FlagLifecycleInput): boolean {
	return flag.firstPublishedAt != null;
}

/** Has a release happened while the flag was archived (deprecation shipped)? */
export function isReleasedWhileArchived(flag: FlagLifecycleInput): boolean {
	if (!flag.archived) {
		return false;
	}
	const archived = ms(flag.archivedAt);
	const lastPublished = ms(flag.lastPublishedAt);
	return archived != null && lastPublished != null && lastPublished > archived;
}

/** Archiving is only meaningful for a published, currently-active flag. */
export function canArchive(flag: FlagLifecycleInput): boolean {
	return isPublished(flag) && !flag.archived;
}

/**
 * A flag can be deleted when it was never published (clean removal) or when it
 * has been released at least once in its archived/deprecated state.
 */
export function canDelete(flag: FlagLifecycleInput): boolean {
	return !isPublished(flag) || isReleasedWhileArchived(flag);
}

export type DeleteBlockReason =
	| 'archive-first'
	| 'publish-archived-first'
	| null;

/** Why delete is blocked, for surfacing a specific message. null = allowed. */
export function deleteBlockReason(flag: FlagLifecycleInput): DeleteBlockReason {
	if (canDelete(flag)) {
		return null;
	}
	// Published and not deletable: either still active, or archived without a release.
	return flag.archived ? 'publish-archived-first' : 'archive-first';
}

export const DELETE_BLOCK_MESSAGE: Record<
	Exclude<DeleteBlockReason, null>,
	string
> = {
	'archive-first': 'Archive this flag before deleting it.',
	'publish-archived-first':
		'Publish the archived flag at least once before deleting it.',
};
