import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@ui/components/Button'
import { Input, Textarea } from '@ui/components/Input'
import { BookOpenIcon } from '@ui/icons/icons/book-open'
import { FilePlusIcon } from '@ui/icons/icons/file-plus'
import { HeadingIcon } from '@ui/icons/icons/heading'
import { ImageIcon } from '@ui/icons/icons/image'
import { SaveIcon } from '@ui/icons/icons/save'
import { SendIcon } from '@ui/icons/icons/send'
import { TextPlusIcon } from '@ui/icons/icons/text-plus'
import { VideoIcon } from '@ui/icons/icons/video'
import {
  createCmsContentEntry,
  listCmsContentCollections,
  listCmsContentEntries,
  listCmsMediaAssets,
  publishCmsContentEntry,
  saveCmsContentEntryDraft,
  type CmsMediaAsset,
} from '@core/persistence'
import {
  createHeadingBlock,
  createImageBlock,
  createParagraphBlock,
  createVideoBlock,
  parseMarkdownBlocks,
  serializeMarkdownBlocks,
} from './markdown'
import { RichMarkdownEditor } from './RichMarkdownEditor'
import type { ContentBlock, ContentCollection, ContentEntry } from './types'
import styles from './ContentAdmin.module.css'

type SaveMessage = 'idle' | 'saving' | 'saved' | 'publishing' | 'published' | 'error'
type MediaPickerMode = 'image' | 'video' | null

function slugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled'
}

function updateEntryList(entries: ContentEntry[], entry: ContentEntry): ContentEntry[] {
  const existing = entries.findIndex((candidate) => candidate.id === entry.id)
  if (existing === -1) return [entry, ...entries]
  const next = [...entries]
  next[existing] = entry
  return next
}

