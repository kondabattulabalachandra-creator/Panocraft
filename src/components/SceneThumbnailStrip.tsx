import type { DragEvent } from 'react';
import type { Scene } from '../lib/studio';

type Props = {
  scenes: Scene[];
  activeSceneId: string | null;
  startSceneId: string | null;
  preview: boolean;
  onSelect: (sceneId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, sceneId: string) => void;
  onDragEnd: () => void;
};

export default function SceneThumbnailStrip({ scenes, activeSceneId, startSceneId, preview, onSelect, onDragStart, onDragEnd }: Props) {
  if (!scenes.length) return null;
  const activeIndex = scenes.findIndex((scene) => scene.id === activeSceneId);

  return <section className="scene-strip" aria-label="Scene thumbnails">
    <div className="scene-strip-heading">
      <div className="scene-strip-title"><span>SCENES</span><small>{activeIndex + 1} / {scenes.length}</small></div>
      {!preview && <span className="scene-strip-hint">Drag a thumbnail onto the panorama to add a connection</span>}
    </div>
    <div className="scene-strip-list" role="list">
      {scenes.map((scene, index) => <button
        key={scene.id}
        type="button"
        role="listitem"
        data-scene-id={scene.id}
        aria-current={scene.id === activeSceneId ? 'true' : undefined}
        aria-label={`${scene.name}${scene.id === startSceneId ? ', start scene' : ''}${preview ? '' : ', draggable connection target'}`}
        title={preview ? scene.name : `Drag ${scene.name} onto the panorama to connect`}
        className={'scene-strip-card' + (scene.id === activeSceneId ? ' scene-strip-card-active' : '')}
        onClick={() => onSelect(scene.id)}
        draggable={!preview}
        onDragStart={(event) => onDragStart(event, scene.id)}
        onDragEnd={onDragEnd}
      >
        <span className="scene-strip-image"><img src={scene.imageUrl} alt=""/><span className="scene-strip-number">{String(index + 1).padStart(2, '0')}</span>{scene.id === startSceneId && <span className="scene-strip-start">START</span>}</span>
        <span className="scene-strip-copy"><strong>{scene.name}</strong><small>{scene.width} × {scene.height}<span className="scene-strip-hotspots">{scene.hotspots.length} link{scene.hotspots.length === 1 ? '' : 's'}</span></small></span>
      </button>)}
    </div>
  </section>;
}
