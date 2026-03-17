import { Plugin, MarkdownPostProcessorContext, MarkdownView, TFile } from "obsidian";
import { PlayerView } from "./player-view";
import { YouTubeManager, YOUTUBE_RE } from "./youtube-manager";
import { formatHMS, parseHMS } from "./time-utils";
import { PluginSettings, DEFAULT_SETTINGS, PersistentAudioPlayerSettingTab } from "./settings";

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
  youtubeManager: YouTubeManager | null = null;
  settings: PluginSettings;
  currentUrl: string | null = null;
  currentSourcePath: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new PersistentAudioPlayerSettingTab(this.app, this));

    this.audio = new Audio();
    this.playerView = new PlayerView(this.audio, this.app);

    if (this.settings.enableYouTubeMiniPlayer) {
      this.initYouTubeManager();
    }

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

    // Update last_played when an audio link is clicked to open externally
    this.registerDomEvent(document, "click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!(target instanceof HTMLElement)) return;

      const isAudioLink =
        // Standard <a> links in markdown body
        (target.closest("a")?.href && AUDIO_EXTENSIONS.test(target.closest("a")!.href)) ||
        // Properties panel: click on the "audio" property link
        (target.closest('.metadata-property[data-property-key="audio"]') &&
          target.closest(".metadata-link-inner.external-link"));

      if (isAudioLink) this.saveLastPlayedForActiveFile();
    });

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
    this.destroyYouTubeManager();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  initYouTubeManager(): void {
    if (this.youtubeManager) return;
    this.youtubeManager = new YouTubeManager(this.app);

    // Scan for YouTube iframes on layout ready and when switching notes
    const scanForIframes = (): void => {
      if (!this.youtubeManager) return;
      const activePath = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
      if (!activePath) return;
      const leaf = document.querySelector(".workspace-leaf.mod-active");
      if (!leaf) return;
      leaf.querySelectorAll("iframe").forEach((iframe: HTMLIFrameElement) => {
        const src = iframe.getAttribute("src") || "";
        const match = src.match(YOUTUBE_RE);
        if (match) {
          this.youtubeManager!.trackIframe(iframe, match[1], activePath);
        }
      });
    };

    this.app.workspace.onLayoutReady(() => scanForIframes());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      setTimeout(scanForIframes, 500);
    }));
  }

  destroyYouTubeManager(): void {
    if (!this.youtubeManager) return;
    this.youtubeManager.destroy();
    this.youtubeManager = null;
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

  private saveLastPlayedForActiveFile(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file) this.saveLastPlayed(view.file.path);
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
    if (typeof pos === "string") return parseHMS(pos);
    return null;
  }

  private savePosition(): void {
    if (!this.currentSourcePath || !this.currentUrl || this.audio.currentTime <= 0) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentSourcePath);
    if (!(file instanceof TFile)) return;
    const position = formatHMS(Math.floor(this.audio.currentTime));
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

    // Detect YouTube iframes and track them for mini-player
    if (this.youtubeManager) {
      const iframes = el.querySelectorAll("iframe");
      iframes.forEach((iframe: HTMLIFrameElement) => {
        const src = iframe.getAttribute("src") || "";
        const match = src.match(YOUTUBE_RE);
        if (match) {
          this.youtubeManager!.trackIframe(iframe, match[1], ctx.sourcePath);
        }
      });
    }
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
