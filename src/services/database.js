import { supabase } from '../lib/supabase'

export const db = {
    // PROFILE / EOS
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        if (error) throw error
        return data
    },

    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                ...updates,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async saveEOS(userId, eos) {
        return this.updateProfile(userId, { eos })
    },

    async saveHeatMap(userId, heatMap) {
        return this.updateProfile(userId, { heat_map: heatMap })
    },

    // MEMORIES
    async getMemories(userId) {
        const { data, error } = await supabase
            .from('memories')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async addMemory(userId, memory) {
        const { data, error } = await supabase
            .from('memories')
            .insert({
                user_id: userId,
                content: memory.content,
                domains: memory.domains,
                emotions: memory.emotions,
                intensity: memory.intensity
            })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateMemory(memoryId, updates) {
        const { data, error } = await supabase
            .from('memories')
            .update(updates)
            .eq('id', memoryId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async deleteMemory(memoryId) {
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('id', memoryId)
        if (error) throw error
    },

    // REAL-TIME SUBSCRIPTIONS
    subscribeToMemories(userId, callback) {
        return supabase
            .channel('memories')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'memories', filter: `user_id=eq.${userId}` },
                callback
            )
            .subscribe()
    }
}
