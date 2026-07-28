import { useMemo } from 'react'
import { Info, Edit3, RefreshCw, Trash2, Home, ExternalLink, Copy, Receipt } from 'lucide-react'
import { Account } from '@renderer/types'
import GenericContextMenu, { ContextMenuSection } from './GenericContextMenu'

interface ContextMenuProps {
  activeMenu: { id: string; x: number; y: number } | null
  accounts: Account[]
  onViewDetails: (account: Account) => void
  onEditNote: (id: string) => void
  onReauth: (id: string) => void
  onOpenBrowserHome: (id: string) => void
  onOpenBrowserCustom: (id: string) => void
  onGetCookie?: (id: string) => void
  onRemove: (id: string) => void
  selectedIds?: Set<string>
  onBulkOpenBrowsers?: () => void
  onBulkCopyCookies?: () => void
  onBulkRemove?: () => void
  onBulkOpenBrowserCustom?: () => void
  onBulkEditNote?: () => void
  onBulkReauth?: () => void
  onChangeDisplayName?: (id: string) => void
  onBulkChangeDisplayName?: () => void
  onClose?: () => void
}

const ContextMenu = ({
  activeMenu,
  accounts,
  onViewDetails,
  onEditNote,
  onReauth,
  onOpenBrowserHome,
  onOpenBrowserCustom,
  onGetCookie,
  onRemove,
  selectedIds,
  onBulkOpenBrowsers,
  onBulkCopyCookies,
  onBulkRemove,
  onBulkOpenBrowserCustom,
  onBulkEditNote,
  onBulkReauth,
  onChangeDisplayName,
  onBulkChangeDisplayName,
  onClose = () => {}
}: ContextMenuProps) => {

  const sections: ContextMenuSection[] = useMemo(() => {
    if (!activeMenu) return []

    const account = accounts.find((a) => a.id === activeMenu.id)

    // If the right-clicked account is part of a multiple selection, show Bulk Actions
    if (selectedIds && selectedIds.size > 1 && selectedIds.has(activeMenu.id)) {
      return [
        {
          items: [
            {
              label: `Open Browsers (${selectedIds.size})`,
              icon: <ExternalLink size={16} />,
              onClick: () => onBulkOpenBrowsers?.()
            },
            {
              label: `Open Custom Browsers (${selectedIds.size})`,
              icon: <ExternalLink size={16} />,
              onClick: () => onBulkOpenBrowserCustom?.()
            },
            {
              label: `Copy Cookies (${selectedIds.size})`,
              icon: <Copy size={16} />,
              onClick: () => onBulkCopyCookies?.()
            },
            {
              label: `Edit Notes (${selectedIds.size})`,
              icon: <Edit3 size={16} />,
              onClick: () => onBulkEditNote?.()
            },
            {
              label: `Change Display Names (${selectedIds.size})`,
              icon: <Edit3 size={16} />,
              onClick: () => onBulkChangeDisplayName?.()
            },
            {
              label: `Reauthenticate (${selectedIds.size})`,
              icon: <RefreshCw size={16} />,
              onClick: () => onBulkReauth?.()
            }
          ]
        },
        {
          items: [
            {
              label: `Remove Selected (${selectedIds.size})`,
              icon: <Trash2 size={16} />,
              onClick: () => onBulkRemove?.(),
              variant: 'danger' as const
            }
          ]
        }
      ]
    }

    // Always show single-account options when right-clicking (independent of selection state)
    // This allows users to right-click any account to get its options without needing to select it
    return [
      {
        items: [
          {
            label: 'View Details',
            icon: <Info size={16} />,
            onClick: () => account && onViewDetails(account)
          },
          {
            label: 'Open Home',
            icon: <Home size={16} />,
            onClick: () => onOpenBrowserHome(activeMenu.id)
          },
          {
            label: 'Open Custom',
            icon: <ExternalLink size={16} />,
            onClick: () => onOpenBrowserCustom(activeMenu.id)
          },
          {
            label: 'Get Cookie',
            icon: <Copy size={16} />,
            onClick: () => onGetCookie?.(activeMenu.id)
          },
          {
            label: 'Change Display Name',
            icon: <Edit3 size={16} />,
            onClick: () => onChangeDisplayName?.(activeMenu.id)
          },
          {
            label: 'Edit Note',
            icon: <Edit3 size={16} />,
            onClick: () => onEditNote(activeMenu.id)
          },
          {
            label: 'Re-authenticate',
            icon: <RefreshCw size={16} />,
            onClick: () => onReauth(activeMenu.id)
          }
        ]
      },
      {
        items: [
          {
            label: 'Remove Account',
            icon: <Trash2 size={16} />,
            onClick: () => onRemove(activeMenu.id),
            variant: 'danger' as const
          }
        ]
      }
    ]
  }, [
    activeMenu, accounts, onViewDetails, onEditNote, onReauth, 
    onOpenBrowserHome, onOpenBrowserCustom, onGetCookie, onRemove,
    selectedIds, onBulkOpenBrowsers, onBulkCopyCookies, onBulkRemove,
    onBulkOpenBrowserCustom, onBulkEditNote, onBulkReauth,
    onChangeDisplayName, onBulkChangeDisplayName, onClose
  ])
  return (
    <GenericContextMenu
      position={activeMenu ? { x: activeMenu.x, y: activeMenu.y } : null}
      sections={sections}
      onClose={onClose}
      width={192}
    />
  )
}

export default ContextMenu
