import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface SideNavContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SideNavContext = createContext<SideNavContextType | undefined>(undefined);

export function SideNavProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidenav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidenav-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  return (
    <SideNavContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SideNavContext.Provider>
  );
}

export function useSideNav() {
  const context = useContext(SideNavContext);
  if (context === undefined) {
    throw new Error('useSideNav must be used within a SideNavProvider');
  }
  return context;
}