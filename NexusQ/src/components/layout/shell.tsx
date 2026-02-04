import * as React from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface ShellProps {
  children: React.ReactNode
}

export function Shell({ children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) setTheme(saved === "dark");
}


  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
