import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVATE_PROJECTS, PUBLIC_PROJECTS } from '../../portfolio/portfolio-projects';
import { ProjectCard } from '../../portfolio/project-card/project-card';
import type { PortfolioProject } from '../../portfolio/interfaces';

/** The public projects list: one card per project, then a pointer to the private projects page. */
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, ProjectCard],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio {

  protected readonly projects: PortfolioProject[] = PUBLIC_PROJECTS;
  protected readonly privateCount: number = PRIVATE_PROJECTS.length;
}
