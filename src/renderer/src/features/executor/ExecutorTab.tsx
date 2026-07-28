import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ExternalLink, ShieldCheck, Code, Play } from 'lucide-react'
import { EXECUTORS, SELLERS, type Executor, type ExecutorPlan, type Seller } from './types'

const ExecutorTab: React.FC = () => {
  const [selectedSeller, setSelectedSeller] = useState<Seller>(SELLERS[0])
  const [showSellerDropdown, setShowSellerDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSellerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePurchase = (_plan: ExecutorPlan, _executor: Executor) => {
    // Open the selected seller's website
    window.open(`${selectedSeller.url}`, '_blank')
  }

  // Calculate discounted price based on seller
  const getDiscountedPrice = (originalPrice: number): number => {
    if (!selectedSeller.discount) return originalPrice
    
    const discountMatch = selectedSeller.discount.match(/(\d+)%/)
    if (!discountMatch) return originalPrice
    
    const discountPercent = parseInt(discountMatch[1], 10)
    return originalPrice * (1 - discountPercent / 100)
  }

  // Filter and sort executors by cheapest price first (best value) for selected seller
  const sortedExecutors = [...EXECUTORS]
    .filter(executor => selectedSeller.executors.includes(executor.id))
    .sort((a, b) => {
      const cheapestA = Math.min(...a.plans.map(plan => getDiscountedPrice(plan.price)))
      const cheapestB = Math.min(...b.plans.map(plan => getDiscountedPrice(plan.price)))
      return cheapestA - cheapestB
    })

  return (
    <div className="relative flex h-full flex-col overflow-y-auto overflow-x-hidden bg-[#0A0A0B] text-[var(--color-text-primary)]">
      <div className="relative z-10 flex flex-col gap-4 p-4 h-full">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
                <Code className="h-5 w-5 text-[var(--accent-color)]" />
                Script Executor
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Premium selection with the best deals</p>
            </div>
            {/* Seller Selection - Moved to Header */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowSellerDropdown(!showSellerDropdown)}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-left flex items-center justify-between hover:border-[var(--accent-color-border)] transition-colors whitespace-nowrap min-w-[200px]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-primary)] text-sm font-medium">{selectedSeller.name}</span>
                  {selectedSeller.discount && (
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">{selectedSeller.discount} off</span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--color-text-secondary)] transition-transform ml-2 ${showSellerDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showSellerDropdown && (
                <div className="absolute top-full right-0 mt-2 bg-[#121214] border border-white/10 rounded-xl shadow-2xl z-20 min-w-[220px] overflow-hidden">
                  {SELLERS.map((seller) => (
                    <button
                      key={seller.id}
                      onClick={() => {
                        setSelectedSeller(seller)
                        setShowSellerDropdown(false)
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <ExternalLink className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-[var(--color-text-primary)] text-sm font-medium">{seller.name}</span>
                        {seller.discount && (
                          <span className="text-xs font-bold text-emerald-400">{seller.discount} discount</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Executor Grid - Compact Layout */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
            {sortedExecutors.map((executor) => (
              <motion.div
                key={executor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/20 rounded-xl border border-white/5 overflow-hidden hover:border-[var(--accent-color-border)] hover:bg-black/40 transition-all shadow-sm backdrop-blur-md"
              >
                <div className="p-3">
                  <div className="flex items-center gap-2.5 mb-3">
                    <img
                      src={executor.icon}
                      alt={executor.name}
                      className="w-8 h-8 object-contain drop-shadow-md rounded-md bg-white/5 p-0.5 shrink-0"
                    />
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                      {executor.name}
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    {executor.plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="flex items-center justify-between gap-1.5 p-2 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                            {plan.name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-1 flex-shrink-0">
                          {selectedSeller.discount ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-[var(--color-text-muted)] line-through leading-none mb-0.5">
                                ${plan.price.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-emerald-400 leading-none">
                                ${getDiscountedPrice(plan.price).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-400">
                              ${plan.price.toFixed(2)}
                            </span>
                          )}
                          <button
                            onClick={() => handlePurchase(plan, executor)}
                            className="px-2 py-1 rounded-md transition-colors flex items-center gap-1 flex-shrink-0 font-bold text-[11px]"
                            style={{
                              backgroundColor: 'var(--accent-color)',
                              color: 'var(--accent-color-foreground)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--accent-color-muted)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--accent-color)'
                            }}
                          >
                            Buy <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExecutorTab