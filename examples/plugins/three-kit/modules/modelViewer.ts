/**
 * Three Kit — `three-model-viewer` module.
 *
 * Loads a glTF / GLB model from a URL and shows it with OrbitControls so
 * the visitor can rotate / zoom. Uses Three.js examples/jsm subpath
 * (`GLTFLoader`, `OrbitControls`).
 */
import { control, defineModule } from '@core/plugin-sdk'
import { sharedCss } from '../shared/css'
import { THREE_VERSION_RANGE } from '../shared/constants'
import { buildStageHtml, editorPlaceholderHtml, type StageAspect } from '../shared/publish'
import { makeSandboxRuntime } from '../shared/sandbox'

const SANDBOX_SOURCE = `
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background || '#0f172a');

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1000);
  camera.position.set(2.5, 1.8, 2.5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfdbfe, 0.4);
  fill.position.set(-3, 2, -2);
  scene.add(fill);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = options.autoRotate !== false;
  controls.autoRotateSpeed = Number(options.autoRotateSpeed) || 1.5;
  controls.target.set(0, 0, 0);

  let activeModel = null;
  const loader = new GLTFLoader();
  const url = String(options.url || '');
  if (url) {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.8 / maxDim;
        root.position.sub(center.multiplyScalar(scale));
        root.scale.setScalar(scale);
        scene.add(root);
        activeModel = root;
      },
      undefined,
      (err) => { console.warn('[three-kit:model-viewer] load failed', err); },
    );
  }

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
  function tick() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    controls.dispose();
    if (activeModel) {
      activeModel.traverse((node) => {
        if (node.isMesh) {
          node.geometry?.dispose?.();
          const m = node.material;
          if (Array.isArray(m)) m.forEach((mm) => mm?.dispose?.());
          else m?.dispose?.();
        }
      });
    }
    renderer.dispose();
  };
`

const ASPECT: StageAspect = 'wide'

export default defineModule({
  id: 'acme.three-kit.model-viewer',
  name: 'Model Viewer',
  description: 'Interactive glTF/GLB model with OrbitControls (drag to rotate, scroll to zoom).',
  category: 'Three Kit',
  htmlTag: 'div',
  defaults: {
    url: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf',
    background: '#0f172a',
    autoRotate: true,
    autoRotateSpeed: 1.5,
  },
  schema: {
    url: control.url('Model URL (.gltf or .glb)', {
      description: 'Public HTTPS URL to a glTF/GLB asset. CORS must allow your site origin.',
    }),
    background: control.color('Background'),
    autoRotate: control.toggle('Auto-rotate', {
      description: 'When on, the model spins by itself until the visitor interacts.',
    }),
    autoRotateSpeed: control.number('Auto-rotate speed', { min: 0, max: 8, step: 0.1 }),
  },
  dependencies: {
    three: THREE_VERSION_RANGE,
  },
  editorRuntime: makeSandboxRuntime({
    aspect: ASPECT,
    initSource: SANDBOX_SOURCE,
    extraImports: [
      { specifier: 'controls/OrbitControls', named: 'OrbitControls' },
      { specifier: 'loaders/GLTFLoader', named: 'GLTFLoader' },
    ],
  }),
  render: ({ props }) => ({
    html: buildStageHtml({
      type: 'model-viewer',
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
