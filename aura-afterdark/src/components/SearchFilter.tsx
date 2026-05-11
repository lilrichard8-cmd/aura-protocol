import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchFilterProps {
  filters: { value: string; label: string }[]
  activeFilter: string
  onFilterChange: (filter: string) => void
  placeholder?: string
}

export const SearchFilter: FC<SearchFilterProps> = ({
  filters,
  activeFilter,
  onFilterChange,
  placeholder = '搜索内容...'
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <form onSubmit={handleSearch}>
        <div 
          className="relative"
          onMouseEnter={() => setShowFilters(true)}
          onMouseLeave={() => setShowFilters(false)}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-6 py-4 pl-14 bg-aura-surface border border-aura-border rounded-full focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl">
            🔍
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-aura-text-secondary hover:text-aura-text transition-colors"
            >
              ✕
            </button>
          )}

          {/* Filters - show on hover */}
          <div 
            className={`absolute top-full left-0 right-0 mt-2 transition-all duration-300 z-50 ${
              showFilters ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
            }`}
          >
            <div className="bg-aura-bg/90 backdrop-blur-xl border border-aura-border rounded-2xl p-3 shadow-2xl">
              <div className="flex gap-2 flex-wrap">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => onFilterChange(filter.value)}
                    type="button"
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                      activeFilter === filter.value
                        ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                        : 'bg-aura-surface text-aura-text-secondary hover:bg-aura-card'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Hint */}
      {!showFilters && (
        <div className="text-xs text-aura-text-secondary text-center">
          💡 鼠标移到搜索框显示筛选选项
        </div>
      )}
    </div>
  )
}