import { App } from "obsidian";

const SPEEDS = [1, 1.25, 1.5, 2];
const POSITION_KEY = "persistent-audio-player-bar-bottom";
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_SIZE = 18;

function createSvg(children: (parent: SVGSVGElement) => void): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(SVG_SIZE));
  svg.setAttribute("height", String(SVG_SIZE));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  children(svg);
  return svg;
}

function svgEl(parent: SVGSVGElement, tag: string, attrs: Record<string, string>): void {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  parent.appendChild(el);
}

function makeSkipBackIcon(): SVGSVGElement {
  return createSvg((svg) => {
    svgEl(svg, "path", { d: "M1 4v6h6" });
    svgEl(svg, "path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" });
    svgEl(svg, "text", { x: "12", y: "15.5", "text-anchor": "middle", stroke: "none", fill: "currentColor", "font-size": "8", "font-weight": "bold" });
    svg.lastElementChild!.textContent = "15";
  });
}

function makePlayIcon(): SVGSVGElement {
  return createSvg((svg) => {
    svgEl(svg, "polygon", { points: "6,3 20,12 6,21", fill: "currentColor", stroke: "none" });
  });
}

function makePauseIcon(): SVGSVGElement {
  return createSvg((svg) => {
    svgEl(svg, "rect", { x: "5", y: "3", width: "4", height: "18", fill: "currentColor", stroke: "none", rx: "1" });
    svgEl(svg, "rect", { x: "15", y: "3", width: "4", height: "18", fill: "currentColor", stroke: "none", rx: "1" });
  });
}

function makeSkipFwdIcon(): SVGSVGElement {
  return createSvg((svg) => {
    svgEl(svg, "path", { d: "M23 4v6h-6" });
    svgEl(svg, "path", { d: "M20.49 15a9 9 0 1 1-2.13-9.36L23 10" });
    svgEl(svg, "text", { x: "12", y: "15.5", "text-anchor": "middle", stroke: "none", fill: "currentColor", "font-size": "8", "font-weight": "bold" });
    svg.lastElementChild!.textContent = "15";
  });
}

function makeCloseIcon(): SVGSVGElement {
  return createSvg((svg) => {
    svgEl(svg, "line", { x1: "18", y1: "6", x2: "6", y2: "18" });
    svgEl(svg, "line", { x1: "6", y1: "6", x2: "18", y2: "18" });
  });
}

export class PlayerView {
  containerEl: HTMLElement;
  private titleEl: HTMLElement;
  private playPauseBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private progressEl: HTMLInputElement;
  private mobileProgressBar: HTMLElement;
  private mobileProgressFill: HTMLElement;
  private timeEl: HTMLElement;
  private audio: HTMLAudioElement;
  private app: App;
  private seeking = false;
  private speedIndex = 0;
  private onTitleClick: (() => void) | null = null;
  private onClose: (() => void) | null = null;

  // Drag state (mobile only)
  private dragging = false;
  private dragStartY = 0;
  private dragStartBottom = 0;

  constructor(audio: HTMLAudioElement, app: App) {
    this.audio = audio;
    this.app = app;

    this.containerEl = document.createElement("div");
    this.containerEl.addClass("persistent-audio-bar", "hidden");

    // Mobile scrubber bar along top edge
    this.mobileProgressBar = this.containerEl.createEl("div", {
      cls: "persistent-audio-mobile-progress",
    });
    this.mobileProgressFill = this.mobileProgressBar.createEl("div", {
      cls: "persistent-audio-mobile-progress-fill",
    });
    this.setupMobileScrub(this.mobileProgressBar);

    // Drag handle (visible on mobile only via CSS)
    const dragHandle = this.containerEl.createEl("span", {
      cls: "persistent-audio-drag-handle",
    });
    dragHandle.createEl("span", { cls: "persistent-audio-grip-line" });
    dragHandle.createEl("span", { cls: "persistent-audio-grip-line" });
    dragHandle.createEl("span", { cls: "persistent-audio-grip-line" });
    this.setupDrag(dragHandle);

    const skipBackBtn = this.containerEl.createEl("button");
    skipBackBtn.empty();
    skipBackBtn.appendChild(makeSkipBackIcon());
    skipBackBtn.setAttribute("aria-label", "Skip back 15s");
    skipBackBtn.addEventListener("click", () => {
      this.audio.currentTime = Math.max(this.audio.currentTime - 15, 0);
    });

    this.playPauseBtn = this.containerEl.createEl("button");
    this.playPauseBtn.empty();
    this.playPauseBtn.appendChild(makePlayIcon());
    this.playPauseBtn.setAttribute("aria-label", "Play/pause");
    this.playPauseBtn.addEventListener("click", () => {
      if (this.audio.paused) {
        void this.audio.play();
      } else {
        this.audio.pause();
      }
    });

    const skipFwdBtn = this.containerEl.createEl("button");
    skipFwdBtn.empty();
    skipFwdBtn.appendChild(makeSkipFwdIcon());
    skipFwdBtn.setAttribute("aria-label", "Skip forward 15s");
    skipFwdBtn.addEventListener("click", () => {
      this.audio.currentTime = Math.min(
        this.audio.currentTime + 15,
        this.audio.duration || Infinity
      );
    });

    this.titleEl = this.containerEl.createEl("span", {
      cls: "persistent-audio-title",
      text: "",
    });
    this.titleEl.addEventListener("click", () => {
      if (this.onTitleClick) this.onTitleClick();
    });

    this.progressEl = this.containerEl.createEl("input", {
      cls: "persistent-audio-progress",
      type: "range",
    });
    this.progressEl.min = "0";
    this.progressEl.max = "1000";
    this.progressEl.value = "0";

    this.progressEl.addEventListener("mousedown", () => (this.seeking = true));
    this.progressEl.addEventListener("touchstart", () => (this.seeking = true));
    this.progressEl.addEventListener("input", () => {
      if (this.audio.duration) {
        this.audio.currentTime =
          (parseFloat(this.progressEl.value) / 1000) * this.audio.duration;
      }
    });
    this.progressEl.addEventListener("mouseup", () => (this.seeking = false));
    this.progressEl.addEventListener("touchend", () => (this.seeking = false));

    this.timeEl = this.containerEl.createEl("span", {
      cls: "persistent-audio-time",
      text: "0:00 / 0:00",
    });

    this.speedBtn = this.containerEl.createEl("button", {
      cls: "persistent-audio-speed",
      text: "1x",
    });
    this.speedBtn.setAttribute("aria-label", "Playback speed");
    this.speedBtn.addEventListener("click", () => this.cycleSpeed());

    const closeBtn = this.containerEl.createEl("button", {
      cls: "persistent-audio-close",
    });
    closeBtn.empty();
    closeBtn.appendChild(makeCloseIcon());
    closeBtn.setAttribute("aria-label", "Close player");
    closeBtn.addEventListener("click", () => {
      if (this.onClose) this.onClose();
    });

    // Restore saved bar position
    this.restorePosition();

    document.body.appendChild(this.containerEl);
  }

