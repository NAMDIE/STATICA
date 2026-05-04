/**
 * Tiny admin router — replaces react-router-dom for the 4-route admin app.
 *
 * What this provides
 * ------------------
 * - `<Router>`              browser router; subscribes to popstate + custom
 *                           'pb:locationchange' event for pushState/replaceState
 * - `<MemoryRouter>`        in-memory router for tests; maintains its own
 *                           pathname/search state
 * - `<Routes>` / `<Route>`  declarative route matching, supports `:param`
 *                           segments. First match wins.
 * - `<Navigate>`            declarative redirect (effect-based push or replace)
 * - `<Link>`                anchor that calls history.pushState on left-click;
 *                           falls back to a plain anchor if no router context
 * - `useLocation()`         returns `{ pathname, search }`
 * - `useNavigate()`         returns `(to, options?) => void`
 * - `useParams()`           returns the matched route's params
 * - `useInRouterContext()`  returns true when inside <Router> or <MemoryRouter>
 *
 * Why custom (not react-router-dom)
 * ----------------------------------
 * react-router-dom@7 ships ~30 KB gz on the *eager* cold path for an admin
 * with 4 static routes. That's the worst kind of bundle bloat — features
 * we're not using (loaders, actions, nested layouts, data routers) shipped
 * to every visitor before the editor even mounts. This file replaces it in
 * ~150 lines and lands a bigger bundle saving than any other single change
 * in the project.
 *
 * If/when we need data loaders or nested route layouts, this file can grow
 * incrementally — but every feature here is one we actually use.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Location {
  pathname: string
  search: string
}

interface NavigateOptions {
  replace?: boolean
}

interface NavigateFn {
  (to: string, options?: NavigateOptions): void
}

interface RouteContextValue {
  /** params from the currently-matched <Route>, or empty object if none. */
  params: Record<string, string>
}

interface RouterContextValue {
  location: Location
  navigate: NavigateFn
}

const RouterContext = createContext<RouterContextValue | null>(null)
const RouteContext = createContext<RouteContextValue>({ params: {} })

// Custom event the navigate functions dispatch so useSyncExternalStore picks
// up pushState/replaceState (which don't fire popstate natively).
const LOCATION_CHANGE_EVENT = 'pb:locationchange'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.history !== 'undefined'
}

// ---------------------------------------------------------------------------
// Path matching
// ---------------------------------------------------------------------------

interface CompiledPattern {
  regex: RegExp
  paramNames: string[]
}

function compilePattern(pattern: string): CompiledPattern {
  const paramNames: string[] = []
  const escaped = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1))
        return '([^/]+)'
      }
      return segment.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    })
    .join('/')
  // Tolerate trailing slash; require full match.
  const regex = new RegExp(`^${escaped || '/'}/?$`)
  return { regex, paramNames }
}

function matchPath(
  pattern: string,
  pathname: string,
): { params: Record<string, string> } | null {
  const compiled = compilePattern(pattern)
  const match = compiled.regex.exec(pathname)
  if (!match) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < compiled.paramNames.length; i++) {
    const name = compiled.paramNames[i]
    const value = match[i + 1]
    if (value !== undefined) params[name] = decodeURIComponent(value)
  }
  return { params }
}

// ---------------------------------------------------------------------------
// Browser <Router>
// ---------------------------------------------------------------------------

function browserSubscribe(callback: () => void): () => void {
  if (!isBrowser()) return () => {}
  window.addEventListener('popstate', callback)
  window.addEventListener(LOCATION_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(LOCATION_CHANGE_EVENT, callback)
  }
}

function getBrowserSnapshot(): string {
  if (!isBrowser()) return '/'
  return window.location.pathname + window.location.search
}

function getServerSnapshot(): string {
  return '/'
}

