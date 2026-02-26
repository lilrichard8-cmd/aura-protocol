// 模拟区块链交互服务
// 让用户能完整体验所有链上功能

// 模拟延迟（让体验更真实）
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 模拟用户数据存储
const mockDatabase = {
  users: new Map(),
  posts: new Map(),
  transactions: [] as any[],
  balances: new Map(),
  offers: [] as any[],
  proposals: [] as any[],
}

// 初始化当前用户余额
const initUserBalance = (walletAddress: string) => {
  if (!mockDatabase.balances.has(walletAddress)) {
    mockDatabase.balances.set(walletAddress, {
      ora: 10000, // 初始10000 $ORA
      sol: 5.0,   // 初始5 SOL
      pending: 0,
    })
  }
}

export const mockBlockchain = {
  // 1. 用户注册
  async registerUser(walletAddress: string, username: string, profileUri: string) {
    await delay(1500) // 模拟链上确认时间
    
    const user = {
      wallet: walletAddress,
      username,
      profileUri,
      followers: 0,
      following: 0,
      posts: 0,
      reputation: 5.0,
      createdAt: Date.now(),
    }
    
    mockDatabase.users.set(walletAddress, user)
    initUserBalance(walletAddress)
    
    return {
      success: true,
      txHash: `TX${Date.now()}`,
      user,
    }
  },

  // 2. 发布内容
  async publishContent(
    walletAddress: string,
    arweaveId: string,
    title: string,
    contentType: string,
    price: number
  ) {
    await delay(2000)
    
    initUserBalance(walletAddress)
    const balance = mockDatabase.balances.get(walletAddress)
    
    // 检查余额（NFT铸造费50 $ORA）
    const mintFee = 50
    if (balance.ora < mintFee) {
      throw new Error(`余额不足！需要${mintFee} $ORA，当前${balance.ora} $ORA`)
    }
    
    // 扣除铸造费
    balance.ora -= mintFee
    
    const post = {
      id: `post-${Date.now()}`,
      author: walletAddress,
      arweaveId,
      title,
      contentType,
      price,
      likes: 0,
      views: 0,
      createdAt: Date.now(),
    }
    
    mockDatabase.posts.set(post.id, post)
    
    // 更新用户发帖数
    const user = mockDatabase.users.get(walletAddress)
    if (user) user.posts += 1
    
    // 记录交易
    mockDatabase.transactions.push({
      type: 'publish',
      from: walletAddress,
      amount: mintFee,
      timestamp: Date.now(),
      txHash: `TX${Date.now()}`,
    })
    
    // 代币分发（发布奖励）
    const publishReward = 100
    balance.ora += publishReward
    
    return {
      success: true,
      txHash: `TX${Date.now()}`,
      postId: post.id,
      mintFee,
      reward: publishReward,
      newBalance: balance.ora,
    }
  },

  // 3. 购买内容
  async purchaseContent(buyerAddress: string, postId: string, price: number) {
    await delay(1500)
    
    initUserBalance(buyerAddress)
    const balance = mockDatabase.balances.get(buyerAddress)
    
    if (balance.ora < price) {
      throw new Error(`余额不足！需要${price} $ORA，当前${balance.ora} $ORA`)
    }
    
    // 扣除购买金额
    balance.ora -= price
    
    const post = mockDatabase.posts.get(postId)
    if (post) {
      const creatorShare = price * 0.95
      const platformFee = price * 0.05
      
      // 创作者收益（进入pending，7天后可提取）
      initUserBalance(post.author)
      const creatorBalance = mockDatabase.balances.get(post.author)
      creatorBalance.pending += creatorShare
      
      mockDatabase.transactions.push({
        type: 'purchase',
        from: buyerAddress,
        to: post.author,
        amount: price,
        creatorShare,
        platformFee,
        timestamp: Date.now(),
        txHash: `TX${Date.now()}`,
      })
      
      return {
        success: true,
        txHash: `TX${Date.now()}`,
        paid: price,
        creatorReceived: creatorShare,
        platformFee,
        newBalance: balance.ora,
      }
    }
    
    throw new Error('内容未找到')
  },

  // 4. 打赏
  async tipCreator(fromAddress: string, toAddress: string, amount: number) {
    await delay(1000)
    
    initUserBalance(fromAddress)
    const balance = mockDatabase.balances.get(fromAddress)
    
    if (balance.ora < amount) {
      throw new Error(`余额不足！需要${amount} $ORA`)
    }
    
    balance.ora -= amount
    
    initUserBalance(toAddress)
    const creatorBalance = mockDatabase.balances.get(toAddress)
    creatorBalance.pending += amount // 100%归创作者，进入pending
    
    mockDatabase.transactions.push({
      type: 'tip',
      from: fromAddress,
      to: toAddress,
      amount,
      timestamp: Date.now(),
      txHash: `TX${Date.now()}`,
    })
    
    return {
      success: true,
      txHash: `TX${Date.now()}`,
      amount,
      newBalance: balance.ora,
    }
  },

  // 5. 发起求购
  async makeOffer(buyerAddress: string, postId: string, offerAmount: number, message: string) {
    await delay(1500)
    
    initUserBalance(buyerAddress)
    const balance = mockDatabase.balances.get(buyerAddress)
    
    if (balance.ora < offerAmount) {
      throw new Error(`余额不足！需要${offerAmount} $ORA`)
    }
    
    // 托管到国库
    balance.ora -= offerAmount
    balance.pending += offerAmount // 显示在pending中
    
    const offer = {
      id: `offer-${Date.now()}`,
      postId,
      buyer: buyerAddress,
      amount: offerAmount,
      message,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24小时后
    }
    
    mockDatabase.offers.push(offer)
    
    return {
      success: true,
      offerId: offer.id,
      escrowed: offerAmount,
      expiresIn: '24小时',
    }
  },

  // 6. 投票
  async voteOnProposal(voterAddress: string, proposalId: string, voteFor: boolean, voteWeight: number) {
    await delay(1000)
    
    mockDatabase.transactions.push({
      type: 'vote',
      from: voterAddress,
      proposalId,
      voteFor,
      weight: voteWeight,
      timestamp: Date.now(),
      txHash: `TX${Date.now()}`,
    })
    
    return {
      success: true,
      txHash: `TX${Date.now()}`,
      voteFor,
      weight: voteWeight,
    }
  },

  // 7. 获取用户余额
  async getBalance(walletAddress: string) {
    await delay(300)
    initUserBalance(walletAddress)
    return mockDatabase.balances.get(walletAddress)
  },

  // 8. 获取交易历史
  async getTransactions(walletAddress: string) {
    await delay(500)
    return mockDatabase.transactions
      .filter(tx => tx.from === walletAddress || tx.to === walletAddress)
      .sort((a, b) => b.timestamp - a.timestamp)
  },

  // 9. 关注用户
  async followUser(followerAddress: string, targetAddress: string) {
    await delay(800)
    
    mockDatabase.transactions.push({
      type: 'follow',
      from: followerAddress,
      to: targetAddress,
      timestamp: Date.now(),
      txHash: `TX${Date.now()}`,
    })
    
    return { success: true }
  },

  // 10. 点赞内容
  async likePost(_userAddress: string, postId: string) {
    await delay(500)
    
    const post = mockDatabase.posts.get(postId)
    if (post) {
      post.likes += 1
    }
    
    return { success: true }
  },
}

// 模拟Arweave上传
export const mockArweave = {
  async upload(file: File) {
    await delay(2000) // 模拟上传时间
    
    // 生成假的Arweave交易ID
    const txId = Array.from({ length: 43 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
        [Math.floor(Math.random() * 64)]
    ).join('')
    
    return {
      id: txId,
      url: `https://arweave.net/${txId}`,
      size: file.size,
    }
  },

  async get(_txId: string) {
    await delay(500)
    return {
      data: null, // 模拟数据
      contentType: 'image/jpeg',
    }
  },
}

// 模拟数据库
export const mockDB = {
  async savePost(post: any) {
    await delay(300)
    localStorage.setItem(`post-${post.id}`, JSON.stringify(post))
    return { success: true }
  },

  async getPost(postId: string) {
    await delay(200)
    const saved = localStorage.getItem(`post-${postId}`)
    return saved ? JSON.parse(saved) : null
  },

  async searchPosts(_query: string) {
    await delay(500)
    // 简单搜索逻辑
    return []
  },

  async getUserPosts(_username: string) {
    await delay(400)
    // 返回用户的所有帖子
    return []
  },
}

// 导出统一的服务
export const blockchain = {
  ...mockBlockchain,
  arweave: mockArweave,
  db: mockDB,
}