export function ContentAdmin() {
  const [collections, setCollections] = useState<ContentCollection[]>([])
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<ContentEntry | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ContentBlock[]>([createParagraphBlock()])
  const [mediaAssets, setMediaAssets] = useState<CmsMediaAsset[]>([])
  const [mediaPickerMode, setMediaPickerMode] = useState<MediaPickerMode>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<SaveMessage>('idle')
  const titleId = useId()
  const slugId = useId()
  const seoTitleId = useId()
  const seoDescriptionId = useId()

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? null
  const publicPath = selectedCollection && slug ? `/${selectedCollection.slug}/${slug}` : ''

  const filteredMediaAssets = useMemo(() => {
    if (!mediaPickerMode) return []
    return mediaAssets.filter((asset) =>
      mediaPickerMode === 'image'
        ? asset.mimeType.startsWith('image/')
        : asset.mimeType.startsWith('video/'),
    )
  }, [mediaAssets, mediaPickerMode])

  useEffect(() => {
    let cancelled = false

    async function loadCollections() {
      setLoading(true)
      setError(null)
      try {
        const nextCollections = await listCmsContentCollections()
        if (cancelled) return
        setCollections(nextCollections)
        setSelectedCollectionId((current) => current ?? nextCollections[0]?.id ?? null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load content')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCollections()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedCollectionId) return
    let cancelled = false

    async function loadEntries() {
      setError(null)
      try {
        const nextEntries = await listCmsContentEntries(selectedCollectionId)
        if (cancelled) return
        setEntries(nextEntries)
        if (!selectedEntry || selectedEntry.collectionId !== selectedCollectionId) {
          applySelectedEntry(nextEntries[0] ?? null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load entries')
      }
    }

    void loadEntries()
    return () => { cancelled = true }
    // selectedEntry is a current guard; changing collection is the reload trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollectionId])

  function applySelectedEntry(entry: ContentEntry | null) {
    setSelectedEntry(entry)
    setTitle(entry?.title ?? '')
    setSlug(entry?.slug ?? '')
    setSeoTitle(entry?.seoTitle ?? '')
    setSeoDescription(entry?.seoDescription ?? '')
    setFeaturedMediaId(entry?.featuredMediaId ?? null)
    setBlocks(entry ? parseMarkdownBlocks(entry.bodyMarkdown) : [createParagraphBlock()])
    setSaveMessage('idle')
  }

  async function handleCreateEntry() {
    if (!selectedCollection) return
    setSaveMessage('saving')
    setError(null)
    try {
      const nextSlug = entries.length === 0 ? 'untitled' : `untitled-${entries.length + 1}`
      const entry = await createCmsContentEntry(selectedCollection.id, {
        title: 'Untitled',
        slug: nextSlug,
      })
      setEntries((current) => updateEntryList(current, entry))
      applySelectedEntry(entry)
      setSaveMessage('saved')
    } catch (err) {
      setSaveMessage('error')
      setError(err instanceof Error ? err.message : 'Could not create entry')
    }
  }

  async function saveDraft(): Promise<ContentEntry | null> {
    if (!selectedEntry) return null
    const nextTitle = title.trim() || 'Untitled'
    const nextSlug = slugFromTitle(slug || nextTitle)
    const entry = await saveCmsContentEntryDraft(selectedEntry.id, {
      title: nextTitle,
      slug: nextSlug,
      bodyMarkdown: serializeMarkdownBlocks(blocks),
      featuredMediaId,
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
    })
    setSelectedEntry(entry)
    setEntries((current) => updateEntryList(current, entry))
    setTitle(entry.title)
    setSlug(entry.slug)
    setSeoTitle(entry.seoTitle)
    setSeoDescription(entry.seoDescription)
    setFeaturedMediaId(entry.featuredMediaId)
    return entry
  }

  async function handleSaveDraft() {
    setSaveMessage('saving')
    setError(null)
    try {
      await saveDraft()
      setSaveMessage('saved')
    } catch (err) {
      setSaveMessage('error')
      setError(err instanceof Error ? err.message : 'Could not save draft')
    }
  }

  async function handlePublish() {
    if (!selectedEntry) return
    setSaveMessage('publishing')
    setError(null)
    try {
      const savedEntry = await saveDraft()
      if (!savedEntry) return
      const publishedEntry = await publishCmsContentEntry(savedEntry.id)
      setSelectedEntry(publishedEntry)
      setEntries((current) => updateEntryList(current, publishedEntry))
      setSaveMessage('published')
    } catch (err) {
      setSaveMessage('error')
      setError(err instanceof Error ? err.message : 'Could not publish entry')
    }
  }

  async function openMediaPicker(mode: Exclude<MediaPickerMode, null>) {
    setMediaPickerMode(mode)
    setError(null)
    try {
      setMediaAssets(await listCmsMediaAssets())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load media')
    }
  }

  function insertMedia(asset: CmsMediaAsset) {
    setBlocks((current) => [
      ...current,
      asset.mimeType.startsWith('video/')
        ? createVideoBlock(asset.publicPath)
        : createImageBlock(asset.publicPath, asset.filename),
    ])
    setMediaPickerMode(null)
  }

  const statusText =
    saveMessage === 'saving' ? 'Saving draft' :
    saveMessage === 'saved' ? 'Draft saved' :
    saveMessage === 'publishing' ? 'Publishing' :
    saveMessage === 'published' ? 'Published' :
    saveMessage === 'error' ? 'Save failed' :
    selectedEntry?.status === 'published' ? 'Published' :
    selectedEntry ? 'Draft' :
    'No entry selected'

  return (
    <main className={styles.shell} aria-label="Content admin">
      <aside className={styles.rail} aria-label="Admin sections">
        <Link className={styles.railLink} to="/admin/site">Site</Link>
        <Link className={styles.railLinkActive} to="/admin/content">Content</Link>
      </aside>

      <aside className={styles.sidebar} aria-label="Content collections">
        <header className={styles.sidebarHeader}>
          <div>
            <span className={styles.eyebrow}>CMS</span>
            <h1>Content</h1>
          </div>
          <BookOpenIcon size={17} aria-hidden="true" />
        </header>

        {loading && <p className={styles.muted}>Loading content...</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        <section className={styles.sidebarSection} aria-label="Collections">
          <div className={styles.sectionHeader}>
            <span>Collections</span>
          </div>
          {collections.map((collection) => (
            <Button
              key={collection.id}
              variant="ghost"
              size="md"
              align="between"
              fullWidth
              active={collection.id === selectedCollectionId}
              onClick={() => setSelectedCollectionId(collection.id)}
            >
              <span>{collection.name}</span>
              <span className={styles.count}>{collection.id === selectedCollectionId ? entries.length : ''}</span>
            </Button>
          ))}
        </section>

        <section className={styles.sidebarSection} aria-label="Entries">
          <div className={styles.sectionHeader}>
            <span>Entries</span>
            <Button
              variant="secondary"
              size="xs"
              onClick={handleCreateEntry}
              disabled={!selectedCollection}
            >
              <FilePlusIcon size={13} aria-hidden="true" />
              <span>New Post</span>
            </Button>
          </div>

          {entries.length === 0 && !loading && (
            <p className={styles.muted}>No entries yet.</p>
          )}

          <div className={styles.entryList}>
            {entries.map((entry) => (
              <Button
                key={entry.id}
                variant="ghost"
                size="md"
                align="start"
                fullWidth
                active={entry.id === selectedEntry?.id}
                onClick={() => applySelectedEntry(entry)}
              >
                <span className={styles.entryTitle}>{entry.title}</span>
              </Button>
            ))}
          </div>
        </section>
      </aside>

      <section className={styles.workspace} aria-label="Content document editor">
        <header className={styles.toolbar}>
          <div className={styles.toolbarGroup} aria-label="Insert blocks">
            <Button variant="secondary" size="sm" disabled={!selectedEntry} onClick={() => setBlocks((current) => [...current, createHeadingBlock()])}>
              <HeadingIcon size={14} aria-hidden="true" />
              <span>Heading</span>
            </Button>
            <Button variant="secondary" size="sm" disabled={!selectedEntry} onClick={() => setBlocks((current) => [...current, createParagraphBlock()])}>
              <TextPlusIcon size={14} aria-hidden="true" />
              <span>Text</span>
            </Button>
            <Button variant="secondary" size="sm" disabled={!selectedEntry} onClick={() => void openMediaPicker('image')}>
              <ImageIcon size={14} aria-hidden="true" />
              <span>Image</span>
            </Button>
            <Button variant="secondary" size="sm" disabled={!selectedEntry} onClick={() => void openMediaPicker('video')}>
              <VideoIcon size={14} aria-hidden="true" />
              <span>Video</span>
            </Button>
          </div>

          <div className={styles.toolbarGroup}>
            <span className={styles.status}>{statusText}</span>
            <Button variant="secondary" size="sm" disabled={!selectedEntry || saveMessage === 'saving'} onClick={() => void handleSaveDraft()}>
              <SaveIcon size={14} aria-hidden="true" />
              <span>Save Draft</span>
            </Button>
            <Button variant="primary" size="sm" disabled={!selectedEntry || saveMessage === 'publishing'} onClick={() => void handlePublish()}>
              <SendIcon size={14} aria-hidden="true" />
              <span>Publish</span>
            </Button>
          </div>
        </header>

        <div className={styles.documentScroll}>
          {selectedEntry ? (
            <article className={styles.document}>
              <label className={styles.titleLabel} htmlFor={titleId}>Title</label>
              <Input
                id={titleId}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={styles.titleInput}
                fieldSize="md"
                emphasis="strong"
              />
              <RichMarkdownEditor blocks={blocks} onChange={setBlocks} />
            </article>
          ) : (
            <div className={styles.emptyState}>
              <h2>Create the first post</h2>
              <p>Select a collection and create an entry to start writing.</p>
              <Button variant="primary" size="md" onClick={handleCreateEntry} disabled={!selectedCollection}>
                <FilePlusIcon size={15} aria-hidden="true" />
                <span>New Post</span>
              </Button>
            </div>
          )}
        </div>
      </section>

      <aside className={styles.settings} aria-label="Entry settings">
        <h2>Settings</h2>
        <label className={styles.field} htmlFor={slugId}>
          <span>Slug</span>
          <Input
            id={slugId}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            disabled={!selectedEntry}
          />
        </label>
        <label className={styles.field} htmlFor={seoTitleId}>
          <span>SEO title</span>
          <Input
            id={seoTitleId}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            disabled={!selectedEntry}
          />
        </label>
        <label className={styles.field} htmlFor={seoDescriptionId}>
          <span>SEO description</span>
          <Textarea
            id={seoDescriptionId}
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
            disabled={!selectedEntry}
            resize="none"
            rows={4}
          />
        </label>
        <div className={styles.metaBlock}>
          <span>Status</span>
          <strong>{selectedEntry?.status ?? 'None'}</strong>
        </div>
        <div className={styles.metaBlock}>
          <span>Public URL</span>
          <strong>{publicPath || 'Not available'}</strong>
        </div>
        <div className={styles.metaBlock}>
          <span>Featured media</span>
          <strong>{featuredMediaId ?? 'None'}</strong>
        </div>
      </aside>

      {mediaPickerMode && (
        <div className={styles.mediaOverlay} role="dialog" aria-modal="true" aria-label={`Pick ${mediaPickerMode}`}>
          <div className={styles.mediaDialog}>
            <header className={styles.mediaHeader}>
              <h2>Pick {mediaPickerMode}</h2>
              <Button variant="ghost" size="sm" onClick={() => setMediaPickerMode(null)}>Close</Button>
            </header>
            {filteredMediaAssets.length === 0 ? (
              <p className={styles.muted}>No matching media yet.</p>
            ) : (
              <div className={styles.mediaGrid}>
                {filteredMediaAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={styles.mediaTile}
                    onClick={() => insertMedia(asset)}
                  >
                    {asset.mimeType.startsWith('image/') ? (
                      <img src={asset.publicPath} alt="" />
                    ) : (
                      <video src={asset.publicPath} />
                    )}
                    <span>{asset.filename}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
