import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ContactApiService } from '../../contact/contact-api.service';
import type { ContactResult } from '../../contact/contact-api.service';
import { ContactDialogService } from '../../contact/contact-dialog.service';
import { isValidReplyTo } from '../../contact/contact-options';
import type { ContactRequest } from '../../contact/interfaces';
import { ContactDialog } from './contact-dialog';

/**
 * The contact modal: opening from the shared service, channel-aware reply-to validation,
 * the request it sends, and the success and error states. The API is a fake.
 */
describe('ContactDialog', () => {
  let fixture: ComponentFixture<ContactDialog>;
  let host: HTMLElement;
  let dialogs: ContactDialogService;
  let sent: ContactRequest[];
  let nextResult: ContactResult;

  const $ = <T extends Element>(selector: string): T => host.querySelector(selector) as T;

  const type = (selector: string, value: string): void => {
    const el: HTMLInputElement | HTMLTextAreaElement = $<HTMLInputElement>(selector);
    el.value = value;
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('blur'));
  };

  const pick = (name: string, value: string): void => {
    // `[value]` is a property binding, so match on the property rather than an attribute.
    const radios: HTMLInputElement[] = Array.from(host.querySelectorAll<HTMLInputElement>(`input[formControlName="${name}"]`));
    radios.find((el: HTMLInputElement): boolean => el.value === value)?.click();
  };

  const fillValid = (): void => {
    type('input[formControlName="name"]', 'Ada Lovelace');
    pick('replyVia', 'whatsapp');
    type('input[formControlName="replyTo"]', '+1 214 555 0100');
    type('textarea[formControlName="message"]', 'Interested in a platform build.');
  };

  const submit = async (): Promise<void> => {
    $<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    sent = [];
    nextResult = { ok: true, receipt: { id: 'id-1', delivered: ['email'] } };
    const fakeApi: Pick<ContactApiService, 'submit'> = {
      submit: async (req: ContactRequest): Promise<ContactResult> => {
        sent.push(req);
        return nextResult;
      },
    };

    await TestBed.configureTestingModule({
      imports: [ContactDialog],
      providers: [{ provide: ContactApiService, useValue: fakeApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactDialog);
    host = fixture.nativeElement as HTMLElement;
    dialogs = TestBed.inject(ContactDialogService);
    await fixture.whenStable();
  });

  it('opens and closes with the shared service', async () => {
    const dialog: HTMLDialogElement = $<HTMLDialogElement>('dialog');
    expect(dialog.hasAttribute('open')).toBe(false);

    dialogs.open();
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);

    $<HTMLButtonElement>('.icon-button').click();
    await fixture.whenStable();
    expect(dialogs.isOpen()).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('offers consulting, resume and employment', () => {
    const values: string[] = Array.from(host.querySelectorAll('input[formControlName="reason"]')).map(
      (el: Element): string => (el as HTMLInputElement).value,
    );
    expect(values).toEqual(['consulting', 'resume', 'employment']);
  });

  it('relabels the reply-to field for the chosen channel', async () => {
    const label = (): string => $<HTMLElement>('input[formControlName="replyTo"]').closest('label')?.textContent ?? '';
    expect(label()).toContain('email address');

    pick('replyVia', 'whatsapp');
    await fixture.whenStable();
    expect(label()).toContain('WhatsApp number or username');

    pick('replyVia', 'sms');
    await fixture.whenStable();
    expect(label()).toContain('mobile number');
    expect($<HTMLInputElement>('input[formControlName="replyTo"]').getAttribute('type')).toBe('tel');
  });

  it('does not send an incomplete form and shows the errors', async () => {
    await submit();
    expect(sent).toHaveLength(0);
    expect(host.querySelectorAll('.field__error').length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a reply-to that does not fit the channel', async () => {
    fillValid();
    pick('replyVia', 'sms');
    type('input[formControlName="replyTo"]', '@ada');
    await submit();
    expect(sent).toHaveLength(0);
    expect($<HTMLElement>('.field__error').textContent).toContain('mobile number');
  });

  it('sends a trimmed request and shows the confirmation', async () => {
    fillValid();
    pick('reason', 'employment');
    await submit();

    expect(sent).toEqual([
      {
        name: 'Ada Lovelace',
        reason: 'employment',
        replyVia: 'whatsapp',
        replyTo: '+1 214 555 0100',
        message: 'Interested in a platform build.',
      },
    ]);
    expect($<HTMLElement>('.sent').textContent).toContain("I'll reply by WhatsApp");
  });

  it('shows the API error and keeps the draft', async () => {
    nextResult = { ok: false, message: 'Too many messages. Please try again later.' };
    fillValid();
    await submit();
    expect($<HTMLElement>('.alert').textContent).toContain('Too many messages');
    expect($<HTMLTextAreaElement>('textarea').value).toBe('Interested in a platform build.');
  });
});

describe('isValidReplyTo', () => {
  it.each([
    ['email', 'ada@example.com', true],
    ['email', 'ada@', false],
    ['sms', '(214) 555-0100', true],
    ['sms', '555-0100', false],
    ['whatsapp', '+44 20 7946 0958', true],
    ['whatsapp', '@ada.lovelace', true],
    ['whatsapp', 'a b', false],
  ] as const)('%s %s -> %s', (channel, value, valid) => {
    expect(isValidReplyTo(channel, value)).toBe(valid);
  });
});
