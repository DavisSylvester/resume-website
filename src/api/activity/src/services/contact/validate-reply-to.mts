import { ReplyChannel } from '../../types/index.mjs';

const EMAIL: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS: RegExp = /^\+?[\d\s().-]+$/;
/** WhatsApp usernames: letters, digits, dot and underscore, optionally written with a leading @. */
const WHATSAPP_USERNAME: RegExp = /^@?[A-Za-z0-9._]{3,35}$/;

const isPhone = (value: string): boolean => {
  if (!PHONE_CHARS.test(value)) return false;
  const digits: number = value.replace(/\D/g, '').length;
  return digits >= 10 && digits <= 15;
};

/**
 * Checks `replyTo` against the chosen channel: an email address, a phone number for SMS,
 * and a phone number or WhatsApp username for WhatsApp. Returns an error message or null.
 */
export const validateReplyTo = (replyVia: ReplyChannel, raw: string): string | null => {
  const value: string = raw.trim();
  switch (replyVia) {
    case ReplyChannel.Email:
      return EMAIL.test(value) ? null : 'Enter a valid email address';
    case ReplyChannel.Sms:
      return isPhone(value) ? null : 'Enter a mobile number with area code';
    case ReplyChannel.WhatsApp:
      return isPhone(value) || WHATSAPP_USERNAME.test(value) ? null : 'Enter your WhatsApp number or username';
  }
};
