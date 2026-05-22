import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5078/api';

// Types
type User = { id: string; gymStarCoins: number };
type Booking = { id: number; date: string; hasAuction: boolean; auctionActive: boolean };
type Auction = { id: number; date: string; startingPrice: number; expirationDate: string; highestBid: number; bidsCount: number; originalOwner: string };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'auctions' | 'my-entries'>('auctions');
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  const login = async () => {
    const username = prompt("Enter your username:");
    if (!username) return;
    const res = await fetch(`${API_BASE}/me/${username}`);
    if (res.ok) {
      setUser(await res.json());
    }
  };

  const loadData = async () => {
    if (activeTab === 'auctions') {
      const res = await fetch(`${API_BASE}/auctions`);
      if (res.ok) setAuctions(await res.json());
    } 
    
    if (user) {
      if (activeTab === 'my-entries') {
        const res = await fetch(`${API_BASE}/my-bookings/${user.id}`);
        if (res.ok) setMyBookings(await res.json());
      }
      const res2 = await fetch(`${API_BASE}/me/${user.id}`);
      if (res2.ok) setUser(await res2.json());
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); 
    return () => clearInterval(interval);
  }, [user, activeTab]);

  const listForAuction = async () => {
    if (!user) { alert("Please login first."); login(); return; }
    const price = prompt("Enter starting price (GymStar coins):", "100");
    if (!price) return;
    const duration = prompt("Enter duration in hours:", "24");
    if (!duration) return;

    const res = await fetch(`${API_BASE}/auctions/sell?userId=${user.id}&startingPrice=${price}&durationHours=${duration}`, { method: 'POST' });
    if (res.ok) {
        alert("Entry successfully listed for auction!");
        loadData();
    }
    else alert(await res.text());
  };

  const placeBid = async (auctionId: number, startingPrice: number, highestBid: number) => {
    if (!user) { alert("Please login first."); login(); return; }
    const minBid = highestBid ? highestBid + 1 : startingPrice;
    const bidAmount = prompt(`Enter bid amount (Minimum ${minBid}):`, minBid.toString());
    if (!bidAmount) return;

    const res = await fetch(`${API_BASE}/auctions/${auctionId}/bid?userId=${user.id}&amount=${bidAmount}`, { method: 'POST' });
    if (res.ok) loadData();
    else alert(await res.text());
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header-mobile">
        <div className="logo text-gradient">Hyrox Marketplace</div>
        <div className="user-info">
          {user ? (
            <>
              <span className="hide-mobile">{user.id}</span>
              <div className="coin-badge">
                🪙 {user.gymStarCoins}
              </div>
              <button className="btn-secondary" onClick={() => setUser(null)} style={{ padding: '0.4rem 1rem' }}>Logout</button>
            </>
          ) : (
            <button className="btn-primary" onClick={login} style={{ padding: '0.4rem 1rem' }}>Login</button>
          )}
        </div>
      </header>

      <div className="container">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className={activeTab === 'auctions' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('auctions')}>
            Marketplace
          </button>
          <button className={activeTab === 'my-entries' ? 'btn-primary' : 'btn-secondary'} onClick={() => {
            if (!user) login();
            else setActiveTab('my-entries');
          }}>
            My Entries
          </button>
        </div>

        {activeTab === 'auctions' && (
          <div>
            <h2>Active Auctions</h2>
            <div className="grid">
              {auctions.map(a => (
                <div key={a.id} className="glass-panel">
                  <h3>{new Date(a.date).toLocaleString()}</h3>
                  <div className="stats-row">
                    <span>Seller:</span>
                    <span>{a.originalOwner}</span>
                  </div>
                  <div className="stats-row">
                    <span>Starting Price:</span>
                    <span className="stat-value">🪙 {a.startingPrice}</span>
                  </div>
                  <div className="stats-row">
                    <span>Highest Bid:</span>
                    <span className="stat-value">🪙 {a.highestBid || 'No bids yet'}</span>
                  </div>
                  <div className="stats-row">
                    <span>Total Bids: {a.bidsCount}</span>
                    <span>Expires: {new Date(a.expirationDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <button 
                    className="btn-primary" 
                    style={{ width: '100%' }} 
                    disabled={user != null && a.originalOwner === user.id}
                    onClick={() => placeBid(a.id, a.startingPrice, a.highestBid)}
                  >
                    {user != null && a.originalOwner === user.id ? 'Your Listing' : 'Place Bid'}
                  </button>
                </div>
              ))}
              {auctions.length === 0 && <p>No active auctions right now.</p>}
            </div>
          </div>
        )}

        {activeTab === 'my-entries' && user && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>My Entries</h2>
              <button className="btn-primary" onClick={listForAuction}>
                + Sell a Saturday Entry
              </button>
            </div>
            
            <div className="grid">
              {myBookings.map(b => (
                <div key={b.id} className="glass-panel">
                  <h3>{new Date(b.date).toLocaleString()}</h3>
                  <div className="stats-row">
                    <span>Status:</span>
                    {b.hasAuction ? (
                      <span className={`badge ${b.auctionActive ? 'badge-active' : 'badge-inactive'}`}>
                        {b.auctionActive ? 'On Auction' : 'Auction Ended / Sold'}
                      </span>
                    ) : (
                      <span className="badge badge-active">Won / Secured</span>
                    )}
                  </div>
                </div>
              ))}
              {myBookings.length === 0 && <p>You have no entries.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