  show(title: string, onTitleClick: () => void, onClose: () => void): void {
    this.titleEl.textContent = title;
    this.onTitleClick = onTitleClick;
    this.onClose = onClose;
    this.containerEl.removeClass("hidden");
  }

  hide(): void {
    this.containerEl.addClass("hidden");
  }

  updatePlayState(playing: boolean): void {
    this.playPauseBtn.empty();
    this.playPauseBtn.appendChild(playing ? makePauseIcon() : makePlayIcon());
  }

  updateProgress(): void {
    if (this.seeking || !this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 1000;
    this.progressEl.value = String(pct);
    this.mobileProgressFill.style.width = `${(pct / 10)}%`;
    this.timeEl.textContent = `${this.formatTime(this.audio.currentTime)} / ${this.formatTime(this.audio.duration)}`;
  }

  cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    this.applySpeed();
  }

  resetSpeed(): void {
    this.speedIndex = 0;
    this.applySpeed();
  }

  destroy(): void {
    this.containerEl.remove();
  }

  private applySpeed(): void {
    const speed = SPEEDS[this.speedIndex];
    this.audio.playbackRate = speed;
    this.speedBtn.textContent = `${speed}x`;
  }

  private savePosition(bottom: number): void {
    this.app.saveLocalStorage(POSITION_KEY, String(bottom));
  }

  private restorePosition(): void {
    const saved = this.app.loadLocalStorage(POSITION_KEY) as string | null;
    if (typeof saved === "string") {
      const bottom = parseInt(saved, 10);
      if (!isNaN(bottom) && bottom > 0) {
        this.containerEl.style.bottom = `${bottom}px`;
      }
    }
  }

  private setupMobileScrub(bar: HTMLElement): void {
    const seek = (e: TouchEvent) => {
      if (!this.audio.duration) return;
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      this.audio.currentTime = (x / rect.width) * this.audio.duration;
    };
    bar.addEventListener("touchstart", (e: TouchEvent) => {
      this.seeking = true;
      seek(e);
      e.stopPropagation();
    }, { passive: true });
    bar.addEventListener("touchmove", (e: TouchEvent) => {
      if (this.seeking) seek(e);
      e.stopPropagation();
    }, { passive: true });
    bar.addEventListener("touchend", () => {
      this.seeking = false;
    });
  }

  private setupDrag(handle: HTMLElement): void {
    handle.addEventListener("touchstart", (e: TouchEvent) => {
      this.dragging = true;
      this.dragStartY = e.touches[0].clientY;
      this.dragStartBottom = window.innerHeight - this.containerEl.getBoundingClientRect().top - this.containerEl.offsetHeight;
      this.containerEl.addClass("dragging");
      e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchmove", (e: TouchEvent) => {
      if (!this.dragging) return;
      const deltaY = this.dragStartY - e.touches[0].clientY;
      let newBottom = this.dragStartBottom + deltaY;
      const maxBottom = window.innerHeight - this.containerEl.offsetHeight;
      newBottom = Math.max(0, Math.min(newBottom, maxBottom));
      this.containerEl.style.bottom = `${newBottom}px`;
      e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchend", () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.containerEl.removeClass("dragging");
      const bottom = window.innerHeight - this.containerEl.getBoundingClientRect().top - this.containerEl.offsetHeight;
      this.savePosition(bottom);
    });
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
