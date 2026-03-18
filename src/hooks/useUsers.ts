import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

export const useUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('nama_lengkap', { ascending: true });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const saveUser = async (data: Partial<UserProfile>) => {
        if (!data.id) {
            // New user creation is usually handled by Supabase Auth, 
            // but we might need to insert into our profile table
            const { error } = await supabase.from('user_profiles').insert(data);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('user_profiles').update(data).eq('id', data.id);
            if (error) throw error;
        }
        await fetchUsers();
    };

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({ status_aktif: !currentStatus })
            .eq('id', id);
        if (error) throw error;
        await fetchUsers();
    };

    return {
        users,
        loading,
        refresh: fetchUsers,
        saveUser,
        toggleUserStatus
    };
};
