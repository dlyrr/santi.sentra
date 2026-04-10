import { ipcMain } from 'electron'

export function registerNewsHandlers(): void {
  // Get announcements - DISABLED for security (no public announcements API)
  ipcMain.handle('news:get-announcements', async () => {
    try {
      console.log('[News] News announcements disabled for security')
      return []
    } catch (error) {
      console.error('[News] Error getting announcements:', error)
      return []
    }
  })

  // Create announcement - DISABLED (no authentication mechanism in place)
  // Remove this handler entirely - admin features should not be exposed via IPC without auth
  ipcMain.handle(
    'news:create-announcement',
    async (_event, _content: string, _username: string, _media?: any[]) => {
      console.warn('[News] Create announcement blocked: Feature disabled for security')
      throw new Error('News creation is disabled. Contact administrators.')
    }
  )

  // Delete announcement - DISABLED (backdoor: no authentication check)
  // CRITICAL: This handler was accepting requests without any authentication
  ipcMain.handle('news:delete-announcement', (_event, _id: string) => {
    console.warn('[News] Delete announcement blocked: No authentication mechanism')
    throw new Error('News deletion is disabled. Contact administrators.')
  })

  // Update announcement - DISABLED (backdoor: no authentication check)
  // CRITICAL: This handler was accepting requests without any authentication
  ipcMain.handle('news:update-announcement', (_event, _id: string, _updates: any) => {
    console.warn('[News] Update announcement blocked: No authentication mechanism')
    throw new Error('News update is disabled. Contact administrators.')
  })
}

