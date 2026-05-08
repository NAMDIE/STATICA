/**
 * Resolve frontend tags injected into published pages by enabled plugins.
 *
 * Two surfaces:
 *   • `frontend.scripts` — plugin ships a JS file under `entrypoints.frontend`
 *     (path inside the package zip). The file is served from the plugin's
 *     uploads URL prefix and loaded as a deferred `<script type="module">`
 *     just before `</body>`.
 *   • `frontend.tracker` — the host injects a tiny built-in tracker runtime
 *     once if any plugin has the permission. The runtime exposes
 *     `window.__pb.tracker.send(eventName, payload)` and the plugin's
 *     `frontend` script can call it.
 *
 * Pure data assembly — no DOM, no fetch. Run from the publisher only.
 */

import type { DbClient } from '../db/client'
import { listInstalledPlugins } from '../repositories/plugins'

export interface FrontendInjections {
  headTags: string[]
  bodyTags: string[]
}

const TRACKER_RUNTIME = `<script>(function(){
  if(window.__pb && window.__pb.tracker)return;
  var ENDPOINT='/_pb/tracker';
  function rid(){return (Math.random().toString(36).slice(2)+Date.now().toString(36)).slice(0,16);}
  function visitorId(){
    try{
      var k='__pb_v',v=localStorage.getItem(k);
      if(!v){v=rid();localStorage.setItem(k,v);}
      return v;
    }catch(e){return rid();}
  }
  function sessionId(){
    try{
      var k='__pb_s',v=sessionStorage.getItem(k);
      if(!v){v=rid();sessionStorage.setItem(k,v);}
      return v;
    }catch(e){return rid();}
  }
  var listeners={};
  function on(evt,fn){(listeners[evt]=listeners[evt]||[]).push(fn);return function(){listeners[evt]=(listeners[evt]||[]).filter(function(x){return x!==fn});};}
  function emit(evt,detail){(listeners[evt]||[]).forEach(function(fn){try{fn(detail);}catch(e){console.error('[__pb] listener',e);}});}
  function send(pluginId,eventName,payload){
    return fetch(ENDPOINT,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({pluginId:pluginId,eventName:eventName,payload:payload||{},visitorId:visitorId(),sessionId:sessionId(),pagePath:location.pathname,referrer:document.referrer||null,clientTime:new Date().toISOString()})}).catch(function(e){console.warn('[__pb] tracker send failed',e);});
  }
  window.__pb={
    visitorId:visitorId(),
    sessionId:sessionId(),
    hooks:{on:on,emit:emit},
    tracker:{
      send:function(name,payload){return send.apply(null,['__implicit__',name,payload]);},
      sendFor:function(pluginId,name,payload){return send(pluginId,name,payload||{});},
    }
  };
  function fire(evt,detail){emit(evt,detail);}
  // Page view
  document.addEventListener('DOMContentLoaded',function(){fire('page-view',{path:location.pathname,title:document.title});});
  // Outbound clicks
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a[href]');
    if(!a)return;
    fire('link-click',{href:a.getAttribute('href'),text:(a.textContent||'').trim().slice(0,80)});
  },{capture:true});
  // Scroll depth (25/50/75/100)
  var seen={};
  window.addEventListener('scroll',function(){
    var pct=Math.round((window.scrollY+window.innerHeight)/document.documentElement.scrollHeight*100);
    [25,50,75,100].forEach(function(t){if(pct>=t&&!seen[t]){seen[t]=true;fire('scroll-depth',{depth:t});}});
  },{passive:true});
  // Visibility
  document.addEventListener('visibilitychange',function(){fire('visibility-change',{visible:!document.hidden});});
})();</script>`

export async function collectFrontendInjections(db: DbClient): Promise<FrontendInjections> {
  const plugins = await listInstalledPlugins(db)
  const headTags: string[] = []
  const bodyTags: string[] = []

  let anyTracker = false
  for (const plugin of plugins) {
    if (!plugin.enabled || plugin.lifecycleStatus === 'error') continue
    const grants = new Set(plugin.grantedPermissions)
    if (grants.has('frontend.tracker')) anyTracker = true

    if (grants.has('frontend.scripts')
      && plugin.manifest.entrypoints?.frontend
      && plugin.manifest.assetBasePath
    ) {
      const url = `${plugin.manifest.assetBasePath.replace(/\/+$/g, '')}/${plugin.manifest.entrypoints.frontend.replace(/^\/+/g, '')}`
      bodyTags.push(`<script type="module" defer src="${escapeHtmlAttribute(url)}" data-plugin-id="${escapeHtmlAttribute(plugin.id)}"></script>`)
    }
  }

  if (anyTracker || bodyTags.length > 0) {
    // Always inject the runtime when any frontend plugin is active so the
    // plugin script can rely on `window.__pb`.
    bodyTags.unshift(TRACKER_RUNTIME)
  }

  return { headTags, bodyTags }
}

function escapeHtmlAttribute(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
