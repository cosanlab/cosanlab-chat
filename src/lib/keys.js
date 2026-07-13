// RTDB keys can't contain '.'; standard ','-for-'.' idiom.
// MUST match the rules expression auth.token.email.toLowerCase().replace('.', ',')
export function encodeEmail(email) {
  return String(email).trim().toLowerCase().replaceAll('.', ',')
}

export function decodeEmail(key) {
  return String(key).replaceAll(',', '.')
}
