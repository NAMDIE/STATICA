/**
 * Shared CSS for every Three.js module.
 *
 * The publisher dedupes module CSS by string equality, so every module
 * returns the same `sharedCss` from `render()` and the published page ends
 * up with one `<style>` block instead of N copies.
 */
export const sharedCss = `
  .threekit-stage{position:relative;display:block;width:100%;background:var(--threekit-bg,#0f172a);border-radius:var(--threekit-radius,12px);overflow:hidden;line-height:0;font-family:inherit;}
  .threekit-stage canvas{display:block;width:100%;height:100%;}
  .threekit-stage[data-aspect="square"]{aspect-ratio:1/1;}
  .threekit-stage[data-aspect="wide"]{aspect-ratio:16/9;}
  .threekit-stage[data-aspect="ultrawide"]{aspect-ratio:21/9;}
  .threekit-stage[data-aspect="portrait"]{aspect-ratio:4/5;}
  .threekit-stage[data-aspect="banner"]{aspect-ratio:32/9;}
  .threekit-stage--editor-empty{display:grid;place-items:center;min-height:240px;color:#cbd5e1;font:500 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.04em;text-transform:uppercase;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);}
  .threekit-stage--editor-empty::before{content:"three.js \\2014 preview on publish";opacity:0.75;}
  .threekit-hero{position:relative;display:block;width:100%;min-height:clamp(320px,55vh,520px);background:var(--threekit-bg,#020617);overflow:hidden;color:#f8fafc;font-family:inherit;}
  .threekit-hero canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
  .threekit-hero__content{position:relative;display:grid;gap:12px;align-content:center;justify-items:center;text-align:center;padding:clamp(48px,8vw,96px) clamp(20px,4vw,48px);min-height:inherit;z-index:1;}
  .threekit-hero__eyebrow{letter-spacing:0.22em;text-transform:uppercase;font-size:0.75rem;font-weight:600;color:rgba(248,250,252,0.7);}
  .threekit-hero__title{margin:0;font-size:clamp(2rem,5vw,3.4rem);font-weight:700;line-height:1.1;}
  .threekit-hero__body{margin:0;max-width:520px;color:rgba(226,232,240,0.85);font-size:1.05rem;line-height:1.6;}
`
