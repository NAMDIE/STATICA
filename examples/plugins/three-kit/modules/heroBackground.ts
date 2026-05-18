/**
 * Three Kit — `three-hero-background` module.
 *
 * Full-width hero with an animated wave plane behind editorial text.
 * The plane is a high-res `PlaneGeometry` with per-vertex sine-wave
 * displacement done in the vertex shader — cheap on any GPU.
 */
import { control, defineModule } from '@core/plugin-sdk'
import { sharedCss } from '../shared/css'
import { THREE_VERSION_RANGE } from '../shared/constants'
import { buildHeroHtml } from '../shared/publish'
import { makeSandboxRuntime } from '../shared/sandbox'
import { html } from '@core/plugin-sdk'

const SANDBOX_SOURCE = `
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.background || '#020617');

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1.8, 4.2);
  camera.lookAt(0, 0, 0);

  const colorA = new THREE.Color(options.colorA || '#22d3ee');
  const colorB = new THREE.Color(options.colorB || '#a855f7');

  const geometry = new THREE.PlaneGeometry(12, 6, 96, 48);
  geometry.rotateX(-Math.PI / 2.4);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uAmp:    { value: Number(options.amplitude) || 0.55 },
      uFreq:   { value: Number(options.frequency) || 0.8 },
      uColorA: { value: colorA },
      uColorB: { value: colorB },
    },
    vertexShader: \`
      uniform float uTime;
      uniform float uAmp;
      uniform float uFreq;
      varying vec3 vPos;
      void main() {
        vec3 p = position;
        p.y += sin((p.x * uFreq) + uTime * 1.2) * uAmp;
        p.y += sin((p.z * uFreq * 1.3) + uTime * 0.8) * uAmp * 0.6;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    \`,
    fragmentShader: \`
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec3 vPos;
      void main() {
        float mixT = clamp(0.5 + vPos.y * 0.6, 0.0, 1.0);
        vec3 c = mix(uColorA, uColorB, mixT);
        gl_FragColor = vec4(c, 1.0);
      }
    \`,
    wireframe: options.wireframe !== false,
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
  const speed = Number(options.speed) || 0.7;
  function tick(t) {
    if (!running) return;
    material.uniforms.uTime.value = t * 0.001 * speed;
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

const EDITOR_PLACEHOLDER = html`
  <section class="threekit-hero">
    <div class="threekit-hero__content">
      <span class="threekit-hero__eyebrow">Three.js Hero</span>
      <h1 class="threekit-hero__title">Live preview renders here</h1>
      <p class="threekit-hero__body">three.js — preview on publish</p>
    </div>
  </section>
`

export default defineModule({
  id: 'acme.three-kit.hero-background',
  name: 'Hero Background',
  description: 'Full-width animated wave hero with eyebrow + title + body text on top.',
  category: 'Three Kit',
  htmlTag: 'section',
  defaults: {
    eyebrow: 'INTRODUCING',
    title: 'Built on Three.js',
    body: 'Drag this module onto any page to ship a GPU-animated hero band — clean HTML, scoped CSS, zero framework runtime.',
    background: '#020617',
    colorA: '#22d3ee',
    colorB: '#a855f7',
    amplitude: 0.55,
    frequency: 0.8,
    speed: 0.7,
    wireframe: true,
  },
  schema: {
    eyebrow: control.text('Eyebrow'),
    title: control.text('Title'),
    body: control.textarea('Body', { rows: 3 }),
    background: control.color('Background'),
    colorA: control.color('Wave color A'),
    colorB: control.color('Wave color B'),
    amplitude: control.number('Wave amplitude', { min: 0, max: 2, step: 0.05 }),
    frequency: control.number('Wave frequency', { min: 0.1, max: 4, step: 0.05 }),
    speed: control.number('Animation speed', { min: 0, max: 3, step: 0.1 }),
    wireframe: control.toggle('Wireframe'),
  },
  dependencies: {
    three: THREE_VERSION_RANGE,
  },
  editorRuntime: makeSandboxRuntime({
    aspect: 'banner',
    initSource: SANDBOX_SOURCE,
    hero: true,
    minHeight: 320,
  }),
  render: ({ props }) => ({
    html: buildHeroHtml({
      eyebrow: props.eyebrow,
      title: props.title,
      body: props.body,
      options: { ...props },
    }),
    css: sharedCss,
  }),
  preview: () => ({
    html: EDITOR_PLACEHOLDER,
    css: sharedCss,
  }),
})
