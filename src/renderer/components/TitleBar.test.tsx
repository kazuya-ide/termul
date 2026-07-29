import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleBar } from './TitleBar'

const { mockWindowApi, platformState, maximizeRef } = vi.hoisted(() => ({
  mockWindowApi: {
    onMaximizeChange: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn().mockResolvedValue({ success: true, data: false }),
    close: vi.fn()
  },
  platformState: { isMac: false },
  maximizeRef: { cb: null as null | ((maximized: boolean) => void) }
}))

vi.mock('@/lib/api', () => ({
  windowApi: mockWindowApi
}))

vi.mock('@/lib/platform', () => ({
  get isMac() {
    return platformState.isMac
  }
}))

describe('TitleBar (window control strip)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platformState.isMac = false
    maximizeRef.cb = null
    mockWindowApi.onMaximizeChange.mockImplementation((cb: (maximized: boolean) => void) => {
      maximizeRef.cb = cb
      return vi.fn()
    })
  })

  it('renders window controls on Windows/Linux', () => {
    render(<TitleBar />)

    expect(screen.getByRole('button', { name: 'ウィンドウを最小化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ウィンドウを最大化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ウィンドウを閉じる' })).toBeInTheDocument()
  })

  it('renders nothing on macOS (native traffic lights)', () => {
    platformState.isMac = true
    const { container } = render(<TitleBar />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: 'ウィンドウを最小化' })).not.toBeInTheDocument()
  })

  it('minimizes the window on click', () => {
    render(<TitleBar />)

    fireEvent.click(screen.getByRole('button', { name: 'ウィンドウを最小化' }))

    expect(mockWindowApi.minimize).toHaveBeenCalledTimes(1)
  })

  it('toggles maximize on click', async () => {
    render(<TitleBar />)

    fireEvent.click(screen.getByRole('button', { name: 'ウィンドウを最大化' }))

    await waitFor(() => {
      expect(mockWindowApi.toggleMaximize).toHaveBeenCalledTimes(1)
    })
  })

  it('closes the window on click', () => {
    render(<TitleBar />)

    fireEvent.click(screen.getByRole('button', { name: 'ウィンドウを閉じる' }))

    expect(mockWindowApi.close).toHaveBeenCalledTimes(1)
  })

  it('reflects maximize state via onMaximizeChange', () => {
    render(<TitleBar />)

    act(() => {
      maximizeRef.cb?.(true)
    })

    expect(screen.getByRole('button', { name: 'ウィンドウを元に戻す' })).toBeInTheDocument()
  })
})
