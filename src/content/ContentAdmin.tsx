import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@ui/components/Button'
import { Input, Textarea } from '@ui/components/Input'
import { cn } from '@ui/cn'
import { BookOpenIcon } from '@ui/icons/icons/book-open'
import { FilePlusIcon } from '@ui/icons/icons/file-plus'
import { FileTextIcon } from '@ui/icons/icons/file-text'
import { HeadingIcon } from '@ui/icons/icons/heading'
import { ImageIcon } from '@ui/icons/icons/image'
import { SaveIcon } from '@ui/icons/icons/save'
import { SendIcon } from '@ui/icons/icons/send'
import { Settings2Icon } from '@ui/icons/icons/settings-2'
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
import { useEditorStore } from '@core/editor-store/store'
import EditorLayout from '../app/EditorLayout'
import { CanvasNotch, type CanvasNotchAction } from '../editor/components/Canvas/CanvasNotch'
import canvasStyles from '../editor/components/Canvas/CanvasRoot.module.css'
import propertiesStyles from '../editor/components/PropertiesPanel/PropertiesPanel.module.css'
import explorerStyles from '../editor/components/SiteExplorerPanel/SiteExplorerPanel.module.css'
import { PanelHeader } from '../editor/components/shared/PanelHeader'
import { SettingsButton } from '../editor/components/Toolbar/SettingsButton'
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
    useEditorStore.getState().setLeftSidebarPanel('site')
    useEditorStore.getState().setPropertiesPanel({ collapsed: false })
  }, [])

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
    const collectionId = selectedCollectionId
    let cancelled = false

    async function loadEntries() {
      setError(null)
      try {
        const nextEntries = await listCmsContentEntries(collectionId)
        if (cancelled) return
        setEntries(nextEntries)
        if (!selectedEntry || selectedEntry.collectionId !== collectionId) {
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
    useEditorStore.getState().setPropertiesPanel({ collapsed: false })
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

  const toolbarRightSlot = (
    <>
      <span className={styles.toolbarStatus}>{statusText}</span>
      <Button variant="secondary" size="sm" disabled={!selectedEntry || saveMessage === 'saving'} onClick={() => void handleSaveDraft()}>
        <SaveIcon size={14} aria-hidden="true" />
        <span>Save Draft</span>
      </Button>
      <Button variant="primary" size="sm" disabled={!selectedEntry || saveMessage === 'publishing'} onClick={() => void handlePublish()}>
        <SendIcon size={14} aria-hidden="true" />
        <span>Publish</span>
      </Button>
      <SettingsButton />
    </>
  )

  const notchActions: CanvasNotchAction[] = [
    {
      id: 'heading',
      label: 'Heading',
      icon: HeadingIcon,
      onClick: () => setBlocks((current) => [...current, createHeadingBlock()]),
    },
    {
      id: 'text',
      label: 'Text',
      icon: TextPlusIcon,
      onClick: () => setBlocks((current) => [...current, createParagraphBlock()]),
    },
    {
      id: 'image',
      label: 'Image',
      icon: ImageIcon,
      onClick: () => void openMediaPicker('image'),
    },
    {
      id: 'video',
      label: 'Video',
      icon: VideoIcon,
      onClick: () => void openMediaPicker('video'),
    },
  ]

  return (
    <>
      <EditorLayout
        workspace="content"
        toolbarRightSlot={toolbarRightSlot}
        contentLeftPanel={(
          <ContentExplorerPanel
            loading={loading}
            error={error}
            collections={collections}
            entries={entries}
            selectedCollectionId={selectedCollectionId}
            selectedEntryId={selectedEntry?.id ?? null}
            onSelectCollection={setSelectedCollectionId}
            onSelectEntry={applySelectedEntry}
            onCreateEntry={() => void handleCreateEntry()}
          />
        )}
        contentCanvas={(
          <ContentDocumentCanvas
            selectedEntry={selectedEntry}
            selectedCollection={selectedCollection}
            title={title}
            titleId={titleId}
            blocks={blocks}
            notchActions={notchActions}
            onTitleChange={setTitle}
            onBlocksChange={setBlocks}
            onCreateEntry={() => void handleCreateEntry()}
          />
        )}
        contentRightPanel={(
          <ContentSettingsPanel
            selectedEntry={selectedEntry}
            slug={slug}
            slugId={slugId}
            seoTitle={seoTitle}
            seoTitleId={seoTitleId}
            seoDescription={seoDescription}
            seoDescriptionId={seoDescriptionId}
            publicPath={publicPath}
            featuredMediaId={featuredMediaId}
            onSlugChange={setSlug}
            onSeoTitleChange={setSeoTitle}
            onSeoDescriptionChange={setSeoDescription}
          />
        )}
      />

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
    </>
  )
}

interface ContentExplorerPanelProps {
  loading: boolean
  error: string | null
  collections: ContentCollection[]
  entries: ContentEntry[]
  selectedCollectionId: string | null
  selectedEntryId: string | null
  onSelectCollection: (collectionId: string) => void
  onSelectEntry: (entry: ContentEntry) => void
  onCreateEntry: () => void
}

function ContentExplorerPanel({
  loading,
  error,
  collections,
  entries,
  selectedCollectionId,
  selectedEntryId,
  onSelectCollection,
  onSelectEntry,
  onCreateEntry,
}: ContentExplorerPanelProps) {
  const setSiteExplorerPanelOpen = useEditorStore((s) => s.setSiteExplorerPanelOpen)

  return (
    <aside
      role="complementary"
      aria-label="Content Explorer"
      data-panel=""
      data-testid="content-explorer-panel"
      tabIndex={-1}
      className={explorerStyles.panel}
    >
      <PanelHeader
        panelId="content-explorer"
        title="Content"
        onClose={() => setSiteExplorerPanelOpen(false)}
      />

      <div className={explorerStyles.content}>
        {loading && <p className={styles.muted}>Loading content...</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        <section className={explorerStyles.section} aria-label="Collections">
          <div className={explorerStyles.sectionHeader}>
            <h2 className={explorerStyles.sectionTitle}>Collections</h2>
          </div>
          <div className={explorerStyles.rows}>
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className={cn(
                  explorerStyles.row,
                  collection.id === selectedCollectionId && explorerStyles.rowActive,
                )}
                onClick={() => onSelectCollection(collection.id)}
              >
                <BookOpenIcon size={14} aria-hidden="true" />
                <span className={explorerStyles.rowLabel}>{collection.name}</span>
                <span className={explorerStyles.rowMeta}>
                  {collection.id === selectedCollectionId ? entries.length : ''}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={explorerStyles.section} aria-label="Entries">
          <div className={explorerStyles.sectionHeader}>
            <h2 className={explorerStyles.sectionTitle}>Entries</h2>
            <span className={explorerStyles.sectionCount}>{entries.length}</span>
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              onClick={onCreateEntry}
              disabled={!selectedCollectionId}
              aria-label="New post"
              title="New post"
            >
              <FilePlusIcon size={13} aria-hidden="true" />
            </Button>
          </div>

          {entries.length === 0 && !loading ? (
            <p className={explorerStyles.emptyState}>No entries yet.</p>
          ) : (
            <div className={explorerStyles.rows}>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={cn(
                    explorerStyles.row,
                    entry.id === selectedEntryId && explorerStyles.rowActive,
                  )}
                  onClick={() => onSelectEntry(entry)}
                >
                  <FileTextIcon size={14} aria-hidden="true" />
                  <span className={styles.entryTitle}>{entry.title}</span>
                  <span className={explorerStyles.rowMeta}>{entry.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}

interface ContentDocumentCanvasProps {
  selectedEntry: ContentEntry | null
  selectedCollection: ContentCollection | null
  title: string
  titleId: string
  blocks: ContentBlock[]
  notchActions: CanvasNotchAction[]
  onTitleChange: (value: string) => void
  onBlocksChange: (blocks: ContentBlock[]) => void
  onCreateEntry: () => void
}

function ContentDocumentCanvas({
  selectedEntry,
  selectedCollection,
  title,
  titleId,
  blocks,
  notchActions,
  onTitleChange,
  onBlocksChange,
  onCreateEntry,
}: ContentDocumentCanvasProps) {
  const addControl = (
    <Button
      variant="primary"
      size="sm"
      className={styles.notchAddButton}
      disabled={!selectedEntry}
      onClick={() => onBlocksChange([...blocks, createParagraphBlock()])}
    >
      <FilePlusIcon size={14} aria-hidden="true" />
      <span>Add</span>
    </Button>
  )

  return (
    <div
      role="region"
      aria-label="Content canvas"
      data-testid="content-canvas-root"
      className={cn(canvasStyles.canvas, styles.contentCanvas)}
    >
      <CanvasNotch actions={notchActions} addControl={addControl} />

      <div className={styles.documentScroll}>
        {selectedEntry ? (
          <article className={styles.document}>
            <label className={styles.titleLabel} htmlFor={titleId}>Title</label>
            <Input
              id={titleId}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className={styles.titleInput}
              fieldSize="md"
              emphasis="strong"
            />
            <RichMarkdownEditor blocks={blocks} onChange={onBlocksChange} />
          </article>
        ) : (
          <div className={styles.emptyState}>
            <h2>Create the first {selectedCollection?.singularLabel.toLowerCase() ?? 'post'}</h2>
            <p>Select a collection and create an entry to start writing.</p>
            <Button variant="primary" size="md" onClick={onCreateEntry} disabled={!selectedCollection}>
              <FilePlusIcon size={15} aria-hidden="true" />
              <span>New Post</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface ContentSettingsPanelProps {
  selectedEntry: ContentEntry | null
  slug: string
  slugId: string
  seoTitle: string
  seoTitleId: string
  seoDescription: string
  seoDescriptionId: string
  publicPath: string
  featuredMediaId: string | null
  onSlugChange: (value: string) => void
  onSeoTitleChange: (value: string) => void
  onSeoDescriptionChange: (value: string) => void
}

function ContentSettingsPanel({
  selectedEntry,
  slug,
  slugId,
  seoTitle,
  seoTitleId,
  seoDescription,
  seoDescriptionId,
  publicPath,
  featuredMediaId,
  onSlugChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
}: ContentSettingsPanelProps) {
  const setPropertiesPanel = useEditorStore((s) => s.setPropertiesPanel)

  return (
    <aside
      data-panel=""
      data-testid="content-settings-panel"
      role="complementary"
      aria-label="Content settings"
      className={cn(propertiesStyles.panel, propertiesStyles.panelDocked)}
    >
      <PanelHeader
        panelId="content-settings"
        title="Settings"
        titleContent={(
          <span className={propertiesStyles.headerNodeTitle}>
            <Settings2Icon size={13} aria-hidden="true" />
            <span className={propertiesStyles.headerNodeLabel}>Settings</span>
          </span>
        )}
        onClose={() => setPropertiesPanel({ collapsed: true })}
      />

      <div className={styles.settingsBody}>
        <label className={styles.field} htmlFor={slugId}>
          <span>Slug</span>
          <Input
            id={slugId}
            value={slug}
            onChange={(event) => onSlugChange(event.target.value)}
            disabled={!selectedEntry}
          />
        </label>
        <label className={styles.field} htmlFor={seoTitleId}>
          <span>SEO title</span>
          <Input
            id={seoTitleId}
            value={seoTitle}
            onChange={(event) => onSeoTitleChange(event.target.value)}
            disabled={!selectedEntry}
          />
        </label>
        <label className={styles.field} htmlFor={seoDescriptionId}>
          <span>SEO description</span>
          <Textarea
            id={seoDescriptionId}
            value={seoDescription}
            onChange={(event) => onSeoDescriptionChange(event.target.value)}
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
      </div>
    </aside>
  )
}
