import { RefObject } from 'react'
import { AlertCircle, Info, CheckCircle, RotateCcw } from 'lucide-react'
import { WatcherEvent } from '../hooks/useWatcher'

interface WatcherEventLogProps {
  events: WatcherEvent[]
  endRef?: RefObject<HTMLDivElement | null>
}

/**
 * WatcherEventLog - Displays real-time event log from the watcher
 */
export default function WatcherEventLog({
  events,
  endRef
}: WatcherEventLogProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'session-started':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'session-crashed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'session-restarted':
        return <RotateCcw className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Info className="w-4 h-4 text-[var(--color-text-muted)]" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'session-started':
        return 'text-green-500'
      case 'session-crashed':
        return 'text-red-500'
      case 'session-restarted':
        return 'text-yellow-500'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-[var(--color-text-muted)]'
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
        <p className="text-[var(--color-text-muted)]">No events yet</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col border border-[var(--color-border)] rounded-[var(--control-radius)] bg-[var(--color-surface)]">
      {/* Content */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] styled-scrollbar">
        {events.map((event, index) => {
          const detailStr = event.details 
            ? Object.entries(event.details).map(([k, v]) => `${k}: ${v}`).join(' | ') 
            : null

          return (
            <div
              key={index}
              className="border-b border-[var(--color-border)] px-3 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors group flex gap-2.5"
            >
              <div className="mt-0.5 shrink-0">
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] text-[var(--color-text-muted)] tracking-wider">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className={`font-semibold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-surface-strong)] border border-[var(--color-border)] ${getEventColor(event.type)}`}>
                    {event.type.replace(/^session-/, '').replace(/-/g, ' ')}
                  </span>
                  {event.username !== 'system' && (
                    <span className="text-[10px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)] truncate max-w-[120px]">
                      @{event.username}
                    </span>
                  )}
                </div>
                <div className="text-[var(--color-text-primary)] leading-snug">
                  {event.message.replace(`for ${event.username}`, '').replace(`[${event.username}]`, '').trim()}
                </div>
                {detailStr && (
                  <div className="text-[var(--color-text-muted)] mt-1 text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
                    <span className="text-amber-500/50 mr-1">↳</span>
                    {detailStr}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-3 py-2 bg-[var(--color-surface-strong)] text-[10px] font-medium text-[var(--color-text-muted)] flex items-center justify-between">
        <span>{events.length} EVENT{events.length !== 1 ? 'S' : ''} RECORDED</span>
        <span className="opacity-50">REAL-TIME LOG</span>
      </div>
    </div>
  )
}
