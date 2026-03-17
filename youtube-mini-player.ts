import { App } from "obsidian";

const SVG_NS = "http://www.w3.org/2000/svg";

function closeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", "M18 6L6 18M6 6l12 12");
  svg.appendChild(p);
  return svg;
}

export class YouTubeMiniPlayer {
  containerEl: HTMLElement;
  private videoContainerEl: HTMLElement;
  private currentVideoId: string | null = null;
  private onCloseCallback: (() => void) | null = null;
  private isMobile: boolean;

  // Desktop drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartLeft = 0;
  private dragStartTop = 0;

  constructor(_app: App) {
    this.isMobile = document.body.classList.contains("is-mobile");

    this.containerEl = document.createElement("div");
    this.containerEl.addClass("yt-mini-player", "hidden");

    if (!this.isMobile) {
      // Desktop: drag bar with close button
      const header = this.containerEl.createEl("div", { cls: "yt-mini-player-header" });
      header.createEl("span", { cls: "yt-mini-player-drag-handle", text: "\u2261" });
      const headerClose = header.createEl("button", { cls: "yt-mini-player-header-close" });
      headerClose.appendChild(closeIcon());
      headerClose.setAttribute("aria-label", "Close");
      headerClose.addEventListener("click", () => {
        if (this.onCloseCallback) this.onCloseCallback();
      });
      this.setupDrag(header, headerClose);
    } else {
      // Mobile: overlay close button
      const closeBtn = this.containerEl.createEl("button", { cls: "yt-mini-player-close" });
      closeBtn.appendChild(closeIcon());
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.addEventListener("click", () => {
        if (this.onCloseCallback) this.onCloseCallback();
      });
    }

    this.videoContainerEl = this.containerEl.createEl("div", { cls: "yt-mini-player-video" });

    // Desktop: resize handle
    if (!this.isMobile) {
      const resizeHandle = this.containerEl.createEl("div", { cls: "yt-mini-player-resize" });
      this.setupResize(resizeHandle);
    }

    document.body.appendChild(this.containerEl);
  }

  show(iframe: HTMLIFrameElement, videoId: string, onClose: () => void): void {
    this.currentVideoId = videoId;
    this.onCloseCallback = onClose;
    this.videoContainerEl.empty();
    this.videoContainerEl.appendChild(iframe);
    if (this.isMobile) {
      this.positionBelowHeader();
    }
    this.containerEl.removeClass("hidden");
  }

  hide(): void {
    const iframe = this.videoContainerEl.querySelector("iframe");
    if (iframe) iframe.src = "about:blank";
    this.videoContainerEl.empty();
    this.containerEl.addClass("hidden");
    this.currentVideoId = null;
    this.onCloseCallback = null;
  }

  isShowingVideo(videoId: string): boolean {
    return this.currentVideoId === videoId;
  }

  isVisible(): boolean {
    return this.currentVideoId !== null && !this.containerEl.hasClass("hidden");
  }

  destroy(): void {
    this.containerEl.remove();
  }

  private positionBelowHeader(): void {
    let top = 0;

    const selectors = [
      ".workspace-leaf.mod-active .view-content",
      ".view-content",
      ".workspace-leaf.mod-active .view-header",
      ".view-header",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        const val = sel.includes("view-content") ? rect.top : rect.bottom;
        if (val > 0) {
          top = val;
          break;
        }
      }
    }

    const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-top")) || 0;
    top = Math.max(top, safeTop);

    if (top === 0) {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;top:env(safe-area-inset-top,0px);left:0;width:0;height:0;visibility:hidden";
      document.body.appendChild(probe);
      const probeTop = probe.getBoundingClientRect().top;
      probe.remove();
      if (probeTop > 0) top = probeTop;
    }

    this.containerEl.style.top = `${top}px`;
  }

  private setupDrag(header: HTMLElement, closeBtn: HTMLElement): void {
    header.addEventListener("mousedown", (e: MouseEvent) => {
      if (closeBtn.contains(e.target as Node)) return;
      this.dragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.containerEl.getBoundingClientRect();
      this.dragStartLeft = rect.left;
      this.dragStartTop = rect.top;
      // Switch from right to left positioning for drag
      this.containerEl.style.left = `${rect.left}px`;
      this.containerEl.style.right = "auto";
      this.containerEl.addClass("dragging");
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.containerEl.style.left = `${Math.max(0, this.dragStartLeft + dx)}px`;
      this.containerEl.style.top = `${Math.max(0, this.dragStartTop + dy)}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.containerEl.removeClass("dragging");
    });
  }

  private setupResize(handle: HTMLElement): void {
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = this.containerEl.getBoundingClientRect().width;
      this.containerEl.addClass("resizing");
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.containerEl.hasClass("resizing")) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(240, startWidth + dx);
      this.containerEl.style.width = `${newWidth}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!this.containerEl.hasClass("resizing")) return;
      this.containerEl.removeClass("resizing");
    });
  }
}
