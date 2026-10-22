export interface Hotspot {
  id: string;
  label: string;
  targetSceneId: string;
  pitch: number;
  yaw: number;
}

export interface Scene {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  blob: Blob;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  heading: number;
  hotspots: Hotspot[];
  googlePhotoId?: string;
  googleShareLink?: string;
}

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  scenes: Scene[];
  startSceneId: string | null;
}

export const newId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const createProject = (): Project => ({ id: newId(), name: 'Untitled tour', updatedAt: Date.now(), scenes: [], startSceneId: null });

export const cloneProject = (project: Project): Project => ({
  ...project,
  scenes: project.scenes.map((scene) => ({ ...scene, hotspots: scene.hotspots.map((hotspot) => ({ ...hotspot })) }))
});

const DB_NAME = 'luxe360-studio';
const DB_VERSION = 1;
const PROJECT_KEY = 'current-project';
const CLIENT_KEY = 'google-client-id';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available in this browser. Export a project backup to protect your work.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Browser storage could not be opened.'));
    request.onblocked = () => reject(new Error('Storage upgrade is blocked by another Luxe360 tab. Close the other tab and retry.'));
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();
  try {
    const record = { ...project, scenes: project.scenes.map(({ imageUrl: _imageUrl, ...scene }) => scene) };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(record, PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Project save failed.'));
      tx.onabort = () => reject(tx.error || new Error('Project save was aborted.'));
    });
  } finally { db.close(); }
}

export async function loadProject(): Promise<Project | null> {
  const db = await openDb();
  let value: any;
  try {
    value = await new Promise((resolve, reject) => {
      const req = db.transaction('projects', 'readonly').objectStore('projects').get(PROJECT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Project could not be loaded.'));
    });
  } finally { db.close(); }
  if (!value || !Array.isArray(value.scenes)) return null;
  const scenes: Scene[] = [];
  for (const raw of value.scenes) {
    if (!(raw.blob instanceof Blob) || typeof raw.id !== 'string') continue;
    scenes.push({ ...raw, imageUrl: URL.createObjectURL(raw.blob), hotspots: Array.isArray(raw.hotspots) ? raw.hotspots : [] });
  }
  const ids = new Set(scenes.map((scene) => scene.id));
  for (const scene of scenes) scene.hotspots = scene.hotspots.filter((hotspot) => hotspot.targetSceneId === '' || ids.has(hotspot.targetSceneId));
  return { ...value, scenes, startSceneId: ids.has(value.startSceneId) ? value.startSceneId : scenes[0]?.id || null };
}

export async function saveGoogleClientId(value: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      if (value) tx.objectStore('settings').put(value, CLIENT_KEY);
      else tx.objectStore('settings').delete(CLIENT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('OAuth setting could not be saved.'));
    });
  } finally { db.close(); }
}

export async function loadGoogleClientId(): Promise<string> {
  const db = await openDb();
  try {
    return await new Promise<string>((resolve, reject) => {
      const req = db.transaction('settings', 'readonly').objectStore('settings').get(CLIENT_KEY);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '');
      req.onerror = () => reject(req.error || new Error('OAuth setting could not be loaded.'));
    });
  } finally { db.close(); }
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image data could not be encoded.'));
  reader.onerror = () => reject(reader.error || new Error('Image data could not be encoded.'));
  reader.readAsDataURL(blob);
});

function dataUrlToBlob(value: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) throw new Error('A panorama in this backup has invalid image data.');
  const type = match[1] || 'application/octet-stream';
  if (match[2]) {
    const raw = atob(match[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type });
  }
  return new Blob([decodeURIComponent(match[3])], { type });
}

export async function exportProjectJson(project: Project): Promise<Blob> {
  const scenes = [];
  for (const scene of project.scenes) {
    scenes.push({
      id: scene.id, name: scene.name, mimeType: scene.mimeType, size: scene.size,
      width: scene.width, height: scene.height, imageDataUrl: await blobToDataUrl(scene.blob),
      latitude: scene.latitude, longitude: scene.longitude, heading: scene.heading,
      hotspots: scene.hotspots, googlePhotoId: scene.googlePhotoId, googleShareLink: scene.googleShareLink
    });
  }
  return new Blob([JSON.stringify({ format: 'luxe360-project', version: 1, exportedAt: new Date().toISOString(), project: { ...project, scenes } }, null, 2)], { type: 'application/json' });
}

