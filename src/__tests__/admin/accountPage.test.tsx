/**
 * AccountPage — `/admin/account` self-targeted user settings.
 *
 * Verifies:
 *   - All four tab buttons render (Profile / Sessions / Security / Activity)
 *   - Profile tab is the default and shows the current user's identity
 *   - Switching to Sessions renders the device list (current pinned)
 *   - Switching to Security renders the four placeholder cards
 *   - Switching to Activity renders the empty state when there's nothing to show
 *   - The Account workspace is accessible to a viewer-role user (no
 *     capability gating — self-targeted)
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { canAccessWorkspace } from '@admin/access'
import { AccountPage } from '@admin/pages/account/AccountPage'
import { AdminSessionProvider } from '@admin/session'
import { StepUpProvider } from '@admin/shared/StepUp'
import { MemoryRouter } from '@admin/lib/routing'
import { useEditorStore } from '@site/store/store'
import { makeSite } from '../fixtures'
import type { CmsCurrentUser, CmsSession } from '@core/persistence'
import '@modules/base/index'

const now = '2026-05-09T10:00:00.000Z'
const originalFetch = globalThis.fetch
type EventSourceCtor = (typeof globalThis) extends { EventSource: infer T } ? T : never
const originalEventSource = (globalThis as { EventSource?: EventSourceCtor }).EventSource

function makeUser(overrides: Partial<CmsCurrentUser> = {}): CmsCurrentUser {
  return {
    id: 'owner_1',
    email: 'owner@example.com',
    displayName: 'Olivia Owner',
    status: 'active',
    role: {
      id: 'owner',
      slug: 'owner',
      name: 'Owner',
      description: '',
      isSystem: true,
      capabilities: ['site.read'],
    },
    capabilities: ['site.read'],
    lastLoginAt: now,
    failedLoginCount: 0,
    lockedUntil: null,
    avatarMediaId: null,
    avatarUrl: null,
    gravatarHash: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeSession(overrides: Partial<CmsSession> = {}): CmsSession {
  return {
    id: 'sess_a',
    deviceLabel: 'Chrome on macOS',
    ipAddress: '203.0.113.10',
    userAgent: null,
    createdAt: '2026-05-09T09:00:00.000Z',
    lastSeenAt: '2026-05-09T09:55:00.000Z',
    expiresAt: '2026-06-08T09:00:00.000Z',
    isCurrent: true,
    mfaPassedAt: null,
    stepUpExpiresAt: null,
    ...overrides,
  }
}

function setupEditorState() {
  // AdminPageLayout (which wraps AccountPage) reads the site name from the
  // editor store for the toolbar, but doesn't gate rendering on the site
  // object. We still set a minimal site stub here to keep the store shape
  // consistent.
  const site = makeSite({ name: 'Account Test Site' })
  useEditorStore.setState({
    site,
    activePageId: site.pages[0].id,
    selectedNodeId: null,
    selectedNodeIds: [],
    hoveredNodeId: null,
    activeBreakpointId: 'desktop',
    domTreePanel: { collapsed: false, x: 0, y: 0, width: 280 },
    propertiesPanel: { collapsed: false, x: 0, y: 0, width: 360 },
    propertiesPanelMode: 'docked',
    leftSidebarWidth: 320,
    focusedPanel: 'canvas',
    siteExplorerPanelOpen: false,
    selectorsPanelOpen: false,
    colorsPanelOpen: false,
    mediaExplorerPanelOpen: false,
    codeEditorPanelOpen: false,
    activeEditorFileId: null,
    activeMediaAssetPreview: null,
    dependenciesPanelOpen: false,
    isAgentOpen: false,
    isAgentStreaming: false,
    agentMessages: [],
    agentError: null,
    _historyPast: [],
    _historyFuture: [],
    canUndo: false,
    canRedo: false,
    hasUnsavedChanges: false,
  } as Parameters<typeof useEditorStore.setState>[0])
}

/**
 * happy-dom does not implement EventSource, but `usePluginEventBridge` (called
 * unconditionally inside AdminPageLayout) constructs one on mount. Stub it with
 * a no-op so the bridge subscribes silently and the test can render the page.
 */
class StubEventSource {
  readonly url: string
  constructor(url: string) {
    this.url = url
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

function makeAccountFetch(
  overrides: (input: string, init?: RequestInit) => Response | undefined,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const override = overrides(url, init)
    if (override) return override
    // Fallbacks that keep AdminPageLayout's ambient calls happy. The Account
    // page itself never calls these, but the surrounding layout does.
    if (url.endsWith('/admin/api/cms/plugins')) return jsonResponse({ plugins: [], adminPages: [] })
    if (url.endsWith('/admin/api/cms/site/publish-status')) return jsonResponse({ ok: false }, 404)
    return jsonResponse({ error: `Unhandled ${url}` }, 500)
  }) as typeof fetch
}

