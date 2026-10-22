import JSZip from 'jszip';
import pannellumJs from 'pannellum/build/pannellum.js?raw';
import pannellumCss from 'pannellum/build/pannellum.css?raw';
import pannellumLicense from 'pannellum/COPYING?raw';
import type { Hotspot, Project } from './studio';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeDataImage(value: string | undefined) {
  return value && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value) ? value : '';
}

const signedAngle = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;

function exportHotspot(hotspot: Hotspot, source: Project['scenes'][number], scenes: Project['scenes']) {
  const destination = scenes.find((scene) => scene.id === hotspot.targetSceneId);
  const returnHotspot = destination?.hotspots.find((item) => item.targetSceneId === source.id);
  const arrivalYaw = hotspot.autoFaceBack === false ? (hotspot.arrivalYaw ?? 0) : (returnHotspot?.yaw ?? signedAngle(hotspot.yaw + 180));
  const arrivalPitch = hotspot.autoFaceBack === false ? (hotspot.arrivalPitch ?? 0) : (returnHotspot?.pitch ?? 0);
  return {
    id: hotspot.id,
    pitch: hotspot.pitch,
    yaw: hotspot.yaw,
    label: hotspot.label,
    targetSceneId: hotspot.targetSceneId,
    action: hotspot.action || (hotspot.targetSceneId ? 'navigate' : 'none'),
    actionUrl: (hotspot.actionUrl || '').slice(0, 2048),
    actionInfo: (hotspot.actionInfo || '').slice(0, 1000),
    arrivalYaw, arrivalPitch,
    style: {
      icon: hotspot.icon || 'arrow', iconDataUrl: safeDataImage(hotspot.iconDataUrl), tint: safeColor(hotspot.tint, '#e0c45d'),
      width: Math.max(16, Math.min(120, hotspot.width ?? 44)), height: Math.max(16, Math.min(120, hotspot.height ?? 44)),
      opacity: Math.max(5, Math.min(100, hotspot.opacity ?? 100)), rotation: Math.max(-180, Math.min(180, hotspot.rotation ?? 0)),
      rotationX: Math.max(-180, Math.min(180, hotspot.rotationX ?? (hotspot.placementMode === 'floor' ? 65 : 0))), rotationY: Math.max(-180, Math.min(180, hotspot.rotationY ?? 0)),
      rotationZ: Math.max(-180, Math.min(180, hotspot.rotationZ ?? 0)), placementMode: hotspot.placementMode || '2d',
      scaleOnZoom: hotspot.scaleOnZoom !== false, labelFontSize: Math.max(6, Math.min(36, hotspot.labelFontSize ?? 11)),
      labelColor: safeColor(hotspot.labelColor, '#29362e'), labelBackground: safeColor(hotspot.labelBackground, '#ffffff'),
      labelBold: Boolean(hotspot.labelBold), labelItalic: Boolean(hotspot.labelItalic), labelAlignment: hotspot.labelAlignment || 'center',
      shadow: hotspot.shadow !== false, onlyHover: Boolean(hotspot.onlyHover), force2D: Boolean(hotspot.force2D)
    }
  };
}

