import { useState, useMemo, useEffect, useRef } from 'react'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Users, Clock, ChevronRight, User, RefreshCw } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import { Account } from '@renderer/types'
import { Button } from '@renderer/components/UI/buttons/Button'
import { Input } from '@renderer/components/UI/inputs/Input'
import { Avatar, AvatarImage, AvatarFallback } from '@renderer/components/UI/display/Avatar'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from '@renderer/components/UI/display/Tooltip'
import { EmptyState } from '@renderer/components/UI/feedback/EmptyState'
import { ErrorMessage } from '@renderer/components/UI/feedback/ErrorMessage'
import { Tabs } from '@renderer/components/UI/navigation/Tabs'
import VerifiedIcon from '@renderer/components/UI/icons/VerifiedIcon'
import { formatNumber } from '@renderer/utils/numberUtils'
import {
  useActiveGroupsTab,
  useSetActiveGroupsTab,
  useSelectedGroupId,
  useSetSelectedGroupId,
  useGroupsSearchQuery,
  useSetGroupsSearchQuery
} from './stores/useGroupsStore'
import { useSelectedIds } from '@renderer/stores/useSelectionStore'
import { useAccountsManager } from '@renderer/hooks/queries'
import { queryKeys } from '@shared/queryKeys'
import {
  type GroupMembership,
  type PendingGroupRequest
} from './api/useGroups'
import type { ChangeEvent } from 'react'
import UniversalProfileModal from '@renderer/components/Modals/UniversalProfileModal'
import { GroupDetailsPanel } from './components/GroupDetailsPanel'
import AccessoryDetailsModal from '@renderer/features/avatar/Modals/AccessoryDetailsModal'

interface GroupsTabProps {
  selectedAccount: Account | null
}

// Sidebar Group Item Component
interface GroupItemProps {
  group: {
    id: number
    name: string
    memberCount?: number
    hasVerifiedBadge?: boolean
  }
  role?: {
    name: string
    rank: number
  }
  thumbnail?: string
  isSelected: boolean
  isPending?: boolean
  created?: string
  selectedAccountsCount?: number
  onClick: () => void
}

const GroupItem = ({ group, role, thumbnail, isSelected, isPending, selectedAccountsCount, onClick }: GroupItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onClick}
        className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group overflow-hidden ${
          isSelected
            ? 'bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] shadow-[0_10px_30px_rgba(0,0,0,0.28)]'
            : 'hover:bg-[var(--color-surface-hover)] border border-transparent'
        }`}
      >
        {isSelected && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--accent-color)]" />
        )}
        <Avatar className="w-10 h-10 rounded-lg border border-[var(--color-border-strong)] shrink-0">
          <AvatarImage src={thumbnail} alt={group.name} />
          <AvatarFallback className="rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]">
            {group.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-medium truncate text-sm ${
                isSelected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'
              }`}
            >
              {group.name}
            </span>
            {group.hasVerifiedBadge && <VerifiedIcon width={14} height={14} className="shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            {role && !isPending && <span className="truncate">{role.name}</span>}
            {isPending && (
              <span className="text-yellow-500 flex items-center gap-1">
                <Clock size={10} />
                Pending
              </span>
            )}
            {group.memberCount && (
              <span className="flex items-center gap-1">
                <Users size={12} />
                {formatNumber(group.memberCount)}
              </span>
            )}
            {selectedAccountsCount && selectedAccountsCount > 1 ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <User size={12} />
                {selectedAccountsCount} Selected
              </span>
            ) : null}
          </div>
        </div>

        <ChevronRight
          size={16}
          className={`shrink-0 transition-colors ${
            isSelected
              ? 'text-[var(--color-text-muted)]'
              : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
          }`}
        />
      </button>
    </motion.div>
  )
}

