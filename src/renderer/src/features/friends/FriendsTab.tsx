import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search,
  User,
  Play,
  Gamepad2,
  UserPlus,
  Wrench,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Star,
  Wifi,
  WifiOff
} from 'lucide-react'
import CustomDropdown from '@renderer/components/UI/menus/CustomDropdown'
import { Friend, AccountStatus, Account } from '@renderer/types'
import {
  getStatusRingColor,
  getStatusColor
} from '@renderer/utils/statusUtils'
import UniversalProfileModal from '@renderer/components/Modals/UniversalProfileModal'
import AddFriendModal from './Modals/AddFriendModal'
import FriendRequestsModal from './Modals/FriendRequestsModal'
import FriendContextMenu from './UI/FriendContextMenu'
import { Button } from '@renderer/components/UI/buttons/Button'
import { Input } from '@renderer/components/UI/inputs/Input'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from '@renderer/components/UI/display/Tooltip'
import { Card } from '@renderer/components/UI/display/Card'
import { Avatar, AvatarImage, AvatarFallback } from '@renderer/components/UI/display/Avatar'
import { SkeletonFriendGrid } from '@renderer/components/UI/display/SkeletonGrid'
import { EmptyState } from '@renderer/components/UI/feedback/EmptyState'
import { ErrorMessage } from '@renderer/components/UI/feedback/ErrorMessage'
import { useFriends, useFriendRequests, useUnfriend, queryKeys } from '@renderer/hooks/queries'
import {
  useFriendsStore,
  useFavoriteFriends,
  useToggleFavoriteFriend
} from '@renderer/stores/useFriendsStore'
import { useSetSelectedGame } from '@renderer/stores/useUIStore'
import { useSelectedIds } from '@renderer/stores/useSelectionStore'
import { useAccountsManager } from '@renderer/hooks/queries'
import { mapPresenceToStatus } from '@renderer/utils/statusUtils'

interface FriendsTabProps {
  selectedAccount: Account | null
  onFriendJoin: (placeId: string | number, jobId?: string, userId?: string | number) => void
  onFriendsCountChange?: (count: number) => void
}

type FilterType = 'All' | 'Online' | 'InGame' | 'Favorites'

