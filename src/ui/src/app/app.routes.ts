import { Routes } from '@angular/router';
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
    path: 'portfolio/:slug',
    loadComponent: () =>
      import('./pages/portfolio-project/portfolio-project').then((m) => m.PortfolioProjectPage),
  },
];
