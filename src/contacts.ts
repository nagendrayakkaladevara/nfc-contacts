export interface Contact {
  id: string
  name: string
  phone: string
  normalizedPhone: string
  createdAt: string
}

export interface ContactBackup {
  version: 1
  exportedAt: string
  contacts: Array<Pick<Contact, 'name' | 'phone'>>
}

export const STORAGE_KEY = 'quickdial.contacts.v1'

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function isValidPhone(phone: string): boolean {
  const digitCount = phone.replace(/\D/g, '').length
  return digitCount >= 7 && digitCount <= 15
}

export function createContact(name: string, phone: string): Contact {
  return {
    id:
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    phone: phone.trim(),
    normalizedPhone: normalizePhone(phone),
    createdAt: new Date().toISOString(),
  }
}

export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }),
  )
}

export function loadContacts(): Contact[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []

    const contacts = parsed.filter(isContact)
    return sortContacts(contacts)
  } catch {
    return []
  }
}

export function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
}

export function buildBackup(contacts: Contact[]): ContactBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    contacts: contacts.map(({ name, phone }) => ({ name, phone })),
  }
}

export function parseBackup(value: unknown): Contact[] {
  const rawContacts = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.contacts)
      ? value.contacts
      : null

  if (!rawContacts) {
    throw new Error('This file does not contain a valid contact list.')
  }

  const seenNumbers = new Set<string>()
  const contacts: Contact[] = []

  for (const item of rawContacts) {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.phone !== 'string') {
      throw new Error('One or more contacts have an invalid name or phone number.')
    }

    const name = item.name.trim()
    const phone = item.phone.trim()
    const normalizedPhone = normalizePhone(phone)

    if (!name || !isValidPhone(phone)) {
      throw new Error('One or more contacts have an invalid name or phone number.')
    }

    if (!seenNumbers.has(normalizedPhone)) {
      contacts.push(createContact(name, phone))
      seenNumbers.add(normalizedPhone)
    }
  }

  return sortContacts(contacts)
}

function isContact(value: unknown): value is Contact {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.normalizedPhone === 'string' &&
    typeof value.createdAt === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