export async function importProjectJson(file: File): Promise<Project> {
  if (file.size > 1024 * 1024 * 1024) throw new Error('This project exceeds the 1 GB safety limit.');
  let parsed: any;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('The selected file is not valid JSON.'); }
  if (parsed?.format !== 'luxe360-project' || parsed?.version !== 1 || !Array.isArray(parsed?.project?.scenes)) {
    throw new Error('This is not a supported Luxe360 Studio project backup.');
  }
  const p = parsed.project;
  const scenes: Scene[] = [];
  for (const raw of p.scenes) {
    if (!raw.id || typeof raw.name !== 'string' || typeof raw.imageDataUrl !== 'string') throw new Error('A scene in this backup is missing a required field.');
    const blob = dataUrlToBlob(raw.imageDataUrl);
    let width = Number(raw.width) || 0;
    let height = Number(raw.height) || 0;
    if (!width || !height) {
      const bitmap = await createImageBitmap(blob);
      width = bitmap.width; height = bitmap.height; bitmap.close();
    }
    scenes.push({
      id: String(raw.id), name: raw.name, mimeType: raw.mimeType || blob.type || 'image/jpeg', size: blob.size,
      width, height, blob, imageUrl: URL.createObjectURL(blob),
      latitude: finiteOptional(raw.latitude), longitude: finiteOptional(raw.longitude),
      heading: Number.isFinite(Number(raw.heading)) ? Number(raw.heading) : 0,
      hotspots: Array.isArray(raw.hotspots) ? raw.hotspots.map((h: any) => ({
        id: String(h.id || newId()), label: String(h.label || ''), targetSceneId: String(h.targetSceneId || ''),
        pitch: Number.isFinite(Number(h.pitch)) ? Number(h.pitch) : 0,
        yaw: Number.isFinite(Number(h.yaw)) ? Number(h.yaw) : 0
      })) : [],
      googlePhotoId: raw.googlePhotoId ? String(raw.googlePhotoId) : undefined,
      googleShareLink: raw.googleShareLink ? String(raw.googleShareLink) : undefined
    });
  }
  const ids = new Set(scenes.map((scene) => scene.id));
  for (const scene of scenes) scene.hotspots = scene.hotspots.filter((h) => !h.targetSceneId || ids.has(h.targetSceneId));
  return { id: String(p.id || newId()), name: String(p.name || 'Imported tour'), updatedAt: Date.now(), scenes, startSceneId: ids.has(p.startSceneId) ? p.startSceneId : scenes[0]?.id || null };
}

function finiteOptional(value: unknown): number | undefined {
  return value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
}