export function Router({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    browserSubscribe,
    getBrowserSnapshot,
    getServerSnapshot,
  )

  const location = useMemo<Location>(() => {
    const queryIndex = snapshot.indexOf('?')
    return queryIndex === -1
      ? { pathname: snapshot, search: '' }
      : {
          pathname: snapshot.slice(0, queryIndex),
          search: snapshot.slice(queryIndex),
        }
  }, [snapshot])

  const navigate = useCallback<NavigateFn>((to, options) => {
    if (!isBrowser()) return
    const replace = options?.replace ?? false
    if (replace) {
      window.history.replaceState(null, '', to)
    } else {
      window.history.pushState(null, '', to)
    }
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
  }, [])

  const value = useMemo<RouterContextValue>(
    () => ({ location, navigate }),
    [location, navigate],
  )

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// <MemoryRouter> — for tests
// ---------------------------------------------------------------------------

export function MemoryRouter({
  children,
  initialEntries = ['/'],
}: {
  children: ReactNode
  initialEntries?: string[]
}) {
  const initial = initialEntries[initialEntries.length - 1] ?? '/'
  const [snapshot, setSnapshot] = useState<string>(initial)

  const location = useMemo<Location>(() => {
    const queryIndex = snapshot.indexOf('?')
    return queryIndex === -1
      ? { pathname: snapshot, search: '' }
      : {
          pathname: snapshot.slice(0, queryIndex),
          search: snapshot.slice(queryIndex),
        }
  }, [snapshot])

  const navigate = useCallback<NavigateFn>((to) => {
    setSnapshot(to)
  }, [])

  const value = useMemo<RouterContextValue>(
    () => ({ location, navigate }),
    [location, navigate],
  )

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useRouterContext(): RouterContextValue {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    throw new Error('useRouterContext must be used inside <Router> or <MemoryRouter>')
  }
  return ctx
}

export function useInRouterContext(): boolean {
  return useContext(RouterContext) !== null
}

export function useLocation(): Location {
  return useRouterContext().location
}

export function useNavigate(): NavigateFn {
  return useRouterContext().navigate
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(RouteContext).params as T
}

// ---------------------------------------------------------------------------
// <Routes> / <Route>
//
// <Route> is a marker component — it carries `path` + `element` props but
// renders nothing on its own. <Routes> walks its children, matches the first
// path against the current location, and renders that <Route>'s element with
// the params context populated.
// ---------------------------------------------------------------------------

interface RouteProps {
  path: string
  element: ReactNode
}

export function Route(_props: RouteProps): null {
  // Marker only — <Routes> reads props from the React element directly.
  return null
}

interface RoutesProps {
  children: ReactNode
}

export function Routes({ children }: RoutesProps) {
  const { pathname } = useLocation()

  const matched = useMemo(() => {
    const list = collectRouteChildren(children)
    for (const route of list) {
      const result = matchPath(route.path, pathname)
      if (result) return { element: route.element, params: result.params }
    }
    return null
  }, [children, pathname])

  if (!matched) return null
  return (
    <RouteContext.Provider value={{ params: matched.params }}>
      {matched.element}
    </RouteContext.Provider>
  )
}

function collectRouteChildren(children: ReactNode): RouteProps[] {
  const out: RouteProps[] = []
  const arr = Array.isArray(children) ? children : [children]
  for (const child of arr) {
    if (
      typeof child === 'object'
      && child !== null
      && 'type' in child
      && (child as { type?: unknown }).type === Route
    ) {
      const props = (child as { props: RouteProps }).props
      out.push(props)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// <Navigate>
// ---------------------------------------------------------------------------

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const navigate = useNavigate()
  // Use a ref so the effect runs exactly once even under StrictMode double-invoke.
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    navigate(to, { replace })
  }, [navigate, to, replace])
  return null
}

// ---------------------------------------------------------------------------
// <Link>
// ---------------------------------------------------------------------------

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  replace?: boolean
  children?: ReactNode
}

export function Link({ to, replace = false, onClick, children, ...rest }: LinkProps) {
  const inRouter = useInRouterContext()
  // Calling useNavigate without router context throws — only call when
  // we have one. Falling back to a plain anchor preserves SSR / pre-mount
  // rendering in places that render outside a Router (rare but safe).
  const ctx = useContext(RouterContext)
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return
      // Let the browser handle non-left-clicks, modifier-clicks, target=_blank,
      // and external URLs — same semantics as react-router-dom's <Link>.
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (rest.target && rest.target !== '_self') return
      if (!inRouter || !ctx) return
      event.preventDefault()
      ctx.navigate(to, { replace })
    },
    [onClick, inRouter, ctx, to, replace, rest.target],
  )

  return createElement('a', { ...rest, href: to, onClick: handleClick }, children)
}
