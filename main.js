var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PersistentAudioPlayerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// player-view.ts
var SPEEDS = [1, 1.25, 1.5, 2];
var POSITION_KEY = "persistent-audio-player-bar-bottom";
var SVG_SIZE = 18;
var SVG_ATTRS = `width="${SVG_SIZE}" height="${SVG_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
var ICONS = {
  skipBack: `<svg ${SVG_ATTRS}><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="15.5" text-anchor="middle" stroke="none" fill="currentColor" font-size="8" font-weight="bold">15</text></svg>`,
  play: `<svg ${SVG_ATTRS}><polygon points="6,3 20,12 6,21" fill="currentColor" stroke="none"/></svg>`,
  pause: `<svg ${SVG_ATTRS}><rect x="5" y="3" width="4" height="18" fill="currentColor" stroke="none" rx="1"/><rect x="15" y="3" width="4" height="18" fill="currentColor" stroke="none" rx="1"/></svg>`,
  skipFwd: `<svg ${SVG_ATTRS}><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="15.5" text-anchor="middle" stroke="none" fill="currentColor" font-size="8" font-weight="bold">15</text></svg>`,
  close: `<svg ${SVG_ATTRS}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};
var PlayerView = class {
  constructor(audio) {
    this.seeking = false;
    this.speedIndex = 0;
    this.onTitleClick = null;
    this.onClose = null;
    // Drag state (mobile only)
    this.dragging = false;
    this.dragStartY = 0;
    this.dragStartBottom = 0;
    this.audio = audio;
    this.containerEl = document.createElement("div");
    this.containerEl.addClass("persistent-audio-bar", "hidden");
    this.mobileProgressBar = this.containerEl.createEl("div", {
      cls: "persistent-audio-mobile-progress"
    });
    this.mobileProgressFill = this.mobileProgressBar.createEl("div", {
      cls: "persistent-audio-mobile-progress-fill"
    });
    this.setupMobileScrub(this.mobileProgressBar);
    const dragHandle = this.containerEl.createEl("span", {
      cls: "persistent-audio-drag-handle"
    });
    dragHandle.createEl("span", { cls: "persistent-audio-grip-line" });
    dragHandle.createEl("span", { cls: "persistent-audio-grip-line" });
    dragHandle.createEl("span", { cls: "persistent-audio-grip-line" });
    this.setupDrag(dragHandle);
    const skipBackBtn = this.containerEl.createEl("button");
    skipBackBtn.innerHTML = ICONS.skipBack;
    skipBackBtn.setAttribute("aria-label", "Skip back 15s");
    skipBackBtn.addEventListener("click", () => {
      this.audio.currentTime = Math.max(this.audio.currentTime - 15, 0);
    });
    this.playPauseBtn = this.containerEl.createEl("button");
    this.playPauseBtn.innerHTML = ICONS.play;
    this.playPauseBtn.setAttribute("aria-label", "Play/Pause");
    this.playPauseBtn.addEventListener("click", () => {
      if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
    });
    const skipFwdBtn = this.containerEl.createEl("button");
    skipFwdBtn.innerHTML = ICONS.skipFwd;
    skipFwdBtn.setAttribute("aria-label", "Skip forward 15s");
    skipFwdBtn.addEventListener("click", () => {
      this.audio.currentTime = Math.min(
        this.audio.currentTime + 15,
        this.audio.duration || Infinity
      );
    });
    this.titleEl = this.containerEl.createEl("span", {
      cls: "persistent-audio-title",
      text: ""
    });
    this.titleEl.addEventListener("click", () => {
      if (this.onTitleClick)
        this.onTitleClick();
    });
    this.progressEl = this.containerEl.createEl("input", {
      cls: "persistent-audio-progress",
      type: "range"
    });
    this.progressEl.min = "0";
    this.progressEl.max = "1000";
    this.progressEl.value = "0";
    this.progressEl.addEventListener("mousedown", () => this.seeking = true);
    this.progressEl.addEventListener("touchstart", () => this.seeking = true);
    this.progressEl.addEventListener("input", () => {
      if (this.audio.duration) {
        this.audio.currentTime = parseFloat(this.progressEl.value) / 1e3 * this.audio.duration;
      }
    });
    this.progressEl.addEventListener("mouseup", () => this.seeking = false);
    this.progressEl.addEventListener("touchend", () => this.seeking = false);
    this.timeEl = this.containerEl.createEl("span", {
      cls: "persistent-audio-time",
      text: "0:00 / 0:00"
    });
    this.speedBtn = this.containerEl.createEl("button", {
      cls: "persistent-audio-speed",
      text: "1x"
    });
    this.speedBtn.setAttribute("aria-label", "Playback speed");
    this.speedBtn.addEventListener("click", () => this.cycleSpeed());
    const closeBtn = this.containerEl.createEl("button", {
      cls: "persistent-audio-close"
    });
    closeBtn.innerHTML = ICONS.close;
    closeBtn.setAttribute("aria-label", "Close player");
    closeBtn.addEventListener("click", () => {
      if (this.onClose)
        this.onClose();
    });
    this.restorePosition();
    document.body.appendChild(this.containerEl);
  }
  show(title, onTitleClick, onClose) {
    this.titleEl.textContent = title;
    this.onTitleClick = onTitleClick;
    this.onClose = onClose;
    this.containerEl.removeClass("hidden");
  }
  hide() {
    this.containerEl.addClass("hidden");
  }
  updatePlayState(playing) {
    this.playPauseBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
  }
  updateProgress() {
    if (this.seeking || !this.audio.duration)
      return;
    const pct = this.audio.currentTime / this.audio.duration * 1e3;
    this.progressEl.value = String(pct);
    this.mobileProgressFill.style.width = `${pct / 10}%`;
    this.timeEl.textContent = `${this.formatTime(this.audio.currentTime)} / ${this.formatTime(this.audio.duration)}`;
  }
  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    this.applySpeed();
  }
  resetSpeed() {
    this.speedIndex = 0;
    this.applySpeed();
  }
  destroy() {
    this.containerEl.remove();
  }
  applySpeed() {
    const speed = SPEEDS[this.speedIndex];
    this.audio.playbackRate = speed;
    this.speedBtn.textContent = `${speed}x`;
  }
  savePosition(bottom) {
    try {
      localStorage.setItem(POSITION_KEY, String(bottom));
    } catch (e) {
    }
  }
  restorePosition() {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved !== null) {
        const bottom = parseInt(saved, 10);
        if (!isNaN(bottom) && bottom > 0) {
          this.containerEl.style.bottom = `${bottom}px`;
        }
      }
    } catch (e) {
    }
  }
  setupMobileScrub(bar) {
    const seek = (e) => {
      if (!this.audio.duration)
        return;
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      this.audio.currentTime = x / rect.width * this.audio.duration;
    };
    bar.addEventListener("touchstart", (e) => {
      this.seeking = true;
      seek(e);
      e.stopPropagation();
    }, { passive: true });
    bar.addEventListener("touchmove", (e) => {
      if (this.seeking)
        seek(e);
      e.stopPropagation();
    }, { passive: true });
    bar.addEventListener("touchend", () => {
      this.seeking = false;
    });
  }
  setupDrag(handle) {
    handle.addEventListener("touchstart", (e) => {
      this.dragging = true;
      this.dragStartY = e.touches[0].clientY;
      this.dragStartBottom = window.innerHeight - this.containerEl.getBoundingClientRect().top - this.containerEl.offsetHeight;
      this.containerEl.addClass("dragging");
      e.preventDefault();
    }, { passive: false });
    document.addEventListener("touchmove", (e) => {
      if (!this.dragging)
        return;
      const deltaY = this.dragStartY - e.touches[0].clientY;
      let newBottom = this.dragStartBottom + deltaY;
      const maxBottom = window.innerHeight - this.containerEl.offsetHeight;
      newBottom = Math.max(0, Math.min(newBottom, maxBottom));
      this.containerEl.style.bottom = `${newBottom}px`;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener("touchend", () => {
      if (!this.dragging)
        return;
      this.dragging = false;
      this.containerEl.removeClass("dragging");
      const bottom = window.innerHeight - this.containerEl.getBoundingClientRect().top - this.containerEl.offsetHeight;
      this.savePosition(bottom);
    });
  }
  formatTime(seconds) {
    if (!isFinite(seconds))
      return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
};

// main.ts
var AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i;
var PersistentAudioPlayerPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.currentUrl = null;
    this.currentSourcePath = null;
  }
  async onload() {
    this.audio = new Audio();
    this.playerView = new PlayerView(this.audio);
    this.audio.addEventListener(
      "play",
      () => this.playerView.updatePlayState(true)
    );
    this.audio.addEventListener("pause", () => {
      this.playerView.updatePlayState(false);
      this.savePosition();
    });
    this.audio.addEventListener(
      "timeupdate",
      () => this.playerView.updateProgress()
    );
    this.audio.addEventListener("ended", () => {
      this.clearPosition();
      this.currentUrl = null;
      this.currentSourcePath = null;
      this.playerView.hide();
    });
    this.registerMarkdownPostProcessor(
      (el, ctx) => {
        this.processElement(el, ctx);
      }
    );
    this.addCommand({
      id: "play-pause",
      name: "Play / Pause",
      callback: () => {
        if (!this.currentUrl) {
          this.playFromFrontmatter();
          return;
        }
        if (this.audio.paused) {
          this.audio.play();
        } else {
          this.audio.pause();
        }
      }
    });
    this.addCommand({
      id: "stop",
      name: "Stop playback",
      callback: () => this.stop()
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
      }
    });
    this.addCommand({
      id: "skip-back",
      name: "Skip back 15s",
      callback: () => {
        if (this.currentUrl) {
          this.audio.currentTime = Math.max(this.audio.currentTime - 15, 0);
        }
      }
    });
    this.addCommand({
      id: "cycle-speed",
      name: "Cycle playback speed (1x \u2192 1.25x \u2192 1.5x \u2192 2x)",
      callback: () => {
        if (this.currentUrl) {
          this.playerView.cycleSpeed();
        }
      }
    });
    this.addCommand({
      id: "reset-speed",
      name: "Reset playback speed to 1x",
      callback: () => {
        this.playerView.resetSpeed();
      }
    });
    this.addCommand({
      id: "play-from-frontmatter",
      name: "Play audio from current note frontmatter",
      callback: () => this.playFromFrontmatter()
    });
  }
  onunload() {
    this.savePosition();
    this.audio.pause();
    this.audio.src = "";
    this.playerView.destroy();
  }
  stop() {
    this.savePosition();
    this.audio.pause();
    this.audio.src = "";
    this.currentUrl = null;
    this.currentSourcePath = null;
    this.playerView.hide();
  }
  play(url, title, sourcePath) {
    if (this.currentUrl === url) {
      if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
      return;
    }
    this.savePosition();
    this.currentUrl = url;
    this.currentSourcePath = sourcePath;
    this.audio.src = url;
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
    this.audio.play();
    this.playerView.show(
      title,
      () => {
        const file = this.app.vault.getAbstractFileByPath(sourcePath);
        if (file instanceof import_obsidian.TFile) {
          this.app.workspace.getLeaf(false).openFile(file);
        }
      },
      () => this.stop()
    );
    this.saveLastPlayed(sourcePath);
  }
  saveLastPlayed(sourcePath) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof import_obsidian.TFile))
      return;
    this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.last_played = this.nowStamp();
    });
  }
  nowStamp() {
    const now = /* @__PURE__ */ new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  getSavedPosition(sourcePath) {
    var _a;
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof import_obsidian.TFile))
      return null;
    const cache = this.app.metadataCache.getFileCache(file);
    const pos = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.audio_position;
    if (typeof pos === "number")
      return pos;
    if (typeof pos === "string")
      return this.parseHMS(pos);
    return null;
  }
  savePosition() {
    if (!this.currentSourcePath || !this.currentUrl || this.audio.currentTime <= 0)
      return;
    const file = this.app.vault.getAbstractFileByPath(this.currentSourcePath);
    if (!(file instanceof import_obsidian.TFile))
      return;
    const position = this.formatHMS(Math.floor(this.audio.currentTime));
    const stamp = this.nowStamp();
    this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.audio_position = position;
      fm.last_played = stamp;
    });
  }
  clearPosition() {
    if (!this.currentSourcePath)
      return;
    const file = this.app.vault.getAbstractFileByPath(this.currentSourcePath);
    if (!(file instanceof import_obsidian.TFile))
      return;
    this.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm.audio_position;
    });
  }
  playFromFrontmatter() {
    var _a, _b;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!view)
      return;
    const file = view.file;
    if (!file)
      return;
    const cache = this.app.metadataCache.getFileCache(file);
    const mp3 = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.audio;
    if (!mp3)
      return;
    const title = ((_b = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _b.title) || file.basename;
    this.play(mp3, title, file.path);
  }
  processElement(el, ctx) {
    var _a;
    const cache = this.app.metadataCache.getCache(ctx.sourcePath);
    if ((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.audio) {
      const sectionInfo = ctx.getSectionInfo(el);
      if (sectionInfo && sectionInfo.lineStart === 0) {
        const mp3Url = cache.frontmatter.audio;
        const title = cache.frontmatter.title || ctx.sourcePath.replace(/\.md$/, "").split("/").pop();
        const bar = el.createDiv({ cls: "persistent-audio-frontmatter-bar" });
        const btn = bar.createSpan({ cls: "persistent-audio-play-btn", text: "\u25B6" });
        btn.setAttribute("aria-label", "Play episode audio");
        bar.createSpan({ text: " Play episode" });
        bar.addEventListener("click", () => this.play(mp3Url, title || "Unknown", ctx.sourcePath));
      }
    }
    const links = el.querySelectorAll("a");
    links.forEach((link) => {
      var _a2;
      const href = link.getAttribute("href");
      if (!href || !AUDIO_EXTENSIONS.test(href))
        return;
      const btn = document.createElement("span");
      btn.addClass("persistent-audio-play-btn");
      btn.textContent = "\u25B6";
      btn.setAttribute("aria-label", "Play audio");
      btn.addEventListener("click", (e) => {
        var _a3;
        e.preventDefault();
        e.stopPropagation();
        const title = ((_a3 = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a3.title) || this.extractTitle(link, href);
        this.play(href, title, ctx.sourcePath);
      });
      (_a2 = link.parentElement) == null ? void 0 : _a2.insertAfter(btn, link);
    });
  }
  formatHMS(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor(totalSeconds % 3600 / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  parseHMS(value) {
    const parts = value.split(":").map(Number);
    if (parts.some(isNaN))
      return null;
    if (parts.length === 3)
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2)
      return parts[0] * 60 + parts[1];
    return null;
  }
  extractTitle(link, href) {
    var _a, _b;
    const linkText = (_a = link.textContent) == null ? void 0 : _a.trim();
    if (linkText && linkText !== href) {
      return linkText;
    }
    try {
      const url = new URL(href);
      const filename = url.pathname.split("/").pop() || href;
      return decodeURIComponent(filename.replace(AUDIO_EXTENSIONS, ""));
    } catch (e) {
      return ((_b = href.split("/").pop()) == null ? void 0 : _b.replace(AUDIO_EXTENSIONS, "")) || href;
    }
  }
};
