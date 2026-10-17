import { iacTile } from './activity';
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
