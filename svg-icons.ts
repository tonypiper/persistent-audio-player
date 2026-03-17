const SVG_NS = "http://www.w3.org/2000/svg";

export function createSvg(size: number, children: (parent: SVGSVGElement) => void): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  children(svg);
  return svg;
}

export function svgEl(parent: SVGSVGElement, tag: string, attrs: Record<string, string>): void {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  parent.appendChild(el);
}

export function makeCloseIcon(size = 18): SVGSVGElement {
  return createSvg(size, (svg) => {
    svgEl(svg, "line", { x1: "18", y1: "6", x2: "6", y2: "18" });
    svgEl(svg, "line", { x1: "6", y1: "6", x2: "18", y2: "18" });
  });
}
