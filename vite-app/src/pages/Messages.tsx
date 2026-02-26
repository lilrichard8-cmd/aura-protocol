import { FC, useState } from 'react'

const mockConversations = [
  {
    id: '1',
    user: { name: 'Alice.sol', avatar: '👩‍🎨', online: true },
    lastMessage: '你好！很喜欢你的作品',
    time: '5分钟前',
    unread: 2,
    isMutual: true, // 互关
    messageCount: 45,
  },
  {
    id: '2',
    user: { name: 'Bob.sol', avatar: '🧑‍💻', online: false },
    lastMessage: '感谢支持！',
    time: '1小时前',
    unread: 0,
    isMutual: true,
    messageCount: 23,
  },
  {
    id: '3',
    user: { name: 'Charlie.sol', avatar: '🎼', online: true },
    lastMessage: '想合作一个项目',
    time: '2小时前',
    unread: 1,
    isMutual: false, // 单向关注
    messageCount: 3, // 只能发5条
  },
]

const mockMessages = [
  { id: '1', from: 'Alice.sol', content: '你好！', time: '10:30', isMine: false },
  { id: '2', from: 'me', content: '嗨！有什么事吗？', time: '10:32', isMine: true },
  { id: '3', from: 'Alice.sol', content: '很喜欢你的作品，能合作吗？', time: '10:35', isMine: false },
  { id: '4', from: 'me', content: '当然可以！我们详细聊聊', time: '10:36', isMine: true },
]

const mockGroupChats = [
  {
    id: '1',
    name: 'AURA 创作者交流群',
    avatar: '🎨',
    members: 234,
    lastMessage: 'User5: 大家好！',
    time: '刚刚',
    unread: 5,
  },
  {
    id: '2',
    name: 'Web3 音乐爱好者',
    avatar: '🎵',
    members: 156,
    lastMessage: 'User8: 新作品发布了',
    time: '30分钟前',
    unread: 0,
  },
]

export const Messages: FC = () => {
  const [activeTab, setActiveTab] = useState<'private' | 'group'>('private')
  const [selectedChat, setSelectedChat] = useState<any>(null)
  const [messageInput, setMessageInput] = useState('')

  const sendMessage = () => {
    if (!messageInput.trim()) return

    if (selectedChat && !selectedChat.isMutual && selectedChat.messageCount >= 5) {
      alert('⚠️ 单向关注限制\n\n你已达到 5 条私信限制。\n\n要继续聊天，需要对方也关注你（互关）。')
      return
    }

    alert(`消息已发送：${messageInput}\n\n（测试模式）`)
    setMessageInput('')
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            消息
          </span>
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('private')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'private'
                ? 'bg-gradient-aura text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            💬 私信
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'group'
                ? 'bg-gradient-aura text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            👥 群聊
          </button>
        </div>

        {/* Private Messages */}
        {activeTab === 'private' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Conversation list */}
            <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <input
                  type="text"
                  placeholder="搜索对话..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-aura-purple"
                />
              </div>

              <div className="overflow-y-auto max-h-[600px]">
                {mockConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedChat(conv)}
                    className={`p-4 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors ${
                      selectedChat?.id === conv.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-aura rounded-full flex items-center justify-center text-2xl">
                          {conv.user.avatar}
                        </div>
                        {conv.user.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm truncate">
                            {conv.user.name}
                            {!conv.isMutual && (
                              <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                                单向
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">{conv.time}</span>
                        </div>
                        <p className="text-sm text-gray-400 truncate">{conv.lastMessage}</p>
                      </div>
                      {conv.unread > 0 && (
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                          {conv.unread}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
              {selectedChat ? (
                <>
                  {/* Chat header */}
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-aura rounded-full flex items-center justify-center text-xl">
                        {selectedChat.user.avatar}
                      </div>
                      <div>
                        <div className="font-semibold">{selectedChat.user.name}</div>
                        <div className="text-xs text-gray-400">
                          {selectedChat.user.online ? '在线' : '离线'}
                        </div>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      ⋯
                    </button>
                  </div>

                  {/* Message limit warning */}
                  {!selectedChat.isMutual && (
                    <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/30 text-sm">
                      <span className="text-yellow-500 font-semibold">⚠️ 单向关注限制：</span>
                      <span className="text-gray-300"> 已发送 {selectedChat.messageCount}/5 条消息。互关后可畅聊。</span>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 p-4 overflow-y-auto max-h-[400px] space-y-3">
                    {mockMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                            msg.isMine
                              ? 'bg-gradient-aura text-white'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs mt-1 opacity-70">{msg.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input area */}
                  <div className="p-4 border-t border-white/10">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder={selectedChat.isMutual ? '输入消息...' : `还可发送 ${5 - selectedChat.messageCount} 条消息...`}
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-aura-purple"
                        disabled={!selectedChat.isMutual && selectedChat.messageCount >= 5}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!messageInput.trim() || (!selectedChat.isMutual && selectedChat.messageCount >= 5)}
                        className="px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        发送
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p>选择一个对话开始聊天</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Group Chats */}
        {activeTab === 'group' && (
          <div className="space-y-4">
            {mockGroupChats.map((group) => (
              <div
                key={group.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-aura-purple/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-aura rounded-xl flex items-center justify-center text-3xl">
                    {group.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{group.name}</h3>
                      {group.unread > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold">
                          {group.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{group.lastMessage}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>👥 {group.members} 人</span>
                      <span>⏰ {group.time}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      alert(`进入群聊：${group.name}\n\n群成员：${group.members} 人\n\n（测试模式）`)
                    }}
                    className="px-4 py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold hover:opacity-90"
                  >
                    进入
                  </button>
                </div>
              </div>
            ))}

            {/* Create group button */}
            <button
              onClick={() => {
                alert('创建群聊\n\n功能：\n• 设置群名称和头像\n• 选择群成员\n• 设置群公告\n• 管理员权限\n\n（测试模式）')
              }}
              className="w-full py-4 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-colors"
            >
              + 创建群聊
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
