import { isValidSlug } from './router.js'

export function roomPath(roomId, ...segments) {
  if (!isValidSlug(roomId)) throw new Error('invalid roomId')
  return ['rooms', roomId, ...segments].join('/')
}
