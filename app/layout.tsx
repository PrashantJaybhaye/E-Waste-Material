'use client'

import { useState, useEffect } from "react"
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Header from "@/components/Header"
import { ClerkProvider } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import Sidebar from "@/components/Sidebar"

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAuthPage = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [totalEarning, setTotalEarning] = useState(0)

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className} suppressHydrationWarning>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header - Hidden on auth pages */}
            {!isAuthPage && (
              <Header
                onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                totalEarnings={totalEarning}
              />
            )}
            <div className="flex flex-1">
              {/* Sidebar container - margins removed on auth pages */}
              <Sidebar open={sidebarOpen} />
              <main className={`flex-1 p-4 lg:p-8 transition-all duration-300 ${!isAuthPage ? 'ml-0 lg:ml-64' : ''}`}>
                {children}
              </main>
            </div>
          </div>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}