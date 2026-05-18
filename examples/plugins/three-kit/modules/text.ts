/**
 * Three Kit — `three-text` module.
 *
 * Spinning 3D-style text. Instead of pulling in a font loader (an extra
 * async fetch per page), we render the text onto a `CanvasTexture` and
 * apply it to a thin extruded plane that rotates. Reads as "3D text"
 * without the cost of triangulating glyph outlines.
 */
import { control, defineModule } from '@core/plugin-sdk'
import { sharedCss } from '../shared/css'
import { THREE_VERSION_RANGE } from '../shared/constants'
import { buildStageHtml, editorPlaceholderHtml, type StageAspect } from '../shared/publish'
import { makeSandboxRuntime } from '../shared/sandbox'

const SANDBOX_SOURCE = `
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background || '#0f172a');

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 5);
  scene.add(key);

  function buildTextTexture(text, color) {
    const dpr = 2;
    const w = 1024;
    const h = 256;
    const offscreen = document.createElement('canvas');
    offscreen.width = w * dpr;
    offscreen.height = h * dpr;
    const ctx = offscreen.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = '700 144px Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    const texture = new THREE.CanvasTexture(offscreen);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    return texture;
  }

  const texture = buildTextTexture(String(options.text || 'Three.js'), options.color || '#f8fafc');
  const aspect = 1024 / 256;
  const height = 1.6;
  const geometry = new THREE.BoxGeometry(height * aspect, height, options.depth || 0.18);

  const sideColor = new THREE.Color(options.sideColor || options.color || '#22d3ee');
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: sideColor,
    metalness: 0.55,
    roughness: 0.35,
  });
  const faceMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    metalness: 0.1,
    roughness: 0.6,
  });
  // BoxGeometry materials order: +X, -X, +Y, -Y, +Z (front), -Z (back).
  const mesh = new THREE.Mesh(geometry, [
    sideMaterial, sideMaterial, sideMaterial, sideMaterial, faceMaterial, faceMaterial,
  ]);
  scene.add(mesh);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let raf = 0;
  let running = true;
  const speed = Number(options.speed) || 0.5;
  function tick(t) {
    if (!running) return;
    mesh.rotation.y = Math.sin(t * 0.0006 * speed) * 0.6;
    mesh.rotation.x = Math.sin(t * 0.0004 * speed) * 0.15;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    geometry.dispose();
    sideMaterial.dispose();
    faceMaterial.dispose();
    texture.dispose();
    renderer.dispose();
  };
`

const ASPECT: StageAspect = 'wide'

export default defineModule({
  id: 'acme.three-kit.text',
  name: '3D Text',
  description: 'Spinning textured text panel — Three.js with a CanvasTexture glyph atlas.',
  category: 'Three Kit',
  htmlTag: 'div',
  defaults: {
    text: 'Three.js',
    color: '#f8fafc',
    sideColor: '#22d3ee',
    background: '#0f172a',
    depth: 0.18,
    speed: 0.5,
  },
  schema: {
    text: control.text('Text'),
    color: control.color('Face color'),
    sideColor: control.color('Edge color'),
    background: control.color('Background'),
    depth: control.number('Depth', { min: 0.02, max: 1, step: 0.02 }),
    speed: control.number('Wobble speed', { min: 0, max: 3, step: 0.1 }),
  },
  dependencies: {
    three: THREE_VERSION_RANGE,
  },
  editorRuntime: makeSandboxRuntime({
    aspect: ASPECT,
    initSource: SANDBOX_SOURCE,
  }),
  render: ({ props }) => ({
    html: buildStageHtml({
      type: 'text',
      aspect: ASPECT,
      options: { ...props },
    }),
    css: sharedCss,
  }),
  preview: () => ({
    html: editorPlaceholderHtml(ASPECT),
    css: sharedCss,
  }),
})
