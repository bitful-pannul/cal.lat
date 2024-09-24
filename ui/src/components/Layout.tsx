import React from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
    return (
        <div>
            <header style={{ padding: '1rem', backgroundColor: '#f0f0f0' }}>
                <nav>
                    <ul style={{ display: 'flex', listStyle: 'none', gap: '1rem' }}>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/my-location">My Location</Link></li>
                    </ul>
                </nav>
            </header>
            <main>
                {children}
            </main>
        </div>
    );
}

export default Layout;