import { YouTubeMiniPlayer } from "./youtube-mini-player";

interface TrackedPlayer {
  id: string;
  videoId: string;
  iframe: HTMLIFrameElement;
  iframeSrc: string;
  sourcePath: string;
  intersectionObs: IntersectionObserver | null;
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/|releases\.obsidian\.md\/youtube\?v=)([\w-]{11})/;

export { YOUTUBE_RE };

export class YouTubeManager {
  private miniPlayer: YouTubeMiniPlayer;
  private players = new Map<string, TrackedPlayer>();
  private idCounter = 0;
  private activeEntryId: string | null = null;
  private dismissed = false;

  constructor() {
    this.miniPlayer = new YouTubeMiniPlayer();
  }

  trackIframe(iframe: HTMLIFrameElement, videoId: string, sourcePath: string): void {
    // Prune stale entries whose iframes are no longer in the DOM
    for (const [id, entry] of this.players.entries()) {
      if (!entry.iframe.isConnected) {
        entry.intersectionObs?.disconnect();
        this.players.delete(id);
      }
    }

    for (const entry of this.players.values()) {
      if (entry.iframe === iframe) return;
      if (entry.videoId === videoId && entry.sourcePath === sourcePath) {
        entry.intersectionObs?.disconnect();
        entry.iframe = iframe;
        entry.iframeSrc = iframe.src;
        this.observeVisibility(entry);
        return;
      }
    }

    const id = `yt-${videoId}-${this.idCounter++}`;

    const entry: TrackedPlayer = {
      id,
      videoId,
      iframe,
      iframeSrc: iframe.src,
      sourcePath,
      intersectionObs: null,
    };

    this.players.set(id, entry);
    this.observeVisibility(entry);
  }

  destroy(): void {
    for (const entry of this.players.values()) {
      entry.intersectionObs?.disconnect();
    }
    this.players.clear();
    this.miniPlayer.destroy();
  }

  private findScrollParent(el: HTMLElement): HTMLElement | null {
    let parent = el.parentElement;
    while (parent) {
      const overflow = getComputedStyle(parent).overflow;
      if (overflow === "auto" || overflow === "scroll") return parent;
      parent = parent.parentElement;
    }
    // Fallback: find the nearest known Obsidian scroll container
    const leaf = document.querySelector(".workspace-leaf.mod-active");
    if (leaf) {
      return leaf.querySelector(".markdown-preview-view")
        ?? leaf.querySelector(".cm-scroller")
        ?? null;
    }
    return null;
  }

  private observeVisibility(entry: TrackedPlayer): void {
    const scrollParent = this.findScrollParent(entry.iframe);

    entry.intersectionObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const rootTop = scrollParent ? scrollParent.getBoundingClientRect().top : 0;
          const aboveRoot = e.boundingClientRect.bottom < rootTop;
          if (!e.isIntersecting && aboveRoot && !this.dismissed) {
            this.showMiniPlayer(entry);
          } else if (e.isIntersecting) {
            if (this.activeEntryId === entry.id) {
              this.miniPlayer.hide();
              this.activeEntryId = null;
            }
            this.dismissed = false;
          }
        }
      },
      { threshold: 0, root: scrollParent },
    );

    entry.intersectionObs.observe(entry.iframe);
  }

  private showMiniPlayer(entry: TrackedPlayer): void {
    if (this.activeEntryId === entry.id) return;
    this.activeEntryId = entry.id;
    // Copy all attributes from original iframe to preserve CSP/sandbox policies
    const clone = document.createElement("iframe");
    for (const attr of Array.from(entry.iframe.attributes)) {
      clone.setAttribute(attr.name, attr.value);
    }
    // Add permissions that YouTube needs
    clone.setAttribute("allow", "autoplay; encrypted-media; accelerometer; gyroscope; fullscreen");
    // Ensure src is set
    if (!clone.src || clone.src === "about:blank") {
      clone.src = entry.iframeSrc;
    }
    this.miniPlayer.show(clone, entry.id, () => {
      this.miniPlayer.hide();
      this.activeEntryId = null;
      this.dismissed = true;
    });
  }
}
