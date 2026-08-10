export type StaffInviteEmailInput = {
  orgName: string;
  inviterName: string;
  roleLabel: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Sample D — Logo hero + secure card.
 * Table-based HTML for broad email-client support.
 */
export function renderStaffInviteEmail(
  input: StaffInviteEmailInput,
): RenderedEmail {
  const {
    orgName,
    inviterName,
    roleLabel,
    email,
    tempPassword,
    loginUrl,
  } = input;

  const subject = `You're invited to ${orgName} on LendSync`;

  const text = [
    `Access your workspace`,
    ``,
    `${inviterName} invited you to join ${orgName} as ${roleLabel} on LendSync.`,
    ``,
    `Email: ${email}`,
    `Temporary password: ${tempPassword}`,
    ``,
    `Sign in: ${loginUrl}`,
    ``,
    `For your security, change this password after your first sign-in.`,
    `If you didn't expect this invite, you can ignore this email.`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ececf0;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ececf0;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(18,20,26,0.08);">
          <!-- Hero -->
          <tr>
            <td align="center" style="padding:36px 32px 28px;background:linear-gradient(180deg,#f7f0df 0%,#ffffff 100%);background-color:#f7f0df;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" width="64" height="64" style="width:64px;height:64px;border-radius:32px;background:#12141a;color:#d4a53c;font-size:28px;font-weight:700;line-height:64px;text-align:center;">
                    L
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#8a7040;font-weight:700;">LendSync</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 36px 28px;">
              <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#12141a;font-weight:700;">Access your workspace</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#4a4d57;">
                <strong style="color:#12141a;">${escapeHtml(inviterName)}</strong>
                invited you to join
                <strong style="color:#12141a;">${escapeHtml(orgName)}</strong>
                as
                <strong style="color:#12141a;">${escapeHtml(roleLabel)}</strong>
                on LendSync.
              </p>

              <!-- Secure credential card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#12141a;border:1px solid #d4a53c;border-radius:10px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9a9eae;">Email</p>
                    <p style="margin:0 0 18px;font-size:15px;color:#ffffff;word-break:break-all;">${escapeHtml(email)}</p>
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9a9eae;">Temporary password</p>
                    <p style="margin:0;font-size:18px;line-height:1.4;font-family:Consolas,'Courier New',monospace;color:#f5d78a;letter-spacing:0.02em;word-break:break-all;">${escapeHtml(tempPassword)}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 16px;">
                <tr>
                  <td align="center" bgcolor="#d4a53c" style="border-radius:8px;background:#d4a53c;">
                    <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#12141a;text-decoration:none;border-radius:8px;">
                      Open LendSync
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:1.5;color:#6a6c7e;">
                For your security, change this password after your first sign-in.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px 28px;border-top:1px solid #ececf0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8d9a;text-align:center;">
                If you didn’t expect this invite, you can ignore this email.<br />
                &copy; LendSync
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
