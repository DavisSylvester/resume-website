import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Portfolio } from './portfolio';
import { PORTFOLIO_PROJECTS, findProject } from '../../portfolio/portfolio-projects';
import type { PortfolioProject } from '../../portfolio/interfaces';

describe('PORTFOLIO_PROJECTS', () => {
  it('gives every project a unique, URL-safe slug', () => {
    const slugs: string[] = PORTFOLIO_PROJECTS.map((p: PortfolioProject): string => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('uses https for every outbound link', () => {
    for (const p of PORTFOLIO_PROJECTS) {
      for (const url of [p.appStoreUrl, p.playStoreUrl, p.websiteUrl]) {
        if (url) expect(url.startsWith('https://')).toBe(true);
      }
    }
  });

  it('lists BJJ Open Mat with its App Store link', () => {
    expect(findProject('bjj-open-mat')?.appStoreUrl).toBe('https://apps.apple.com/us/app/bjj-open-mat/id6787704999');
    expect(findProject('nope')).toBeUndefined();
  });
});

describe('Portfolio', () => {
  it('renders a card per project with summary and store links', async () => {
    await TestBed.configureTestingModule({ imports: [Portfolio], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Portfolio);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.project').length).toBe(PORTFOLIO_PROJECTS.length);
    const summary: HTMLAnchorElement | null = el.querySelector('.project__summary-link');
    expect(summary?.getAttribute('href')).toBe('/portfolio/bjj-open-mat');
    const appStore: HTMLAnchorElement | null = el.querySelector('a.store-link--primary');
    expect(appStore?.href).toContain('apps.apple.com');
  });
});
