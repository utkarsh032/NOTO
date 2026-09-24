/**
 * The words in Noto's transactional mail.
 *
 * Kept apart from the adapter that sends them so the copy can be read and
 * changed without reading SQL. Every message carries a plain-text body as well
 * as HTML: some people read mail as text, and spam filters distrust HTML-only
 * mail.
 *
 * No message ever quotes a value the requester typed except the address it is
 * being sent to. A sign-up form that echoes a display name into a mail is a way
 * to send arbitrary text from Noto's domain to any address.
 */

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

/** Where the links in a message point. Built from the web app's URL at the composition root. */
export interface MailLinks {
  verifyEmail(token: string): string;
  resetPassword(token: string): string;
  signIn(): string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function message(input: {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
}): MailContent {
  const text = [
    ...input.paragraphs,
    ...(input.action ? [`${input.action.label}: ${input.action.url}`] : []),
    input.footer,
    '— Noto',
  ].join('\n\n');

  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#1f2328;max-width:520px">',
    ...input.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(input.action
      ? [
          `<p><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#2f5bea;color:#fff;text-decoration:none">${escapeHtml(input.action.label)}</a></p>`,
          `<p style="font-size:13px;color:#59636e">Or paste this link into your browser:<br>${escapeHtml(input.action.url)}</p>`,
        ]
      : []),
    `<p style="font-size:13px;color:#59636e">${escapeHtml(input.footer)}</p>`,
    '</div>',
  ].join('');

  return { subject: input.subject, text, html };
}

export function verifyEmailMail(url: string): MailContent {
  return message({
    subject: 'Confirm your email address for Noto',
    paragraphs: ['Confirm this address to finish creating your Noto account.'],
    action: { label: 'Confirm email address', url },
    footer:
      'The link works once and expires in 24 hours. If you did not sign up, ignore this mail.',
  });
}

/**
 * Sent when someone signs up with an address that already has an account.
 *
 * The sign-up form answers exactly as it would for a new address, so the only
 * place the difference shows is this inbox — which belongs to the one person
 * entitled to know.
 */
export function existingAccountMail(signInUrl: string): MailContent {
  return message({
    subject: 'You already have a Noto account',
    paragraphs: [
      'Someone, probably you, tried to create a Noto account with this address. It already has one.',
      'Sign in instead, or reset your password from the sign-in screen if you have forgotten it.',
    ],
    action: { label: 'Sign in to Noto', url: signInUrl },
    footer: 'If this was not you, you can ignore this mail. Nothing has changed.',
  });
}

export function resetPasswordMail(url: string): MailContent {
  return message({
    subject: 'Reset your Noto password',
    paragraphs: ['Use the link below to choose a new password for your Noto account.'],
    action: { label: 'Choose a new password', url },
    footer:
      'The link works once and expires in an hour. Setting a new password signs you out everywhere. If you did not ask for this, ignore this mail.',
  });
}

export function changeEmailMail(url: string): MailContent {
  return message({
    subject: 'Confirm your new email address for Noto',
    paragraphs: ['Confirm this address to make it the one you sign in to Noto with.'],
    action: { label: 'Confirm new address', url },
    footer:
      'The link works once and expires in 24 hours. If you did not ask for this, ignore this mail.',
  });
}

/** Sent to the old address once the account has moved away from it. */
export function emailChangedNoticeMail(): MailContent {
  return message({
    subject: 'Your Noto email address was changed',
    paragraphs: [
      'The email address on your Noto account was just changed, and this address no longer signs in.',
    ],
    footer: 'If you did not make this change, contact support straight away.',
  });
}
