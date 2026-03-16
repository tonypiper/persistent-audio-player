import { Plugin, MarkdownPostProcessorContext, MarkdownView, TFile } from "obsidian";
import { PlayerView } from "./player-view";

interface AudioFrontmatter {
  audio?: string;
  audio_position?: string | number;
  last_played?: string;
  title?: string;
}

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i;

export default class PersistentAudioPlayerPlugin extends Plugin {
  audio: HTMLAudioElement;
  playerView: PlayerView;
  currentUrl: string | null = null;
  currentSourcePath: string | null = null;

  async onload(): Promise<void> {
    this.audio = new Audio();
    this.playerView = new PlayerView(this.audio, this.app);

    this.audio.addEventListener("play", () =>
      this.playerView.updatePlayState(true)
    );
    this.audio.addEventListener("pause", () => {
      this.playerView.updatePlayState(false);
      this.savePosition();
    });
    this.audio.addEventListener("timeupdate", () =>
      this.playerView.updateProgress()
    );
    this.audio.addEventListener("ended", () => {
      this.clearPosition();
      this.currentUrl = null;
      this.currentSourcePath = null;
      this.playerView.hide();
    });

    this.registerMarkdownPostProcessor(
      (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        this.processElement(el, ctx);
      }
    );

    this.addCommand({
      id: "play-pause",
      name: "Play / pause",
      callback: () => {
        if (!this.currentUrl) {
          this.playFromFrontmatter();
          return;
        }
        if (this.audio.paused) {
          void this.audio.play();
        } else {
          this.audio.pause();
        }
      },
    });

    this.addCommand({
      id: "stop",
      name: "Stop playback",
      callback: () => this.stop(),
    });

    this.addCommand({
      id: "skip-forward",
      name: "Skip forward 15s",
      callback: () => {
        if (this.currentUrl) {
          this.audio.currentTime = Math.min(
            this.audio.currentTime + 15,
            this.audio.duration || Infinity
          );
        }
      },
    });

    this.addCommand({
      id: "skip-back",
      name: "Skip back 15s",
      callback: () => {
        if (this.currentUrl) {
          this.audio.currentTime = Math.max(this.audio.currentTime - 15, 0);
        }
      },
    });

    this.addCommand({
      id: "cycle-speed",
      name: "Cycle playback speed (1x → 1.25x → 1.5x → 2x)",
      callback: () => {
        if (this.currentUrl) {
          this.playerView.cycleSpeed();
        }
      },
    });

    this.addCommand({
      id: "reset-speed",
      name: "Reset playback speed to 1x",
      callback: () => {
        this.playerView.resetSpeed();
      },
    });

    this.addCommand({
      id: "play-from-frontmatter",
      name: "Play audio from current note frontmatter",
      callback: () => this.playFromFrontmatter(),
    });
  }

  onunload(): void {
    this.savePosition();
    this.audio.pause();
    this.audio.src = "";
    this.playerView.destroy();
  }

  stop(): void {
    this.savePosition();
    this.audio.pause();
    this.audio.src = "";
    this.currentUrl = null;
    this.currentSourcePath = null;
    this.playerView.hide();
  }

  play(url: string, title: string, sourcePath: string): void {
    if (this.currentUrl === url) {
      if (this.audio.paused) {
        void this.audio.play();
      } else {
        this.audio.pause();
      }
      return;
    }

    // Save position of previous track
    this.savePosition();

    this.currentUrl = url;
    this.currentSourcePath = sourcePath;
    this.audio.src = url;

    // Restore saved position from frontmatter once audio is ready
    const saved = this.getSavedPosition(sourcePath);
    if (saved && saved > 0) {
      const onCanPlay = () => {
        if (saved < this.audio.duration - 2) {
          this.audio.currentTime = saved;
        }
        this.audio.removeEventListener("canplay", onCanPlay);
      };
      this.audio.addEventListener("canplay", onCanPlay);
    }

    void this.audio.play();
    this.playerView.show(
      title,
      () => {
        const file = this.app.vault.getAbstractFileByPath(sourcePath);
        if (file instanceof TFile) {
          void this.app.workspace.getLeaf(false).openFile(file);
        }
      },
      () => this.stop(),
    );
    this.saveLastPlayed(sourcePath);
  }

