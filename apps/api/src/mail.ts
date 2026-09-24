import type { MailPort } from '@noto/backend';
import type { MailLinks } from '@noto/backend/shared';
import { err, ok } from '@noto/core';

/**
 * Sending mail: Resend in deployments, the console on a developer's machine.
 */

/** Resend's HTTP API. No SDK: one POST is the whole integration. */
export function createResendMail(options: {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}): MailPort {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async send(message) {
      try {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: options.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          return err('storage_unavailable', `The mail provider answered ${response.status}.`);
        }

        return ok(undefined);
      } catch (error) {
        return err('storage_unavailable', 'The mail provider could not be reached.', error);
      }
    },
  };
}

/**
 * Prints mail instead of sending it.
 *
 * For a local stack with no Resend account: the verification and reset links
 * appear in the terminal running `pnpm dev`. `env.ts` refuses to start a
 * production process without a real provider, so this cannot ship by accident.
 */
export function createConsoleMail(): MailPort {
  return {
    send(message) {
      console.warn(
        [`\n── mail to ${message.to} ──`, `Subject: ${message.subject}`, '', message.text, ''].join(
          '\n',
        ),
      );
      return Promise.resolve(ok(undefined));
    },
  };
}

/**
 * The links in mail, pointing at the web app's hash routes.
 *
 * The token rides in the fragment, which browsers never send to a server, so
 * it does not end up in anybody's access log on the way.
 */
export function createMailLinks(webAppUrl: string): MailLinks {
  const base = webAppUrl.replace(/\/+$/, '');

  return {
    verifyEmail: (token) => `${base}/#/auth/verify?token=${encodeURIComponent(token)}`,
    resetPassword: (token) => `${base}/#/auth/reset?token=${encodeURIComponent(token)}`,
    signIn: () => `${base}/#/login`,
  };
}
