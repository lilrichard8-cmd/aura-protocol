// 100个模拟内容数据

const authors = [
  { name: 'Alice.sol', avatar: '👩‍🎨', type: 'artist' },
  { name: 'Bob.sol', avatar: '🧑‍💻', type: 'developer' },
  { name: 'Charlie.sol', avatar: '🎼', type: 'musician' },
  { name: 'Diana.sol', avatar: '📸', type: 'photographer' },
  { name: 'Eric.sol', avatar: '✍️', type: 'writer' },
  { name: 'Frank.sol', avatar: '🎨', type: 'artist' },
  { name: 'Grace.sol', avatar: '🎬', type: 'videographer' },
  { name: 'Henry.sol', avatar: '🎵', type: 'musician' },
  { name: 'Iris.sol', avatar: '📝', type: 'writer' },
  { name: 'Jack.sol', avatar: '🖼️', type: 'artist' },
]

const titles = {
  image: [
    '数字艺术：赛博朋克城市', '摄影作品：巴黎之夜', '抽象艺术探索', '像素艺术收藏',
    '3D渲染作品', '插画系列', '概念艺术', '街拍摄影', '自然风光', '人像摄影',
    'NFT艺术品', '数字雕塑', '光影艺术', '几何美学', '色彩实验', '梦境系列',
  ],
  video: [
    'Solana开发教程', 'Web3入门指南', 'NFT创作流程', 'DeFi完全解析',
    '视频创作技巧', 'Vlog日常', '教程系列', '实战案例', '技术分享',
    '创作幕后', '产品评测', '行业分析', '趋势解读', '深度访谈',
  ],
  audio: [
    '原创音乐：夏日之歌', '电子音乐实验', 'Lo-Fi作品集', '钢琴演奏',
    '播客节目', '音频故事', '冥想音乐', '环境音效', '翻唱作品',
    '音乐制作教程', 'Beat制作', '混音技巧', '作曲心得',
  ],
  text: [
    '关于去中心化的思考', 'Web3创作者经济', 'DAO治理分析', 'NFT投资指南',
    '区块链技术解析', '加密货币观察', '创作心得分享', '行业趋势预测',
    '产品设计思考', '用户体验研究', '商业模式分析', '创业经验谈',
  ],
}

const descriptions = [
  '这是一个精心创作的作品，花费了大量时间和精力。',
  '探索数字艺术的无限可能，用代码创造美。',
  '从零开始的完整教程，适合新手学习。',
  '深度分析和独到见解，值得仔细阅读。',
  '原创作品，灵感来自于日常生活的观察。',
  '专业制作，高质量输出，不容错过。',
  '实战经验总结，干货满满。',
  '创意无限，技术精湛，诚意之作。',
]

const colors = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-teal-500',
  'from-orange-500 to-red-500',
  'from-indigo-500 to-purple-500',
  'from-pink-500 to-rose-500',
  'from-yellow-500 to-orange-500',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-purple-500',
]

const emojis = {
  image: ['🎨', '📷', '🖼️', '🌆', '🌃', '🎭', '🗿', '✨', '🌈', '💫'],
  video: ['🎬', '📹', '🎥', '📺', '🎞️', '📽️'],
  audio: ['🎵', '🎶', '🎼', '🎹', '🎸', '🥁', '🎧', '🎤'],
  text: ['📝', '📖', '📄', '📃', '✍️', '📚', '💭', '🗨️'],
}

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成100个post
const generatedPosts = Array.from({ length: 100 }, (_, index) => {
  const types: ('image' | 'video' | 'audio' | 'text')[] = ['image', 'video', 'audio', 'text']
  const type = randomItem(types)
  const author = randomItem(authors)
  const heights: ('short' | 'medium' | 'tall')[] = ['short', 'medium', 'tall']
  const isPaid = Math.random() < 0.2 // 20%付费内容
  const price = isPaid ? randomInt(5, 200) : (Math.random() < 0.3 ? randomInt(5, 50) : 0)
  
  return {
    id: `post-${index + 1}`,
    title: randomItem(titles[type]),
    author: author.name,
    authorAvatar: author.avatar,
    description: randomItem(descriptions),
    type,
    coverImage: randomItem(emojis[type]),
    coverColor: randomItem(colors),
    price,
    isPaid,
    isUnlocked: false,
    likes: randomInt(10, 5000),
    views: randomInt(50, 20000),
    comments: randomInt(5, 500),
    height: randomItem(heights),
    onMarket: price > 0 || Math.random() < 0.7,
    createdAt: Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000), // 最近30天
  }
})

// 按创建时间排序（最新的在前）
export const mockPosts = generatedPosts.sort((a, b) => b.createdAt - a.createdAt)
