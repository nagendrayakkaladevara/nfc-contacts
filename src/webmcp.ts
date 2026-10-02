import type { Contact } from './contacts'

interface ModelContextTool {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }
  execute(input: unknown): unknown | Promise<unknown>
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): void | Promise<void>
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext
  }
}

interface ContactToolsOptions {
  getContacts: () => Contact[]
  addContact: (name: string, phone: string) => Contact
}

export function registerContactTools({ getContacts, addContact }: ContactToolsOptions): () => void {
  const context = document.modelContext
  if (!context?.registerTool) return () => undefined

  const lifecycle = new AbortController()

  const registrations = [
    context.registerTool(
      {
        name: 'list_contacts',
        title: 'List contacts',
        description: 'List the names and phone numbers currently stored in QuickDial.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          contacts: getContacts().map(({ id, name, phone }) => ({ id, name, phone })),
        }),
      },
      { signal: lifecycle.signal },
    ),
    context.registerTool(
      {
        name: 'add_contact',
        title: 'Add contact',
        description: 'Add one named phone number to the QuickDial contact list.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            phone: { type: 'string', minLength: 7 },
          },
          required: ['name', 'phone'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          if (!isAddContactInput(input)) throw new Error('A name and phone number are required.')
          const contact = addContact(input.name, input.phone)
          return { id: contact.id, name: contact.name, phone: contact.phone }
        },
      },
      { signal: lifecycle.signal },
    ),
  ]

  for (const registration of registrations) {
    void Promise.resolve(registration).catch(() => undefined)
  }

  return () => lifecycle.abort()
}

function isAddContactInput(value: unknown): value is { name: string; phone: string } {
  if (typeof value !== 'object' || value === null) return false
  const input = value as Record<string, unknown>
  return typeof input.name === 'string' && typeof input.phone === 'string'
}