// Main Groups Tab Component
const GroupsTab = ({ selectedAccount }: GroupsTabProps) => {
  // Store state
  const activeTab = useActiveGroupsTab()
  const setActiveTab = useSetActiveGroupsTab()
  const selectedGroupId = useSelectedGroupId()
  const setSelectedGroupId = useSetSelectedGroupId()
  const searchQuery = useGroupsSearchQuery()
  const setSearchQuery = useSetGroupsSearchQuery()

  // Profile modal state
  const [profileUserId, setProfileUserId] = useState<number | null>(null)
  const [selectedStoreItem, setSelectedStoreItem] = useState<{
    id: number
    name: string
    imageUrl?: string
  } | null>(null)

  const selectedIds = useSelectedIds()
  const { accounts } = useAccountsManager()
  const targetAccounts = useMemo(() => {
    if (selectedIds.size > 0) {
      return accounts.filter((a) => selectedIds.has(a.id) && a.cookie)
    }
    return selectedAccount && selectedAccount.cookie ? [selectedAccount] : []
  }, [selectedAccount, selectedIds, accounts])
  const [sidebarWidth, setSidebarWidth] = useState(320) // default to 80 * 4
  const [isResizing, setIsResizing] = useState(false)
  const sidebarWidthRef = useRef(sidebarWidth)
  const MIN_SIDEBAR_WIDTH = 240
  const MAX_SIDEBAR_WIDTH = 480
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  const resizeOriginRef = useRef(0)

  const clampWidth = (width: number) =>
    Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH)

  // Keep ref in sync
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  // Restore saved width
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('groupsSidebarWidth')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!Number.isNaN(parsed)) {
          setSidebarWidth(clampWidth(parsed))
        }
      }
    } catch (error) {
      console.error('Failed to load groups sidebar width', error)
    }
  }, [])

  // Handle drag-to-resize lifecycle
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent) => {
      const newWidth = clampWidth(event.clientX - resizeOriginRef.current)
      setSidebarWidth(newWidth)
      sidebarWidthRef.current = newWidth
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      try {
        window.localStorage.setItem('groupsSidebarWidth', sidebarWidthRef.current.toString())
      } catch (error) {
        console.error('Failed to save groups sidebar width', error)
      }
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Get user ID
  const userId = selectedAccount?.userId ? parseInt(selectedAccount.userId, 10) : null

  // Queries
  const joinedQueries = useQueries({
    queries: targetAccounts.map((acc) => ({
      queryKey: queryKeys.groups.userGroups(acc.userId ? parseInt(acc.userId) : 0),
      queryFn: async (): Promise<GroupMembership[]> => {
        const uid = acc.userId ? parseInt(acc.userId) : null
        if (!uid) return []
        const groups = await window.api.getUserGroupsFull(uid)
        if (groups.length === 0) return []
        const groupIds = groups.map((g: any) => g.group.id)
        const thumbnails = await window.api.getGroupThumbnails(groupIds)
        return groups.map((g: any) => ({
          ...g,
          thumbnail: thumbnails[g.group.id] || ''
        }))
      },
      staleTime: 60 * 1000
    }))
  })

  const pendingQueries = useQueries({
    queries: targetAccounts.map((acc) => ({
      queryKey: queryKeys.groups.pending(acc.id),
      queryFn: async (): Promise<PendingGroupRequest[]> => {
        if (!acc.cookie) return []
        const pending = await window.api.getPendingGroupRequests(acc.cookie)
        if (pending.length === 0) return []
        const groupIds = pending.map((g: any) => g.group.id)
        const thumbnails = await window.api.getGroupThumbnails(groupIds)
        return pending.map((g: any) => ({ ...g, thumbnail: thumbnails[g.group.id] || '' }))
      },
      staleTime: 30 * 1000
    }))
  })

  const joinedGroups = useMemo(() => {
    const all = joinedQueries.flatMap(q => q.data || [])
    const unique = new Map<number, GroupMembership & { selectedAccountsCount?: number }>()
    const counts = new Map<number, number>()
    
    all.forEach(g => {
      counts.set(g.group.id, (counts.get(g.group.id) || 0) + 1)
      if (!unique.has(g.group.id)) {
        unique.set(g.group.id, g)
      }
    })
    
    return Array.from(unique.values()).map(g => ({
      ...g,
      selectedAccountsCount: counts.get(g.group.id)
    }))
  }, [joinedQueries])

  const pendingGroups = useMemo(() => {
    const all = pendingQueries.flatMap(q => q.data || [])
    const unique = new Map<number, PendingGroupRequest & { selectedAccountsCount?: number }>()
    const counts = new Map<number, number>()
    
    all.forEach(g => {
      counts.set(g.group.id, (counts.get(g.group.id) || 0) + 1)
      if (!unique.has(g.group.id)) {
        unique.set(g.group.id, g)
      }
    })
    
    return Array.from(unique.values()).map(g => ({
      ...g,
      selectedAccountsCount: counts.get(g.group.id)
    }))
  }, [pendingQueries])

  const joinedLoading = joinedQueries.some(q => q.isLoading)
  const pendingLoading = pendingQueries.some(q => q.isLoading)
  const joinedFetching = joinedQueries.some(q => q.isFetching)
  const pendingFetching = pendingQueries.some(q => q.isFetching)
  const joinedError = joinedQueries.some(q => q.error)
  const pendingError = pendingQueries.some(q => q.error)

  // Filter groups by search
  const filteredJoinedGroups = useMemo(() => {
    if (!searchQuery.trim()) return joinedGroups
    const query = searchQuery.toLowerCase()
    return joinedGroups.filter(
      (g: GroupMembership) =>
        g.group.name.toLowerCase().includes(query) || g.role.name.toLowerCase().includes(query)
    )
  }, [joinedGroups, searchQuery])

  const filteredPendingGroups = useMemo(() => {
    if (!searchQuery.trim()) return pendingGroups
    const query = searchQuery.toLowerCase()
    return pendingGroups.filter((g: PendingGroupRequest) =>
      g.group.name.toLowerCase().includes(query)
    )
  }, [pendingGroups, searchQuery])

  const displayGroups = activeTab === 'joined' ? filteredJoinedGroups : filteredPendingGroups
  const isLoading = activeTab === 'joined' ? joinedLoading : pendingLoading
  const isFetching = activeTab === 'joined' ? joinedFetching : pendingFetching
  const error = activeTab === 'joined' ? joinedError : pendingError

  // Get the selected group's user role (for joined groups)
  const selectedGroupMembership = useMemo(() => {
    if (activeTab !== 'joined' || !selectedGroupId) return null
    return joinedGroups.find((g) => g.group.id === selectedGroupId)
  }, [activeTab, selectedGroupId, joinedGroups])

  const handleRefresh = () => {
    if (activeTab === 'joined') {
      joinedQueries.forEach(q => q.refetch())
    } else {
      pendingQueries.forEach(q => q.refetch())
    }
  }

  // Auto-select first group when data loads or tab changes
  useEffect(() => {
    if (!isLoading && displayGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(displayGroups[0].group.id)
    }
  }, [isLoading, displayGroups, selectedGroupId, setSelectedGroupId])

  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedGroupId(null)
    setSearchQuery('')
  }, [activeTab, setSelectedGroupId, setSearchQuery])

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-[var(--color-app-bg)]">
        {/* Toolbar */}
        <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Groups</h1>
          </div>

          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isLoading || isFetching || !selectedAccount}
                >
                  <RefreshCw size={18} className={isLoading || isFetching ? 'animate-spin' : ''} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh Groups</TooltipContent>
            </Tooltip>
            
          </div>
        </div>

        {/* Main Content */}
        {targetAccounts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={Users}
              title="No Accounts Selected"
              description="Select one or more accounts to view groups."
            />
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Sidebar */}
            <div
              ref={sidebarRef}
              className={`relative border-r border-[var(--color-border)] flex flex-col shrink-0 bg-[var(--color-surface)]/30 ${!isResizing ? 'transition-[width] duration-150 ease-in-out' : ''}`}
              style={{ width: `${sidebarWidth}px` }}
            >
              {/* Sidebar Tabs */}
              <Tabs
                tabs={[
                  {
                    id: 'joined',
                    label: 'Joined',
                    icon: Users
                  },
                  {
                    id: 'pending',
                    label: 'Pending',
                    icon: Clock
                  }
                ]}
                activeTab={activeTab}
                onTabChange={(tabId: string) => setActiveTab(tabId as 'joined' | 'pending')}
                layoutId="groupsSidebarTabIndicator"
              />

              {/* Search */}
              <div className="p-3 border-b border-[var(--color-border)]">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-[var(--color-text-muted)]" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>

              {/* Groups List */}
              <div className="flex-1 overflow-hidden p-2">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <div className="space-y-2 p-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-hover)] animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-24 bg-[var(--color-surface-hover)] rounded animate-pulse" />
                            <div className="h-3 w-16 bg-[var(--color-surface-hover)] rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="p-4">
                      <ErrorMessage
                        message="There was an error communicating with Roblox."
                        onRetry={handleRefresh}
                      />
                    </div>
                  ) : displayGroups.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full text-center p-4"
                    >
                      <Users size={32} className="text-[var(--color-text-muted)] mb-2" />
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {searchQuery
                          ? 'No groups match your search'
                          : activeTab === 'joined'
                            ? 'No groups joined yet'
                            : 'No pending requests'}
                      </p>
                    </motion.div>
                  ) : (
                    <Virtuoso
                      data={displayGroups as (GroupMembership | PendingGroupRequest)[]}
                      overscan={200}
                      itemContent={(_index, item) => {
                        if (activeTab === 'joined') {
                          const joinedItem = item as GroupMembership & { selectedAccountsCount?: number }
                          return (
                            <GroupItem
                              key={joinedItem.group.id}
                              group={joinedItem.group}
                              role={joinedItem.role}
                              thumbnail={joinedItem.thumbnail}
                              isSelected={selectedGroupId === joinedItem.group.id}
                              selectedAccountsCount={joinedItem.selectedAccountsCount}
                              onClick={() => setSelectedGroupId(joinedItem.group.id)}
                            />
                          )
                        } else {
                          const pendingItem = item as PendingGroupRequest & { selectedAccountsCount?: number }
                          return (
                            <GroupItem
                              key={pendingItem.group.id}
                              group={pendingItem.group}
                              thumbnail={pendingItem.thumbnail}
                              isSelected={selectedGroupId === pendingItem.group.id}
                              isPending
                              created={pendingItem.created}
                              selectedAccountsCount={pendingItem.selectedAccountsCount}
                              onClick={() => setSelectedGroupId(pendingItem.group.id)}
                            />
                          )
                        }
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Resize Handle */}
              <div
                className="absolute top-0 right-0 h-full cursor-col-resize z-20"
                style={{
                  right: '-2px',
                  width: '4px',
                  background: isResizing ? 'rgb(115, 115, 115)' : 'transparent'
                }}
                onMouseDown={() => {
                  const left = sidebarRef.current?.getBoundingClientRect().left ?? 0
                  resizeOriginRef.current = left
                  setIsResizing(true)
                }}
              >
                <div className="absolute inset-0 hover:bg-[var(--color-surface-hover)] transition-colors" />
              </div>
            </div>

            {/* Details Panel */}
            <GroupDetailsPanel
              groupId={selectedGroupId}
              selectedAccount={selectedAccount}
              isPending={activeTab === 'pending'}
              userRole={selectedGroupMembership?.role}
              onViewProfile={(userId) => setProfileUserId(userId)}
              onStoreItemSelect={(item) => setSelectedStoreItem(item)}
            />
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <UniversalProfileModal
        isOpen={!!profileUserId}
        onClose={() => setProfileUserId(null)}
        userId={profileUserId}
        selectedAccount={selectedAccount}
        initialData={null}
      />

      <AccessoryDetailsModal
        isOpen={!!selectedStoreItem}
        onClose={() => setSelectedStoreItem(null)}
        assetId={selectedStoreItem?.id || null}
        account={selectedAccount}
        initialData={
          selectedStoreItem
            ? { name: selectedStoreItem.name, imageUrl: selectedStoreItem.imageUrl || '' }
            : undefined
        }
      />
    </TooltipProvider>
  )
}

export default GroupsTab
