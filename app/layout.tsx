'use client'

import { useState, useEffect } from "react"
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Header from "@/components/Header"
import { ClerkProvider } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import { getAvailableRewards, getUserByEmail } from "@/utils/db/actions"

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()


  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [totalEarning, setTotalEarning] = useState(0)

  useEffect(() => {
    const fetchTotalEarnings = async () => {
      try {
        const userEmail = localStorage.getItem('userEmail')
        if (userEmail) {
          const user = await getUserByEmail(userEmail)
          console.log('user from layout', user);

          if (user) {
            const availableRewards = await getAvailableRewards(user.id) as any
            console.log('availableRewards from layout', availableRewards);
            setTotalEarning(availableRewards)
          }
        }
      } catch (error) {
        console.error('Error fetching total earnings:', error)
      }
    }

    fetchTotalEarnings()
  }, [])

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className} suppressHydrationWarning>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <Header
              onMenuClick={() => setSidebarOpen(!sidebarOpen)}
              totalEarnings={totalEarning}
            />
            <div className="flex flex-1">
              {/* Sidebar container */}
              <Sidebar open={sidebarOpen} />
              <main className="flex-1 p-4 lg:p-8 pt-20 transition-all duration-300 ml-0 lg:ml-64 flex flex-col">
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