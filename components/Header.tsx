'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { Menu, Coins, Leaf, Search, Bell, ChevronDown, LogIn, LogOut, MenuIcon, User, Loader } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Badge } from "./ui/badge"
// ... imports
import { SignInButton, UserButton, useUser, useClerk } from "@clerk/nextjs"
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
    const { user, isSignedIn, isLoaded } = useUser()
    const { signOut } = useClerk()
    const [notification, setNotification] = useState<Notification[]>([])
    const [balance, setBalance] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const isMobile = useMediaQuery("(max-width: 768px)")

    useEffect(() => {
        if (!isLoaded) return;

        const syncUserAndFetchData = async () => {
            if (isSignedIn && user) {
                setLoading(true)
                const email = user.primaryEmailAddress?.emailAddress;
                if (email) {
                    try {
                        await createUser(email, user.fullName || "Anonymous user")
                        localStorage.setItem('userEmail', email)
                    } catch (error) {
                        console.error('error creating user', error)
                    }

                    // Fetch user data immediately after ensuring user exists
                    try {
                        const dbUser = await getUserByEmail(email)
                        if (dbUser) {
                            const unreadNotifications = await getUnreadNotifications(dbUser.id)
                            setNotification(unreadNotifications || [])
                            const userBalance = await getUserBalance(dbUser.id)
                            setBalance(userBalance)
                        }
                    } catch (error) {
                        console.error('Error fetching user data:', error)
                        // Set safe fallback values to prevent UI inconsistencies
                        setNotification([])
                        setBalance(0)
                    } finally {
                        setLoading(false)
                    }
                } else {
                    setLoading(false)
                }
            } else {
                setLoading(false)
            }
        }
        syncUserAndFetchData()
    }, [isSignedIn, user, isLoaded])

    useEffect(() => {
        const fetchNotifications = async () => {
            if (isSignedIn && user) {
                const email = user.primaryEmailAddress?.emailAddress;
                if (email) {
                    try {
                        const dbUser = await getUserByEmail(email)
                        if (dbUser) {
                            const unreadNotifications = await getUnreadNotifications(dbUser.id)
                            setNotification(unreadNotifications || [])
                        }
                    } catch (error) {
                        console.error('Error fetching notifications:', error)
                    }
                }
            }
        }
        // Initial fetch is handled in the syncUser effect, but we keep this for interval
        // fetchNotifications(); // Removed initial call to avoid double fetching/racing

        // Only start polling when Clerk is loaded and user is signed in
        if (isLoaded && isSignedIn && user) {
            const notificationInterval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(notificationInterval);
        }
    }, [isLoaded, isSignedIn, user])


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
        // Optimistically update local state - remove notification immediately
        const previousNotifications = notification;
        setNotification(prevNotifications =>
            prevNotifications.filter(n => n.id !== notificationId)
        );

        try {
            // Call API to mark as read in the database
            await markNotificationAsRead(notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Rollback to previous state if API call fails
            setNotification(previousNotifications);
        }
    }

    return (
        <header className="bg-white border-b border-gray-200 fixed w-full top-0 z-50">
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
                        <span className="font-bold text-base md:text-lg text-gray-800">Waste Material</span>
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
                                notification.map((n: Notification) => (
                                    <DropdownMenuItem
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium">{n.title}</span>
                                            <span className="text-sm text-gray-500">{n.message}</span>
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
                    {loading ? (
                        <Loader className="animate-spin h-5 w-5 text-gray-800" />
                    ) : !isSignedIn ? (
                        <Button onClick={() => window.location.href = '/sign-in'} className="bg-green-600 hover:bg-green-700 text-white text-sm md:text-base">
                            Login
                            <LogIn className="ml-1 md:ml-2 h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="flex items-center focus:outline-none focus:ring-0 focus:ring-offset-0 mr-2">
                                    {user?.imageUrl ? (
                                        <img src={user.imageUrl} alt="User" className="h-8 w-8 rounded-full" />
                                    ) : (
                                        <User className="h-5 w-5" />
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                    {user?.fullName || "User"}
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Link href="/settings">Profile</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem>Settings</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => signOut()}>Sign Out</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </header>
    )
}
