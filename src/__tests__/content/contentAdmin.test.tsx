import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ContentAdmin } from '../../content/ContentAdmin'

const originalFetch = globalThis.fetch

interface FetchCall {
  input: RequestInfo | URL
  init?: RequestInit
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  const calls: FetchCall[] = []
  ;(globalThis as typeof globalThis & { __contentFetchCalls?: FetchCall[] }).__contentFetchCalls = calls
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init })
    const url = String(input)

    if (url === '/api/cms/content/collections') {
      return json({
        collections: [{
          id: 'posts',
          name: 'Posts',
          slug: 'posts',
          singularLabel: 'Post',
          pluralLabel: 'Posts',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
        }],
      })
    }

    if (url === '/api/cms/content/collections/posts/entries' && init?.method === 'GET') {
      return json({ entries: [] })
    }

    if (url === '/api/cms/content/collections/posts/entries' && init?.method === 'POST') {
      return json({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          title: 'Untitled',
          slug: 'untitled',
          status: 'draft',
          bodyMarkdown: '',
          featuredMediaId: null,
          seoTitle: '',
          seoDescription: '',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          publishedAt: null,
          deletedAt: null,
        },
      }, 201)
    }

    if (url === '/api/cms/content/entries/entry_1' && init?.method === 'PUT') {
      const draft = JSON.parse(String(init.body))
      return json({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          status: 'draft',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:01:00.000Z',
          publishedAt: null,
          deletedAt: null,
          ...draft,
        },
      })
    }

    if (url === '/api/cms/content/entries/entry_1/publish' && init?.method === 'POST') {
      return json({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          title: 'My first post',
          slug: 'untitled',
          status: 'published',
          bodyMarkdown: '## Intro',
          featuredMediaId: null,
          seoTitle: '',
          seoDescription: '',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:02:00.000Z',
          publishedAt: '2026-05-01T10:02:00.000Z',
          deletedAt: null,
        },
      })
    }

    if (url === '/api/cms/media') {
      return json({ assets: [] })
    }

    return json({ error: `Unhandled ${url}` }, 500)
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
  cleanup()
})

describe('ContentAdmin', () => {
  it('creates, edits, saves, and publishes a rich Markdown-backed post', async () => {
    render(
      <MemoryRouter>
        <ContentAdmin />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Posts')).toBeDefined()
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Entries' }))
        .getByRole('button', { name: /new post/i }),
    )

    const title = await screen.findByLabelText('Title')
    fireEvent.change(title, { target: { value: 'My first post' } })

    const firstBlock = await screen.findByTestId('content-block-0')
    firstBlock.textContent = '## Intro'
    fireEvent.input(firstBlock)

    expect(screen.getByRole('heading', { name: 'Intro' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await screen.findByText('Draft saved')

    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    await screen.findByText('Published')

    const calls = (globalThis as typeof globalThis & { __contentFetchCalls?: FetchCall[] }).__contentFetchCalls ?? []
    const saveCall = calls.find((call) => String(call.input) === '/api/cms/content/entries/entry_1' && call.init?.method === 'PUT')
    expect(saveCall?.init?.body).toBe(JSON.stringify({
      title: 'My first post',
      slug: 'untitled',
      bodyMarkdown: '## Intro',
      featuredMediaId: null,
      seoTitle: '',
      seoDescription: '',
    }))
    expect(calls.some((call) =>
      String(call.input) === '/api/cms/content/entries/entry_1/publish' &&
      call.init?.method === 'POST'
    )).toBe(true)
  })
})