function sampleSvg(title: string, tone: number): string {
  const palettes = [
    ['#dfe3dc', '#adb9ac', '#5b6b5c', '#9c7854'],
    ['#e9e0d2', '#c0b09a', '#75675b', '#426457'],
    ['#dce6e8', '#a8b8ba', '#52696a', '#a16c4d']
  ];
  const [sky, wall, floor, accent] = palettes[tone % palettes.length];
  const shelves = Array.from({ length: 7 }, (_, i) => {
    const x = 170 + i * 250;
    return `<rect x="${x}" y="300" width="170" height="300" rx="7" fill="${accent}"/><rect x="${x + 14}" y="320" width="142" height="258" fill="#f2e8d6"/><path d="M${x + 14} 385h142 M${x + 14} 455h142 M${x + 14} 525h142" stroke="${accent}" stroke-width="10"/><rect x="${x + 28}" y="338" width="32" height="30" fill="#a9b58c"/><rect x="${x + 78}" y="405" width="48" height="34" fill="#c28d66"/><rect x="${x + 35}" y="475" width="55" height="36" fill="#8aa2a1"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${wall}"/></linearGradient><linearGradient id="f" x2="0" y2="1"><stop stop-color="${floor}"/><stop offset="1" stop-color="#252e29"/></linearGradient></defs><rect width="2048" height="1024" fill="url(#s)"/><rect y="620" width="2048" height="404" fill="url(#f)"/><path d="M0 160 Q1024 220 2048 160 M0 245 Q1024 300 2048 245" stroke="#faf1df" stroke-width="12" fill="none"/><rect x="50" y="260" width="160" height="350" fill="#435a53"/><rect x="68" y="280" width="124" height="310" fill="#bbd0cd"/><rect x="1838" y="260" width="160" height="350" fill="#435a53"/><rect x="1856" y="280" width="124" height="310" fill="#bbd0cd"/>${shelves}<text x="1024" y="118" text-anchor="middle" fill="#37453d" font-family="Arial" font-size="36" letter-spacing="8">${title.replace(/[<>&]/g, '')}</text></svg>`;
}

async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image(); image.src = url;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Sample image generation failed.')); });
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Sample image could not be encoded.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

export async function createSampleProject(): Promise<Project> {
  const names = ['Store entrance', 'Main showroom', 'Service counter'];
  const scenes: Scene[] = [];
  for (let i = 0; i < names.length; i++) {
    const blob = await svgToPng(sampleSvg(names[i].toUpperCase(), i));
    scenes.push({ id: newId(), name: names[i], mimeType: blob.type, size: blob.size, width: 2048, height: 1024, blob, imageUrl: URL.createObjectURL(blob), heading: 0, hotspots: [] });
  }
  scenes[0].hotspots.push({ id: newId(), label: 'Enter showroom', targetSceneId: scenes[1].id, pitch: -2, yaw: 42 });
  scenes[1].hotspots.push({ id: newId(), label: 'Back to entrance', targetSceneId: scenes[0].id, pitch: -3, yaw: -150 }, { id: newId(), label: 'Service counter', targetSceneId: scenes[2].id, pitch: -1, yaw: 68 });
  scenes[2].hotspots.push({ id: newId(), label: 'Back to showroom', targetSceneId: scenes[1].id, pitch: -2, yaw: -125 });
  return { id: newId(), name: 'Local sample tour', updatedAt: Date.now(), scenes, startSceneId: scenes[0].id };
}

function createXmp(width: number, height: number, heading: number) {
  const h = ((heading % 360) + 360) % 360;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"><GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer><GPano:CaptureSoftware>Luxe360 Studio</GPano:CaptureSoftware><GPano:StitchingSoftware>Luxe360 Studio</GPano:StitchingSoftware><GPano:ProjectionType>equirectangular</GPano:ProjectionType><GPano:PoseHeadingDegrees>${h.toFixed(1)}</GPano:PoseHeadingDegrees><GPano:PosePitchDegrees>0.0</GPano:PosePitchDegrees><GPano:PoseRollDegrees>0.0</GPano:PoseRollDegrees><GPano:InitialViewHeadingDegrees>${h.toFixed(1)}</GPano:InitialViewHeadingDegrees><GPano:InitialViewPitchDegrees>0.0</GPano:InitialViewPitchDegrees><GPano:InitialViewRollDegrees>0.0</GPano:InitialViewRollDegrees><GPano:InitialHorizontalFOVDegrees>90.0</GPano:InitialHorizontalFOVDegrees><GPano:FullPanoWidthPixels>${width}</GPano:FullPanoWidthPixels><GPano:FullPanoHeightPixels>${height}</GPano:FullPanoHeightPixels><GPano:CroppedAreaImageWidthPixels>${width}</GPano:CroppedAreaImageWidthPixels><GPano:CroppedAreaImageHeightPixels>${height}</GPano:CroppedAreaImageHeightPixels><GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels><GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

function injectXmp(jpeg: Uint8Array, xml: string): Uint8Array {
  if (jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error('JPEG encoder did not create a valid JPEG.');
  const header = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
  const body = new TextEncoder().encode(xml);
  const payload = new Uint8Array(header.length + body.length); payload.set(header); payload.set(body, header.length);
  if (payload.length + 2 > 65535) throw new Error('Spherical metadata is too large for a JPEG APP1 segment.');
  const segment = new Uint8Array(payload.length + 4); segment.set([255, 225, (payload.length + 2) >> 8, (payload.length + 2) & 255]); segment.set(payload, 4);
  const parts: Uint8Array[] = [jpeg.slice(0, 2)]; let offset = 2; let inserted = false;
  while (offset + 4 <= jpeg.length) {
    if (jpeg[offset] !== 255) { parts.push(jpeg.slice(offset)); break; }
    const marker = jpeg[offset + 1];
    if (marker === 218 || marker === 217) { if (!inserted) { parts.push(segment); inserted = true; } parts.push(jpeg.slice(offset)); break; }
    const length = jpeg[offset + 2] * 256 + jpeg[offset + 3];
    if (length < 2 || offset + length + 2 > jpeg.length) throw new Error('JPEG structure is malformed; could not add spherical metadata.');
    const end = offset + 2 + length;
    const old = jpeg.slice(offset, end);
    const existingXmp = marker === 225 && new TextDecoder().decode(jpeg.slice(offset + 4, Math.min(end, offset + 4 + header.length))) === new TextDecoder().decode(header);
    if (!existingXmp) parts.push(old);
    if (!inserted && marker === 224) { parts.push(segment); inserted = true; }
    offset = end;
  }
  if (!inserted) parts.push(segment);
  const out = new Uint8Array(parts.reduce((sum, item) => sum + item.length, 0)); let position = 0;
  for (const item of parts) { out.set(item, position); position += item.length; }
  return out;
}

export async function prepareGoogleJpeg(scene: Scene): Promise<Blob> {
  const bitmap = await createImageBitmap(scene.blob);
  try {
    const { width, height } = bitmap;
    if (width / height < 1.97 || width / height > 2.03) throw new Error(`${scene.name} is not close to a full 2:1 equirectangular panorama.`);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas image preparation is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
    if (!jpeg) throw new Error(`Could not create an upload-ready JPEG for ${scene.name}.`);
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const tagged = injectXmp(bytes, createXmp(width, height, scene.heading || 0));
    const blobBytes = new ArrayBuffer(tagged.byteLength);
    new Uint8Array(blobBytes).set(tagged);
    return new Blob([blobBytes], { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}
