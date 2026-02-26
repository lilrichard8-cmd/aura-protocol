import { FC } from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export const Skeleton: FC<SkeletonProps> = ({ 
  className = '', 
  variant = 'rectangular',
  width,
  height 
}) => {
  const baseClass = 'animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]'
  
  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  }[variant]

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div 
      className={`${baseClass} ${variantClass} ${className}`}
      style={style}
    />
  )
}

// 内容卡片骨架屏
export const PostCardSkeleton: FC = () => (
  <div className="bg-white/5 rounded-2xl overflow-hidden p-4">
    <Skeleton variant="rectangular" className="w-full aspect-square mb-4" />
    <Skeleton variant="text" className="w-3/4 mb-2" />
    <Skeleton variant="text" className="w-1/2" />
  </div>
)

// 列表项骨架屏
export const ListItemSkeleton: FC = () => (
  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
    <Skeleton variant="circular" width={48} height={48} />
    <div className="flex-1">
      <Skeleton variant="text" className="w-3/4 mb-2" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
  </div>
)
