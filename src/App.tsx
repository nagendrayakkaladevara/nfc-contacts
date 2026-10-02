import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildBackup,
  createContact,
  isValidPhone,
  loadContacts,
  normalizePhone,
  parseBackup,
  saveContacts,
  sortContacts,
  type Contact,
} from './contacts'
import { registerContactTools } from './webmcp'

type IconName = 'add' | 'backup' | 'call' | 'close' | 'delete' | 'phone' | 'search'

const iconPaths: Record<IconName, ReactNode> = {
  add: <path d="M12 5v14M5 12h14" />,
  backup: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  call: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  delete: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
}

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}

function App() {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts)
  const [query, setQuery] = useState('')
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const contactsRef = useRef(contacts)
  const addDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const backupDialogRef = useRef<HTMLDialogElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const visibleContacts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    const searchDigits = query.replace(/\D/g, '')
    if (!search) return contacts

    return contacts.filter(
      ({ name, phone }) =>
        name.toLocaleLowerCase().includes(search) ||
        (searchDigits.length > 0 && phone.replace(/\D/g, '').includes(searchDigits)),
    )
  }, [contacts, query])

  useEffect(() => {
    contactsRef.current = contacts
  }, [contacts])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const commitContacts = useCallback((nextContacts: Contact[]): boolean => {
    const sorted = sortContacts(nextContacts)
    try {
      saveContacts(sorted)
      contactsRef.current = sorted
      setContacts(sorted)
      return true
    } catch {
      setToast('Could not save. Check your browser storage settings.')
      return false
    }
  }, [])

  const addContact = useCallback((name: string, phone: string): Contact => {
    const cleanName = name.trim()
    const cleanPhone = phone.trim()

    if (!cleanName) throw new Error('Enter a name.')
    if (!isValidPhone(cleanPhone)) throw new Error('Enter a valid phone number with 7–15 digits.')

    const normalizedPhone = normalizePhone(cleanPhone)
    if (contactsRef.current.some((contact) => contact.normalizedPhone === normalizedPhone)) {
      throw new Error('That phone number is already saved.')
    }

    const contact = createContact(cleanName, cleanPhone)
    if (!commitContacts([...contactsRef.current, contact])) {
      throw new Error('The contact could not be saved.')
    }
    return contact
  }, [commitContacts])

  useEffect(
    () => registerContactTools({ getContacts: () => contactsRef.current, addContact }),
    [addContact],
  )

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const errorElement = form.querySelector<HTMLElement>('[data-form-error]')

    try {
      const contact = addContact(String(data.get('name') ?? ''), String(data.get('phone') ?? ''))
      form.reset()
      if (errorElement) errorElement.textContent = ''
      addDialogRef.current?.close()
      setToast(`${contact.name} added`)
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error instanceof Error ? error.message : 'Could not add contact.'
      }
    }
  }

  function requestDelete(contact: Contact) {
    setContactToDelete(contact)
    deleteDialogRef.current?.showModal()
  }

  function confirmDelete() {
    if (!contactToDelete) return
    const didSave = commitContacts(contacts.filter(({ id }) => id !== contactToDelete.id))
    if (didSave) setToast(`${contactToDelete.name} deleted`)
    setContactToDelete(null)
    deleteDialogRef.current?.close()
  }

  function exportContacts() {
    const blob = new Blob([JSON.stringify(buildBackup(contacts), null, 2)], {
      type: 'application/json',
    })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `quickdial-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    setToast('Backup downloaded')
  }

  async function importContacts(file: File | undefined) {
    if (!file) return

    try {
      const imported = parseBackup(JSON.parse(await file.text()) as unknown)
      const shouldReplace =
        contacts.length === 0 ||
        window.confirm(`Replace your ${contacts.length} saved contacts with ${imported.length} imported contacts?`)

      if (shouldReplace && commitContacts(imported)) {
        backupDialogRef.current?.close()
        setToast(`${imported.length} contacts restored`)
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not import that file.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <div className="app-shell">
      <header className="top-panel">
        <div className="brand-row">
          <div className="brand">
            <span className="brand-mark"><Icon name="phone" size={20} /></span>
            <div>
              <h1>QuickDial</h1>
              <p>{contacts.length === 0 ? 'Your private phonebook' : `${contacts.length} saved ${contacts.length === 1 ? 'contact' : 'contacts'}`}</p>
            </div>
          </div>
          <button
            className="icon-button header-action"
            type="button"
            aria-label="Back up or restore contacts"
            onClick={() => backupDialogRef.current?.showModal()}
          >
            <Icon name="backup" />
          </button>
        </div>

        <div className="search-row">
          <label className="search-field">
            <span className="sr-only">Search contacts</span>
            <Icon name="search" size={20} />
            <input
              type="search"
              value={query}
              placeholder="Search by name or number"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="add-button desktop-add" type="button" onClick={() => addDialogRef.current?.showModal()}>
            <Icon name="add" size={20} />
            Add contact
          </button>
        </div>
      </header>

      <main>
        <div className="section-heading">
          <h2>Contacts</h2>
          {query && <span>{visibleContacts.length} found</span>}
        </div>

        {contacts.length === 0 ? (
          <section className="empty-state" aria-labelledby="empty-title">
            <span className="empty-icon"><Icon name="phone" size={30} /></span>
            <h2 id="empty-title">No contacts yet</h2>
            <p>Add the phone numbers you want close at hand.</p>
            <button className="add-button" type="button" onClick={() => addDialogRef.current?.showModal()}>
              <Icon name="add" size={20} />
              Add your first contact
            </button>
          </section>
        ) : visibleContacts.length === 0 ? (
          <section className="empty-state compact" aria-live="polite">
            <span className="empty-icon"><Icon name="search" size={28} /></span>
            <h2>No matching contacts</h2>
            <p>Try a different name or phone number.</p>
            <button className="text-button" type="button" onClick={() => setQuery('')}>Clear search</button>
          </section>
        ) : (
          <ul className="contact-list" aria-label="Saved contacts">
            {visibleContacts.map((contact) => (
              <li className="contact-row" key={contact.id}>
                <span className="avatar" aria-hidden="true">{initials(contact.name)}</span>
                <div className="contact-details">
                  <strong>{contact.name}</strong>
                  <span>{contact.phone}</span>
                </div>
                <button
                  className="icon-button delete-button"
                  type="button"
                  aria-label={`Delete ${contact.name}`}
                  onClick={() => requestDelete(contact)}
                >
                  <Icon name="delete" size={20} />
                </button>
                <a className="call-button" href={`tel:${contact.normalizedPhone}`} aria-label={`Call ${contact.name} at ${contact.phone}`}>
                  <Icon name="call" size={22} />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="privacy-note">
          <span aria-hidden="true">●</span> Saved only in this browser on this device
        </p>
      </main>

      {contacts.length > 0 && (
        <button className="mobile-fab" type="button" onClick={() => addDialogRef.current?.showModal()}>
          <Icon name="add" size={22} />
          Add contact
        </button>
      )}

      <dialog className="dialog" ref={addDialogRef} onClose={(event) => {
        const error = event.currentTarget.querySelector<HTMLElement>('[data-form-error]')
        if (error) error.textContent = ''
      }}>
        <form method="dialog" className="dialog-card" onSubmit={handleAdd}>
          <div className="dialog-header">
            <div>
              <span className="eyebrow">New contact</span>
              <h2>Add a phone number</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Close" onClick={() => addDialogRef.current?.close()}>
              <Icon name="close" size={21} />
            </button>
          </div>
          <label className="form-field">
            <span>Name</span>
            <input name="name" type="text" autoComplete="name" maxLength={80} placeholder="e.g. Ravi Kumar" required />
          </label>
          <label className="form-field">
            <span>Phone number</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="e.g. +91 98765 43210" required />
          </label>
          <p className="form-error" data-form-error aria-live="polite" />
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={() => addDialogRef.current?.close()}>Cancel</button>
            <button className="add-button" type="submit">Save contact</button>
          </div>
        </form>
      </dialog>

      <dialog className="dialog" ref={deleteDialogRef} onClose={() => setContactToDelete(null)}>
        <div className="dialog-card small-card">
          <span className="warning-icon"><Icon name="delete" size={24} /></span>
          <h2>Delete {contactToDelete?.name}?</h2>
          <p>This number will be removed from this device.</p>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={() => deleteDialogRef.current?.close()}>Keep contact</button>
            <button className="danger-button" type="button" onClick={confirmDelete}>Delete</button>
          </div>
        </div>
      </dialog>

      <dialog className="dialog" ref={backupDialogRef}>
        <div className="dialog-card">
          <div className="dialog-header">
            <div>
              <span className="eyebrow">Your data</span>
              <h2>Backup &amp; restore</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Close" onClick={() => backupDialogRef.current?.close()}>
              <Icon name="close" size={21} />
            </button>
          </div>
          <p className="dialog-copy">Download a JSON backup before changing phones or clearing browser data.</p>
          <div className="backup-actions">
            <button className="add-button" type="button" disabled={contacts.length === 0} onClick={exportContacts}>Export JSON</button>
            <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>Import JSON</button>
          </div>
          <input
            ref={importInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importContacts(event.target.files?.[0])}
          />
          <p className="backup-warning">Backup files are not encrypted. Store them somewhere private.</p>
        </div>
      </dialog>

      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('')
}

export default App
