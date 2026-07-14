// RTDB keys can't contain '.'; standard ','-for-'.' idiom.
// MUST match the rules expression auth.token.email.toLowerCase().replace('.', ',')
export function encodeEmail(email) {
  return String(email).trim().toLowerCase().replaceAll('.', ',')
}

export function decodeEmail(key) {
  return String(key).replaceAll(',', '.')
}

// Gmail ignores dots in the local part and Firebase auth tokens carry the
// canonical (dotless) address — store invites in the same canonical form.
export function normalizeInviteEmail(email) {
  const e = String(email).trim().toLowerCase()
  const [local, domain] = e.split('@')
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.replaceAll('.', '')}@${domain}`
  }
  return e
}
