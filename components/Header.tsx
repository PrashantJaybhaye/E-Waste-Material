'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { Menu, Coins, Leaf, Search, Bell, ChevronDown, LogIn, LogOut, MenuIcon, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Badge } from "./ui/badge"
// ... imports
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { createUser, getUnreadNotifications, getUserBalance, getUserByEmail, markNotificationAsRead } from "@/utils/db/actions"
import { useMediaQuery } from "@/hooks/useMediaQuery"
// import { Notification } from "@/utils/db/schema" // Removing this import to avoid conflict

interface HeaderProps {
    onMenuClick: () => void,
    totalEarnings: number,
}

interface Notification {
    id: number;
    userId: number;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
}

export default function Header({ onMenuClick, totalEarnings }: HeaderProps) {
    const { user, isSignedIn } = useUser()
    const [notification, setNotification] = useState<Notification[]>([])
    const [balance, setBalance] = useState<number>(0)
    const isMobile = useMediaQuery("(max-width: 768px)")

    useEffect(() => {
        const syncUserAndFetchData = async () => {
            if (isSignedIn && user) {
                const email = user.primaryEmailAddress?.emailAddress;
                if (email) {
                    try {
                        await createUser(email, user.fullName || "Anonymous user")
                        localStorage.setItem('userEmail', email)
                    } catch (error) {
                        console.error('error creating user', error)
                    }

                    // Fetch user data immediately after ensuring user exists
                    const dbUser = await getUserByEmail(email)
                    if (dbUser) {
                        const unreadNotifications = await getUnreadNotifications(dbUser.id)
                        setNotification(unreadNotifications || [])
                        const userBalance = await getUserBalance(dbUser.id)
                        setBalance(userBalance)
                    }
                }
            }
        }
        syncUserAndFetchData()
    }, [isSignedIn, user])

    useEffect(() => {
        const fetchNotifications = async () => {
            if (isSignedIn && user) {
                const email = user.primaryEmailAddress?.emailAddress;
                if (email) {
                    const dbUser = await getUserByEmail(email)
                    if (dbUser) {
                        const unreadNotifications = await getUnreadNotifications(dbUser.id)
                        setNotification(unreadNotifications || [])
                    }
                }
            }
        }
        // Initial fetch is handled in the syncUser effect, but we keep this for interval
        // fetchNotifications(); // Removed initial call to avoid double fetching/racing

        const notificationInterval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(notificationInterval);
    }, [isSignedIn, user])


    useEffect(() => {
        // Initial balance fetch is handled in syncUser effect

        const handleBalanceUpdate = (event: CustomEvent) => {
            setBalance(event.detail)
        }

        window.addEventListener('balanceUpdate', handleBalanceUpdate as EventListener);

        return () => {
            window.removeEventListener('balanceUpdate', handleBalanceUpdate as EventListener);
        }
    }, [])

    const handleNotificationClick = async (notificationId: number) => {
        await markNotificationAsRead(notificationId)
    }

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center">
                    <Button
                        variant={'ghost'}
                        size={'icon'}
                        className="mr-2 md:mr-4"
                        onClick={onMenuClick}
                    >
                        <MenuIcon className="h-6 w-6 text-gray-800" />
                    </Button>
                    <Link href="/" className="flex items-center">
                        <Leaf className="h-6 w-6 md:h-8 md:w-8 text-green-500 mr-1 md:mr-2" />
                        <span className="font-bold text-base md:text-lg text-gray-800">E-Waste Material</span>
                    </Link>
                </div>
                {!isMobile && (
                    <div className="flex-1 max-w-xl mx-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search...."
                                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>
                )}
                <div className="flex items-center">
                    {isMobile && (
                        <Button
                            variant={'ghost'}
                            size={'icon'}
                            className="mr-2"
                        >
                            <Search className="h-6 w-6 text-gray-800" />
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant={'ghost'} size={'icon'} className="mr-2 relative">
                                <Bell className="h-5 w-5 text-gray-800" />
                                {notification.length > 0 && (
                                    <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5" >
                                        {notification.length}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            {notification.length > 0 ? (
                                notification.map((notification: any) => (
                                    <DropdownMenuItem
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium">{notification.type}</span>
                                            <span className="text-sm text-gray-500">{notification.message}</span>
                                        </div>
                                    </DropdownMenuItem>
                                ))
                            ) : (
                                <DropdownMenuLabel>No new notifications</DropdownMenuLabel>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="mr-2 md:mr-4 flex items-center bg-gray-100 rounded-full px-2 md:px-3 py-1">
                        <Coins className="h-4 w-4 md:h-5 md:w-5 mr-1 text-green-500" />
                        <span className="font-semibold text-sm md:text-base text-gray-800">
                            {balance.toFixed(2)}
                        </span>
                    </div>
                    {!isSignedIn ? (
                        <SignInButton>
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white text-sm md:text-base"
                            >
                                Login
                                <LogIn className="ml-1 md:ml-2 h-4 w-4 md:h-5 md:w-5" />
                            </Button>
                        </SignInButton>
                    ) : (
                        <UserButton afterSignOutUrl="/" />
                    )}
                </div>
            </div>
        </header>
    )

}
