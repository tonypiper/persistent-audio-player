# Changelog

## 1.2.2

- Fix: dismissed mini-player state now preserved across note re-renders (iframe replacement no longer creates a new entry)
- Update README to cover YouTube mini-player feature and video support

## 1.2.1

- Fix: dismissed mini-player no longer reappears after note re-renders
- Fix: preserve existing iframe `allow` permissions instead of overwriting
- Fix: original YouTube iframe no longer blank after scrolling back into view
- Fix: migrate saved player bar position from old plugin ID on first load
- Fix: README and CSS comment still referenced old plugin name

## 1.2.0

- Add YouTube mini-player that keeps video visible in a floating window while scrolling
- Add settings tab with toggle to enable/disable YouTube mini-player
- Rename plugin from persistent-audio-player to persistent-media-player

## 1.1.0

- Mobile: two-row player layout with full-width scrub bar and time display
- Remove thin top-edge progress bar (replaced by full scrub bar)
- Update `last_played` when audio link opened externally (browser playback)
- Add `/release` command and improve release workflow
- Add CLAUDE.md

## 1.0.4

- Update `last_played` when an audio link is opened externally (browser playback)
- Supports links in both the markdown body and the Properties panel

## 1.0.3

- Align project structure with obsidian-sample-plugin
- Fix release workflow permissions

## 1.0.2

- Mobile: add thin scrubber bar along top edge of player

## 1.0.1

- Mobile: hide progress bar, make close button visible

## 1.0.0

- Initial release
