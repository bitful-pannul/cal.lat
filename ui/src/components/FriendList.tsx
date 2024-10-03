import React, { useState, useEffect } from 'react';

interface Friend {
    node_id: string;
    friend_type: 'Best' | 'CloseFriend' | 'Acquaintance';
    last_pinged: number;
}

interface PendingRequest {
    node_id: string;
    friend_type: 'Best' | 'CloseFriend' | 'Acquaintance';
    last_pinged: number;
    is_local: boolean;
}

const FriendList: React.FC = () => {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [newFriendId, setNewFriendId] = useState('');
    const [newFriendType, setNewFriendType] = useState<'Best' | 'CloseFriend' | 'Acquaintance'>('Acquaintance');
    const [acceptFriendType, setAcceptFriendType] = useState<{ [key: string]: 'Best' | 'CloseFriend' | 'Acquaintance' }>({});

    // @ts-ignore
    const BASE_URL = import.meta.env.BASE_URL;

    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
    }, []);

    const fetchFriends = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends`);
            const data = await response.json();
            setFriends(data);
        } catch (error) {
            console.error('Error fetching friends:', error);
        }
    };

    const fetchPendingRequests = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/pending`);
            const data = await response.json();
            if (data && typeof data === 'object') {
                const incoming = (data.incoming || []).map((friend: Friend) => ({ ...friend, is_local: false }));
                const outgoing = (data.outgoing || []).map((friend: Friend) => ({ ...friend, is_local: true }));
                setPendingRequests([...incoming, ...outgoing]);

                // Initialize acceptFriendType for incoming requests
                const newAcceptFriendType = { ...acceptFriendType };
                incoming.forEach((request: PendingRequest) => {
                    if (!newAcceptFriendType[request.node_id]) {
                        newAcceptFriendType[request.node_id] = 'Acquaintance';
                    }
                });
                setAcceptFriendType(newAcceptFriendType);
            } else {
                console.error('Unexpected data structure for pending requests:', data);
            }
        } catch (error) {
            console.error('Error fetching pending requests:', error);
        }
    };

    const handleAddFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`${BASE_URL}/api/friends`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: newFriendId, friend_type: newFriendType }),
            });
            if (response.ok) {
                setShowAddFriend(false);
                setNewFriendId('');
                setNewFriendType('Acquaintance');
                fetchFriends();
                fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error adding friend:', error);
        }
    };

    const handleAcceptRequest = async (nodeId: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId, friend_type: acceptFriendType[nodeId] }),
            });
            if (response.ok) {
                fetchFriends();
                fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    };

    const handleRejectRequest = async (nodeId: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId }),
            });
            if (response.ok) {
                fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error rejecting friend request:', error);
        }
    };

    const handleRemoveFriend = async (nodeId: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/friends`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: nodeId }),
            });
            if (response.ok) {
                fetchFriends();
            }
        } catch (error) {
            console.error('Error removing friend:', error);
        }
    };

    return (
        <div className="friend-list">
            <h2>Friends</h2>
            <ul>
                {friends.map((friend) => (
                    <li key={friend.node_id}>
                        {friend.node_id} - {friend.friend_type}
                        <button onClick={() => handleRemoveFriend(friend.node_id)}>Remove</button>
                    </li>
                ))}
            </ul>
            <button onClick={() => setShowAddFriend(true)}>Add Friend</button>

            {showAddFriend && (
                <form onSubmit={handleAddFriend}>
                    <input
                        type="text"
                        value={newFriendId}
                        onChange={(e) => setNewFriendId(e.target.value)}
                        placeholder="Friend's Node ID"
                        required
                    />
                    <select
                        value={newFriendType}
                        onChange={(e) => setNewFriendType(e.target.value as 'Best' | 'CloseFriend' | 'Acquaintance')}
                    >
                        <option value="Best">Best</option>
                        <option value="CloseFriend">Close Friend</option>
                        <option value="Acquaintance">Acquaintance</option>
                    </select>
                    <button type="submit">Send Request</button>
                    <button type="button" onClick={() => setShowAddFriend(false)}>Cancel</button>
                </form>
            )}

            <h3>Pending Requests</h3>
            <ul>
                {pendingRequests.map((request) => (
                    <li key={request.node_id}>
                        {request.node_id} - {request.is_local ? 'Outgoing' : 'Incoming'}
                        {!request.is_local && (
                            <>
                                <select
                                    value={acceptFriendType[request.node_id]}
                                    onChange={(e) => setAcceptFriendType({
                                        ...acceptFriendType,
                                        [request.node_id]: e.target.value as 'Best' | 'CloseFriend' | 'Acquaintance'
                                    })}
                                >
                                    <option value="Best">Best</option>
                                    <option value="CloseFriend">Close Friend</option>
                                    <option value="Acquaintance">Acquaintance</option>
                                </select>
                                <button onClick={() => handleAcceptRequest(request.node_id)}>Accept</button>
                                <button onClick={() => handleRejectRequest(request.node_id)}>Reject</button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FriendList;