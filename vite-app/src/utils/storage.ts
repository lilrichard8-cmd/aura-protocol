// LocalStorage工具函数

export const storage = {
  // 点赞记录
  getLikedPosts: (): string[] => {
    const saved = localStorage.getItem('likedPosts')
    return saved ? JSON.parse(saved) : []
  },
  
  addLikedPost: (postId: string) => {
    const liked = storage.getLikedPosts()
    if (!liked.includes(postId)) {
      liked.push(postId)
      localStorage.setItem('likedPosts', JSON.stringify(liked))
    }
  },
  
  removeLikedPost: (postId: string) => {
    const liked = storage.getLikedPosts()
    const filtered = liked.filter(id => id !== postId)
    localStorage.setItem('likedPosts', JSON.stringify(filtered))
  },
  
  isPostLiked: (postId: string): boolean => {
    return storage.getLikedPosts().includes(postId)
  },

  // 收藏记录
  getSavedPosts: (): string[] => {
    const saved = localStorage.getItem('savedPosts')
    return saved ? JSON.parse(saved) : []
  },
  
  addSavedPost: (postId: string) => {
    const saves = storage.getSavedPosts()
    if (!saves.includes(postId)) {
      saves.push(postId)
      localStorage.setItem('savedPosts', JSON.stringify(saves))
    }
  },
  
  removeSavedPost: (postId: string) => {
    const saves = storage.getSavedPosts()
    const filtered = saves.filter(id => id !== postId)
    localStorage.setItem('savedPosts', JSON.stringify(filtered))
  },

  // 草稿
  getDrafts: (): any[] => {
    const saved = localStorage.getItem('drafts')
    return saved ? JSON.parse(saved) : []
  },
  
  saveDraft: (draft: any) => {
    const drafts = storage.getDrafts()
    const existing = drafts.findIndex(d => d.id === draft.id)
    
    if (existing >= 0) {
      drafts[existing] = draft
    } else {
      drafts.push(draft)
    }
    
    localStorage.setItem('drafts', JSON.stringify(drafts))
  },
  
  deleteDraft: (draftId: string) => {
    const drafts = storage.getDrafts()
    const filtered = drafts.filter(d => d.id !== draftId)
    localStorage.setItem('drafts', JSON.stringify(filtered))
  },

  // 用户发布的内容
  getPosts: (): any[] => {
    const saved = localStorage.getItem('aura_posts')
    return saved ? JSON.parse(saved) : []
  },

  savePost: (post: any) => {
    const posts = storage.getPosts()
    posts.unshift(post)
    localStorage.setItem('aura_posts', JSON.stringify(posts))
  },

  // 浏览历史
  addToHistory: (item: any) => {
    const history = storage.getHistory()
    const filtered = history.filter((h: any) => h.id !== item.id)
    filtered.unshift(item)
    const limited = filtered.slice(0, 50) // 只保留最近50个
    localStorage.setItem('browsingHistory', JSON.stringify(limited))
  },
  
  getHistory: (): any[] => {
    const saved = localStorage.getItem('browsingHistory')
    return saved ? JSON.parse(saved) : []
  },
}
