import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://olqyvnqaosfkzhttjqzt.supabase.co'
const supabaseAnonKey = 'sb_publishable_OXnGdDUXstz48uIR8jtgaw_I68eO-9k'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: {
            getItem: (key) => {
                return new Promise((resolve) => {
                    chrome.storage.local.get([key], (result) => {
                        resolve(result[key]);
                    });
                });
            },
            setItem: (key, value) => {
                return new Promise((resolve) => {
                    chrome.storage.local.set({ [key]: value }, () => {
                        resolve();
                    });
                });
            },
            removeItem: (key) => {
                return new Promise((resolve) => {
                    chrome.storage.local.remove([key], () => {
                        resolve();
                    });
                });
            },
        },
    },
})
