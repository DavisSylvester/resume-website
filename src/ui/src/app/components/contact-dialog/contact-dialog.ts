import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, FormControl, FormGroup, ValidationErrors } from '@angular/forms';
import type { Subscription } from 'rxjs';
import { ContactApiService } from '../../contact/contact-api.service';
import type { ContactResult } from '../../contact/contact-api.service';
import { ContactDialogService } from '../../contact/contact-dialog.service';
import {
  ContactReason,
  REASON_OPTIONS,
  REPLY_OPTIONS,
  ReplyChannel,
  isValidReplyTo,
} from '../../contact/contact-options';
import type { ReasonOption, ReplyOption } from '../../contact/contact-options';

export const SendState = {
  Idle: 'idle',
  Sending: 'sending',
  Sent: 'sent',
  Error: 'error',
} as const;
export type SendState = (typeof SendState)[keyof typeof SendState];

interface ContactForm {
  name: FormControl<string>;
  company: FormControl<string>;
  reason: FormControl<ContactReason>;
  replyVia: FormControl<ReplyChannel>;
  replyTo: FormControl<string>;
  message: FormControl<string>;
  website: FormControl<string>;
}

/** Validates the reply-to field against whichever channel is currently selected. */
const replyToValidator = (control: AbstractControl<string>): ValidationErrors | null => {
  const via: unknown = control.parent?.get('replyVia')?.value;
  if (!control.value || typeof via !== 'string') return null;
  return isValidReplyTo(via as ReplyChannel, control.value) ? null : { replyTo: true };
};

@Component({
  selector: 'app-contact-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './contact-dialog.html',
  styleUrl: './contact-dialog.scss',
})
export class ContactDialog {

  protected readonly reasons: ReasonOption[] = REASON_OPTIONS;
  protected readonly replyOptions: ReplyOption[] = REPLY_OPTIONS;
  protected readonly maxMessage: number = 4000;

  protected readonly form: FormGroup<ContactForm> = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    company: ['', [Validators.maxLength(120)]],
    reason: [ContactReason.Consulting as ContactReason, [Validators.required]],
    replyVia: [ReplyChannel.Email as ReplyChannel, [Validators.required]],
    replyTo: ['', [Validators.required, Validators.maxLength(254), replyToValidator]],
    message: ['', [Validators.required, Validators.maxLength(4000)]],
    website: [''],
  });

  protected readonly state: WritableSignal<SendState> = signal<SendState>(SendState.Idle);
  protected readonly errorMessage: WritableSignal<string> = signal<string>('');
  protected readonly replyVia: WritableSignal<ReplyChannel> = signal<ReplyChannel>(ReplyChannel.Email);
  protected readonly messageLength: WritableSignal<number> = signal<number>(0);
  /** Set once the visitor tries to send, so untouched fields then show their errors too. */
  protected readonly submitted: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly replyOption: Signal<ReplyOption> = computed(
    (): ReplyOption =>
      this.replyOptions.find((o: ReplyOption): boolean => o.value === this.replyVia()) ?? this.replyOptions[2]!,
  );
  protected readonly SendState: typeof SendState = SendState;

  private readonly dialogs: ContactDialogService = inject(ContactDialogService);
  private readonly api: ContactApiService = inject(ContactApiService);
  private readonly dialogRef: Signal<ElementRef<HTMLDialogElement> | undefined> =
    viewChild<ElementRef<HTMLDialogElement>>('dialog');

  public constructor() {
    const subs: Subscription[] = [
      this.form.controls.replyVia.valueChanges.subscribe((via: ReplyChannel): void => {
        this.replyVia.set(via);
        this.form.controls.replyTo.updateValueAndValidity();
      }),
      this.form.controls.message.valueChanges.subscribe((text: string): void => this.messageLength.set(text.length)),
    ];
    inject(DestroyRef).onDestroy((): void => subs.forEach((s: Subscription): void => s.unsubscribe()));

    effect((): void => {
      const el: HTMLDialogElement | undefined = this.dialogRef()?.nativeElement;
      if (!el) return;
      if (this.dialogs.isOpen()) {
        if (el.open) return;
        // jsdom (unit tests) has no showModal; fall back to the plain attribute.
        if (typeof el.showModal === 'function') el.showModal();
        else el.setAttribute('open', '');
      } else if (el.open) {
        if (typeof el.close === 'function') el.close();
        else el.removeAttribute('open');
      }
    });
  }

  protected close(): void {
    this.dialogs.close();
    // Start fresh next time once a message has gone through; keep a draft otherwise.
    if (this.state() === SendState.Sent) this.reset();
  }

  /** The native `close` event fires on Esc as well as on our own close. */
  protected onNativeClose(): void {
    if (this.dialogs.isOpen()) this.close();
  }

  /** A click that lands on the <dialog> itself (not its panel) is a backdrop click. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected showError(name: keyof ContactForm): boolean {
    const control: AbstractControl = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected async send(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.state() === SendState.Sending) {
      this.form.markAllAsTouched();
      return;
    }
    this.state.set(SendState.Sending);
    const v: ReturnType<FormGroup<ContactForm>['getRawValue']> = this.form.getRawValue();
    const result: ContactResult = await this.api.submit({
      name: v.name.trim(),
      reason: v.reason,
      replyVia: v.replyVia,
      replyTo: v.replyTo.trim(),
      message: v.message.trim(),
      ...(v.company.trim() ? { company: v.company.trim() } : {}),
      ...(v.website ? { website: v.website } : {}),
    });
    if (result.ok) {
      this.state.set(SendState.Sent);
    } else {
      this.errorMessage.set(result.message);
      this.state.set(SendState.Error);
    }
  }

  private reset(): void {
    this.form.reset();
    this.submitted.set(false);
    this.state.set(SendState.Idle);
    this.errorMessage.set('');
  }
}
