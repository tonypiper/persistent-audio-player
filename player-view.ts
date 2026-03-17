import { App } from "obsidian";
import { createSvg, svgEl, makeCloseIcon } from "./svg-icons";

const SPEEDS = [1, 1.25, 1.5, 2];
const POSITION_KEY = "persistent-media-player-bar-bottom";
const SVG_SIZE = 18;

function makeSkipIcon(direction: "back" | "fwd"): SVGSVGElement {
  const isBack = direction === "back";
  return createSvg(SVG_SIZE, (svg) => {
    svgEl(svg, "path", { d: isBack ? "M1 4v6h6" : "M23 4v6h-6" });
    svgEl(svg, "path", { d: isBack ? "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" : "M20.49 15a9 9 0 1 1-2.13-9.36L23 10" });
    svgEl(svg, "text", { x: "12", y: "15.5", "text-anchor": "middle", stroke: "none", fill: "currentColor", "font-size": "8", "font-weight": "bold" });
    svg.lastElementChild!.textContent = "15";
  });
}

function makePlayIcon(): SVGSVGElement {
  return createSvg(SVG_SIZE, (svg) => {
    svgEl(svg, "polygon", { points: "6,3 20,12 6,21", fill: "currentColor", stroke: "none" });
  });
}

function makePauseIcon(): SVGSVGElement {
  return createSvg(SVG_SIZE, (svg) => {
    svgEl(svg, "rect", { x: "5", y: "3", width: "4", height: "18", fill: "currentColor", stroke: "none", rx: "1" });
    svgEl(svg, "rect", { x: "15", y: "3", width: "4", height: "18", fill: "currentColor", stroke: "none", rx: "1" });
  });
}

export class PlayerView {
  containerEl: HTMLElement;
  private titleEl: HTMLElement;
  private playPauseBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private progressEl: HTMLInputElement;
  private timeEl: HTMLElement;
  private audio: HTMLAudioElement;
  private app: App;
  private playIcon: SVGSVGElement;
  private pauseIcon: SVGSVGElement;
  private seeking = false;
  private speedIndex = 0;
  private onTitleClick: (() => void) | null = null;
  private onClose: (() => void) | null = null;

  // Drag state (mobile only)
  private dragging = false;
  private dragStartY = 0;
  private dragStartBottom = 0;

  // Bound document listeners for cleanup
  private onDocTouchMove: (e: TouchEvent) => void;
  private onDocTouchEnd: () => void;

  constructor(audio: HTMLAudioElement, app: App) {
    this.audio = audio;
    this.app = app;
    this.playIcon = makePlayIcon();
    this.pauseIcon = makePauseIcon();

    this.containerEl = document.createElement("div");
    this.containerEl.addClass("persistent-media-bar", "hidden");

    // Drag handle (visible on mobile only via CSS)
    const dragHandle = this.containerEl.createEl("span", {
      cls: "persistent-media-drag-handle",
    });
    dragHandle.createEl("span", { cls: "persistent-media-grip-line" });
    dragHandle.createEl("span", { cls: "persistent-media-grip-line" });
    dragHandle.createEl("span", { cls: "persistent-media-grip-line" });
    this.setupDrag(dragHandle);

    const skipBackBtn = this.containerEl.createEl("button");
    skipBackBtn.appendChild(makeSkipIcon("back"));
    skipBackBtn.setAttribute("aria-label", "Skip back 15s");
    skipBackBtn.addEventListener("click", () => {
      this.audio.currentTime = Math.max(this.audio.currentTime - 15, 0);
    });

    this.playPauseBtn = this.containerEl.createEl("button");
    this.playPauseBtn.appendChild(this.playIcon);
    this.playPauseBtn.setAttribute("aria-label", "Play/pause");
    this.playPauseBtn.addEventListener("click", () => {
      if (this.audio.paused) {
        void this.audio.play();
      } else {
        this.audio.pause();
      }
    });

    const skipFwdBtn = this.containerEl.createEl("button");
    skipFwdBtn.appendChild(makeSkipIcon("fwd"));
    skipFwdBtn.setAttribute("aria-label", "Skip forward 15s");
    skipFwdBtn.addEventListener("click", () => {
      this.audio.currentTime = Math.min(
        this.audio.currentTime + 15,
        this.audio.duration || Infinity
      );
    });

    this.titleEl = this.containerEl.createEl("span", {
      cls: "persistent-media-title",
      text: "",
    });
    this.titleEl.addEventListener("click", () => {
      if (this.onTitleClick) this.onTitleClick();
    });

    const progressRow = this.containerEl.createEl("div", {
      cls: "persistent-media-progress-row",
    });

    this.progressEl = progressRow.createEl("input", {
      cls: "persistent-media-progress",
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

    this.timeEl = progressRow.createEl("span", {
      cls: "persistent-media-time",
      text: "0:00 / 0:00",
    });

    this.speedBtn = this.containerEl.createEl("button", {
      cls: "persistent-media-speed",
      text: "1x",
    });
    this.speedBtn.setAttribute("aria-label", "Playback speed");
    this.speedBtn.addEventListener("click", () => this.cycleSpeed());

    const closeBtn = this.containerEl.createEl("button", {
      cls: "persistent-media-close",
    });
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
    const current = playing ? this.pauseIcon : this.playIcon;
    if (this.playPauseBtn.firstChild !== current) {
      this.playPauseBtn.empty();
      this.playPauseBtn.appendChild(current);
    }
  }

  updateProgress(): void {
    if (this.seeking || !this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 1000;
    this.progressEl.value = String(pct);
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
    document.removeEventListener("touchmove", this.onDocTouchMove);
    document.removeEventListener("touchend", this.onDocTouchEnd);
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
    const OLD_KEY = "persistent-audio-player-bar-bottom";
    let saved = this.app.loadLocalStorage(POSITION_KEY) as string | null;
    if (!saved) {
      const legacy = this.app.loadLocalStorage(OLD_KEY) as string | null;
      if (legacy) {
        this.app.saveLocalStorage(POSITION_KEY, legacy);
        saved = legacy;
      }
    }
    if (typeof saved === "string") {
      const bottom = parseInt(saved, 10);
      if (!isNaN(bottom) && bottom > 0) {
        this.containerEl.style.bottom = `${bottom}px`;
      }
    }
  }

  private setupDrag(handle: HTMLElement): void {
    handle.addEventListener("touchstart", (e: TouchEvent) => {
      this.dragging = true;
      this.dragStartY = e.touches[0].clientY;
      this.dragStartBottom = window.innerHeight - this.containerEl.getBoundingClientRect().top - this.containerEl.offsetHeight;
      this.containerEl.addClass("dragging");
      e.preventDefault();
    }, { passive: false });

    this.onDocTouchMove = (e: TouchEvent) => {
      if (!this.dragging) return;
      const deltaY = this.dragStartY - e.touches[0].clientY;
      let newBottom = this.dragStartBottom + deltaY;
      const maxBottom = window.innerHeight - this.containerEl.offsetHeight;
      newBottom = Math.max(0, Math.min(newBottom, maxBottom));
      this.containerEl.style.bottom = `${newBottom}px`;
      e.preventDefault();
    };

    this.onDocTouchEnd = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.containerEl.removeClass("dragging");
      const bottom = window.innerHeight - this.containerEl.getBoundingClientRect().top - this.containerEl.offsetHeight;
      this.savePosition(bottom);
    };

    document.addEventListener("touchmove", this.onDocTouchMove, { passive: false });
    document.addEventListener("touchend", this.onDocTouchEnd);
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
