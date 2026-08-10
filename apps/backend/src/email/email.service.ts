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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>('MAILGUN_API_KEY')?.trim() &&
        this.config.get<string>('MAILGUN_DOMAIN')?.trim() &&
        this.config.get<string>('MAILGUN_FROM')?.trim(),
    );
  }

  webAppUrl() {
    return (
      this.config.get<string>('APP_WEB_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000'
    );
  }

  async send(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean }> {
    const apiKey = this.config.get<string>('MAILGUN_API_KEY')?.trim();
    const domain = this.config.get<string>('MAILGUN_DOMAIN')?.trim();
    const from = this.config.get<string>('MAILGUN_FROM')?.trim();
    const apiBase = (
      this.config.get<string>('MAILGUN_API_BASE')?.trim() ||
      'https://api.mailgun.net'
    ).replace(/\/$/, '');

    if (!apiKey || !domain || !from) {
      this.logger.warn(
        `Email skipped (Mailgun not configured): to=${input.to} subject="${input.subject}"`,
      );
      return { ok: false, skipped: true };
    }

    const body = new URLSearchParams();
    body.set('from', from);
    body.set('to', input.to);
    body.set('subject', input.subject);
    body.set('text', input.text);
    body.set('html', input.html);

    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const url = `${apiBase}/v3/${domain}/messages`;

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
        this.logger.error(
          `Mailgun send failed (${res.status}) to=${input.to}: ${detail.slice(0, 300)}`,
        );
        return { ok: false };
      }

      this.logger.log(`Email sent to=${input.to} subject="${input.subject}"`);
      return { ok: true };
    } catch (err) {
      this.logger.error(
        `Mailgun send error to=${input.to}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { ok: false };
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
