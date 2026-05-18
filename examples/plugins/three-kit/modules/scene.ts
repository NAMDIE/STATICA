/**
 * Three Kit — `three-scene` module.
 *
 * Pure HTML render: a `<div data-threekit-type="scene">` wrapper holding a
 * `<canvas>` and the user's props serialised as `data-threekit-options`.
 * The plugin's `frontend/threekit.ts` bundle scans for these markers at
 * page load and boots one Three.js scene per match.
 *
 * The editor canvas preview is driven by `editorRuntime.sandbox` — an
 * iframe with the host's importmap, importing `three` exactly the way
 * the frontend bundle does.
 */
import { control, defineModule } from '@core/plugin-sdk'
import { sharedCss } from '../shared/css'
import { THREE_VERSION_RANGE } from '../shared/constants'
import { buildStageHtml, editorPlaceholderHtml, type StageAspect } from '../shared/publish'
import { makeSandboxRuntime } from '../shared/sandbox'

const ASPECT: StageAspect = 'square'

const SANDBOX_SOURCE = `
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background || '#0f172a');

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, Number(options.cameraDistance) || 4.5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const directional = new THREE.DirectionalLight(0xffffff, 1.4);
  directional.position.set(3, 4, 5);
  scene.add(directional);

  function geometryFor(kind) {
    switch (kind) {
      case 'sphere': return new THREE.SphereGeometry(1.1, 48, 32);
      case 'torus':  return new THREE.TorusGeometry(0.95, 0.32, 24, 80);
      case 'cone':   return new THREE.ConeGeometry(1.1, 1.8, 48);
      case 'cube':
      default:       return new THREE.BoxGeometry(1.5, 1.5, 1.5);
    }
  }

  const geometry = geometryFor(options.geometry);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color || '#22d3ee'),
    metalness: 0.4,
    roughness: 0.35,
    flatShading: options.geometry === 'cube',
  });
  const mesh = new THREE.Mesh(geometry, material);
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
  const speed = Number(options.speed) || 0.6;
  function tick(t) {
    if (!running) return;
    const s = speed * 0.001;
    mesh.rotation.x = t * s * 0.6;
    mesh.rotation.y = t * s;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
`

export default defineModule({
  id: 'acme.three-kit.scene',
  name: 'Three.js Scene',
  description: 'Rotating Three.js primitive with light and color controls.',
  category: 'Three Kit',
  htmlTag: 'div',
  defaults: {
    geometry: 'cube' as 'cube' | 'sphere' | 'torus' | 'cone',
    color: '#22d3ee',
    background: '#0f172a',
    speed: 0.6,
    cameraDistance: 4.5,
  },
  schema: {
    geometry: control.select('Geometry', [
      { label: 'Cube', value: 'cube' },
      { label: 'Sphere', value: 'sphere' },
      { label: 'Torus', value: 'torus' },
      { label: 'Cone', value: 'cone' },
    ]),
    color: control.color('Material color'),
    background: control.color('Background'),
    speed: control.number('Rotation speed', { min: 0, max: 5, step: 0.1 }),
    cameraDistance: control.number('Camera distance', { min: 2, max: 12, step: 0.1 }),
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
      type: 'scene',
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