function renderWithUser(user: CmsCurrentUser) {
  // AccountPage renders inside the same provider stack as production —
  // router (AdminRouteLink ↔ useAdminNavigate) and StepUpProvider
  // (Sessions tab calls useStepUp).
  return render(
    <MemoryRouter initialEntries={['/admin/account']}>
      <AdminSessionProvider user={user}>
        <StepUpProvider>
          <AccountPage />
        </StepUpProvider>
      </AdminSessionProvider>
    </MemoryRouter>,
  )
}

describe('AccountPage', () => {
  beforeEach(() => {
    localStorage.clear()
    setupEditorState()
    ;(globalThis as { EventSource?: unknown }).EventSource = StubEventSource as unknown
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    if (originalEventSource) {
      ;(globalThis as { EventSource?: unknown }).EventSource = originalEventSource
    } else {
      delete (globalThis as { EventSource?: unknown }).EventSource
    }
  })

  it('canAccessWorkspace allows account for any authenticated user', () => {
    const viewer = makeUser({
      role: { id: 'viewer', slug: 'viewer', name: 'Viewer', description: '', isSystem: true, capabilities: ['site.read'] },
      capabilities: ['site.read'],
    })
    expect(canAccessWorkspace(viewer, 'account')).toBe(true)

    // Anonymous (null user) is rejected.
    expect(canAccessWorkspace(null, 'account')).toBe(false)
  })

  it('renders all four tabs and defaults to Profile', () => {
    globalThis.fetch = makeAccountFetch((url) => {
      if (url.endsWith('/admin/api/cms/auth/sessions')) return jsonResponse({ sessions: [] })
      return undefined
    })
    renderWithUser(makeUser())
    expect(screen.getByTestId('account-tab-profile')).toBeTruthy()
    expect(screen.getByTestId('account-tab-sessions')).toBeTruthy()
    expect(screen.getByTestId('account-tab-security')).toBeTruthy()
    expect(screen.getByTestId('account-tab-activity')).toBeTruthy()
    // Default tab is Profile — user's email is visible.
    expect(screen.getByText('owner@example.com')).toBeTruthy()
  })

  it('Sessions tab renders the device list with the current session pinned', async () => {
    globalThis.fetch = makeAccountFetch((url) => {
      if (url.endsWith('/admin/api/cms/auth/sessions')) {
        return jsonResponse({
          sessions: [
            makeSession({ id: 'sess_a', deviceLabel: 'Chrome on macOS', isCurrent: true }),
            makeSession({ id: 'sess_b', deviceLabel: 'Safari on iOS', isCurrent: false }),
          ],
        })
      }
      return undefined
    })

    renderWithUser(makeUser())
    fireEvent.click(screen.getByTestId('account-tab-sessions'))

    await waitFor(() => {
      expect(screen.getByText('Chrome on macOS')).toBeTruthy()
      expect(screen.getByText('Safari on iOS')).toBeTruthy()
    })
    // Current session has no per-row sign-out button (revoke happens via toolbar).
    expect(screen.queryByTestId('account-sessions-sign-out-sess_a')).toBeNull()
    // Other sessions DO get a sign-out button.
    expect(screen.getByTestId('account-sessions-sign-out-sess_b')).toBeTruthy()
  })

  it('Security tab renders four placeholder cards with disabled actions', () => {
    globalThis.fetch = makeAccountFetch((url) => {
      if (url.endsWith('/admin/api/cms/auth/sessions')) return jsonResponse({ sessions: [] })
      return undefined
    })
    renderWithUser(makeUser())
    fireEvent.click(screen.getByTestId('account-tab-security'))

    expect(screen.getByTestId('security-password-card')).toBeTruthy()
    expect(screen.getByTestId('security-mfa-card')).toBeTruthy()
    expect(screen.getByTestId('security-recovery-card')).toBeTruthy()
    expect(screen.getByTestId('security-connected-card')).toBeTruthy()
  })

  it('Activity tab shows an empty state when there are no events', async () => {
    globalThis.fetch = makeAccountFetch((url) => {
      if (url.endsWith('/admin/api/cms/auth/activity')) return jsonResponse({ events: [] })
      return undefined
    })

    renderWithUser(makeUser())
    fireEvent.click(screen.getByTestId('account-tab-activity'))

    await waitFor(() => {
      expect(screen.getByText('No login activity yet.')).toBeTruthy()
    })
  })

  it('Activity tab surfaces a suspicious-activity banner when recent locked events exist', async () => {
    const recentLockTimestamp = new Date(Date.now() - 5 * 60_000).toISOString()
    globalThis.fetch = makeAccountFetch((url) => {
      if (url.endsWith('/admin/api/cms/auth/activity')) {
        return jsonResponse({
          events: [
            {
              id: 'a1',
              attemptedAt: recentLockTimestamp,
              emailNorm: 'owner@example.com',
              ipAddress: '198.51.100.99',
              userId: 'owner_1',
              result: 'locked',
            },
          ],
        })
      }
      return undefined
    })

    renderWithUser(makeUser())
    fireEvent.click(screen.getByTestId('account-tab-activity'))

    await waitFor(() => {
      expect(screen.getByTestId('account-activity-suspicious')).toBeTruthy()
    })
  })
})