  private saveLastPlayed(sourcePath: string): void {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;
    void this.app.fileManager.processFrontMatter(file, (fm: AudioFrontmatter) => {
      fm.last_played = this.nowStamp();
    });
  }

  private nowStamp(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  private getAudioFrontmatter(file: TFile): AudioFrontmatter | undefined {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter as AudioFrontmatter | undefined;
  }

  private getSavedPosition(sourcePath: string): number | null {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return null;
    const pos = this.getAudioFrontmatter(file)?.audio_position;
    if (typeof pos === "number") return pos;
    if (typeof pos === "string") return this.parseHMS(pos);
    return null;
  }

  private savePosition(): void {
    if (!this.currentSourcePath || !this.currentUrl || this.audio.currentTime <= 0) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentSourcePath);
    if (!(file instanceof TFile)) return;
    const position = this.formatHMS(Math.floor(this.audio.currentTime));
    const stamp = this.nowStamp();
    void this.app.fileManager.processFrontMatter(file, (fm: AudioFrontmatter) => {
      fm.audio_position = position;
      fm.last_played = stamp;
    });
  }

  private clearPosition(): void {
    if (!this.currentSourcePath) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentSourcePath);
    if (!(file instanceof TFile)) return;
    void this.app.fileManager.processFrontMatter(file, (fm: AudioFrontmatter) => {
      delete fm.audio_position;
    });
  }

  private playFromFrontmatter(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const file = view.file;
    if (!file) return;
    const fm = this.getAudioFrontmatter(file);
    const mp3 = fm?.audio;
    if (!mp3) return;
    const title = fm?.title ?? file.basename;
    this.play(mp3, title, file.path);
  }

  private processElement(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    // Inject play button for frontmatter audio at top of note
    const cache = this.app.metadataCache.getCache(ctx.sourcePath);
    const cacheFm = cache?.frontmatter as AudioFrontmatter | undefined;
    if (cacheFm?.audio) {
      const sectionInfo = ctx.getSectionInfo(el);
      if (sectionInfo && sectionInfo.lineStart === 0) {
        const mp3Url = cacheFm.audio;
        const title = cacheFm.title ?? ctx.sourcePath.replace(/\.md$/, "").split("/").pop();
        const bar = el.createDiv({ cls: "persistent-audio-frontmatter-bar" });
        const btn = bar.createSpan({ cls: "persistent-audio-play-btn", text: "\u25B6" });
        btn.setAttribute("aria-label", "Play episode audio");
        bar.createSpan({ text: " Play episode" });
        bar.addEventListener("click", () => this.play(mp3Url, title ?? "Unknown", ctx.sourcePath));
      }
    }

    // Inject play buttons next to inline audio links
    const links = el.querySelectorAll("a");
    links.forEach((link: HTMLAnchorElement) => {
      const href = link.getAttribute("href");
      if (!href || !AUDIO_EXTENSIONS.test(href)) return;

      const btn = document.createElement("span");
      btn.addClass("persistent-audio-play-btn");
      btn.textContent = "\u25B6";
      btn.setAttribute("aria-label", "Play audio");

      btn.addEventListener("click", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const title = cacheFm?.title ?? this.extractTitle(link, href);
        this.play(href, title, ctx.sourcePath);
      });

      link.parentElement?.insertAfter(btn, link);
    });
  }

  private formatHMS(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  private parseHMS(value: string): number | null {
    const parts = value.split(":").map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  private extractTitle(link: HTMLAnchorElement, href: string): string {
    const linkText = link.textContent?.trim();
    if (linkText && linkText !== href) {
      return linkText;
    }
    try {
      const url = new URL(href);
      const filename = url.pathname.split("/").pop() || href;
      return decodeURIComponent(filename.replace(AUDIO_EXTENSIONS, ""));
    } catch {
      return href.split("/").pop()?.replace(AUDIO_EXTENSIONS, "") || href;
    }
  }
}
