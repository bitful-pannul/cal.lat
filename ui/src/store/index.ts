import { create } from 'zustand';
import { addYears } from 'date-fns';

export interface Location {
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    owner: string;
    start_date: number;
    end_date: number;
    photos: string[];
}

export interface DateRange {
    start: Date;
    end: Date;
}

export interface Friend {
    node_id: string;
    friend_type: 'Best' | 'CloseFriend' | 'Acquaintance';
    last_pinged: number;
}

export interface PendingRequest {
    node_id: string;
    friend_type: 'Best' | 'CloseFriend' | 'Acquaintance';
    last_pinged: number;
    is_local: boolean;
}

export interface NewLocationData {
    description: string;
    latitude: number | null;
    longitude: number | null;
    start_date: number;
    end_date: number;
    photos: string[];
}


interface AppState {
    locations: Location[];
    selectedLocation: Location | null;
    dateRange: DateRange;
    friends: Friend[];
    pendingRequests: PendingRequest[];
    setLocations: (locations: Location[]) => void;
    setSelectedLocation: (location: Location | null) => void;
    setDateRange: (range: DateRange) => void;
    setFriends: (friends: Friend[]) => void;
    setPendingRequests: (requests: PendingRequest[]) => void;
    fetchFriends: () => Promise<void>;
    fetchPendingRequests: () => Promise<void>;
    addFriend: (nodeId: string, friendType: 'Best' | 'CloseFriend' | 'Acquaintance') => Promise<void>;
    acceptFriendRequest: (nodeId: string, friendType: 'Best' | 'CloseFriend' | 'Acquaintance') => Promise<void>;
    rejectFriendRequest: (nodeId: string) => Promise<void>;
    removeFriend: (nodeId: string) => Promise<void>;
    pingFriend: (nodeId: string) => Promise<void>;
    cancelPendingRequest: (nodeId: string) => Promise<void>;
}

// @ts-ignore
const BASE_URL = import.meta.env.BASE_URL;

const useStore = create<AppState>((set, get) => ({
    locations: [],
    selectedLocation: null,
    dateRange: {
        start: new Date(),
        end: addYears(new Date(), 1),
    },
    friends: [],
    pendingRequests: [],
    setLocations: (locations) => set({ locations }),
    setSelectedLocation: (location) => set({ selectedLocation: location }),
    setDateRange: (range) => set({ dateRange: range }),
    setFriends: (friends) => set({ friends }),
    setPendingRequests: (requests) => set({ pendingRequests: requests }),

    fetchFriends: async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends`);
            const data = await response.json();
            set({ friends: data });
        } catch (error) {
            console.error('Error fetching friends:', error);
        }
    },

    fetchPendingRequests: async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/pending`);
            const data = await response.json();
            if (data && typeof data === 'object') {
                const incoming = (data.incoming || []).map((friend: Friend) => ({ ...friend, is_local: false }));
                const outgoing = (data.outgoing || []).map((friend: Friend) => ({ ...friend, is_local: true }));
                set({ pendingRequests: [...incoming, ...outgoing] });
            } else {
                console.error('Unexpected data structure for pending requests:', data);
            }
        } catch (error) {
            console.error('Error fetching pending requests:', error);
        }
    },

    addFriend: async (nodeId, friendType) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId, friend_type: friendType }),
            });
            if (response.ok) {
                await get().fetchFriends();
                await get().fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error adding friend:', error);
        }
    },

    acceptFriendRequest: async (nodeId, friendType) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId, friend_type: friendType }),
            });
            if (response.ok) {
                await get().fetchFriends();
                await get().fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    },

    rejectFriendRequest: async (nodeId) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId }),
            });
            if (response.ok) {
                await get().fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error rejecting friend request:', error);
        }
    },

    removeFriend: async (nodeId) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId }),
            });
            if (response.ok) {
                await get().fetchFriends();
            }
        } catch (error) {
            console.error('Error removing friend:', error);
        }
    },

    pingFriend: async (nodeId) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId }),
            });
            if (response.ok) {
                await get().fetchFriends();
            }
        } catch (error) {
            console.error('Error syncing friend:', error);
        }
    },

    cancelPendingRequest: async (nodeId) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId }),
            });
            if (response.ok) {
                await get().fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error canceling pending request:', error);
        }
    },
}));

export default useStore;