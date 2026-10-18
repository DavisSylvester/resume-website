export const ContactReason = {
  Consulting: 'consulting',
  Resume: 'resume',
  Employment: 'employment',
} as const;
export type ContactReason = (typeof ContactReason)[keyof typeof ContactReason];

export const ReplyChannel = {
  WhatsApp: 'whatsapp',
  Sms: 'sms',
  Email: 'email',
} as const;
export type ReplyChannel = (typeof ReplyChannel)[keyof typeof ReplyChannel];

export interface ReasonOption {
  value: ContactReason;
  label: string;
  hint: string;
}

export interface ReplyOption {
  value: ReplyChannel;
  label: string;
  /** Label of the field that holds the visitor's id, number or address. */
  fieldLabel: string;
  placeholder: string;
  inputType: 'email' | 'tel' | 'text';
  autocomplete: string;
}

export const REASON_OPTIONS: ReasonOption[] = [
  { value: ContactReason.Consulting, label: 'Consulting services', hint: 'Architecture, cloud, AI or a build' },
  { value: ContactReason.Resume, label: 'Resume request', hint: 'Get my latest resume' },
  { value: ContactReason.Employment, label: 'Employment', hint: 'A role you are hiring for' },
];

export const REPLY_OPTIONS: ReplyOption[] = [
  {
    value: ReplyChannel.WhatsApp,
    label: 'WhatsApp',
    fieldLabel: 'Your WhatsApp number or username',
    placeholder: '+1 214 555 0100 or @username',
    inputType: 'text',
    autocomplete: 'tel',
  },
  {
    value: ReplyChannel.Sms,
    label: 'SMS',
    fieldLabel: 'Your mobile number',
    placeholder: '(214) 555-0100',
    inputType: 'tel',
    autocomplete: 'tel',
  },
  {
    value: ReplyChannel.Email,
    label: 'Email',
    fieldLabel: 'Your email address',
    placeholder: 'you@company.com',
    inputType: 'email',
    autocomplete: 'email',
  },
];

const EMAIL: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS: RegExp = /^\+?[\d\s().-]+$/;
const WHATSAPP_USERNAME: RegExp = /^@?[A-Za-z0-9._]{3,35}$/;

const isPhone = (value: string): boolean =>
  PHONE_CHARS.test(value) && value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15;

/** Mirrors the API's `validateReplyTo`, so the visitor sees the problem before sending. */
export const isValidReplyTo = (channel: ReplyChannel, raw: string): boolean => {
  const value: string = raw.trim();
  switch (channel) {
    case ReplyChannel.Email:
      return EMAIL.test(value);
    case ReplyChannel.Sms:
      return isPhone(value);
    case ReplyChannel.WhatsApp:
      return isPhone(value) || WHATSAPP_USERNAME.test(value);
  }
};
