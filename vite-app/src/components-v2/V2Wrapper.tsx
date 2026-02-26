import { FC, ReactNode } from 'react'
import { TopNavV2 } from './TopNavV2'

interface V2WrapperProps {
  children: ReactNode
  showNav?: boolean
}

export const V2Wrapper: FC<V2WrapperProps> = ({ children, showNav = true }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {showNav && <TopNavV2 />}
      <div className="pb-8">
        {children}
      </div>
    </div>
  )
}

// 包装现有页面为V2样式
export const wrapV2 = (Component: FC<any>) => {
  return (props: any) => (
    <V2Wrapper>
      <Component {...props} />
    </V2Wrapper>
  )
}
