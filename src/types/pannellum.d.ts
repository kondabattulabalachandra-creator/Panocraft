declare module 'pannellum' {
  const pannellum: {
    viewer: (container: HTMLElement, config: Record<string, unknown>) => {
      destroy: () => void;
      addEventListener: (name: string, callback: (...args: unknown[]) => void) => void;
      mouseEventToCoords: (event: MouseEvent) => number[];
      addHotSpot: (hotspot: Record<string, unknown>) => unknown;
      removeHotSpot: (id: string) => boolean;
    };
  };
  export default pannellum;
}
declare module 'pannellum/build/pannellum.css';
declare module '*?raw' { const contents: string; export default contents; }