const FriendsTab = ({ selectedAccount, onFriendJoin, onFriendsCountChange }: FriendsTabProps) => {
  const queryClient = useQueryClient()

  // Store State
  const {
    searchQuery: friendSearchQuery,
    scrollPosition,
    setSearchQuery: setFriendSearchQuery,
    setScrollPosition
  } = useFriendsStore()

  const favorites = useFavoriteFriends()
  const toggleFavorite = useToggleFavoriteFriend()

  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false)
  const [isFriendRequestsModalOpen, setIsFriendRequestsModalOpen] = useState(false)
  const [activeContextMenu, setActiveContextMenu] = useState<{
    id: string
    userId: number
    x: number
    y: number
  } | null>(null)
  const friendsListRef = useRef<HTMLDivElement>(null)

  const selectedIds = useSelectedIds()
  const { accounts } = useAccountsManager()

  const targetAccounts = useMemo(() => {
    if (selectedIds.size > 0) {
      return accounts.filter((a) => selectedIds.has(a.id) && a.cookie)
    }
    return selectedAccount && selectedAccount.cookie ? [selectedAccount] : []
  }, [selectedAccount, selectedIds, accounts])

  const friendsQueries = useQueries({
    queries: targetAccounts.map((acc) => ({
      queryKey: queryKeys.friends.list(acc.id),
      queryFn: async (): Promise<Friend[]> => {
        if (!acc.cookie) return []
        const fetchedFriends = await window.api.getFriends(acc.cookie, acc.userId ? parseInt(acc.userId) : undefined)
        return fetchedFriends.map((f: any) => ({
          id: f.id,
          accountId: acc.id,
          displayName: f.displayName || f.username || `User ${f.userId || f.id}`,
          username: f.username || f.displayName || `user_${f.userId || f.id}`,
          userId: f.userId,
          avatarUrl: f.avatarUrl,
          status: mapPresenceToStatus(f.userPresenceType),
          description: f.description,
          gameActivity: f.placeId
            ? { name: f.lastLocation || 'Unknown Game', placeId: f.placeId.toString(), jobId: f.gameId }
            : undefined
        }))
      },
      staleTime: 60 * 1000,
      refetchInterval: 60 * 1000
    }))
  })

  const isLoading = friendsQueries.some((q) => q.isLoading)
  const isFetching = friendsQueries.some((q) => q.isFetching)
  
  const friends = useMemo(() => {
    const allFriends = friendsQueries.flatMap((q) => q.data || [])
    // Deduplicate by userId
    const unique = new Map<string, Friend>()
    allFriends.forEach((f) => unique.set(String(f.userId), f))
    return Array.from(unique.values())
  }, [friendsQueries])

  const { data: friendRequests = [] } = useFriendRequests(selectedAccount)
  const friendRequestCount = friendRequests.length

  const unfriendMutation = useUnfriend(selectedAccount)

  // Effects
  useEffect(() => {
    onFriendsCountChange?.(friends.length)
  }, [friends.length, onFriendsCountChange])

  // Status polling is handled by TanStack Query's refetchInterval in useFriends hook
  // No need for custom interval here to avoid duplicate polling and memory leaks

  useEffect(() => {
    if (targetAccounts.length === 0) onFriendsCountChange?.(0)
  }, [targetAccounts.length, onFriendsCountChange])

  useEffect(() => {
    if (friendsListRef.current && scrollPosition > 0 && !isLoading) {
      friendsListRef.current.scrollTop = scrollPosition
    }
  }, [isLoading, scrollPosition])

  // Filtering & Sorting
  const filteredFriends = useMemo(() => {
    if (targetAccounts.length === 0) return []

    let filtered = friends.filter((f) => {
      const displayName = f.displayName || ''
      const username = f.username || ''
      const matchesSearch =
        displayName.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
        username.toLowerCase().includes(friendSearchQuery.toLowerCase())
      return matchesSearch
    })

    // Apply Active Filter
    if (activeFilter === 'Favorites') {
      filtered = filtered.filter((f) => favorites.includes(String(f.userId)))
    } else if (activeFilter === 'Online') {
      filtered = filtered.filter(
        (f) =>
          f.status === AccountStatus.Online ||
          f.status === AccountStatus.InGame ||
          f.status === AccountStatus.InStudio
      )
    } else if (activeFilter === 'InGame') {
      filtered = filtered.filter(
        (f) => f.status === AccountStatus.InGame || f.status === AccountStatus.InStudio
      )
    }

    return filtered.sort((a, b) => {
      // Favorites first
      const isAFav = favorites.includes(String(a.userId))
      const isBFav = favorites.includes(String(b.userId))
      if (isAFav && !isBFav) return -1
      if (!isAFav && isBFav) return 1

      // Then status
      const statusOrder = {
        [AccountStatus.InGame]: 0,
        [AccountStatus.Online]: 1,
        [AccountStatus.InStudio]: 1,
        [AccountStatus.Offline]: 2,
        [AccountStatus.Banned]: 3
      }
      const orderA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 3
      const orderB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 3

      if (orderA !== orderB) return orderA - orderB

      // Then name
      return a.displayName.localeCompare(b.displayName)
    })
  }, [targetAccounts.length, friendSearchQuery, friends, activeFilter, favorites])

  type SectionKey = 'Favorites' | AccountStatus | 'InGameNoJoin'

  const getSectionKey = useCallback(
    (friend: Friend): SectionKey => {
      if (favorites.includes(String(friend.userId))) return 'Favorites'
      if (friend.status === AccountStatus.InGame && !friend.gameActivity?.placeId) {
        return 'InGameNoJoin'
      }
      return friend.status
    },
    [favorites]
  )

  const groupedFriends = useMemo(() => {
    const groups: Partial<Record<SectionKey, Friend[]>> = {}

    filteredFriends.forEach((friend) => {
      const key = getSectionKey(friend)
      if (!groups[key]) groups[key] = []
      groups[key]!.push(friend)
    })

    return groups
  }, [filteredFriends, getSectionKey])

  const handleUnfriend = async (targetUserId: number) => {
    if (!selectedAccount || !selectedAccount.cookie) return
    try {
      await unfriendMutation.mutateAsync(targetUserId)
      setActiveContextMenu(null)
    } catch (err) {
      console.error('Failed to unfriend:', err)
    }
  }

  const setSelectedGame = useSetSelectedGame()
  const handleGameClick = async (placeId: string) => {
    try {
      const games = await window.api.getGamesByPlaceIds([placeId])
      if (games && games.length > 0) setSelectedGame(games[0])
    } catch (err) {
      console.error('Failed to fetch game details:', err)
    }
  }

  const handleRequestCountChange = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.friends.requests(selectedAccount?.id || '')
    })
  }, [queryClient, selectedAccount?.id])

  const toggleSection = (key: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(key)) newCollapsed.delete(key)
    else newCollapsed.add(key)
    setCollapsedSections(newCollapsed)
  }

  const sections: { key: SectionKey; label: string; icon?: any; color?: string }[] = [
    { key: 'Favorites', label: 'Favorites', icon: Star, color: 'text-yellow-500' },
    { key: AccountStatus.InGame, label: 'In Game', icon: Gamepad2, color: 'text-emerald-500' },
    {
      key: 'InGameNoJoin',
      label: 'In Game (Joins Off)',
      icon: Gamepad2,
      color: 'text-emerald-500'
    },
    { key: AccountStatus.InStudio, label: 'In Studio', icon: Wrench, color: 'text-orange-500' },
    { key: AccountStatus.Online, label: 'Online', icon: Wifi, color: 'text-blue-500' },
    { key: AccountStatus.Offline, label: 'Offline', icon: WifiOff, color: 'text-[var(--color-text-muted)]' },
    { key: AccountStatus.Banned, label: 'Banned', icon: User, color: 'text-red-500' }
  ]

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-[var(--color-app-bg)]">
        {/* Toolbar */}
        <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-4 shrink-0">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Friends</h1>
            <span className="flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold tracking-tight text-[var(--color-text-secondary)]">
              {filteredFriends.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
              {targetAccounts.length > 1 && (
                <Button variant="default" onClick={() => setIsAddFriendModalOpen(true)} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700">
                  <UserPlus size={16} />
                  <span>Bulk Add Friend</span>
                </Button>
              )}
              {targetAccounts.length === 1 && (
                <Button variant="default" onClick={() => setIsAddFriendModalOpen(true)} className="gap-2 shrink-0 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover-2)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                  <UserPlus size={16} />
                  <span>Add Friend</span>
                </Button>
              )}
              {targetAccounts.length === 1 && (
                <Button variant="secondary" onClick={() => setIsFriendRequestsModalOpen(true)} className="gap-2 shrink-0 relative bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover-2)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                  <Users size={16} />
                  <span>Requests</span>
                  {friendRequestCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-[var(--color-text-primary)] ring-2 ring-[var(--color-surface-strong)]">
                      {friendRequestCount > 99 ? '99+' : friendRequestCount}
                    </span>
                  )}
                </Button>
              )}

            <CustomDropdown
              options={[
                { value: 'All', label: 'All Friends', icon: <Users size={16} /> },
                {
                  value: 'Favorites',
                  label: 'Favorites',
                  icon: <Star size={16} className="text-yellow-500" />
                },
                {
                  value: 'Online',
                  label: 'Online',
                  icon: <Wifi size={16} className="text-blue-500" />
                },
                {
                  value: 'InGame',
                  label: 'In Game',
                  icon: <Gamepad2 size={16} className="text-emerald-500" />
                }
              ]}
              value={activeFilter}
              onChange={(value) => setActiveFilter(value as FilterType)}
              className="w-40"
            />

            <div className="relative w-48 lg:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-[var(--color-text-muted)]" />
              </div>
              <Input
                type="text"
                placeholder="Search..."
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    friendsQueries.forEach(q => q.refetch())
                  }}
                  disabled={isLoading || isFetching || targetAccounts.length === 0}
                >
                  <RefreshCw size={18} className={isLoading || isFetching ? 'animate-spin' : ''} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh Friends</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--color-app-bg)] relative" ref={friendsListRef}>
          {targetAccounts.length === 0 ? (
            <EmptyState
              icon={User}
              title="No Accounts Selected"
              description="Select one or more accounts to view friends."
            />
          ) : isLoading ? (
            <SkeletonFriendGrid count={12} />
          ) : friendsQueries.some(q => q.error) ? (
            <ErrorMessage
              message="There was a problem communicating with Roblox."
              onRetry={() => friendsQueries.forEach(q => q.refetch())}
            />
          ) : filteredFriends.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                friendSearchQuery ? 'No friends match your search' : 'Your friends list is empty'
              }
              description={
                friendSearchQuery
                  ? 'Try adjusting the filters or search for a different name.'
                  : 'Add friends to quickly join their games and check their status.'
              }
              action={
                !friendSearchQuery && (
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => setIsAddFriendModalOpen(true)}
                    disabled={!selectedAccount}
                  >
                    <UserPlus size={16} />
                    Add Friend
                  </Button>
                )
              }
              className="h-full"
            />
          ) : (
            <div className="space-y-4">
              {sections.map(({ key, label, icon: Icon, color }) => {
                const friendsInGroup = groupedFriends[key] || []
                if (friendsInGroup.length === 0) return null

                const isCollapsed = collapsedSections.has(key)

                return (
                  <div key={key} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button
                      onClick={() => toggleSection(key)}
                      className="w-full flex items-center gap-3 py-3 group select-none outline-none"
                    >
                      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] ${color}`}>
                        {Icon && <Icon size={14} />}
                        {label}
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]/60 px-2 py-0.5 rounded-full">
                        {friendsInGroup.length}
                      </span>
                      <div className="flex-1 h-px bg-white/5 ml-2" />
                      {isCollapsed ? (
                        <ChevronRight size={14} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors" />
                      ) : (
                        <ChevronDown size={14} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors" />
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-2">
                        {friendsInGroup.map((friend) => {
                          const canJoinFriend = Boolean(friend.gameActivity?.placeId)
                          const shouldShowJoinButton =
                            friend.status === AccountStatus.InGame && canJoinFriend
                          const isFavorite = favorites.includes(friend.userId)

                          return (
                            <motion.div
                              key={friend.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <Card
                                onClick={() => {
                                  setSelectedFriend(friend)
                                  setIsInfoModalOpen(true)
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  setActiveContextMenu({
                                    id: friend.id,
                                    userId: parseInt(friend.userId, 10),
                                    x: e.clientX,
                                    y: e.clientY
                                  })
                                }}
                                className="relative flex items-center p-4 bg-[var(--color-surface)]/60 border-white/5 hover:border-white/10 hover:bg-[var(--color-surface-hover)]/60 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 group cursor-pointer hover:-translate-y-0.5 h-[88px] overflow-hidden"
                              >
                                {/* Avatar glow derived from status */}
                                {(friend.status === AccountStatus.InGame || friend.status === AccountStatus.Online) && (
                                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
                                )}

                                <div className="relative mr-4 shrink-0">
                                  <Avatar className="w-14 h-14 ring-2 ring-white/5 group-hover:ring-white/10 transition-all">
                                    <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                                    <AvatarFallback>
                                      {friend.displayName.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div
                                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[var(--color-border)] ${getStatusColor(friend.status)} ${friend.status === AccountStatus.Online || friend.status === AccountStatus.InGame || friend.status === AccountStatus.InStudio ? 'status-dot-pulse' : ''}`}
                                  />

                                  {isFavorite && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 rounded-full p-1 z-10 shadow-md shadow-yellow-900/30">
                                      <Star size={9} className="fill-black text-black" />
                                    </div>
                                  )}
                                </div>

                                 <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                  <h3 className="font-bold text-[var(--color-text-primary)] truncate text-sm leading-none group-hover:text-[var(--color-text-primary)] transition-colors">
                                    {friend.displayName}
                                  </h3>
                                  <span className="text-xs text-[var(--color-text-muted)] truncate leading-none">
                                    @{friend.username}
                                  </span>
                                  {friend.gameActivity && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {friend.status === AccountStatus.InStudio ? (
                                        <Wrench size={12} className="text-orange-400 shrink-0" />
                                      ) : (
                                        <Gamepad2 size={12} className="text-emerald-400 shrink-0" />
                                      )}
                                      <span
                                        className={`text-xs font-medium truncate hover:underline cursor-pointer ${friend.status === AccountStatus.InStudio ? 'text-orange-400' : 'text-emerald-400'}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (friend.gameActivity?.placeId)
                                            handleGameClick(friend.gameActivity.placeId)
                                        }}
                                      >
                                        {friend.gameActivity.name}
                                      </span>
                                    </div>
                                  )}
                                </div>


                                {shouldShowJoinButton && (
                                  <Button
                                    variant="default"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[var(--color-text-primary)] shadow-lg shadow-emerald-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      friend.gameActivity &&
                                        onFriendJoin(
                                          friend.gameActivity.placeId,
                                          friend.gameActivity.jobId,
                                          friend.userId
                                        )
                                    }}
                                  >
                                    <Play size={14} fill="currentColor" />
                                  </Button>
                                )}
                              </Card>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <UniversalProfileModal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          userId={selectedFriend?.userId || null}
          selectedAccount={selectedAccount}
          onJoinGame={onFriendJoin}
          initialData={{
            name: selectedFriend?.username,
            displayName: selectedFriend?.displayName,
            status: selectedFriend?.status,
            lastLocation: selectedFriend?.gameActivity?.name,
            headshotUrl: selectedFriend?.avatarUrl,
            description: selectedFriend?.description
          }}
        />

        {targetAccounts.length === 1 && (
        <FriendRequestsModal
          isOpen={isFriendRequestsModalOpen}
          onClose={() => setIsFriendRequestsModalOpen(false)}
          selectedAccount={targetAccounts[0]}
          onFriendAdded={() => friendsQueries.forEach(q => q.refetch())}
          onRequestCountChange={handleRequestCountChange}
        />
      )}

        <AddFriendModal
          isOpen={isAddFriendModalOpen}
          onClose={() => setIsAddFriendModalOpen(false)}
          selectedAccount={targetAccounts[0] || null}
          onFriendRequestSent={() => friendsQueries.forEach(q => q.refetch())}
        />

        <FriendContextMenu
          activeMenu={activeContextMenu}
          isFavorite={
            activeContextMenu ? favorites.includes(activeContextMenu.userId.toString()) : false
          }
          onClose={() => setActiveContextMenu(null)}
          onUnfriend={handleUnfriend}
          onToggleFavorite={(userId) => toggleFavorite(userId.toString())}
        />
      </div>
    </TooltipProvider>
  )
}

export default FriendsTab
