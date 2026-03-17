import { App } from "obsidian";
import { makeCloseIcon } from "./svg-icons";

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

  // Stored listeners for cleanup
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: (() => void) | null = null;

  constructor(_app: App) {
    this.isMobile = document.body.classList.contains("is-mobile");

    this.containerEl = document.createElement("div");
    this.containerEl.addClass("yt-mini-player", "hidden");

    const handleClose = (): void => {
      if (this.onCloseCallback) this.onCloseCallback();
    };

    if (!this.isMobile) {
      const header = this.containerEl.createEl("div", { cls: "yt-mini-player-header" });
      header.createEl("span", { cls: "yt-mini-player-drag-handle", text: "\u2261" });
      const headerClose = header.createEl("button", { cls: "yt-mini-player-header-close" });
      headerClose.appendChild(makeCloseIcon(16));
      headerClose.setAttribute("aria-label", "Close");
      headerClose.addEventListener("click", handleClose);
      this.setupDrag(header, headerClose);
    } else {
      const closeBtn = this.containerEl.createEl("button", { cls: "yt-mini-player-close" });
      closeBtn.appendChild(makeCloseIcon(16));
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.addEventListener("click", handleClose);
    }

    this.videoContainerEl = this.containerEl.createEl("div", { cls: "yt-mini-player-video" });

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

  destroy(): void {
    if (this.boundMouseMove) document.removeEventListener("mousemove", this.boundMouseMove);
    if (this.boundMouseUp) document.removeEventListener("mouseup", this.boundMouseUp);
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
    let resizing = false;

    header.addEventListener("mousedown", (e: MouseEvent) => {
      if (closeBtn.contains(e.target as Node)) return;
      this.dragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.containerEl.getBoundingClientRect();
      this.dragStartLeft = rect.left;
      this.dragStartTop = rect.top;
      this.containerEl.style.left = `${rect.left}px`;
      this.containerEl.style.right = "auto";
      this.containerEl.addClass("dragging");
      e.preventDefault();
    });

    // Single set of document listeners handles both drag and resize
    this.boundMouseMove = (e: MouseEvent): void => {
      if (this.dragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.containerEl.style.left = `${Math.max(0, this.dragStartLeft + dx)}px`;
        this.containerEl.style.top = `${Math.max(0, this.dragStartTop + dy)}px`;
      } else if (resizing) {
        const dx = e.clientX - this.dragStartX;
        const newWidth = Math.max(240, this.dragStartLeft + dx); // dragStartLeft reused as startWidth
        this.containerEl.style.width = `${newWidth}px`;
      }
    };

    this.boundMouseUp = (): void => {
      if (this.dragging) {
        this.dragging = false;
        this.containerEl.removeClass("dragging");
      }
      if (resizing) {
        resizing = false;
        this.containerEl.removeClass("resizing");
      }
    };

    document.addEventListener("mousemove", this.boundMouseMove);
    document.addEventListener("mouseup", this.boundMouseUp);

    // Expose resizing state for setupResize
    this._setResizing = (val: boolean, startX: number, startWidth: number): void => {
      resizing = val;
      this.dragStartX = startX;
      this.dragStartLeft = startWidth; // reuse field for startWidth
    };
  }

  // Set by setupDrag to share document listeners
  private _setResizing: ((val: boolean, startX: number, startWidth: number) => void) | null = null;

  private setupResize(handle: HTMLElement): void {
    handle.addEventListener("mousedown", (e: MouseEvent) => {
      const startWidth = this.containerEl.getBoundingClientRect().width;
      this.containerEl.addClass("resizing");
      this._setResizing?.(true, e.clientX, startWidth);
      e.preventDefault();
      e.stopPropagation();
    });
  }
}
