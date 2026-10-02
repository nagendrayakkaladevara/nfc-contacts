# QuickDial

QuickDial is a mobile-first React + TypeScript phonebook designed to open from an NFC tag. Contacts stay in the browser on the current device, and tapping the green call button opens the mobile dialer with the selected number.

## Features

- Add and delete named phone numbers
- Search by name or number
- Open the phone's dialer with a `tel:` link
- Store contacts in browser `localStorage`
- Export and restore contacts as a JSON backup
- Responsive, accessible mobile UI
- GitHub Pages deployment workflow

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Deploy to GitHub Pages

1. Create an empty GitHub repository.
2. Commit this project and push it to the repository's `main` branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, select **GitHub Actions** as the source.
5. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish.
6. Copy the published HTTPS URL from the deployment and write that URL to the NFC tag as a **URL/URI** record.

The Vite base path is relative, so the same build works for project URLs such as `https://username.github.io/repository-name/`.

## How storage works

Contacts are serialized as JSON and saved under a namespaced `localStorage` key. This is more appropriate than trying to modify a JSON file from a static GitHub Pages site because browser JavaScript cannot silently write back into deployed files.

Important limitations:

- Contacts are available only in the same browser on the same device.
- They do not automatically sync to another phone or browser.
- Clearing site data or browser storage removes them.
- Private/incognito browsing may remove them when the session ends.
- Use **Backup & restore → Export JSON** before changing phones or clearing browser data.

For 30–40 contacts, storage usage is tiny compared with normal browser limits.

## NFC usage

The NFC tag stores only the GitHub Pages URL. Scanning it opens QuickDial in the browser. The actual contacts remain on the phone; they are not written to the NFC tag or committed to the repository.
