import type { Routes } from '@angular/router';
import { PrintResume } from './pages/print-resume/print-resume';
import { About } from './pages/about/about';

export const routes: Routes = [
  { path: 'print', component: PrintResume },
  { path: 'about', component: About },
  {
    path: 'activity',
    title: 'GitHub Activity | Davis Sylvester',
    loadComponent: () => import('./pages/activity/activity').then((m) => m.Activity),
  },
  {
    path: 'portfolio',
    title: 'Public Projects | Davis Sylvester',
    loadComponent: () => import('./pages/portfolio/portfolio').then((m) => m.Portfolio),
  },
  {
    path: 'privacy',
    title: 'Privacy Policy | Davis Sylvester',
    loadComponent: () => import('./pages/legal/privacy/privacy').then((m) => m.Privacy),
  },
  {
    path: 'terms',
    title: 'Terms of Use | Davis Sylvester',
    loadComponent: () => import('./pages/legal/terms/terms').then((m) => m.Terms),
  },
  {
    path: 'portfolio/:slug',
    loadComponent: () =>
      import('./pages/portfolio-project/portfolio-project').then((m) => m.PortfolioProjectPage),
  },
];