export async function exportTourZip(project: Project): Promise<Blob> {
  if (!project.scenes.length) throw new Error('Add at least one panorama before exporting a tour.');
  const zip = new JSZip();
  const files: Record<string, string> = {};
  const used = new Set<string>();
  for (const [index, scene] of project.scenes.entries()) {
    let slug = scene.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `scene-${index + 1}`;
    if (used.has(slug)) slug += `-${index + 1}`;
    used.add(slug);
    const ext = scene.mimeType === 'image/png' ? 'png' : scene.mimeType === 'image/webp' ? 'webp' : 'jpg';
    files[scene.id] = `assets/${slug}.${ext}`;
    zip.file(files[scene.id], scene.blob);
  }
  const tour = {
    title: project.name,
    default: { firstScene: project.startSceneId && files[project.startSceneId] ? project.startSceneId : project.scenes[0].id, yaw: signedAngle(project.scenes.find((scene) => scene.id === project.startSceneId)?.heading ?? project.scenes[0].heading), pitch: 0, autoLoad: true, showControls: true, sceneFadeDuration: 350 },
    scenes: Object.fromEntries(project.scenes.map((scene) => [scene.id, {
      title: scene.name, type: 'equirectangular', panorama: files[scene.id], yaw: signedAngle(scene.heading), pitch: 0,
      hotSpots: scene.hotspots.filter((h) => h.targetSceneId ? Boolean(files[h.targetSceneId]) : true).map((h) => exportHotspot(h, scene, project.scenes))
    }]))
  };
  const tourJson = JSON.stringify(tour).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const standaloneScript = `const tour=${tourJson};
const iconPaths={arrow:'<path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',info:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5m0-8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2" fill="currentColor"/>',star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',camera:'<path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>'};
let viewer; Object.values(tour.scenes).forEach(scene=>{scene.hotSpots=scene.hotSpots.map(h=>({id:h.id,pitch:h.pitch,yaw:h.yaw,type:'info',cssClass:'luxe-export-hotspot',text:h.label||'Tour hotspot',createTooltipFunc:function(el){const s=h.style||{};el.dataset.scaleOnZoom=String(s.scaleOnZoom!==false);el.classList.add('export-position-'+(s.placementMode||'2d'));if(s.shadow!==false)el.classList.add('export-shadow');if(s.onlyHover)el.classList.add('export-hover');if(s.force2D)el.classList.add('export-flat');const icon=document.createElement('span');icon.className='export-icon';icon.style.width=(s.width||44)+'px';icon.style.height=(s.height||44)+'px';icon.style.opacity=String((s.opacity||100)/100);icon.style.color=s.tint||'#e0c45d';icon.style.borderColor=s.tint||'#e0c45d';icon.style.transform=s.force2D?'rotate('+(s.rotation||0)+'deg) scale(var(--addon-zoom,1))':'perspective(500px) rotateX('+(s.rotationX||0)+'deg) rotateY('+(s.rotationY||0)+'deg) rotateZ('+(s.rotationZ||0)+'deg) rotate('+(s.rotation||0)+'deg) scale(var(--addon-zoom,1))';if(s.iconDataUrl){const image=document.createElement('span');image.className='export-custom-icon';image.style.backgroundColor=s.tint||'#e0c45d';image.style.maskImage='url(\"'+s.iconDataUrl+'\")';image.style.webkitMaskImage='url(\"'+s.iconDataUrl+'\")';icon.appendChild(image)}else{icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[s.icon]||iconPaths.arrow)+'</svg>'}el.appendChild(icon);if(h.label){const label=document.createElement('span');label.className='export-label';label.textContent=h.label;label.style.color=s.labelColor||'#29362e';label.style.backgroundColor=s.labelBackground||'#fff';label.style.fontSize=(s.labelFontSize||11)+'px';label.style.fontWeight=s.labelBold?'700':'600';label.style.fontStyle=s.labelItalic?'italic':'normal';label.style.textAlign=s.labelAlignment||'center';label.style.transform='scale(var(--addon-zoom,1))';el.appendChild(label)}},clickHandlerFunc:function(){if(h.action==='navigate'&&h.targetSceneId&&viewer)viewer.loadScene(h.targetSceneId,h.arrivalPitch||0,h.arrivalYaw||0);else if(h.action==='url'&&h.actionUrl){try{const u=new URL(h.actionUrl);if(u.protocol==='https:'||u.protocol==='http:')window.open(u.href,'_blank','noopener,noreferrer')}catch(e){}}else if(h.action==='info')window.alert(h.actionInfo||h.label||'More information')}}))});
viewer=pannellum.viewer('panorama',tour);viewer.on('zoomchange',function(){const scale=Math.max(.55,Math.min(2,96/(viewer.getHfov()||96)));document.querySelectorAll('.luxe-export-hotspot[data-scale-on-zoom="true"]').forEach(el=>el.style.setProperty('--addon-zoom',String(scale)))})`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111416"><title>${escapeHtml(project.name)}</title><link rel="stylesheet" href="vendor/pannellum.css"><link rel="stylesheet" href="vendor/tour.css"></head><body><header><strong>${escapeHtml(project.name)}</strong><span>360° virtual tour</span></header><main id="panorama"></main><footer>Tour created with Luxee360 Studio · Select a marker to follow its action</footer><script src="vendor/pannellum.js"></script><script>${standaloneScript}</script></body></html>`;
  zip.file('index.html', html);
  zip.file('tour.json', JSON.stringify(tour, null, 2));
  zip.file('vendor/pannellum.js', pannellumJs);
  zip.file('vendor/pannellum.css', pannellumCss);
  zip.file('vendor/PANNELLUM-LICENSE.txt', pannellumLicense);
  zip.file('vendor/tour.css', 'html,body{margin:0;height:100%;font-family:system-ui,sans-serif;color:#e9e9e6;background:#111416}header{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#181c1f;border-bottom:1px solid #2a3033}header strong{font-size:14px}header span,footer{font-size:11px;color:#a3abad}footer{height:32px;display:flex;align-items:center;justify-content:center}#panorama{height:calc(100% - 84px);width:100%}.pnlm-hotspot.luxe-export-hotspot{width:auto!important;height:auto!important;min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;cursor:pointer}.export-icon{box-sizing:border-box;display:grid;place-items:center;border:1px solid #ffffffa8;border-radius:50%;background:#fdfefa;color:#284c3f;box-shadow:0 4px 17px #0003,0 0 0 5px #fff3;transition:transform .15s;backface-visibility:hidden}.export-icon svg{width:58%;height:58%}.export-icon img{display:block;width:82%;height:82%;object-fit:contain}.export-custom-icon{display:block;width:74%;height:74%;mask-size:contain;-webkit-mask-size:contain;mask-position:center;-webkit-mask-position:center;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat}.pnlm-hotspot.luxe-export-hotspot:not(.export-shadow) .export-icon,.pnlm-hotspot.luxe-export-hotspot:not(.export-shadow) .export-label{box-shadow:none}.export-label{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border-radius:6px;box-shadow:0 2px 12px #0002}.export-shadow:not(.export-hover) .export-icon,.export-shadow:not(.export-hover) .export-label{box-shadow:0 4px 17px #0003,0 0 0 5px #fff3}.export-hover .export-icon,.export-hover .export-label{opacity:0!important;transform:scale(.72)!important;transition:opacity .16s,transform .16s}.export-hover:hover .export-icon,.export-hover:hover .export-label,.export-hover:focus .export-icon,.export-hover:focus .export-label{opacity:1!important;transform:scale(var(--addon-zoom,1))!important}.export-position-floor .export-icon{border-radius:8px 8px 50% 50%}.export-position-wall .export-icon{border-radius:8px}.export-flat .export-icon{perspective:none}.pnlm-hotspot.luxe-export-hotspot:after{display:none!important}');
  zip.file('README.txt', 'Luxee360 Studio standalone tour\n\nKeep the relative folder structure intact. Host these files as a static website or use a local static HTTP server if the browser blocks file:// resources. This website export is separate from Google Maps publication.\n\nHotspot appearance, labels and actions are included in this export. Pannellum is included under its MIT license; see vendor/PANNELLUM-LICENSE.txt.');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } });
}
