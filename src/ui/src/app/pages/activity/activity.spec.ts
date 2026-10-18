import { iacTile, pullRequestNote } from './activity';
import type { IacToolStat } from '../../activity/interfaces';

const stat = (tool: string, commits: number, linesAdded: number, reposPresent: number): IacToolStat => ({
  tool,
  commits,
  linesAdded,
  linesDeleted: 0,
  reposTouched: reposPresent,
  reposPresent,
});

describe('iacTile', () => {
  it('summarises a tool from the insights stats', () => {
    const tile = iacTile('cdk', [stat('terraform', 100, 11_383, 3), stat('cdk', 125, 4_851, 5)]);
    expect(tile).toEqual({ label: 'AWS CDK commits', value: '125', note: '+4.9K lines · 5 repos' });
  });

  it('uses the singular for one repository', () => {
    expect(iacTile('terraform', [stat('terraform', 2, 40, 1)]).note).toBe('+40 lines · 1 repo');
  });

  it('shows a placeholder when the tool has no stats yet', () => {
    expect(iacTile('terraform', [])).toEqual({ label: 'Terraform commits', value: '–', note: 'no infrastructure commits yet' });
  });
});

describe('pullRequestNote', () => {
  it('counts reviews when GitHub reports some', () => {
    expect(pullRequestNote(1)).toBe('1 review given');
    expect(pullRequestNote(1200)).toBe('1,200 reviews given');
  });

  it('does not claim "0 reviews" when none are visible', () => {
    expect(pullRequestNote(0)).toBe('last 12 months');
  });
});
