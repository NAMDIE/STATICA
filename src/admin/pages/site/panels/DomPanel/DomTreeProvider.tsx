import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DomTreeContext } from './DomTreeContext'

export function DomTreeProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const isExpanded = useCallback((nodeId: string) => expanded.has(nodeId), [expanded])

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const expandNode = useCallback((nodeId: string) => {
    setExpanded((prev) => {
      if (prev.has(nodeId)) return prev
      const next = new Set(prev)
      next.add(nodeId)
      return next
    })
  }, [])

  const expandAll = useCallback((nodeIds: string[]) => {
    setExpanded(new Set(nodeIds))
  }, [])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const value = useMemo(
    () => ({ expanded, isExpanded, toggleExpanded, expandNode, expandAll, collapseAll }),
    [collapseAll, expandAll, expandNode, expanded, isExpanded, toggleExpanded],
  )

  return (
    <DomTreeContext.Provider value={value}>
      {children}
    </DomTreeContext.Provider>
  )
}
