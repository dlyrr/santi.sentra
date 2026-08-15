import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Account } from '@renderer/types'
import AccessoryContextMenu from './UI/AccessoryContextMenu'
import RenameOutfitModal from './Modals/RenameOutfitModal'
import ConfirmModal from '@renderer/components/UI/dialogs/ConfirmModal'
import AccessoryDetailsModal from './Modals/AccessoryDetailsModal'
import { useNotification } from '@renderer/features/system/stores/useSnackbarStore'
import { Box } from 'lucide-react';
import { Button } from '@renderer/components/UI/buttons/Button';
import { useAvatarRenderResize } from '@renderer/hooks/useAvatarRenderResize'
import {
  useCurrentAvatar,
  useInventory,
  useUserOutfits,
  useFavoriteItems,
  useAccountsManager
} from '@renderer/hooks/queries'
import { useInvalidateAvatar3D } from './hooks/useAvatar3DManifest'
import { useAvatarStore } from './stores/useAvatarStore'
import { AvatarViewport } from './components/AvatarViewport'
import { InventoryGrid } from './components/InventoryGrid'
import { CategorySelector } from './components/CategorySelector'
import { SearchBar } from './components/SearchBar'
import { useInventoryFilter } from './hooks/useInventoryFilter'
import { useAvatarActions } from './hooks/useAvatarActions'
import { useBulkInventory } from './hooks/useBulkInventory'
import { useSelectedIds } from '@renderer/stores/useSelectionStore'
import {
  CATEGORIES,
  getAssetTypeIds,
  isInventoryCategory,
  type MainCategory
} from './utils/categoryUtils'

interface AvatarTabProps {
  account: Account | null
}

interface InventoryItem {
  id: number
  name: string
  type: string
  imageUrl: string
}

