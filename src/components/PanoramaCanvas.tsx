import { useEffect, useRef, useState, type MouseEvent } from 'react';
import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';
import type { Hotspot, Scene } from '../lib/studio';

type Props = {
  scene: Scene;
  allScenes: Scene[];
  mode: 'select' | 'add' | 'reposition';
  selectedHotspotId: string | null;
  preview: boolean;
  onPlace: (pitch: number, yaw: number) => void;
  onSelect: (id: string) => void;
  onNavigate: (id: string) => void;
};
type Viewer = ReturnType<Window['pannellum']['viewer']>;

function decorateHotspot(element: HTMLElement, hotspot: Hotspot, selected: boolean, broken: boolean) {
  element.classList.add('luxe-hotspot');
  if (selected) element.classList.add('luxe-hotspot-selected');
  if (broken) element.classList.add('luxe-hotspot-broken');
  const arrow = document.createElement('span');
  arrow.className = 'luxe-hotspot-arrow';
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  element.appendChild(arrow);
  if (hotspot.label) {
    const label = document.createElement('span');
    label.className = 'luxe-hotspot-label';
    label.textContent = hotspot.label;
    element.appendChild(label);
  }
  element.setAttribute('aria-label', hotspot.label || 'Tour navigation hotspot');
}

export default function PanoramaCanvas({ scene, allScenes, mode, selectedHotspotId, preview, onPlace, onSelect, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const hotspotsRef = useRef<string[]>([]);
  const callbackRef = useRef({ scene, mode, selectedHotspotId, preview, allScenes, onPlace, onSelect, onNavigate });
  const [error, setError] = useState('');
  callbackRef.current = { scene, mode, selectedHotspotId, preview, allScenes, onPlace, onSelect, onNavigate };

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
            if (!current.preview) current.onSelect(hotspot.id);
            else if (target && hotspot.targetSceneId) current.onNavigate(hotspot.targetSceneId);
          },
          text: hotspot.label || (target ? 'Go to ' + target.name : 'Choose a destination')
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
        friction: 0.15, hfov: 96, pitch: 0, yaw: 0, hotSpots: []
      });
      viewerRef.current = viewer;
      viewer.on('error', () => setError('This image could not be rendered. Check that it is a readable panorama file.'));
      viewer.on('load', () => { setError(''); syncHotspotsRef.current(); });
      return () => {
        hotspotsRef.current = [];
        try { viewer.destroy(); } catch { /* The viewer may already be disposed. */ }
        if (viewerRef.current === viewer) viewerRef.current = null;
      };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The panorama viewer could not start.');
    }
  }, [scene.id, scene.imageUrl]);

  useEffect(() => {
    syncHotspotsRef.current();
  }, [scene.id, scene.hotspots, allScenes, selectedHotspotId, preview]);

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

  return (
    <div ref={containerRef} className={'panorama-container ' + (mode !== 'select' ? 'crosshair-mode' : '')} onClick={onClick} role="application" aria-label="Interactive 360 degree panorama viewer">
      {error && <div className="viewer-error"><span>!</span>{error}</div>}
      {mode !== 'select' && <div className="viewer-hint">{mode === 'add' ? 'Click the panorama to place a hotspot' : 'Click the new position for the selected hotspot'}</div>}
    </div>
  );
}
