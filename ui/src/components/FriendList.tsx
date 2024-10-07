import React, { useState, useEffect } from 'react';
import useStore from '../store';

const FriendList: React.FC = () => {
    const { friends, pendingRequests, fetchFriends, fetchPendingRequests, addFriend, acceptFriendRequest, rejectFriendRequest, removeFriend, pingFriend, cancelPendingRequest } = useStore();
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [newFriendId, setNewFriendId] = useState('');
    const [newFriendType, setNewFriendType] = useState<'Best' | 'CloseFriend' | 'Acquaintance'>('Acquaintance');
    const [acceptFriendType, setAcceptFriendType] = useState<{ [key: string]: 'Best' | 'CloseFriend' | 'Acquaintance' }>({});

    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
    }, [fetchFriends, fetchPendingRequests]);

    const handleAddFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        await addFriend(newFriendId, newFriendType);
        setShowAddFriend(false);
        setNewFriendId('');
        setNewFriendType('Acquaintance');
    };

    const formatLastPinged = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        }
    };

    return (
        <div className="friend-list">
            <h2>Friends</h2>
            <ul>
                {friends.map((friend) => (
                    <li key={friend.node_id}>
                        {friend.node_id} - {friend.friend_type} - Last pinged: {formatLastPinged(friend.last_pinged)}
                        <button onClick={() => pingFriend(friend.node_id)}>🔄</button>
                        <button onClick={() => removeFriend(friend.node_id)}>Remove</button>
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
                    <button type="submit">Add</button>
                    <button type="button" onClick={() => setShowAddFriend(false)}>Cancel</button>
                </form>
            )}

            <h3>Pending Requests</h3>
            <ul>
                {pendingRequests.map((request) => (
                    <li key={request.node_id}>
                        {request.node_id} - {request.is_local ? 'Outgoing' : 'Incoming'} - Last pinged: {formatLastPinged(request.last_pinged)}
                        {!request.is_local ? (
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
                                <button onClick={() => acceptFriendRequest(request.node_id, acceptFriendType[request.node_id])}>Accept</button>
                                <button onClick={() => rejectFriendRequest(request.node_id)}>Reject</button>
                            </>
                        ) : (
                            <button onClick={() => cancelPendingRequest(request.node_id)}>❌</button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default FriendList;