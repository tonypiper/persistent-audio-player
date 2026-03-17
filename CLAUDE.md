# CLAUDE.md

## Build & test
See README.md for commands. Reload in Obsidian: `obsidian plugin:reload id=persistent-media-player`

## Architecture
- `main.ts` — plugin lifecycle, audio element, frontmatter read/write, markdown post-processor
- `player-view.ts` — persistent player bar UI, progress/seek, speed control, mobile drag
- Single shared `HTMLAudioElement` on the plugin instance

## Key conventions
- Playback state stored in note frontmatter: `audio`, `audio_position` (HH:MM:SS), `last_played`
- `AUDIO_EXTENSIONS` regex gates what counts as an audio link
- Properties panel renders URLs as `<div class="metadata-link-inner external-link" data-href="...">`, not `<a>` tags
- Use `registerDomEvent`/`registerMarkdownPostProcessor` for automatic cleanup on unload

## Release
Use `/release` command
