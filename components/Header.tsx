'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { Menu, Coins, Leaf, Search, Bell, ChevronDown, LogIn, LogOut } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Badge } from "./ui/badge"
import { Web3Auth } from "@web3auth/modal"
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base"
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider"
import { createUser, getUnreadNotifications, getUserBalance, getUserByEmail } from "@/utils/db/actions"
// import {useMediaQuery} from "next/hooks"

const clientId = process.env.WEB3_AUTH_CLIENT_ID!
const ChainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: '0xaa36a7',
    rpcTarget: "https://rpc.ankr.com/eth_sepolia",
    displayName: "Sepolia Testnet",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    ticker: "ETH",
    tickerName: "Ethereum",
    logo: "https://assets.web3auth.io/evm-chains/sepolia.png",
}

const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: chainConfig,
})
const web3Auth = new Web3Auth({
    clientId,
    network: WEB3AUTH_NETWORK.TESTNET,
    privateKeyProvider,
})

interface HeaderProps {
    onMenuClick: () => void,
    totalEarnings: number,
}

export default function Header({ onMenuClick, totalEarnings }: HeaderProps) {
    const [provider, setProvider] = useState<IProvider | null>(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<any>(null)
    const pathName = usePathname()
    const [notification, setNotification] = useState<Notification[]>([])
    const [balance, setBalance] = useState<number>(0)

    useEffect(() => {
        const init = async () => {
            try {
                await web3Auth.init()
                setProvider(web3Auth.provider)

                if (web3Auth.connected) {
                    setLoggedIn(true)
                    const user = await web3Auth.getUserInfo()
                    setUserInfo(user)
                    if (user?.email) {
                        localStorage.setItem('userEmail', user.email)
                        try {
                            await createUser(user.email, user.name || "Anonymous user")
                        } catch (error) {
                            console.error('error creating user', error)
                        }
                    }
                }
            } catch (error) {
                console.error('error intializing web3auth', error)
                setLoading(false)
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [])


    useEffect(() => {
        const fetchNotifications = async () => {
            if (userInfo && userInfo.email) {
                const user = await getUserByEmail(userInfo.email)
                if (user) {
                    const unreadNotifications = await getUnreadNotifications(user.id)
                    setNotification(unreadNotifications)
                }
            }
        }
        fetchNotifications();

        const notificationInterval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(notificationInterval);
    }, [userInfo])


    useEffect(() => {
        const fetchUserBalance = async () => {
            if (userInfo && userInfo.email) {
                const user = await getUserByEmail(userInfo.email)
                if (user) {
                    const userBalance = await getUserBalance(user.id)
                    setBalance(userBalance)
                }
            }
        }
        fetchUserBalance();

        const handleBalanceUpdate = (event: CustomEvent) => {
            setBalance(event.detail)
        }

        window.addEventListener('balanceUpdate', handleBalanceUpdate as EventListener);

        return () => {
            window.removeEventListener('balanceUpdate', handleBalanceUpdate as EventListener);
        }
    }, [userInfo])

    const login = async () => {
        if (!web3Auth) {
            console.error('Web3auth is not initialized')
            return
        }
        try {
            const web3authProvider = await web3Auth.connect();
            setProvider(web3authProvider);
            setLoggedIn(true);
            const user = await web3Auth.getUserInfo();
            setUserInfo(user);
            if (user.email) {
                localStorage.setItem('userEmail', user.email)
                try {
                    await createUser(user.email, user.name || "Anonymous user")
                } catch (error) {
                    console.error('Error creating user', error)
                }
            }
        } catch (error) {
            console.error('Error logging in', error)
        }
    }

    const logout = async () => {
        if (!web3Auth) {
            console.error('Web3auth is not initialized')
            return
        }
        try {
            await web3Auth.logout();
            setProvider(null);
            setLoggedIn(false);
            setUserInfo(null);
            localStorage.removeItem('userEmail')
        } catch (error) {
            console.error('Error logging out', error)
        }
    }
}
