import { describe, expect, it } from 'bun:test'
import {
  createCmsContentCollection,
  createCmsContentEntry,
  deleteCmsContentCollection,
  deleteCmsContentEntry,
  listCmsContentAuthors,
  listCmsContentCollections,
  listCmsContentEntries,
  publishCmsContentEntry,
  saveCmsContentEntryDraft,
  updateCmsContentEntryAuthor,
  updateCmsContentEntryCollection,
  updateCmsContentCollection,
  updateCmsContentEntryStatus,
} from '@core/persistence/cmsContent'

describe('CMS content client', () => {
  it('lists content collections with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    const collections = await listCmsContentCollections(async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        collections: [{
          id: 'posts',
          name: 'Posts',
          slug: 'posts',
          routeBase: '/blog',
          singularLabel: 'Post',
          pluralLabel: 'Posts',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
        }],
      }), { status: 200 })
    })

    expect(collections[0].slug).toBe('posts')
    expect(collections[0].routeBase).toBe('/blog')
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/collections',
      init: { method: 'GET', credentials: 'include' },
    })
  })

  it('updates collection route settings with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const update = {
      name: 'Articles',
      slug: 'articles',
      routeBase: '/articles',
      singularLabel: 'Article',
      pluralLabel: 'Articles',
    }

    const collection = await updateCmsContentCollection('posts', update, async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        collection: {
          id: 'posts',
          ...update,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:02:00.000Z',
        },
      }), { status: 200 })
    })

    expect(collection.name).toBe('Articles')
    expect(collection.slug).toBe('articles')
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/collections/posts',
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[0].init?.body).toBe(JSON.stringify(update))
  })

  it('creates collections with built-in field choices', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const input = {
      name: 'Products',
      slug: 'products',
      routeBase: '/products',
      singularLabel: 'Product',
      pluralLabel: 'Products',
      fields: {
        builtIn: {
          body: true,
          featuredMedia: false,
          seo: false,
        },
        custom: [],
      },
    }

    const collection = await createCmsContentCollection(input, async (requestInput, init) => {
      calls.push({ input: requestInput, init })
      return new Response(JSON.stringify({
        collection: {
          id: 'products',
          ...input,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      }), { status: 201 })
    })

    expect(collection.id).toBe('products')
    expect(collection.fields?.builtIn.featuredMedia).toBe(false)
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/collections',
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[0].init?.body).toBe(JSON.stringify(input))
  })

  it('creates and lists entries inside a collection', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    await listCmsContentEntries('posts', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({ entries: [] }), { status: 200 })
    })

    await createCmsContentEntry('posts', { title: 'Hello', slug: 'hello' }, async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          title: 'Hello',
          slug: 'hello',
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
      }), { status: 201 })
    })

    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/collections/posts/entries',
      init: { method: 'GET', credentials: 'include' },
    })
    expect(calls[1]).toMatchObject({
      input: '/admin/api/cms/content/collections/posts/entries',
      init: {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[1].init?.body).toBe(JSON.stringify({ title: 'Hello', slug: 'hello' }))
  })

  it('lists content authors with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    const authors = await listCmsContentAuthors(async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        authors: [{
          id: 'user_author',
          email: 'author@example.com',
          displayName: 'Author Name',
          roleSlug: 'editor',
          roleName: 'Editor',
        }],
      }), { status: 200 })
    })

    expect(authors).toEqual([{
      id: 'user_author',
      email: 'author@example.com',
      displayName: 'Author Name',
      roleSlug: 'editor',
      roleName: 'Editor',
    }])
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/authors',
      init: { method: 'GET', credentials: 'include' },
    })
  })

  it('saves and publishes entries with JSON bodies', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const draft = {
      title: 'Hello',
      slug: 'hello',
      bodyMarkdown: '# Hello',
      featuredMediaId: null,
      seoTitle: 'SEO',
      seoDescription: 'Description',
    }

    await saveCmsContentEntryDraft('entry_1', draft, async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          status: 'draft',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          publishedAt: null,
          deletedAt: null,
          ...draft,
        },
      }), { status: 200 })
    })

    await publishCmsContentEntry('entry_1', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({ entry: { id: 'entry_1', status: 'published' } }), { status: 200 })
    })

    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/entries/entry_1',
      init: {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[0].init?.body).toBe(JSON.stringify(draft))
    expect(calls[1]).toMatchObject({
      input: '/admin/api/cms/content/entries/entry_1/publish',
      init: { method: 'POST', credentials: 'include' },
    })
  })

  it('updates an entry status with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    const entry = await updateCmsContentEntryStatus('entry_1', 'unpublished', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          title: 'Hello',
          slug: 'hello',
          status: 'unpublished',
          bodyMarkdown: '# Hello',
          featuredMediaId: null,
          seoTitle: '',
          seoDescription: '',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:03:00.000Z',
          publishedAt: null,
          deletedAt: null,
        },
      }), { status: 200 })
    })

    expect(entry.status).toBe('unpublished')
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/entries/entry_1/status',
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[0].init?.body).toBe(JSON.stringify({ status: 'unpublished' }))
  })

  it('moves entries between collections with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    const entry = await updateCmsContentEntryCollection('entry_1', 'products', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        entry: {
          id: 'entry_1',
          collectionId: 'products',
          title: 'Hello',
          slug: 'hello',
          status: 'draft',
          bodyMarkdown: '# Hello',
          featuredMediaId: null,
          seoTitle: '',
          seoDescription: '',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:03:00.000Z',
          publishedAt: null,
          deletedAt: null,
        },
      }), { status: 200 })
    })

    expect(entry.collectionId).toBe('products')
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/entries/entry_1/collection',
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[0].init?.body).toBe(JSON.stringify({ collectionId: 'products' }))
  })

  it('updates an entry author with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    const entry = await updateCmsContentEntryAuthor('entry_1', 'user_author_2', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          title: 'Hello',
          slug: 'hello',
          status: 'draft',
          bodyMarkdown: '# Hello',
          featuredMediaId: null,
          seoTitle: '',
          seoDescription: '',
          authorUserId: 'user_author_2',
          author: {
            id: 'user_author_2',
            email: 'next@example.com',
            displayName: 'Next Author',
            roleSlug: 'admin',
            roleName: 'Admin',
          },
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:03:00.000Z',
          publishedAt: null,
          deletedAt: null,
        },
      }), { status: 200 })
    })

    expect(entry.author?.displayName).toBe('Next Author')
    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/entries/entry_1/author',
      init: {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      },
    })
    expect(calls[0].init?.body).toBe(JSON.stringify({ authorUserId: 'user_author_2' }))
  })

  it('deletes collections and entries with session credentials', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

    await deleteCmsContentEntry('entry_1', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        entry: {
          id: 'entry_1',
          collectionId: 'posts',
          title: 'Hello',
          slug: 'hello',
          status: 'draft',
          bodyMarkdown: '',
          featuredMediaId: null,
          seoTitle: '',
          seoDescription: '',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:03:00.000Z',
          publishedAt: null,
          deletedAt: '2026-05-01T10:03:00.000Z',
        },
      }), { status: 200 })
    })

    await deleteCmsContentCollection('products', async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({
        collection: {
          id: 'products',
          name: 'Products',
          slug: 'products',
          routeBase: '/products',
          singularLabel: 'Product',
          pluralLabel: 'Products',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:03:00.000Z',
        },
      }), { status: 200 })
    })

    expect(calls[0]).toMatchObject({
      input: '/admin/api/cms/content/entries/entry_1',
      init: { method: 'DELETE', credentials: 'include' },
    })
    expect(calls[1]).toMatchObject({
      input: '/admin/api/cms/content/collections/products',
      init: { method: 'DELETE', credentials: 'include' },
    })
  })

  it('surfaces API errors from the response body', async () => {
    await expect(
      listCmsContentCollections(async () =>
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    ).rejects.toThrow('Unauthorized')
  })
})
