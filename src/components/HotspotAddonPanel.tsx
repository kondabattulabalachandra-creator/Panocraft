import { useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowRight, ArrowUp, Bold, Camera, ImagePlus,
  Info, Italic, MapPin, RotateCcw, RotateCw, Star, Type, X
} from 'lucide-react';
import type { Hotspot } from '../lib/studio';

type Props = { hotspot: Hotspot; onChange: (patch: Partial<Hotspot>) => void };
const color = (value: string | undefined, fallback: string) => value || fallback;
const value = (number: number | undefined, fallback: number) => number ?? fallback;
const signedAngle = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;

export default function HotspotAddonPanel({ hotspot, onChange }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [advanced, setAdvanced] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const labelColor = color(hotspot.labelColor, '#29362e');
  const labelBackground = color(hotspot.labelBackground, '#ffffff');
  const action = hotspot.action || (hotspot.targetSceneId ? 'navigate' : 'none');
  const PreviewIcon = action === 'navigate' ? ArrowUp : { arrow: ArrowRight, info: Info, pin: MapPin, star: Star, camera: Camera }[hotspot.icon || 'arrow'];
  const setPlacement = (mode: NonNullable<Hotspot['placementMode']>) => {
    const current = hotspot.placementMode || '2d';
    const patch: Partial<Hotspot> = { placementMode: mode };
    if (mode === 'floor' && (hotspot.rotationX === undefined || (current === '2d' && hotspot.rotationX === 0))) patch.rotationX = 65;
    else if (current === 'floor' && mode !== 'floor' && hotspot.rotationX === 65) patch.rotationX = 0;
    onChange(patch);
  };

  const chooseIcon = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 4 * 1024 * 1024) {
      setUploadError('Choose a PNG, JPG, WebP, or GIF under 4 MB.');
      if (uploadRef.current) uploadRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ iconDataUrl: reader.result });
        setUploadError('');
      } else setUploadError('The selected image could not be read.');
    };
    reader.onerror = () => setUploadError('The selected image could not be read.');
    reader.readAsDataURL(file);
  };

  const resetAppearance = () => onChange({
    icon: 'arrow', iconDataUrl: '', tint: '#e0c45d', width: 44, height: 44, opacity: 100,
    rotation: 0, rotationX: 0, rotationY: 0, rotationZ: 0, placementMode: '2d', scaleOnZoom: true,
    labelFontSize: 11, labelColor: '#29362e', labelBackground: '#ffffff', labelBold: false,
    labelItalic: false, labelAlignment: 'center', shadow: true, onlyHover: false, force2D: false
  });

  return <div className="hotspot-addon-panel">
    <section className="addon-section">
      <div className="addon-section-heading"><h3>Icon</h3><span className="addon-live-dot">LIVE</span></div>
      <div className="addon-icon-row">
        <div className="addon-icon-preview" aria-label="Hotspot icon preview">
          {action !== 'navigate' && hotspot.iconDataUrl ? <img src={hotspot.iconDataUrl} alt="Custom hotspot icon"/> : <PreviewIcon className={'addon-preview-glyph addon-glyph-' + (action === 'navigate' ? 'arrow' : hotspot.icon || 'arrow')} size={42} strokeWidth={1.7} style={{ color: action === 'navigate' ? '#344b3d' : '#718078' }}/>}
        </div>
        <div className="addon-icon-actions">
          {action === 'navigate' ? <span className="addon-label">Navigation arrow</span> : <>
            <label className="addon-label" htmlFor="hotspot-icon">Icon style</label>
            <select id="hotspot-icon" className="select-input" value={hotspot.icon || 'arrow'} onChange={(event) => onChange({ icon: event.target.value as Hotspot['icon'], iconDataUrl: '' })}>
              <option value="arrow">Arrow</option><option value="info">Information</option><option value="pin">Pin</option><option value="star">Star</option><option value="camera">Camera</option>
            </select>
            <button className="addon-link-button" type="button" onClick={() => uploadRef.current?.click()}><ImagePlus size={14}/> Change image</button>
            {hotspot.iconDataUrl && <button className="addon-link-button addon-remove-icon" type="button" onClick={() => onChange({ iconDataUrl: '' })}><X size={14}/> Remove custom image</button>}
          </>}
        </div>
        {action !== 'navigate' && <input ref={uploadRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => chooseIcon(event.target.files?.[0])}/>}
      </div>
      {uploadError && <p className="addon-error" role="alert">{uploadError}</p>}
    </section>

    <section className="addon-section">
      <div className="addon-section-heading"><h3>Appearance</h3></div>
      <div className="addon-range-row"><label htmlFor="hotspot-width">Width</label><input id="hotspot-width" type="range" min="16" max="120" value={value(hotspot.width, 44)} onChange={(event) => onChange({ width: Number(event.target.value) })}/><output>{value(hotspot.width, 44)} px</output></div>
      <div className="addon-range-row"><label htmlFor="hotspot-height">Height</label><input id="hotspot-height" type="range" min="16" max="120" value={value(hotspot.height, 44)} onChange={(event) => onChange({ height: Number(event.target.value) })}/><output>{value(hotspot.height, 44)} px</output></div>
      <div className="addon-range-row"><label htmlFor="hotspot-opacity">Opacity</label><input id="hotspot-opacity" type="range" min="5" max="100" value={value(hotspot.opacity, 100)} onChange={(event) => onChange({ opacity: Number(event.target.value) })}/><output>{value(hotspot.opacity, 100)}%</output></div>
    </section>

    <section className="addon-section">
      <div className="addon-section-heading"><h3>Rotation</h3><div className="addon-heading-actions"><button type="button" onClick={() => setAdvanced((open) => !open)}>{advanced ? 'Basic' : 'Advanced'}</button><button type="button" onClick={() => onChange({ rotation: 0, rotationX: 0, rotationY: 0, rotationZ: 0 })}><RotateCcw size={13}/> Reset</button></div></div>
      <div className="addon-range-row"><label htmlFor="hotspot-rotation">Degrees</label><input id="hotspot-rotation" type="range" min="-180" max="180" value={value(hotspot.rotation, 0)} onChange={(event) => onChange({ rotation: Number(event.target.value) })}/><output>{value(hotspot.rotation, 0)}°</output></div>
      {advanced && <div className="addon-advanced-rotation"><span><RotateCw size={13}/> 3D rotation</span>{(['rotationX', 'rotationY', 'rotationZ'] as const).map((axis) => <label key={axis}>{axis.slice(-1)}<input aria-label={`Rotate ${axis.slice(-1)} axis`} type="number" min="-180" max="180" value={value(hotspot[axis], 0)} onChange={(event) => onChange({ [axis]: Math.max(-180, Math.min(180, Number(event.target.value) || 0)) })}/><span>°</span></label>)}</div>}
    </section>

    <section className="addon-section">
      <div className="addon-section-heading"><h3>Position</h3></div>
      <div className="addon-position-options" role="group" aria-label="Hotspot display plane">{(['2d', 'floor', 'wall'] as const).map((mode) => <button key={mode} type="button" aria-pressed={(hotspot.placementMode || '2d') === mode} onClick={() => setPlacement(mode)}><span className="addon-checkmark">✓</span>{mode === '2d' ? '2D' : mode === 'floor' ? 'Floor' : 'Wall'}</button>)}</div>
      <label className="addon-check-row"><input type="checkbox" checked={hotspot.scaleOnZoom !== false} onChange={(event) => onChange({ scaleOnZoom: event.target.checked })}/><span>Scale on zoom</span></label>
    </section>

    <section className="addon-section addon-label-section">
      <div className="addon-section-heading"><h3>Label</h3></div>
      <div className="addon-format-toolbar" role="group" aria-label="Label formatting">
        <span className="format-mark">T</span>
        <label className="format-color" title="Text color"><Type size={15}/><input aria-label="Label text color" type="color" value={labelColor} onChange={(event) => onChange({ labelColor: event.target.value })}/></label>
        <label className="format-color format-background" title="Label background"><span>◩</span><input aria-label="Label background color" type="color" value={labelBackground} onChange={(event) => onChange({ labelBackground: event.target.value })}/></label>
        <button type="button" className={hotspot.labelBold ? 'format-active' : ''} aria-pressed={!!hotspot.labelBold} aria-label="Bold label" onClick={() => onChange({ labelBold: !hotspot.labelBold })}><Bold size={15}/></button>
        <label className="format-size">{value(hotspot.labelFontSize, 11)} px<input aria-label="Label font size" type="range" min="6" max="36" value={value(hotspot.labelFontSize, 11)} onChange={(event) => onChange({ labelFontSize: Number(event.target.value) })}/></label>
        <button type="button" className={hotspot.labelItalic ? 'format-active' : ''} aria-pressed={!!hotspot.labelItalic} aria-label="Italic label" onClick={() => onChange({ labelItalic: !hotspot.labelItalic })}><Italic size={14}/></button>
        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => <button key={align} type="button" aria-label={`Align label ${align}`} aria-pressed={(hotspot.labelAlignment || 'center') === align} className={(hotspot.labelAlignment || 'center') === align ? 'format-active' : ''} onClick={() => onChange({ labelAlignment: align })}><Icon size={14}/></button>)}
      </div>
      <textarea id="hotspot-label" className="addon-label-input" maxLength={120} rows={3} placeholder="Enter text here" value={hotspot.label} onChange={(event) => onChange({ label: event.target.value })}/>
    </section>

    <section className="addon-section addon-flags">
      <label className="addon-check-row"><input type="checkbox" checked={hotspot.shadow !== false} onChange={(event) => onChange({ shadow: event.target.checked })}/><span>Shadow</span></label>
      <label className="addon-check-row"><input type="checkbox" checked={!!hotspot.onlyHover} onChange={(event) => onChange({ onlyHover: event.target.checked })}/><span>Only hover</span></label>
      <label className="addon-check-row"><input type="checkbox" checked={!!hotspot.force2D} onChange={(event) => onChange({ force2D: event.target.checked })}/><span>Force 2D</span></label>
    </section>

    <section className="addon-section addon-action-section">
      <div className="addon-section-heading"><h3>Action</h3><button className="addon-reset-button" type="button" onClick={resetAppearance}>Reset appearance</button></div>
      <label className="visually-hidden" htmlFor="hotspot-action">Hotspot action</label>
      <select id="hotspot-action" className="select-input" value={hotspot.action || (hotspot.targetSceneId ? 'navigate' : 'none')} onChange={(event) => onChange({ action: event.target.value as Hotspot['action'] })}>
        <option value="none">No action</option><option value="navigate">Navigate to scene</option><option value="url">Open a web link</option><option value="info">Show information</option>
      </select>
      {action === 'url' && <><label className="addon-label" htmlFor="hotspot-action-url">Web address</label><input id="hotspot-action-url" className="text-input" type="url" maxLength={2048} placeholder="https://example.com" value={hotspot.actionUrl || ''} onChange={(event) => onChange({ actionUrl: event.target.value })}/></>}
      {action === 'info' && <><label className="addon-label" htmlFor="hotspot-action-info">Information to show</label><textarea id="hotspot-action-info" className="text-input addon-info-input" maxLength={1000} rows={3} placeholder="Add a short note for visitors" value={hotspot.actionInfo || ''} onChange={(event) => onChange({ actionInfo: event.target.value })}/></>}
      {action === 'navigate' && hotspot.targetSceneId && <div className="addon-arrival-direction">
        <h4>Arrival view</h4><p className="field-help">Follows a return hotspot when present; otherwise turns back from the exit direction. You can override each connection below.</p>
        <label className="addon-check-row"><input type="checkbox" checked={hotspot.autoFaceBack !== false} onChange={(event) => onChange(event.target.checked ? { autoFaceBack: true } : { autoFaceBack: false, arrivalYaw: signedAngle(hotspot.yaw + 180), arrivalPitch: 0 })}/><span>Face back toward previous room automatically</span></label>
        {hotspot.autoFaceBack === false && <div className="field-row addon-arrival-fields"><div className="field-group"><label className="field-label" htmlFor="hotspot-arrival-yaw">Arrival yaw (°)</label><input id="hotspot-arrival-yaw" className="text-input" type="number" min="-180" max="180" step="1" value={hotspot.arrivalYaw ?? signedAngle(hotspot.yaw + 180)} onChange={(event) => onChange({ arrivalYaw: Math.max(-180, Math.min(180, Number(event.target.value) || 0)) })}/></div><div className="field-group"><label className="field-label" htmlFor="hotspot-arrival-pitch">Arrival pitch (°)</label><input id="hotspot-arrival-pitch" className="text-input" type="number" min="-90" max="90" step="1" value={hotspot.arrivalPitch ?? 0} onChange={(event) => onChange({ arrivalPitch: Math.max(-90, Math.min(90, Number(event.target.value) || 0)) })}/></div></div>}
      </div>}
    </section>
  </div>;
}
