import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PortfolioProjectPage } from './portfolio-project';

const setup = async (url: string): Promise<{ el: HTMLElement; title: Title }> => {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'portfolio/:slug', component: PortfolioProjectPage }], withComponentInputBinding())],
  });
  const harness: RouterTestingHarness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  harness.detectChanges();
  return { el: harness.routeNativeElement as HTMLElement, title: TestBed.inject(Title) };
};

describe('PortfolioProjectPage', () => {
  it('shows the summary, features and App Store link for a known project', async () => {
    const { el, title } = await setup('/portfolio/bjj-open-mat');

    expect(el.querySelector('h1')?.textContent).toContain('BJJ Open Mat');
    expect(el.querySelectorAll('.card').length).toBeGreaterThan(0);
    expect((el.querySelector('a.store-link--primary') as HTMLAnchorElement | null)?.href).toContain('apps.apple.com');
    expect(title.getTitle()).toBe('BJJ Open Mat | Davis Sylvester');
  });

  it('links a public project back to /portfolio and a private one back to /private-projects', async () => {
    const pub = await setup('/portfolio/bjj-open-mat');
    expect(pub.el.querySelector('.summary__back')?.getAttribute('href')).toBe('/portfolio');

    TestBed.resetTestingModule();
    const priv = await setup('/portfolio/claude-dashboard');
    expect(priv.el.querySelector('.summary__back')?.getAttribute('href')).toBe('/private-projects');
    expect(priv.el.querySelector('.secure-badge')).not.toBeNull();
    expect(priv.el.querySelector('a.store-link')).toBeNull();
  });

  it('shows a not-found message for an unknown slug', async () => {
    const { el } = await setup('/portfolio/does-not-exist');

    expect(el.querySelector('h1')?.textContent).toContain('Project not found');
    expect(el.querySelector('a.store-link')).toBeNull();
  });
});
