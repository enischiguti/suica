import FormData from 'form-data'
import Mailgun from 'mailgun.js'

const mailgun = new Mailgun(FormData)

let _mg: ReturnType<typeof mailgun.client> | null = null

function getMg() {
  if (!_mg) {
    _mg = mailgun.client({
      username: 'api',
      key: useRuntimeConfig().mailgunApiKey,
    })
  }
  return _mg
}

interface SendMailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendMail({ to, subject, html, from }: SendMailOptions) {
  const { mailgunDomain } = useRuntimeConfig()
  return getMg().messages.create(mailgunDomain, {
    from: from ?? `Suica <noreply@${mailgunDomain}>`,
    to,
    subject,
    html,
  })
}
