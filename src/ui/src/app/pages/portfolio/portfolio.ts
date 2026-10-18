import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PORTFOLIO_PROJECTS } from '../../portfolio/portfolio-projects';
import { StoreLinks } from '../../portfolio/store-links/store-links';
import type { PortfolioProject } from '../../portfolio/interfaces';

/** The public projects list: one card per project, linking to its summary page and its store listings. */
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, StoreLinks],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio {

  protected readonly projects: PortfolioProject[] = PORTFOLIO_PROJECTS;
}
