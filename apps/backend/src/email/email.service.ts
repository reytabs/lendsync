import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  renderStaffInviteEmail,
  type StaffInviteEmailInput,
} from './templates/staff-invite';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  /** Prefer ConfigService, fall back to process.env (Railway injects here). */
  private env(name: string) {
    return (
      this.config.get<string>(name)?.trim() ||
      process.env[name]?.trim() ||
      ''
    );
  }

  isConfigured() {
    return Boolean(
      this.env('MAILGUN_API_KEY') &&
        this.env('MAILGUN_DOMAIN') &&
        this.env('MAILGUN_FROM'),
    );
  }

  webAppUrl() {
    return this.env('APP_WEB_URL').replace(/\/$/, '') || 'http://localhost:3000';
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.env('MAILGUN_API_KEY');
    const domain = this.env('MAILGUN_DOMAIN');
    const from = this.env('MAILGUN_FROM');
    const apiBase = (
      this.env('MAILGUN_API_BASE') || 'https://api.mailgun.net'
    ).replace(/\/$/, '');

    if (!apiKey || !domain || !from) {
      const missing = [
        !apiKey && 'MAILGUN_API_KEY',
        !domain && 'MAILGUN_DOMAIN',
        !from && 'MAILGUN_FROM',
      ].filter(Boolean);
      const error = `Mailgun not configured (missing ${missing.join(', ')})`;
      this.logger.warn(`${error}: to=${input.to} subject="${input.subject}"`);
      return { ok: false, skipped: true, error };
    }

    // From address must be on the Mailgun sending domain (sandbox or custom).
    const fromMatch = from.match(/<([^>]+)>/)?.[1] ?? from;
    const fromHost = fromMatch.split('@')[1]?.toLowerCase();
    if (!fromHost || fromHost !== domain.toLowerCase()) {
      const error = `MAILGUN_FROM must use @${domain} (got ${fromHost ?? 'invalid'}). Example: LendSync <postmaster@${domain}>`;
      this.logger.error(error);
      return { ok: false, error };
    }

    const body = new URLSearchParams();
    body.set('from', from);
    body.set('to', input.to);
    body.set('subject', input.subject);
    body.set('text', input.text);
    body.set('html', input.html);

    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const url = `${apiBase}/v3/${encodeURIComponent(domain)}/messages`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        let message = `Mailgun rejected the email (${res.status})`;
        try {
          const parsed = JSON.parse(detail) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          if (detail) message = `${message}: ${detail.slice(0, 200)}`;
        }
        // Sandbox domains only deliver to authorized recipients.
        if (
          domain.includes('sandbox') &&
          /not authorized|forbidden|recipient/i.test(message)
        ) {
          message = `${message} — authorize this recipient in Mailgun sandbox (Sending → Authorized Recipients).`;
        }
        this.logger.error(
          `Mailgun send failed (${res.status}) to=${input.to}: ${detail.slice(0, 300)}`,
        );
        return { ok: false, error: message };
      }

      this.logger.log(`Email sent to=${input.to} subject="${input.subject}"`);
      return { ok: true };
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'Mailgun network error';
      this.logger.error(`Mailgun send error to=${input.to}: ${error}`);
      return { ok: false, error };
    }
  }

  async sendStaffInvite(input: StaffInviteEmailInput) {
    const rendered = renderStaffInviteEmail(input);
    return this.send({
      to: input.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
}
