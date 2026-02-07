# Quick Reads sync for Obsidian

Sync your Quick Reads highlights into Obsidian notes.

## Features

- Imports highlights from your Quick Reads account.
- Groups highlights by article and creates one note per article.
- Appends new highlights to existing article notes.
- Supports automatic sync on startup and at a configurable interval.
- Includes a customizable note template with placeholder tags.

## Requirements

- Obsidian `0.15.0` or newer
- A Quick Reads API key from `https://quickreads.app/settings`

## Setup

1. Install and enable **Quick Reads sync** in Obsidian.
2. Open plugin settings.
3. Paste your API key.
4. Choose a destination folder for imported highlights.
5. (Optional) Enable startup sync or set an auto-sync interval.

## Command and actions

- Command palette: `Sync highlights from Quick Reads`
- Ribbon icon: `Sync Quick Reads highlights`
- Settings button: `Sync`

## Note template placeholders

You can customize the note template using:

- `{{articleId}}`
- `{{articleTitle}}`
- `{{author}}`
- `{{siteName}}`
- `{{url}}`
- `{{highlights}}`

## Behavior details

- The plugin tracks synced highlight IDs to avoid duplicate imports.
- If a note already exists for an article, newly fetched highlights are appended.
- If no new highlights are available, the plugin records the sync time and exits.

## Troubleshooting

- If sync fails, verify your API key in plugin settings.
- Confirm your vault has permission to create notes in the selected folder.
- Check Obsidian developer console logs for API or network errors.

## Development

- Install dependencies: `npm install`
- Build: `npm run build`
- Dev build/watch: `npm run dev`

## License

This project is licensed under the MIT License. See `LICENSE`.
