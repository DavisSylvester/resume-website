import { Badges } from './sections/badges/badges';

import { Component, inject, signal } from '@angular/core';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { Hero } from './sections/hero/hero';
import { Expertise } from './sections/expertise/expertise';
import { Experience } from './sections/experience/experience';
import { Certifications } from './sections/certifications/certifications';
import { Projects } from './sections/projects/projects';
import { Router, RouterOutlet } from '@angular/router';
import { ContactDialog } from './components/contact-dialog/contact-dialog';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Navbar,
    Footer,
    Hero,
    Expertise,
    Experience,
    Certifications,
    Projects,
    Badges,
    ContactDialog,
  ],
  template: `
    <app-navbar></app-navbar>
    @if (!isStandalonePage()) {
    <main class="container">
      <section id="hero" class="section">
        <app-hero></app-hero>
      </section>
      <section id="certifications" class="section">
        <app-certifications></app-certifications>
      </section>
      <section id="expertise" class="section">
        <app-expertise></app-expertise>
      </section>
      <section id="experience" class="section">
        <app-experience></app-experience>
      </section>
      <section id="projects" class="section">
        <app-projects></app-projects>
      </section>
      <section id="badges" class="section">
        <app-badges></app-badges>
      </section>
    </main>
    }
    <router-outlet></router-outlet>
    <app-footer></app-footer>
    <app-contact-dialog></app-contact-dialog>
  `,
  styleUrl: './app.scss',
})
export class App {

  protected readonly title = signal('davis-resume');
  private readonly router: Router = inject(Router);

  protected isStandalonePage(): boolean {
    return ['/print', '/activity', '/portfolio', '/privacy', '/terms'].some((path) => this.router.url.startsWith(path));
  }
}
