import { makeCloseIcon } from "./svg-icons";

// Cached safe-area inset (measured once via probe element)
let cachedSafeAreaTop: number | null = null;

export class YouTubeMiniPlayer {
  containerEl: HTMLElement;
  private videoContainerEl: HTMLElement;
  private currentVideoId: string | null = null;
  private onCloseCallback: (() => void) | null = null;
  private isMobile: boolean;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartLeft = 0;
  private dragStartTop = 0;

  // Resize state
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  // Stored listeners for cleanup
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: (() => void) | null = null;

  constructor() {
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

  // Removes the iframe from the container and returns it without blanking its src.
  detach(): HTMLIFrameElement | null {
    const iframe = this.videoContainerEl.querySelector("iframe") as HTMLIFrameElement | null;
    if (iframe) this.videoContainerEl.removeChild(iframe);
    this.containerEl.addClass("hidden");
    this.currentVideoId = null;
    this.onCloseCallback = null;
    return iframe;
  }

  hide(): void {
    const iframe = this.detach();
    if (iframe) iframe.src = "about:blank";
  }

  isShowingVideo(videoId: string): boolean {
    return this.currentVideoId === videoId;
  }

  destroy(): void {
    this.detachDocListeners();
    this.containerEl.remove();
  }

  private positionBelowHeader(): void {
    let top = 0;

    const selectors: Array<{ query: string; useTop: boolean }> = [
      { query: ".workspace-leaf.mod-active .view-content", useTop: true },
      { query: ".view-content", useTop: true },
      { query: ".workspace-leaf.mod-active .view-header", useTop: false },
      { query: ".view-header", useTop: false },
    ];
    for (const { query, useTop } of selectors) {
      const el = document.querySelector(query);
      if (el) {
        const rect = el.getBoundingClientRect();
        const val = useTop ? rect.top : rect.bottom;
        if (val > 0) {
          top = val;
          break;
        }
      }
    }

    const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-top")) || 0;
    top = Math.max(top, safeTop);

    if (top === 0) {
      if (cachedSafeAreaTop === null) {
        const probe = document.createElement("div");
        probe.style.cssText = "position:fixed;top:env(safe-area-inset-top,0px);left:0;width:0;height:0;visibility:hidden";
        document.body.appendChild(probe);
        cachedSafeAreaTop = probe.getBoundingClientRect().top;
        probe.remove();
      }
      if (cachedSafeAreaTop > 0) top = cachedSafeAreaTop;
    }

    this.containerEl.style.top = `${top}px`;
  }

  private attachDocListeners(): void {
    if (this.boundMouseMove) return;

    this.boundMouseMove = (e: MouseEvent): void => {
      if (this.dragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.containerEl.style.left = `${Math.max(0, this.dragStartLeft + dx)}px`;
        this.containerEl.style.top = `${Math.max(0, this.dragStartTop + dy)}px`;
      } else if (this.resizing) {
        const dx = e.clientX - this.resizeStartX;
        this.containerEl.style.width = `${Math.max(240, this.resizeStartWidth + dx)}px`;
      }
    };

    this.boundMouseUp = (): void => {
      this.dragging = false;
      this.resizing = false;
      this.containerEl.removeClass("dragging");
      this.containerEl.removeClass("resizing");
      this.detachDocListeners();
    };

    document.addEventListener("mousemove", this.boundMouseMove);
    document.addEventListener("mouseup", this.boundMouseUp);
  }

  private detachDocListeners(): void {
    if (this.boundMouseMove) {
      document.removeEventListener("mousemove", this.boundMouseMove);
      this.boundMouseMove = null;
    }
    if (this.boundMouseUp) {
      document.removeEventListener("mouseup", this.boundMouseUp);
      this.boundMouseUp = null;
    }
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
      this.containerEl.style.left = `${rect.left}px`;
      this.containerEl.style.right = "auto";
      this.containerEl.addClass("dragging");
      this.attachDocListeners();
      e.preventDefault();
    });
  }

  private setupResize(handle: HTMLElement): void {
    handle.addEventListener("mousedown", (e: MouseEvent) => {
      this.resizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartWidth = this.containerEl.getBoundingClientRect().width;
      this.containerEl.addClass("resizing");
      this.attachDocListeners();
      e.preventDefault();
      e.stopPropagation();
    });
  }
}
