import { createContext, useContext, useEffect, useState } from 'react'
import { authService } from '../services/auth'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for existing session
        authService.getUser().then(user => {
            setUser(user)
            setLoading(false)
        }).catch(() => {
            setUser(null)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email, password) => {
        const data = await authService.signIn(email, password)
        if (data?.user) setUser(data.user)
        return data
    }

    const signUp = async (email, password) => {
        const data = await authService.signUp(email, password)
        return data
    }

    const signOut = async () => {
        await authService.signOut()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}