const AvatarTab: React.FC<AvatarTabProps> = ({ account }) => {
  const { showNotification } = useNotification()

  const {
    mainCategory,
    subCategory,
    searchQuery,
    scrollPosition,
    setMainCategory,
    setSubCategory,
    setSearchQuery,
    setScrollPosition
  } = useAvatarStore()

  const avatarRenderContainerRef = useRef<HTMLDivElement | null>(null)
  const { avatarRenderWidth, isResizing, handleResizeStart } =
    useAvatarRenderResize(avatarRenderContainerRef)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024)
  const [resetCameraSignal, setResetCameraSignal] = useState(0)
  const [isResettingBulk, setIsResettingBulk] = useState(false)

  const selectedIds = useSelectedIds()
  const { accounts = [] } = useAccountsManager()
  // For multi-account mode: track if reset gate has been cleared
  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedIds.has(a.id)),
    [accounts, selectedIds]
  )
  const selectedAccountIds = useMemo(() => selectedAccounts.map((a) => a.id), [selectedAccounts])

  const effectiveAccount = account || (selectedAccounts.length > 0 ? selectedAccounts[0] : null)
  const isBulkMode = selectedIds.size >= 2

  const [isRendering, setIsRendering] = useState(false)
  const [renderText, setRenderText] = useState('')

  const handleRenderStart = useCallback(() => {
    setIsRendering(true)
  }, [])

  const handleRenderComplete = useCallback(() => {
    setIsRendering(false)
  }, [])

  const handleRenderError = useCallback((_error: string) => {
    setIsRendering(false)
  }, [])

  const handleRenderStatusChange = useCallback((status: string) => {
    setRenderText(status)
  }, [])

  const resetCamera = useCallback(() => {
    setResetCameraSignal((signal) => signal + 1)
  }, [])

  const renderAvatar = useCallback(async (_userId: string) => {}, [])

  const { data: currentAvatarData, refetch: refetchCurrentAvatar } = useCurrentAvatar(effectiveAccount)
  const { data: favoriteItems = [] } = useFavoriteItems()
  const { invalidateAvatar } = useInvalidateAvatar3D()

  const assetTypeIds = useMemo(() => {
    return getAssetTypeIds(mainCategory, subCategory)
  }, [mainCategory, subCategory])

  const isInventoryCat = isInventoryCategory(mainCategory)

  const { data: singleInventoryData = [], isLoading: isLoadingSingleInventory } = useInventory(
    effectiveAccount,
    assetTypeIds,
    { enabled: isInventoryCat && assetTypeIds.length > 0 && !isBulkMode }
  )

  const { data: bulkInventoryData = [], isLoading: isLoadingBulkInventory } = useBulkInventory(
    selectedAccounts,
    assetTypeIds,
    { enabled: isInventoryCat && assetTypeIds.length > 0 && isBulkMode }
  )

  const inventoryData = isBulkMode ? bulkInventoryData : singleInventoryData
  const isLoadingInventory = isBulkMode ? isLoadingBulkInventory : isLoadingSingleInventory

  const isEditable = subCategory === 'Creations'
  const { data: outfitsData = [], isLoading: isLoadingOutfits } = useUserOutfits(
    effectiveAccount,
    isEditable
  )

  const equippedIds = useMemo(() => {
    return new Set<number>(currentAvatarData?.assets.map((a) => a.id) || [])
  }, [currentAvatarData])

  const currentAvatarAssets = useMemo(() => {
    return currentAvatarData?.assets || []
  }, [currentAvatarData])

  const currentBodyColors = currentAvatarData?.bodyColors || null
  const currentScales = currentAvatarData?.scales || null
  const currentAvatarType = currentAvatarData?.playerAvatarType || null

  const favoriteIds = useMemo(() => {
    return new Set<number>(favoriteItems.map((f) => f.id))
  }, [favoriteItems])

  const currentlyWearingItems = useMemo((): InventoryItem[] => {
    if (!currentAvatarData?.assets) return []
    return currentAvatarData.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.assetType?.name || 'Equipped Item',
      imageUrl: '' // Will be fetched separately if needed
    }))
  }, [currentAvatarData])

  const inventoryItems = useMemo((): InventoryItem[] => {
    if (mainCategory === 'Currently Wearing') {
      return currentlyWearingItems
    }
    if (mainCategory === 'Favorites') {
      return favoriteItems
    }
    if (mainCategory === 'Characters') {
      return outfitsData
    }
    return inventoryData
  }, [mainCategory, currentlyWearingItems, favoriteItems, outfitsData, inventoryData])

  const isLoading =
    mainCategory === 'Characters' ? isLoadingOutfits : isInventoryCat ? isLoadingInventory : false

  const { filteredItems } = useInventoryFilter({
    inventoryItems,
    searchQuery,
    favoriteIds
  })

  const {
    isUpdatingAvatar,
    loadingItemId,
    favoriteBurstKeys,
    handleFavorite,
    toggleEquip,
    handleRename,
    handleUpdateWithWorn,
    handleDeleteOutfit
  } = useAvatarActions({
    account: effectiveAccount,
    accounts: selectedAccounts,
    isBulkMode,
    mainCategory,
    subCategory,
    inventoryItems,
    currentAvatarAssets,
    equippedIds,
    favoriteIds,
    renderAvatar,
    refetchCurrentAvatar
  })

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean
    outfitId: number | null
    currentName: string
  }>({ isOpen: false, outfitId: null, currentName: '' })

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean
    outfitId: number | null
    outfitName: string
  }>({ isOpen: false, outfitId: null, outfitName: '' })

  const [selectedAccessory, setSelectedAccessory] = useState<{
    id: number
    name: string
    imageUrl: string
  } | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    id: number
    name: string
    isFavorite: boolean
    x: number
    y: number
    canEdit?: boolean
  } | null>(null)

  const handleContextMenu = (e: React.MouseEvent, item: InventoryItem) => {
    e.preventDefault()
    const isCreation = mainCategory === 'Characters' && subCategory === 'Creations'
    setContextMenu({
      id: item.id,
      name: item.name,
      isFavorite: favoriteIds.has(item.id),
      x: e.clientX,
      y: e.clientY,
      canEdit: isCreation
    })
  }

  const handleCopyId = (id: number) => {
    navigator.clipboard.writeText(id.toString())
    showNotification('Accessory ID copied to clipboard', 'success')
  }

  const handleFavoriteFromMenu = async (id: number, name: string) => {
    await handleFavorite(id, name)
  }

  const handleMainCategoryChange = (category: MainCategory) => {
    setMainCategory(category)
    setSubCategory(CATEGORIES[category][0])
    setScrollPosition(0)
  }

  const handleRefreshAvatar = async () => {
    if (effectiveAccount?.userId) {
      await refetchCurrentAvatar()
      invalidateAvatar(effectiveAccount.userId)
    }
  }

  const handleDeleteOutfitWithConfirmation = (outfitId: number, name: string) => {
    setDeleteConfirmation({
      isOpen: true,
      outfitId,
      outfitName: name
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmation.outfitId) return
    await handleDeleteOutfit(deleteConfirmation.outfitId)
    setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }))
  }

  const openRenameModal = (id: number, currentName: string) => {
    setRenameModal({ isOpen: true, outfitId: id, currentName })
  }

  const openDetailsModal = (id: number) => {
    const item = inventoryItems.find((i) => i.id === id)
    if (item) {
      setSelectedAccessory({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl
      })
    } else {
      setSelectedAccessory({
        id,
        name: 'Unknown Item',
        imageUrl: ''
      })
    }
  }

  const handleUpdate = async () => {
    await refetchCurrentAvatar()
    if (effectiveAccount?.userId) {
      invalidateAvatar(effectiveAccount.userId)
    }
  }

  if (!effectiveAccount) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        Please select an account or multiple accounts to view the avatar editor
      </div>
    )
  }

  // Multi-account bulk mode — no reset gate, go straight to editor

  return (
    <div className="flex h-full flex-col">
      {/* Compact Toolbar */}
      <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4 shrink-0">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-none">Avatar</h1>
          {isBulkMode && (
            <span className="flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Bulk
            </span>
          )}
        </div>
        {isBulkMode && (
          <Button
            variant="destructive"
            size="sm"
            disabled={isResettingBulk}
            onClick={async () => {
              setIsResettingBulk(true)
              try {
                for (const account of selectedAccounts) {
                  if (account.cookie) {
                    await window.api.setWearingAssets(account.cookie, [])
                  }
                }
                showNotification(`Reset ${selectedAccounts.length} avatars to default`, 'success')
              } catch (err) {
                console.error(err)
                showNotification('Failed to reset all avatars', 'error')
              } finally {
                setIsResettingBulk(false)
              }
            }}
            className="gap-2 h-9 px-3"
          >
            <span className="text-sm font-semibold">Reset All</span>
          </Button>
        )}
      </div>

      {effectiveAccount && (
        <div className="flex h-[calc(100%-80px)] flex-col gap-6 lg:flex-row">
          <div className="w-full lg:w-1/2 h-full">
            <AvatarViewport
              userId={effectiveAccount?.userId}
              cookie={effectiveAccount?.cookie}
              account={effectiveAccount}
              currentAvatarType={
                currentAvatarType === 'R6' || currentAvatarType === 'R15' ? currentAvatarType : null
              }
              isRendering={isRendering}
              renderText={renderText}
              onRefresh={handleRefreshAvatar}
              onReset={resetCamera}
              resetSignal={resetCameraSignal}
              onRenderStart={handleRenderStart}
              onRenderComplete={handleRenderComplete}
              onRenderError={handleRenderError}
              onRenderStatusChange={handleRenderStatusChange}
              isLargeScreen={isLargeScreen}
              isResizing={isResizing}
              onResizeStart={handleResizeStart}
              avatarRenderWidth={avatarRenderWidth}
              containerRef={avatarRenderContainerRef}
            />
          </div>

          <div className="w-full lg:w-1/2 h-full bg-[var(--color-app-bg)] flex flex-col min-w-0">
            <div className="flex flex-col border-b border-[var(--color-border)] bg-[var(--color-app-bg)] z-10 shadow-sm">
              <CategorySelector
                mainCategory={mainCategory}
                subCategory={subCategory}
                onMainCategoryChange={handleMainCategoryChange}
                onSubCategoryChange={setSubCategory}
              />

              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                placeholder={`Search ${subCategory}...`}
                show={!(mainCategory === 'Body' && (subCategory === 'Skin' || subCategory === 'Scale'))}
              />
            </div>

            <InventoryGrid
              account={effectiveAccount}
              filteredItems={filteredItems}
              isLoading={isLoading}
              isUpdatingAvatar={isUpdatingAvatar}
              loadingItemId={loadingItemId}
              equippedIds={equippedIds}
              favoriteIds={favoriteIds}
              favoriteBurstKeys={favoriteBurstKeys}
              mainCategory={mainCategory}
              subCategory={subCategory}
              currentBodyColors={currentBodyColors}
              currentScales={currentScales}
              currentAvatarType={currentAvatarType}
              onItemClick={toggleEquip}
              onItemContextMenu={handleContextMenu}
              onUpdate={handleUpdate}
              scrollPosition={scrollPosition}
              onScroll={setScrollPosition}
            />
          </div>
        </div>
      )}

      <AccessoryContextMenu
        activeMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onViewDetails={openDetailsModal}
        onFavorite={handleFavoriteFromMenu}
        onCopyId={handleCopyId}
        onRename={openRenameModal}
        onUpdate={handleUpdateWithWorn}
        onDelete={handleDeleteOutfitWithConfirmation}
      />

      <AccessoryDetailsModal
        isOpen={!!selectedAccessory}
        onClose={() => setSelectedAccessory(null)}
        assetId={selectedAccessory?.id || null}
        account={effectiveAccount}
        initialData={
          selectedAccessory
            ? {
                name: selectedAccessory.name,
                imageUrl: selectedAccessory.imageUrl
              }
            : undefined
        }
      />

      <RenameOutfitModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={handleRename}
        outfitId={renameModal.outfitId}
        currentName={renameModal.currentName}
      />

      <ConfirmModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDelete}
        title="Delete Outfit"
        message={`Are you sure you want to delete the outfit "${deleteConfirmation.outfitName}"? This action cannot be undone.`}
        confirmText="Delete"
        isDangerous={true}
      />
    </div>
  )
}

export default AvatarTab
