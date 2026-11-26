import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Portfolio } from './portfolio';
import { PORTFOLIO_PROJECTS, PRIVATE_PROJECTS, PUBLIC_PROJECTS, findProject } from '../../portfolio/portfolio-projects';
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

  it('marks Claude Dashboard as secure, with no public links', () => {
    const p: PortfolioProject | undefined = findProject('claude-dashboard');
    expect(p?.secure).toBe(true);
    expect(p?.appStoreUrl).toBeUndefined();
    expect(p?.playStoreUrl).toBeUndefined();
    expect(p?.websiteUrl).toBeUndefined();
  });

  it('gives no secure project a public link', () => {
    for (const p of PORTFOLIO_PROJECTS.filter((x: PortfolioProject): boolean => x.secure === true)) {
      expect([p.appStoreUrl, p.playStoreUrl, p.websiteUrl].filter(Boolean)).toEqual([]);
    }
  });
});

const renderPortfolio = async (): Promise<HTMLElement> => {
  await TestBed.configureTestingModule({ imports: [Portfolio], providers: [provideRouter([])] }).compileComponents();
  const fixture = TestBed.createComponent(Portfolio);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('PUBLIC_PROJECTS / PRIVATE_PROJECTS', () => {
  it('splits every project into exactly one list by its secure flag', () => {
    expect(PUBLIC_PROJECTS.length + PRIVATE_PROJECTS.length).toBe(PORTFOLIO_PROJECTS.length);
    expect(PUBLIC_PROJECTS.every((p: PortfolioProject): boolean => p.secure !== true)).toBe(true);
    expect(PRIVATE_PROJECTS.every((p: PortfolioProject): boolean => p.secure === true)).toBe(true);
    expect(PRIVATE_PROJECTS.map((p: PortfolioProject): string => p.slug)).toContain('claude-dashboard');
  });
});

describe('Portfolio', () => {
  it('renders a card per public project with summary and store links', async () => {
    const el: HTMLElement = await renderPortfolio();

    expect(el.querySelectorAll('.project').length).toBe(PUBLIC_PROJECTS.length);
    const summary: HTMLAnchorElement | null = el.querySelector('.project__summary-link');
    expect(summary?.getAttribute('href')).toBe('/portfolio/bjj-open-mat');
    const appStore: HTMLAnchorElement | null = el.querySelector('a.store-link--primary');
    expect(appStore?.href).toContain('apps.apple.com');
  });

  it('leaves private projects off the list and links to the private projects page', async () => {
    const el: HTMLElement = await renderPortfolio();

    expect(el.textContent).not.toContain('Claude Dashboard');
    expect(el.querySelector('.secure-badge')).toBeNull();
    const link: HTMLAnchorElement | null = el.querySelector('a.portfolio__private-link');
    expect(link?.getAttribute('href')).toBe('/private-projects');
    expect(link?.textContent).toContain(`${PRIVATE_PROJECTS.length} private`);
  });
});
