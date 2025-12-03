import { supabase } from '../lib/supabase'

export const authService = {
    // Sign up with email/password
    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        return data
    },

    // Sign in
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        return data
    },

    // Sign out
    async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    },

    // Get current user
    async getUser() {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    },

    // Listen to auth changes
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback)
    }
}
