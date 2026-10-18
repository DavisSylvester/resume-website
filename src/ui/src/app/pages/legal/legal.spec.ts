import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Privacy } from './privacy/privacy';
import { Terms } from './terms/terms';

/** The SMS toll-free registration is reviewed against these pages, so the carrier-required wording must stay. */
const render = async (component: typeof Privacy | typeof Terms): Promise<string> => {
  await TestBed.configureTestingModule({ imports: [component], providers: [provideRouter([])] }).compileComponents();
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
};

describe('legal pages', () => {
  it('privacy policy promises mobile information is not shared for marketing', async () => {
    const text: string = await render(Privacy);
    expect(text).toContain('No mobile information will be shared with third parties or affiliates for marketing or promotional purposes');
    expect(text).toContain('opt-in data and consent will not be shared with any third parties');
  });

  it('terms carry the SMS frequency, rates, STOP and HELP disclosures', async () => {
    const text: string = await render(Terms);
    expect(text).toContain('message and data rates may apply');
    expect(text).toMatch(/reply STOP/);
    expect(text).toMatch(/reply HELP/);
    expect(text).toContain('message frequency varies');
  });
});
