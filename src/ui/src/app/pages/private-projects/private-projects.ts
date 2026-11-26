import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContactDialogService } from '../../contact/contact-dialog.service';
import { PRIVATE_PROJECTS } from '../../portfolio/portfolio-projects';
import { ProjectCard } from '../../portfolio/project-card/project-card';
import { SecureBadge } from '../../portfolio/secure-badge/secure-badge';
import type { PortfolioProject, ProjectHighlight } from '../../portfolio/interfaces';

/** Private projects: software I built that runs behind sign-in, described here because it cannot be linked. */
@Component({
  selector: 'app-private-projects',
  standalone: true,
  imports: [RouterLink, ProjectCard, SecureBadge],
  templateUrl: './private-projects.html',
  styleUrl: './private-projects.scss',
})
export class PrivateProjects {

  private readonly contact: ContactDialogService = inject(ContactDialogService);

  protected readonly projects: PortfolioProject[] = PRIVATE_PROJECTS;

  /** Why these projects have no link, shown above the list. */
  protected readonly reasons: ProjectHighlight[] = [
    { title: 'Behind sign-in', text: 'Every request needs an authenticated user with the right role. There is no public page to visit.' },
    { title: 'Real data', text: 'They work on personal or business data that is not mine to put on the open web.' },
    { title: 'Still real work', text: 'Each one is built, tested and deployed to the same standard as my public products.' },
  ];

  protected openContact(): void {
    this.contact.open();
  }
}
