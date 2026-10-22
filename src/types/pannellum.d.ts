interface Window {
  pannellum: {
    viewer: (container: HTMLElement, config: Record<string, unknown>) => {
      destroy: () => void;
      on: (name: string, callback: (...args: unknown[]) => void) => void;
      mouseEventToCoords: (event: MouseEvent) => number[];
      addHotSpot: (hotspot: Record<string, unknown>) => unknown;
      removeHotSpot: (id: string) => boolean;
    };
  };
}
declare module 'pannellum/build/pannellum.js';
declare module 'pannellum/build/pannellum.css';
declare module '*?raw' { const contents: string; export default contents; }
