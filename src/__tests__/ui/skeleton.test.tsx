import { describe, expect, it } from 'bun:test'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonRows } from '@ui/components/Skeleton'

describe('Skeleton primitives', () => {
  it('renders local shimmer spans with CSS custom-property dimensions', () => {
    render(<Skeleton width={18} height="50%" radius={999} ariaLabel="Loading preview" />)

    const skeleton = screen.getByRole('status', { name: 'Loading preview' }) as HTMLElement
    expect(skeleton.tagName).toBe('SPAN')
    expect(skeleton.style.getPropertyValue('--skeleton-width')).toBe('18px')
    expect(skeleton.style.getPropertyValue('--skeleton-height')).toBe('50%')
    expect(skeleton.style.getPropertyValue('--skeleton-radius')).toBe('999px')
    expect(skeleton.className.includes('react-loading-skeleton')).toBe(false)
  })

  it('renders row skeletons without third-party wrapper spans', () => {
    render(<SkeletonRows count={3} rowHeight={12} ariaLabel="Loading rows" />)

    const status = screen.getByRole('status', { name: 'Loading rows' })
    expect(status.querySelectorAll('span')).toHaveLength(3)
    expect(status.querySelector('.react-loading-skeleton')).toBeNull()
  })
})
