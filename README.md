# Persistent Audio Player for Obsidian

Audio player that keeps playing when you scroll or switch notes. Built for podcast listeners who take notes while listening.

## Features

- **Persistent playback** — audio continues when you scroll, switch notes, or navigate
- **Auto-detection** — finds audio links (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.webm`, `.flac`) in note body and `audio` frontmatter field
- **Mini-player bar** — sticky bar with play/pause, skip ±15s, seek, speed control, and track title
- **Position memory** — saves playback position to frontmatter (`audio_position`) so you can resume where you left off
- **Last played tracking** — records `last_played` timestamp in frontmatter
- **Navigate to note** — click the track title in the player bar to jump to the source note
- **Mobile support** — floating draggable player bar on mobile, respects safe areas
- **Playback speed** — cycle through 1x, 1.25x, 1.5x, 2x

## Frontmatter fields

The plugin reads and writes these frontmatter properties:

| Field | Type | Description |
|-------|------|-------------|
| `audio` | URL | Audio file URL — adds a "Play episode" button at the top of the note |
| `audio_position` | HH:MM:SS | Last playback position — auto-saved on pause/stop |
| `last_played` | datetime | When the audio was last played |

## Commands

All commands are available in the Command Palette and can be assigned to hotkeys:

- **Play / Pause** — toggle playback (starts from frontmatter if nothing playing)
- **Stop playback** — stop and save position
- **Skip forward 15s** / **Skip back 15s**
- **Cycle playback speed**
- **Reset playback speed to 1x**
- **Play audio from current note frontmatter**

## Installation

### From community plugins
Search for "Persistent Audio Player" in Settings → Community Plugins.

### Manual
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Create `.obsidian/plugins/persistent-audio-player/` in your vault
3. Copy the three files into that directory
4. Enable the plugin in Settings → Community Plugins

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
npm run lint   # run eslint
```

## Releasing

1. Update `CHANGELOG.md` with the new version's entries
2. Run `npm version <major|minor|patch>` — bumps `manifest.json`, `versions.json`, and `package.json`, stages the changelog, commits, and creates a git tag
3. `git push && git push --tags` — triggers GitHub Actions release

The release workflow builds the plugin and creates a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached, using the changelog entry as release notes. Compatible with [BRAT](https://github.com/TfTHacker/obsidian42-brat) for beta installs on mobile.
