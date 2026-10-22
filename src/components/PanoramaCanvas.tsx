import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';
import type { Hotspot, Scene } from '../lib/studio';
const signedAngle = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
const CONNECTION_DRAG_TYPE = 'text/luxe360-connection';

type Props = {
  scene: Scene;
  allScenes: Scene[];
  initialYaw: number;
  initialPitch: number;
  mode: 'select' | 'add' | 'reposition';
  selectedHotspotId: string | null;
  preview: boolean;
  onPlace: (pitch: number, yaw: number) => void;
  onSceneDrop: (sceneId: string, pitch: number, yaw: number) => void;
  onSelect: (id: string) => void;
  onNavigate: (id: string, yaw: number, pitch: number) => void;
};
type Viewer = ReturnType<Window['pannellum']['viewer']>;

function decorateHotspot(element: HTMLElement, hotspot: Hotspot, selected: boolean, broken: boolean) {
  Array.from(element.children).forEach((child) => {
    if (child.classList.contains('luxe-hotspot-arrow') || child.classList.contains('luxe-hotspot-label')) child.remove();
  });
  element.classList.add('luxe-hotspot', 'luxe-hotspot-position-' + (hotspot.placementMode || '2d'));
  if (selected) element.classList.add('luxe-hotspot-selected');
  if (broken) element.classList.add('luxe-hotspot-broken');
  if (hotspot.shadow !== false) element.classList.add('luxe-hotspot-shadow');
  if (hotspot.onlyHover) element.classList.add('luxe-hotspot-only-hover');
  if (hotspot.force2D) element.classList.add('luxe-hotspot-force-2d');
  element.dataset.scaleOnZoom = String(hotspot.scaleOnZoom !== false);
  element.style.setProperty('--addon-zoom', '1');

  const arrow = document.createElement('span');
  arrow.className = 'luxe-hotspot-arrow';
  const width = Math.max(16, Math.min(120, hotspot.width ?? 44));
  const height = Math.max(16, Math.min(120, hotspot.height ?? 44));
  arrow.style.width = width + 'px';
  arrow.style.height = height + 'px';
  arrow.style.opacity = String(Math.max(5, Math.min(100, hotspot.opacity ?? 100)) / 100);
  arrow.style.color = hotspot.tint || '#e0c45d';
  arrow.style.borderColor = hotspot.tint || '#e0c45d';
  const floorTilt = hotspot.rotationX ?? (hotspot.placementMode === 'floor' ? 65 : 0);
  arrow.style.transform = hotspot.force2D === true
    ? `rotate(${hotspot.rotation || 0}deg) scale(var(--addon-zoom, 1))`
    : `perspective(500px) rotateX(${floorTilt}deg) rotateY(${hotspot.rotationY || 0}deg) rotateZ(${hotspot.rotationZ || 0}deg) rotate(${hotspot.rotation || 0}deg) scale(var(--addon-zoom, 1))`;
  if (hotspot.iconDataUrl?.startsWith('data:image/')) {
    const image = document.createElement('span');
    image.className = 'luxe-hotspot-custom-icon';
    image.style.backgroundColor = hotspot.tint || '#e0c45d';
    image.style.maskImage = `url("${hotspot.iconDataUrl}")`;
    image.style.webkitMaskImage = `url("${hotspot.iconDataUrl}")`;
    arrow.appendChild(image);
  } else {
    const paths: Record<string, string> = {
      arrow: '<path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5m0-8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2" fill="currentColor"/>',
      star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      camera: '<path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>'
    };
    arrow.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[hotspot.icon || 'arrow'] || paths.arrow}</svg>`;
  }
  element.appendChild(arrow);

  if (hotspot.label) {
    const label = document.createElement('span');
    label.className = 'luxe-hotspot-label';
    label.textContent = hotspot.label;
    label.style.color = hotspot.labelColor || '#29362e';
    label.style.backgroundColor = hotspot.labelBackground || '#ffffff';
    label.style.fontSize = Math.max(6, Math.min(36, hotspot.labelFontSize ?? 11)) + 'px';
    label.style.fontWeight = hotspot.labelBold ? '700' : '600';
    label.style.fontStyle = hotspot.labelItalic ? 'italic' : 'normal';
    label.style.textAlign = hotspot.labelAlignment || 'center';
    label.style.transform = 'scale(var(--addon-zoom, 1))';
    element.appendChild(label);
  }
  element.setAttribute('aria-label', hotspot.label || 'Tour hotspot');
}

export default function PanoramaCanvas({ scene, allScenes, initialYaw, initialPitch, mode, selectedHotspotId, preview, onPlace, onSceneDrop, onSelect, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const hotspotsRef = useRef<string[]>([]);
  const [connectionDropActive, setConnectionDropActive] = useState(false);
  const callbackRef = useRef({ scene, mode, selectedHotspotId, preview, allScenes, onPlace, onSceneDrop, onSelect, onNavigate });
  const [error, setError] = useState('');
  callbackRef.current = { scene, mode, selectedHotspotId, preview, allScenes, onPlace, onSceneDrop, onSelect, onNavigate };

  const syncHotspots = () => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.isLoaded()) return;
    hotspotsRef.current.forEach((id) => { try { viewer.removeHotSpot(id); } catch { /* Ignore stale ids while refreshing. */ } });
    hotspotsRef.current = [];
    const latest = callbackRef.current;
    latest.scene.hotspots.forEach((hotspot) => {
      const target = latest.allScenes.find((item) => item.id === hotspot.targetSceneId);
      const id = 'luxe-' + hotspot.id;
      try {
        viewer.addHotSpot({
          id, pitch: hotspot.pitch, yaw: hotspot.yaw, type: 'info', cssClass: 'luxe360-hotspot',
          createTooltipFunc: (element: HTMLElement) => decorateHotspot(element, hotspot, latest.selectedHotspotId === hotspot.id && !latest.preview, !target),
          clickHandlerFunc: () => {
            const current = callbackRef.current;
            if (!current.preview) { current.onSelect(hotspot.id); return; }
            const action = hotspot.action || (hotspot.targetSceneId ? 'navigate' : 'none');
            if (action === 'navigate' && target && hotspot.targetSceneId) {
              const returnHotspot = target.hotspots.find((item) => item.targetSceneId === current.scene.id);
              const arrivalYaw = hotspot.autoFaceBack === false ? (hotspot.arrivalYaw ?? 0) : (returnHotspot?.yaw ?? signedAngle(hotspot.yaw + 180));
              const arrivalPitch = hotspot.autoFaceBack === false ? (hotspot.arrivalPitch ?? 0) : (returnHotspot?.pitch ?? 0);
              current.onNavigate(hotspot.targetSceneId, arrivalYaw, arrivalPitch);
            }
            else if (action === 'url' && hotspot.actionUrl) {
              try {
                const url = new URL(hotspot.actionUrl);
                if (url.protocol === 'https:' || url.protocol === 'http:') window.open(url.href, '_blank', 'noopener,noreferrer');
              } catch { /* Ignore invalid visitor-provided links. */ }
            } else if (action === 'info') window.alert(hotspot.actionInfo || hotspot.label || 'More information');
          },
          text: hotspot.label || (target ? 'Go to ' + target.name : 'Hotspot')
        });
        hotspotsRef.current.push(id);
      } catch { /* One malformed hotspot should not break the viewer. */ }
    });
  };
  const syncHotspotsRef = useRef(syncHotspots);
  syncHotspotsRef.current = syncHotspots;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setError('');
    try {
      const viewer = window.pannellum.viewer(element, {
        type: 'equirectangular', panorama: scene.imageUrl, autoLoad: true,
        showControls: true, showZoomCtrl: true, showFullscreenCtrl: true,
        compass: false, mouseZoom: true, keyboardZoom: true, draggable: true,
        friction: 0.15, hfov: 96, pitch: initialPitch, yaw: initialYaw, hotSpots: []
      });
      viewerRef.current = viewer;
      viewer.on('error', () => setError('This image could not be rendered. Check that it is a readable panorama file.'));
      viewer.on('load', () => { setError(''); syncHotspotsRef.current(); });
      viewer.on('zoomchange', () => {
        const getHfov = (viewer as typeof viewer & { getHfov?: () => number }).getHfov;
        const hfov = getHfov?.() || 96;
        const scale = Math.max(0.55, Math.min(2, 96 / hfov));
        element.querySelectorAll<HTMLElement>('.luxe-hotspot[data-scale-on-zoom="true"]').forEach((hotspot) => hotspot.style.setProperty('--addon-zoom', String(scale)));
      });
      return () => {
        hotspotsRef.current = [];
        try { viewer.destroy(); } catch { /* The viewer may already be disposed. */ }
        if (viewerRef.current === viewer) viewerRef.current = null;
      };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The panorama viewer could not start.');
    }
  }, [scene.id, scene.imageUrl, initialYaw, initialPitch]);


  useEffect(() => { syncHotspotsRef.current(); }, [scene.id, scene.hotspots, allScenes, selectedHotspotId, preview]);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const state = callbackRef.current;
    if (state.mode === 'select') return;
    const target = event.target as HTMLElement;
    if (target.closest('.pnlm-hotspot') || target.closest('.pnlm-controls') || target.closest('.pnlm-ui')) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      const coords = viewer.mouseEventToCoords(event.nativeEvent);
      if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) state.onPlace(coords[0], coords[1]);
    } catch { setError('Could not read the clicked panorama position. Try again.'); }
  };

  const onConnectionDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (callbackRef.current.preview || !Array.from(event.dataTransfer.types).includes(CONNECTION_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setConnectionDropActive(true);
  };
  const onConnectionDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setConnectionDropActive(false);
  };
  const onConnectionDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes(CONNECTION_DRAG_TYPE)) return;
    event.preventDefault();
    setConnectionDropActive(false);
    const state = callbackRef.current;
    if (state.preview) return;
    const targetSceneId = event.dataTransfer.getData(CONNECTION_DRAG_TYPE);
    const viewer = viewerRef.current;
    if (!targetSceneId || !viewer) return;
    try {
      const coords = viewer.mouseEventToCoords(event.nativeEvent);
      if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) state.onSceneDrop(targetSceneId, coords[0], coords[1]);
      else setError('Could not read that drop position. Use Add connection to place it by clicking instead.');
    } catch { setError('Could not read that drop position. Use Add connection to place it by clicking instead.'); }
  };

  return (
    <div ref={containerRef} className={'panorama-container ' + (mode !== 'select' ? 'crosshair-mode' : '') + (connectionDropActive ? ' connection-drop-active' : '')} onClick={onClick} onDragOver={onConnectionDragOver} onDragLeave={onConnectionDragLeave} onDrop={onConnectionDrop} role="application" aria-label="Interactive 360 degree panorama viewer">
      {error && <div className="viewer-error"><span>!</span>{error}</div>}
      {mode !== 'select' && <div className="viewer-hint">{mode === 'add' ? 'Click a point, then choose a destination' : 'Click the new position for the selected hotspot'}</div>}
      {connectionDropActive && <div className="connection-drop-overlay" aria-hidden="true"><div className="connection-drop-card"><span className="connection-drop-icon">+</span><strong>Drop to add connection</strong><span>Hotspot will be placed here</span></div></div>}
    </div>
  );
}
