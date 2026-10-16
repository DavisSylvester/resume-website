import { FileClass, classifyFile, commitType } from './classify.mjs';
import type { IacRoots } from './classify.mjs';
import type { CommitDetail } from '../../interfaces/index.mjs';
import type { LedgerCommit } from '../../types/index.mjs';

/** Ledger key for a repository: its name if public, an opaque id if private. */
export const ledgerRepoKey = (fullName: string, isPrivate: boolean, databaseId: number | null): string =>
  isPrivate ? `private:${databaseId ?? fullName.length}` : fullName;

/**
 * Classifies one commit's changed files into per-class line counts.
 * Only the counts, the date and the Conventional Commit type survive; the message and
 * file names are discarded here.
 */
export const toLedgerCommit = (detail: CommitDetail, repoKey: string, isPrivate: boolean, roots: IacRoots): LedgerCommit => {
  const lines: LedgerCommit['lines'] = {};
  for (const f of detail.files) {
    const cls: FileClass = classifyFile(f.filename, roots);
    if (cls === FileClass.Excluded) continue;
    const row: { add: number; del: number; files: number } = lines[cls] ?? { add: 0, del: 0, files: 0 };
    row.add += f.additions;
    row.del += f.deletions;
    row.files += 1;
    lines[cls] = row;
  }
  return {
    sha: detail.sha,
    repo: repoKey,
    isPrivate,
    date: detail.date,
    type: commitType(detail.message.split('\n')[0] ?? '', detail.isMerge),
    isMerge: detail.isMerge,
    lines,
  };
};
