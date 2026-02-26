import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export const SearchBar: FC = () => {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto mb-6">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索创作者、内容、标签..."
          className="w-full px-6 py-4 pl-14 bg-white/5 border border-white/10 rounded-full focus:outline-none focus:border-aura-purple transition-colors text-white placeholder-gray-500"
        />
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl">
          🔍
        </div>
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  )
}
