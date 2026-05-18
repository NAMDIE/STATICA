/**
 * Three Kit — `three-particles` module.
 *
 * A drifting starfield-style particle cloud rendered as a single
 * `THREE.Points` buffer. Cheap to render at 5000–50000 particles.
 */
import { control, defineModule } from '@core/plugin-sdk'
import { sharedCss } from '../shared/css'
import { THREE_VERSION_RANGE } from '../shared/constants'
import { buildStageHtml, editorPlaceholderHtml, type StageAspect } from '../shared/publish'
import { makeSandboxRuntime } from '../shared/sandbox'

const SANDBOX_SOURCE = `
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background || '#020617');

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 0, 30);

  const count = Math.max(100, Math.min(80000, Number(options.count) || 6000));
  const positions = new Float32Array(count * 3);
  const radius = Number(options.spread) || 36;
  for (let i = 0; i < count; i++) {
    // Uniform-ish sphere distribution; cheap and reads as a starfield.
    const r = Math.cbrt(Math.random()) * radius;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(options.color || '#e2e8f0'),
    size: Number(options.size) || 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

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
  const speed = Number(options.speed) || 0.4;
  function tick(t) {
    if (!running) return;
    points.rotation.y = t * 0.0001 * speed;
    points.rotation.x = Math.sin(t * 0.00005 * speed) * 0.2;
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

const ASPECT: StageAspect = 'wide'

export default defineModule({
  id: 'acme.three-kit.particles',
  name: 'Particle Field',
  description: 'Animated 3D particle cloud — starfield, dust, or floating points.',
  category: 'Three Kit',
  htmlTag: 'div',
  defaults: {
    count: 6000,
    color: '#e2e8f0',
    background: '#020617',
    size: 0.08,
    speed: 0.4,
    spread: 36,
  },
  schema: {
    count: control.number('Particle count', { min: 100, max: 80000, step: 100 }),
    color: control.color('Particle color'),
    background: control.color('Background'),
    size: control.number('Particle size', { min: 0.01, max: 1, step: 0.01 }),
    speed: control.number('Rotation speed', { min: 0, max: 4, step: 0.1 }),
    spread: control.number('Field spread', { min: 5, max: 80, step: 1 }),
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
      type: 'particles',
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
