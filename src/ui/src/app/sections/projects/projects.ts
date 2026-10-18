import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PORTFOLIO_PROJECTS } from '../../portfolio/portfolio-projects';
import { StoreLinks } from '../../portfolio/store-links/store-links';
import type { PortfolioProject, ProjectHighlight } from '../../portfolio/interfaces';

/** Home-page band in the accent color: the products I have built and shipped, with store links. */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, StoreLinks],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects {

  protected readonly projects: PortfolioProject[] = PORTFOLIO_PROJECTS;

  /** The first few highlights, enough to show the shape of the product on a card. */
  protected topHighlights(p: PortfolioProject): ProjectHighlight[] {
    return p.highlights.slice(0, 4);
  }
}
