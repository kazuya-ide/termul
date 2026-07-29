import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommandHistoryEntry } from '@/stores/command-history-store'
import { CommandHistoryModal } from './CommandHistoryModal'

describe('CommandHistoryModal', () => {
  const mockEntries: CommandHistoryEntry[] = [
    {
      id: '1',
      command: 'bun install',
      terminalName: 'default',
      terminalId: 'term-1',
      projectId: 'proj-1',
      timestamp: Date.now() - 60000
    },
    {
      id: '2',
      command: 'bun run dev',
      terminalName: 'default',
      terminalId: 'term-1',
      projectId: 'proj-1',
      timestamp: Date.now() - 120000
    },
    {
      id: '3',
      command: 'git status',
      terminalName: 'default',
      terminalId: 'term-1',
      projectId: 'proj-1',
      timestamp: Date.now() - 180000
    }
  ]

  const mockAllEntries: CommandHistoryEntry[] = [
    ...mockEntries,
    {
      id: '4',
      command: 'cargo build',
      terminalName: 'rust',
      terminalId: 'term-2',
      projectId: 'proj-2',
      timestamp: Date.now() - 30000
    }
  ]

  const defaultProps = {
    isOpen: true,
    entries: mockEntries,
    allEntries: mockAllEntries,
    onClose: vi.fn(),
    onSelectCommand: vi.fn(),
    onClearHistory: vi.fn().mockResolvedValue(undefined)
  }

  it('should render title when open', () => {
    render(<CommandHistoryModal {...defaultProps} />)

    expect(screen.getByText('コマンド履歴')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<CommandHistoryModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('コマンド履歴')).not.toBeInTheDocument()
  })

  it('should render command entries', async () => {
    render(<CommandHistoryModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('bun install')).toBeInTheDocument()
      expect(screen.getByText('bun run dev')).toBeInTheDocument()
      expect(screen.getByText('git status')).toBeInTheDocument()
    })
  })

  it('should render terminal name and time for each entry', async () => {
    render(<CommandHistoryModal {...defaultProps} />)

    await waitFor(() => {
      const terminalNames = screen.getAllByText('default')
      expect(terminalNames).toHaveLength(3)
    })
  })

  it('should filter entries based on search query', async () => {
    render(<CommandHistoryModal {...defaultProps} />)

    const input = screen.getByPlaceholderText('コマンドを検索...')
    fireEvent.change(input, { target: { value: 'bun' } })

    await waitFor(() => {
      expect(screen.getByText('bun install')).toBeInTheDocument()
      expect(screen.getByText('bun run dev')).toBeInTheDocument()
      expect(screen.queryByText('git status')).not.toBeInTheDocument()
    })
  })

  it('should show empty state when no entries', () => {
    render(<CommandHistoryModal {...defaultProps} entries={[]} allEntries={[]} />)

    expect(screen.getByText('コマンド履歴がまだありません')).toBeInTheDocument()
  })

  it('should show empty state when no matching results', () => {
    render(<CommandHistoryModal {...defaultProps} />)

    const input = screen.getByPlaceholderText('コマンドを検索...')
    fireEvent.change(input, { target: { value: 'nonexistent' } })

    expect(screen.getByText('一致するコマンドがありません')).toBeInTheDocument()
  })

  it('should call onClose on escape key', () => {
    const onClose = vi.fn()
    render(<CommandHistoryModal {...defaultProps} onClose={onClose} />)

    const input = screen.getByPlaceholderText('コマンドを検索...')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('should call onSelectCommand and onClose when clicking an entry', async () => {
    const onSelectCommand = vi.fn()
    const onClose = vi.fn()
    render(
      <CommandHistoryModal {...defaultProps} onSelectCommand={onSelectCommand} onClose={onClose} />
    )

    await waitFor(() => {
      const entry = screen.getByText('bun install')
      fireEvent.click(entry)
    })

    expect(onSelectCommand).toHaveBeenCalledWith('bun install')
    expect(onClose).toHaveBeenCalled()
  })

  it('should select command and close on Enter key', () => {
    const onSelectCommand = vi.fn()
    const onClose = vi.fn()
    render(
      <CommandHistoryModal {...defaultProps} onSelectCommand={onSelectCommand} onClose={onClose} />
    )

    const input = screen.getByPlaceholderText('コマンドを検索...')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelectCommand).toHaveBeenCalledWith('bun install')
    expect(onClose).toHaveBeenCalled()
  })

  it('should navigate entries with arrow keys', () => {
    render(<CommandHistoryModal {...defaultProps} />)

    const input = screen.getByPlaceholderText('コマンドを検索...')

    // Arrow down should increment selection
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // Arrow up should decrement selection
    fireEvent.keyDown(input, { key: 'ArrowUp' })
  })

  it('should call onClose when clicking backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(<CommandHistoryModal {...defaultProps} onClose={onClose} />)

    const backdrop = container.querySelector('.fixed.inset-0')
    if (backdrop) {
      fireEvent.click(backdrop)
    }

    expect(onClose).toHaveBeenCalled()
  })

  it('should prevent click propagation when clicking modal content', () => {
    const onClose = vi.fn()
    render(<CommandHistoryModal {...defaultProps} onClose={onClose} />)

    const modalContent = screen.getByText('コマンド履歴').closest('.bg-card')
    if (modalContent) {
      fireEvent.click(modalContent)
    }

    expect(onClose).not.toHaveBeenCalled()
  })

  it('should display keyboard shortcuts in footer', () => {
    render(<CommandHistoryModal {...defaultProps} />)

    expect(screen.getByText(/で移動/)).toBeInTheDocument()
    expect(screen.getByText(/で挿入/)).toBeInTheDocument()
    expect(screen.getByText(/で閉じる/)).toBeInTheDocument()
  })

  // Project filter tests
  describe('Project Filter', () => {
    it('should render filter dropdown showing "This Project" by default', () => {
      render(<CommandHistoryModal {...defaultProps} />)

      expect(screen.getByText('このプロジェクト')).toBeInTheDocument()
    })

    it('should show only current project entries by default', async () => {
      render(<CommandHistoryModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('bun install')).toBeInTheDocument()
        expect(screen.getByText('git status')).toBeInTheDocument()
        expect(screen.queryByText('cargo build')).not.toBeInTheDocument()
      })
    })

    it('should show entries from all projects when filter is changed to "All Projects"', async () => {
      render(<CommandHistoryModal {...defaultProps} />)

      // Click on the filter dropdown
      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      // Select "All Projects"
      const allProjectsOption = screen.getByRole('option', { name: 'すべてのプロジェクト' })
      fireEvent.click(allProjectsOption)

      await waitFor(() => {
        expect(screen.getByText('bun install')).toBeInTheDocument()
        expect(screen.getByText('cargo build')).toBeInTheDocument()
      })
    })

    it('should filter back to current project when switching back to "This Project"', async () => {
      render(<CommandHistoryModal {...defaultProps} />)

      // Switch to All Projects
      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)
      const allProjectsOption = screen.getByRole('option', { name: 'すべてのプロジェクト' })
      fireEvent.click(allProjectsOption)

      await waitFor(() => {
        expect(screen.getByText('cargo build')).toBeInTheDocument()
      })

      // Switch back to This Project
      fireEvent.click(trigger)
      const thisProjectOption = screen.getByRole('option', { name: 'このプロジェクト' })
      fireEvent.click(thisProjectOption)

      await waitFor(() => {
        expect(screen.getByText('bun install')).toBeInTheDocument()
        expect(screen.queryByText('cargo build')).not.toBeInTheDocument()
      })
    })

    it('should maintain search query when changing project filter', async () => {
      render(<CommandHistoryModal {...defaultProps} />)

      // Type search query
      const input = screen.getByPlaceholderText('コマンドを検索...')
      fireEvent.change(input, { target: { value: 'bun' } })

      await waitFor(() => {
        expect(screen.getByText('bun install')).toBeInTheDocument()
        expect(screen.queryByText('git status')).not.toBeInTheDocument()
      })

      // Switch to All Projects
      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)
      const allProjectsOption = screen.getByRole('option', { name: 'すべてのプロジェクト' })
      fireEvent.click(allProjectsOption)

      // Search should still filter
      await waitFor(() => {
        expect(screen.getByText('bun install')).toBeInTheDocument()
        expect(screen.queryByText('cargo build')).not.toBeInTheDocument()
      })
    })
  })

  // Clear history tests
  describe('Clear History', () => {
    it('should render Clear History button in footer', () => {
      render(<CommandHistoryModal {...defaultProps} />)

      expect(screen.getByText('履歴を消去')).toBeInTheDocument()
    })

    it('should disable Clear History button when no entries', () => {
      render(<CommandHistoryModal {...defaultProps} entries={[]} allEntries={[]} />)

      const clearButton = screen.getByText('履歴を消去').closest('button')
      expect(clearButton).toBeDisabled()
    })

    it('should disable Clear History button when viewing All Projects', async () => {
      render(<CommandHistoryModal {...defaultProps} />)

      // Switch to All Projects
      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)
      const allProjectsOption = screen.getByRole('option', { name: 'すべてのプロジェクト' })
      fireEvent.click(allProjectsOption)

      await waitFor(() => {
        const clearButton = screen.getByText('履歴を消去').closest('button')
        expect(clearButton).toBeDisabled()
      })
    })

    it('should show confirmation dialog when clicking Clear History', async () => {
      render(<CommandHistoryModal {...defaultProps} />)

      const clearButton = screen.getByText('履歴を消去')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText('コマンド履歴を消去')).toBeInTheDocument()
        expect(screen.getByText(/コマンド履歴を消去しますか/)).toBeInTheDocument()
      })
    })

    it('should call onClearHistory when confirming clear', async () => {
      const onClearHistory = vi.fn().mockResolvedValue(undefined)
      render(<CommandHistoryModal {...defaultProps} onClearHistory={onClearHistory} />)

      const clearButton = screen.getByText('履歴を消去')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText('コマンド履歴を消去')).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: '消去' })
      fireEvent.click(confirmButton)

      expect(onClearHistory).toHaveBeenCalledTimes(1)
    })

    it('should not call onClearHistory when canceling clear', async () => {
      const onClearHistory = vi.fn().mockResolvedValue(undefined)
      render(<CommandHistoryModal {...defaultProps} onClearHistory={onClearHistory} />)

      const clearButton = screen.getByText('履歴を消去')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText('コマンド履歴を消去')).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: 'キャンセル' })
      fireEvent.click(cancelButton)

      expect(onClearHistory).not.toHaveBeenCalled()
    })

    it('should close confirmation dialog after clearing', async () => {
      const onClearHistory = vi.fn().mockResolvedValue(undefined)
      render(<CommandHistoryModal {...defaultProps} onClearHistory={onClearHistory} />)

      const clearButton = screen.getByText('履歴を消去')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText('コマンド履歴を消去')).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: '消去' })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.queryByText('コマンド履歴を消去')).not.toBeInTheDocument()
      })
    })
  })
})
