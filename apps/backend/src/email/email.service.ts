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

type BrevoSender = { name: string; email: string };

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

  private parseSender(): BrevoSender | null {
    const fromEmail = this.env('BREVO_FROM_EMAIL');
    const fromName = this.env('BREVO_FROM_NAME') || 'LendSync';
    if (fromEmail) {
      return { name: fromName, email: fromEmail };
    }

    // Allow "LendSync <noreply@example.com>" in BREVO_FROM
    const from = this.env('BREVO_FROM');
    if (!from) return null;
    const match = from.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
      return {
        name: match[1].trim() || 'LendSync',
        email: match[2].trim(),
      };
    }
    if (from.includes('@')) {
      return { name: 'LendSync', email: from };
    }
    return null;
  }

  isConfigured() {
    return Boolean(this.env('BREVO_API_KEY') && this.parseSender());
  }

  webAppUrl() {
    return this.env('APP_WEB_URL').replace(/\/$/, '') || 'http://localhost:3000';
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.env('BREVO_API_KEY');
    const sender = this.parseSender();

    if (!apiKey || !sender) {
      const missing = [
        !apiKey && 'BREVO_API_KEY',
        !sender && 'BREVO_FROM_EMAIL (or BREVO_FROM)',
      ].filter(Boolean);
      const error = `Brevo not configured (missing ${missing.join(', ')})`;
      this.logger.warn(`${error}: to=${input.to} subject="${input.subject}"`);
      return { ok: false, skipped: true, error };
    }

    const payload = {
      sender,
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    };

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        let message = `Brevo rejected the email (${res.status})`;
        try {
          const parsed = JSON.parse(detail) as {
            message?: string;
            code?: string;
          };
          if (parsed.message) message = parsed.message;
        } catch {
          if (detail) message = `${message}: ${detail.slice(0, 200)}`;
        }
        this.logger.error(
          `Brevo send failed (${res.status}) to=${input.to}: ${detail.slice(0, 300)}`,
        );
        return { ok: false, error: message };
      }

      this.logger.log(`Email sent via Brevo to=${input.to} subject="${input.subject}"`);
      return { ok: true };
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'Brevo network error';
      this.logger.error(`Brevo send error to=${input.to}: ${error}`);
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
