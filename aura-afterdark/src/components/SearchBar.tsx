import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  className?: string
}

export const SearchBar: FC<SearchBarProps> = ({
  placeholder = '搜索用户、内容、标签...',
  onSearch,
  className = '',
}) => {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedQuery = query.trim()
    
    if (trimmedQuery) {
      if (onSearch) {
        onSearch(trimmedQuery)
      } else {
        navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`)
      }
    }
  }

  const handleClear = () => {
    setQuery('')
  }

  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 bg-aura-surface border border-aura-border rounded-full focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
        />
        
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-aura-text-secondary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Search Button (hidden, triggered by form submission) */}
        <button type="submit" className="hidden">
          搜索
        </button>
      </div>
    </form>
  )
}