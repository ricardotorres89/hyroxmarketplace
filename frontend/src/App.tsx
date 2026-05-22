import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5078/api';

// Types
type User = { id: string; gymStarCoins: number };
type Booking = { id: number; date: string; hasAuction: boolean; auctionActive: boolean };
type Auction = { id: number; date: string; startingPrice: number; expirationDate: string; highestBid: number; highestBidder: string | null; bidsCount: number; originalOwner: string };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'auctions' | 'my-entries'>('auctions');
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  // Modal State
  const [modalType, setModalType] = useState<'login' | 'bid' | 'sell' | null>(null);
  const [modalData, setModalData] = useState<any>({});
  
  // Notification State
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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

  const openLogin = () => { setModalData({ username: '' }); setModalType('login'); };
  
  const submitLogin = async () => {
    if (!modalData.username) return;
    const res = await fetch(`${API_BASE}/me/${modalData.username}`);
    if (res.ok) {
      setUser(await res.json());
      setModalType(null);
      showNotification("Bem-vindo!", "success");
    } else showNotification(await res.text(), "error");
  };

  const openSell = () => {
    if (!user) { openLogin(); return; }
    setModalData({ price: 100, duration: 24 });
    setModalType('sell');
  };

  const submitSell = async () => {
    if (!user) return;
    const res = await fetch(`${API_BASE}/auctions/sell?userId=${user.id}&startingPrice=${modalData.price}&durationHours=${modalData.duration}`, { method: 'POST' });
    if (res.ok) {
        setModalType(null);
        showNotification("Inscrição listada para leilão com sucesso!", "success");
        loadData();
    } else showNotification(await res.text(), "error");
  };

  const openBid = (a: Auction) => {
    alert("Da próxima vez, marca a aula a horas! 😂");
  };

  const submitBid = async () => {
    if (!user) return;
    const res = await fetch(`${API_BASE}/auctions/${modalData.auctionId}/bid?userId=${user.id}&amount=${modalData.amount}`, { method: 'POST' });
    if (res.ok) {
        setModalType(null);
        showNotification("Licitação efetuada com sucesso!", "success");
        loadData();
    } else showNotification(await res.text(), "error");
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          padding: '1rem',
          borderRadius: '8px',
          zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(8px)',
          fontWeight: 600
        }} className="animate-fade-in">
          {notification.message || (notification.type === 'error' ? 'Ocorreu um erro' : 'Sucesso')}
        </div>
      )}

      {/* Modals */}
      {modalType && (
        <div className="modal-overlay">
          <div className="modal animate-fade-in">
            {modalType === 'login' && (
              <>
                <h2>Entrar</h2>
                <input type="text" className="input-field" placeholder="Nome de utilizador" value={modalData.username} onChange={e => setModalData({...modalData, username: e.target.value})} />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setModalType(null)}>Cancelar</button>
                  <button className="btn-primary" onClick={submitLogin}>Confirmar</button>
                </div>
              </>
            )}
            {modalType === 'sell' && (
              <>
                <h2>Vender Inscrição</h2>
                <label style={{color: 'var(--text-secondary)'}}>Preço Base (Moedas GymStar):</label>
                <input type="number" className="input-field" value={modalData.price} onChange={e => setModalData({...modalData, price: parseInt(e.target.value)})} />
                <label style={{color: 'var(--text-secondary)'}}>Duração (Horas):</label>
                <input type="number" className="input-field" value={modalData.duration} onChange={e => setModalData({...modalData, duration: parseInt(e.target.value)})} />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setModalType(null)}>Cancelar</button>
                  <button className="btn-primary" onClick={submitSell}>Listar</button>
                </div>
              </>
            )}
            {modalType === 'bid' && (
              <>
                <h2>Fazer uma Licitação</h2>
                <label style={{color: 'var(--text-secondary)'}}>Valor (Mínimo {modalData.minBid}):</label>
                <input type="number" className="input-field" value={modalData.amount} onChange={e => setModalData({...modalData, amount: parseInt(e.target.value)})} />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setModalType(null)}>Cancelar</button>
                  <button className="btn-primary" onClick={submitBid}>Licitar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <header className="header-mobile">
        <div className="logo text-gradient">Aulas de sabado hyrox marketplace</div>
        <div className="user-info">
          {user ? (
            <>
              <span className="hide-mobile">{user.id}</span>
              <div className="coin-badge">
                🪙 {user.gymStarCoins}
              </div>
              <button className="btn-secondary" onClick={() => setUser(null)} style={{ padding: '0.4rem 1rem' }}>Sair</button>
            </>
          ) : (
            <button className="btn-primary" onClick={openLogin} style={{ padding: '0.4rem 1rem' }}>Entrar</button>
          )}
        </div>
      </header>

      <div className="container">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className={activeTab === 'auctions' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('auctions')}>
            Mercado
          </button>
          <button className={activeTab === 'my-entries' ? 'btn-primary' : 'btn-secondary'} onClick={() => {
            if (!user) openLogin();
            else setActiveTab('my-entries');
          }}>
            Minhas Inscrições
          </button>
        </div>

        {activeTab === 'auctions' && (
          <div>
            <h2>Leilões Ativos</h2>
            <div className="grid">
              {auctions.map(a => (
                <div key={a.id} className="glass-panel">
                  <h3>{new Date(a.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</h3>
                  <div className="stats-row">
                    <span>Vendedor:</span>
                    <span>{a.originalOwner}</span>
                  </div>
                  <div className="stats-row">
                    <span>Preço Base:</span>
                    <span className="stat-value">🪙 {a.startingPrice}</span>
                  </div>
                  <div className="stats-row">
                    <span>Maior Licitação:</span>
                    <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🪙 {a.highestBid || '0'}
                      {a.highestBidder && (
                        <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                          {a.highestBidder}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="stats-row">
                    <span>Total de Licitações: {a.bidsCount}</span>
                    <span>Expira às: {new Date(a.expirationDate).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <button 
                    className="btn-primary" 
                    style={{ width: '100%' }} 
                    disabled={user != null && a.originalOwner === user.id}
                    onClick={() => openBid(a)}
                  >
                    {user != null && a.originalOwner === user.id ? 'Sua Listagem' : 'Licitar'}
                  </button>
                </div>
              ))}
              {auctions.length === 0 && <p>Sem leilões ativos de momento.</p>}
            </div>
          </div>
        )}

        {activeTab === 'my-entries' && user && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>Minhas Inscrições</h2>
              <button className="btn-primary" onClick={openSell}>
                + Vender Inscrição
              </button>
            </div>
            
            <div className="grid">
              {myBookings.map(b => (
                <div key={b.id} className="glass-panel">
                  <h3>{new Date(b.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</h3>
                  <div className="stats-row">
                    <span>Estado:</span>
                    {b.hasAuction ? (
                      <span className={`badge ${b.auctionActive ? 'badge-active' : 'badge-inactive'}`}>
                        {b.auctionActive ? 'Em Leilão' : 'Terminado / Vendido'}
                      </span>
                    ) : (
                      <span className="badge badge-active">Ganha / Garantida</span>
                    )}
                  </div>
                </div>
              ))}
              {myBookings.length === 0 && <p>Não tens inscrições.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
