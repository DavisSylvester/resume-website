import { Badges } from './sections/badges/badges';

import { Component, signal } from '@angular/core';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { Hero } from './sections/hero/hero';
import { Expertise } from './sections/expertise/expertise';
import { Experience } from './sections/experience/experience';
import { Certifications } from './sections/certifications/certifications';
import { Projects } from './sections/projects/projects';
import { Router, RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgIf,
    Navbar,
    Footer,
    Hero,
    Expertise,
    Experience,
    Certifications,
    Projects,
    Badges,
  ],
  template: `
    <app-navbar></app-navbar>
    <main class="container" *ngIf="!isPrint()">
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
    <router-outlet></router-outlet>
    <app-footer></app-footer>
  `,
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('davis-resume');
  constructor(private router: Router) {}
  isPrint() {
    return this.router.url.startsWith('/print');
  }
}
