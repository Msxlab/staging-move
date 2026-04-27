# DNS and Email Checklist

LocateFlow uses mailbox DNS separately from transactional sending DNS.

## Mailbox Receiving

- Keep Zoho MX records on the root domain (`locateflow.com`) for mailbox delivery.
- Publish exactly one SPF TXT record at each DNS name.
- Root SPF example for Zoho mailbox sending:
  - Name: `@`
  - Value: `v=spf1 include:zoho.com -all`

## Transactional Sending

- Use a dedicated sending subdomain for Resend, for example `send.locateflow.com`.
- Add the DKIM records Resend provides for that sending subdomain.
- Add the SPF record Resend provides at the sending subdomain. Resend may use Amazon SES include values.
- Sending subdomain SPF example:
  - Name: `send`
  - Value: `v=spf1 include:amazonses.com -all`

## DMARC

- Publish DMARC at `_dmarc.locateflow.com`.
- Minimum recommended policy before scale:
  - `v=DMARC1; p=quarantine; rua=mailto:dmarc@locateflow.com; sp=quarantine; adkim=s; aspf=s`

## Guardrails

- Do not publish multiple SPF TXT records at the same DNS name.
- Do not mix mailbox MX records into the Resend sending subdomain unless there is a deliberate mailbox there.
- Verify `EMAIL_FROM`, `ALERT_EMAIL_FROM`, and Resend domain status before production sends.
