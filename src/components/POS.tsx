import React, { useState, useEffect, useRef } from 'react';

const POS = ({ user }: { user: any }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedMagasinId, setSelectedMagasinId] = useState(user.id_magasin || '');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState<any>(null);
  const [lastInvoiceNum, setLastInvoiceNum] = useState('');
  const [lastPaymentMode, setLastPaymentMode] = useState('');
  const [receivedAmount, setPaymentAmount] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // États pour l'historique et réimpression
  const [historyMode, setHistoryMode] = useState(false);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [reprintData, setReprintData] = useState<any>(null);
  const [reprintItems, setReprintItems] = useState<any[]>([]);

  const fetchData = async () => {
    const url = await (window as any).electronAPI.mediaGetBaseUrl();
    setBaseUrl(url);

    // Récupérer le stock spécifique au magasin sélectionné
    const resProds = await (window as any).electronAPI.dbQuery(`
      SELECT p.*, IFNULL(s.quantite, 0) as stock_total 
      FROM products p 
      LEFT JOIN stock s ON p.id = s.id_product AND s.id_magasin = ?
      ORDER BY p.designation
    `, [selectedMagasinId]);
    if (resProds.success) {
        const cleaned = resProds.data.map((p: any) => ({
            ...p,
            prix_vente: Math.round(parseFloat(p.prix_vente) || 0),
            prix_achat: Math.round(parseFloat(p.prix_achat) || 0),
            prix_revient: Math.round(parseFloat(p.prix_revient) || 0)
        }));
        setProducts(cleaned);
    }
    
    const resMags = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (resMags.success) setMagasins(resMags.data);

    const resClients = await (window as any).electronAPI.dbQuery('SELECT id, nom FROM clients ORDER BY nom');
    if (resClients.success) setClients(resClients.data);

    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
  };

  const loadHistory = async () => {
    const res = await (window as any).electronAPI.dbQuery(`
        SELECT f.*, c.nom as client_nom, m.nom as magasin_nom
        FROM factures f
        LEFT JOIN clients c ON f.id_client = c.id
        LEFT JOIN magasins m ON f.id_magasin = m.id
        WHERE f.type_paiement = 'comptant'
        ORDER BY f.date_facture DESC LIMIT 50
    `);
    if (res.success) setHistoryInvoices(res.data);
  };

  const reprintInvoice = async (invoice: any) => {
    const res = await (window as any).electronAPI.dbQuery(`
        SELECT fi.*, p.designation 
        FROM facture_items fi 
        JOIN products p ON fi.id_product = p.id 
        WHERE fi.id_facture = ?
    `, [invoice.id]);
    if (res.success) {
        setReprintData(invoice);
        setReprintItems(res.data);
        setTimeout(() => {
            window.print();
            setReprintData(null);
            setReprintItems([]);
        }, 300);
    }
  };

  useEffect(() => { 
    fetchData(); 
    searchInputRef.current?.focus();
  }, [selectedMagasinId]);

  const addToCart = (product: any) => {
    if (!selectedMagasinId) { alert('Veuillez d\'abord sélectionner un dépôt/magasin !'); return; }
    if (product.stock_total <= 0) { alert('Stock épuisé dans ce magasin !'); return; }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock_total) { alert('Stock maximum atteint pour ce magasin !'); return; }
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
    setSearch('');
    searchInputRef.current?.focus();
  };

  const updateCartPrice = (id: number, price: string) => {
    const p = Math.round(parseFloat(price) || 0);
    setCart(cart.map(item => item.id === id ? { ...item, prix_vente: p } : item));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = products.find(p => p.code_barre === search || p.designation.toLowerCase() === search.toLowerCase());
    if (found) addToCart(found);
  };

  const totalTTC = Math.round(cart.reduce((sum, item) => sum + (item.prix_vente * item.qty), 0));
  const changeAmount = receivedAmount ? Math.round(parseFloat(receivedAmount)) - totalTTC : 0;

  const validateSale = async (mode: string) => {
    if (cart.length === 0) return;
    if (!selectedMagasinId) { alert('Sélectionnez un magasin de sortie.'); return; }

    const sousPrix = cart.find(item => item.prix_vente < item.prix_revient);
    if (sousPrix) {
        alert(`⚠️ VENTE INTERDITE : Le prix de vente de "${sousPrix.designation}" (${sousPrix.prix_vente.toLocaleString()} FCFA) est inférieur au prix de revient (${sousPrix.prix_revient.toLocaleString()} FCFA).`);
        return;
    }

    const resCount = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM factures');
    const nextSeq = (resCount.success && resCount.data[0]?.total ? resCount.data[0].total + 1 : 1);
    const invoiceNum = `POS-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;
    setLastInvoiceNum(invoiceNum);
    setLastPaymentMode(mode);

    const resInvoice = await (window as any).electronAPI.dbQuery(
      'INSERT INTO factures (numero_facture, id_client, total_ht, total_ttc, type_paiement, mode_reglement, id_magasin) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invoiceNum, selectedClientId || null, totalTTC, totalTTC, 'comptant', mode, selectedMagasinId]
    );

    if (resInvoice.success) {
      const invoiceId = resInvoice.data.insertId || resInvoice.data;
      for (const item of cart) {
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO facture_items (id_facture, id_product, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?)',
          [invoiceId, item.id, item.qty, item.prix_vente, item.qty * item.prix_vente]
        );
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO stock (id_product, id_magasin, quantite) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantite = quantite - ?',
          [item.id, selectedMagasinId, -item.qty, item.qty]
        );
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO stock_movements (id_product, id_magasin, type_mouvement, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?)',
          [item.id, selectedMagasinId, 'SORTIE', item.qty, item.prix_vente, item.qty * item.prix_vente]
        );
      }

      if (mode === 'espece') {
        const clientName = clients.find(c => c.id.toString() === selectedClientId)?.nom || 'Client Comptant';
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO caisse (type_mouvement, montant, motif, beneficiaire, id_magasin) VALUES (?, ?, ?, ?, ?)',
          ['ENTREE', totalTTC, `Vente POS ${invoiceNum}`, clientName, selectedMagasinId]
        );
      }

      setTimeout(() => {
        window.print();
        setCart([]); setPaymentAmount(''); setSelectedClientId(''); fetchData();
        searchInputRef.current?.focus();
      }, 300);
    }
  };

  const filteredProducts = products.filter(p => 
    p.designation.toLowerCase().includes(search.toLowerCase()) || (p.code_barre && p.code_barre.includes(search))
  ).slice(0, 15);

  const getPaymentModeLabel = (mode: string) => {
    switch(mode) {
        case 'espece': return 'ESPÈCES';
        case 'mobile': return 'MOBILE MONEY';
        case 'carte': return 'CARTE BANCAIRE';
        default: return mode?.toUpperCase() || '';
    }
  };

  const selectedMagasinName = magasins.find(m => m.id.toString() === selectedMagasinId.toString())?.nom || 'Non spécifié';

  return (
    <div className="pos-container h-100">
      <style>{`
        .pos-grid { display: grid; grid-template-columns: 1fr 400px; gap: 20px; height: calc(100vh - 120px); }
        .product-card { cursor: pointer; transition: transform 0.1s; border: none; shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden; }
        .product-img-container { height: 120px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid #eee; }
        .product-img { width: 100%; height: 100%; object-fit: cover; }
        .total-display { background: #212529; color: #00ff00; font-family: monospace; font-size: 2.5rem; text-align: right; padding: 15px; border-radius: 8px; }
        @media print {
          body * { visibility: hidden !important; }
          .pos-print, .pos-print * { visibility: visible !important; }
          .pos-print { 
            position: absolute !important; left: 0 !important; top: 0 !important; width: 80mm !important; 
            display: block !important;
            font-family: 'Courier New', Courier, monospace; 
            font-size: 13px; color: #000; font-weight: bold;
          }
          .pos-print h4 { font-size: 16px; font-weight: bold; margin-bottom: 0px; }
          .pos-print .ticket-item { border-bottom: 1px dashed #ccc; padding: 3px 0; }
          .pos-print .item-row-2 { display: flex; justify-content: space-between; margin-top: 2px; }
          .pos-print hr { margin: 3px 0; border-top: 1px dashed #000; }
          .pos-print .total-box { border: 1px solid #000; padding: 5px; margin: 5px 0; font-size: 16px; text-align: center; font-weight: bold; text-transform: uppercase; }
        }
      `}</style>

      {/* VUE HISTORIQUE (D-PRINT-NONE) */}
      {historyMode ? (
        <div className="card shadow-sm border-0 h-100 d-print-none">
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">📜 Dernières Ventes POS</h5>
                <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => setHistoryMode(false)}>Retour à la Vente</button>
            </div>
            <div className="card-body">
                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead><tr><th>Date</th><th>N° Ticket</th><th>Client</th><th>Dépôt</th><th className="text-end">Montant</th><th className="text-end">Action</th></tr></thead>
                        <tbody>
                            {historyInvoices.map(inv => (
                                <tr key={inv.id}>
                                    <td>{new Date(inv.date_facture).toLocaleString()}</td>
                                    <td className="fw-bold">{inv.numero_facture}</td>
                                    <td>{inv.client_nom}</td>
                                    <td>{inv.magasin_nom}</td>
                                    <td className="text-end fw-bold">{inv.total_ttc.toLocaleString()} FCFA</td>
                                    <td className="text-end"><button className="btn btn-sm btn-primary fw-bold" onClick={() => reprintInvoice(inv)}>🖨️ Réimprimer</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      ) : (
        /* VUE VENTE (D-PRINT-NONE) */
        <div className="pos-grid d-print-none">
            {/* SECTION GAUCHE : PRODUITS */}
            <div className="d-flex flex-column gap-3">
                <div className="card shadow-sm border-0">
                    <div className="card-body p-2 d-flex gap-3">
                        <div className="flex-grow-1"><form onSubmit={handleSearch}><input ref={searchInputRef} type="text" className="form-control form-control-lg bg-light border-0" placeholder="🔍 Scanner un code-barre ou chercher un nom..." value={search} onChange={e => setSearch(e.target.value)}/></form></div>
                        <div style={{ width: '200px' }}>
                            <select className={`form-select form-select-lg fw-bold ${cart.length > 0 ? 'bg-light text-muted' : 'border-primary text-primary'}`} value={selectedMagasinId} onChange={e => setSelectedMagasinId(e.target.value)} disabled={cart.length > 0}>
                                <option value="">-- DÉPÔT --</option>
                                {magasins.map(m => <option key={m.id} value={m.id}>📦 {m.nom}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="overflow-auto pe-2">
                    <div className="row g-3">
                        {filteredProducts.map(p => (
                            <div key={p.id} className="col-md-3 col-sm-4 col-6">
                                <div className="card product-card h-100 shadow-sm" onClick={() => addToCart(p)}>
                                    <div className="product-img-container">{p.image_path ? <img src={`${baseUrl}${p.image_path}`} alt="" className="product-img" /> : <span style={{ fontSize: '40px' }}>📦</span>}</div>
                                    <div className="card-body p-2 text-center">
                                        <div className="fw-bold small mb-1 text-truncate">{p.designation}</div>
                                        <div className="text-primary fw-bold fs-5">{p.prix_vente.toLocaleString()}</div>
                                        <div className={`fw-bold mt-1 ${p.stock_total > 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '12px' }}>Stock: {p.stock_total}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECTION DROITE : PANIER */}
            <div className="cart-panel shadow rounded-3 p-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0 fw-bold">🛒 Panier</h5>
                    <button className="btn btn-sm btn-outline-dark" onClick={() => { setHistoryMode(true); loadHistory(); }}>📜 Historique</button>
                </div>
                <div className="mb-3">
                    <label className="small fw-bold">Client</label>
                    <select className="form-select form-select-sm border-success" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                        <option value="">-- Client Comptant --</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                </div>
                <div className="flex-grow-1 overflow-auto mb-3 border-bottom">
                    <table className="table table-sm align-middle">
                        <thead><tr className="small text-muted"><th>Article</th><th className="text-center">Qté</th><th className="text-end">P.U</th></tr></thead>
                        <tbody>
                            {cart.map(item => (
                                <tr key={item.id}>
                                    <td className="small fw-bold">
                                        <div className="d-flex align-items-center gap-2">
                                            {item.image_path && <img src={`${baseUrl}${item.image_path}`} alt="" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px' }} />}
                                            <span className="text-truncate" style={{ maxWidth: '80px' }}>{item.designation}</span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="d-flex align-items-center justify-content-center gap-1">
                                            <button className="btn btn-xs btn-light p-0 px-1 border" onClick={() => { if (item.qty > 1) setCart(cart.map(i => i.id === item.id ? {...i, qty: i.qty - 1} : i)); else setCart(cart.filter(i => i.id !== item.id)); }}>-</button>
                                            <span className="small px-1 fw-bold">{item.qty}</span>
                                            <button className="btn btn-xs btn-light p-0 px-1 border" onClick={() => addToCart(item)}>+</button>
                                        </div>
                                    </td>
                                    <td className="text-end"><input type="number" className="form-control form-control-sm text-end fw-bold text-primary p-0 border-0 bg-transparent" value={item.prix_vente} onChange={e => updateCartPrice(item.id, e.target.value)}/></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mb-3">
                    <div className="total-display mb-3"><div className="small" style={{ fontSize: '0.8rem', opacity: 0.7 }}>TOTAL À PAYER</div>{totalTTC.toLocaleString()}</div>
                    <div className="mb-2"><label className="small fw-bold">Espèces reçues :</label><input type="number" className="form-control form-control-lg fw-bold text-end border-primary" value={receivedAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0" /></div>
                    {receivedAmount && <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded border"><span className="fw-bold">À RENDRE :</span><span className={`fs-4 fw-bold ${changeAmount >= 0 ? 'text-success' : 'text-danger'}`}>{changeAmount.toLocaleString()} FCFA</span></div>}
                </div>
                <div className="d-grid gap-2">
                    <button className="btn btn-success btn-lg py-3 fw-bold shadow" onClick={() => validateSale('espece')} disabled={cart.length === 0}>💵 ENCAISSER (CASH)</button>
                    <div className="row g-2">
                        <div className="col-6"><button className="btn btn-primary w-100 fw-bold" onClick={() => validateSale('mobile')} disabled={cart.length === 0}>📱 MOBILE</button></div>
                        <div className="col-6"><button className="btn btn-dark w-100 fw-bold" onClick={() => validateSale('carte')} disabled={cart.length === 0}>💳 CARTE</button></div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ZONE D'IMPRESSION TICKET POS (TOUJOURS PRÉSENTE POUR window.print()) */}
      <div className="pos-print" style={{ display: 'none' }}>
        <div className="text-center">
          <h4>{company?.company_name}</h4>
          {company?.activity && <div style={{ fontSize: '10px', fontStyle: 'italic' }}>{company.activity}</div>}
          <div style={{ fontSize: '10px' }}>{company?.address} | Tél: {company?.phone}<br/>{company?.niu && <span>NIU: {company.niu} </span>}{company?.rccm && <span>| RCCM: {company.rccm}</span>}</div>
          <hr/>
          <div style={{ fontSize: '12px', textAlign: 'left' }}>
            {reprintData && <div className="text-center fw-bold border-bottom mb-1">DUPLICATA TICKET</div>}
            <b>N°:</b> {reprintData ? reprintData.numero_facture : lastInvoiceNum} | <b>Date:</b> {reprintData ? new Date(reprintData.date_facture).toLocaleDateString() : new Date().toLocaleDateString()} {new Date().toLocaleTimeString().substring(0,5)}<br/>
            <b>Dépôt:</b> {reprintData ? reprintData.magasin_nom : selectedMagasinName} | <b>Vend:</b> {user.username}<br/>
            <b>Client:</b> {reprintData ? reprintData.client_nom : (clients.find(c => c.id.toString() === selectedClientId)?.nom || 'Client Comptant')}
          </div>
          <hr/>
        </div>

        <div className="ticket-items">
            {(reprintData ? reprintItems : cart).map((item, idx) => {
                const qty = reprintData ? item.quantite : item.qty;
                const pu = Math.round(reprintData ? item.prix_unitaire : item.prix_vente);
                return (
                    <div key={idx} className="ticket-item">
                        <div className="item-designation">{item.designation}</div>
                        <div className="item-row-2">
                            <span>Qté: {qty}</span>
                            <span>x {pu.toLocaleString()}</span>
                            <span>= {(qty * pu).toLocaleString()}</span>
                        </div>
                    </div>
                );
            })}
        </div>

        <hr/><div className="total-box">TOTAL: {(reprintData ? reprintData.total_ttc : totalTTC).toLocaleString()} FCFA</div>
        <div style={{ fontSize: '12px', textAlign: 'center', border: '1px solid #000', padding: '2px' }}>MODE RÈGLEMENT: {getPaymentModeLabel(reprintData ? reprintData.mode_reglement : lastPaymentMode)}</div>
        {!reprintData && receivedAmount && <div style={{ fontSize: '12px', marginTop: '5px' }}><div className="d-flex justify-content-between"><span>Reçu:</span> <span>{Math.round(parseFloat(receivedAmount)).toLocaleString()}</span></div><div className="d-flex justify-content-between"><span>Rendu:</span> <span>{changeAmount.toLocaleString()}</span></div></div>}
        <div className="text-center mt-2" style={{ fontSize: '10px', fontStyle: 'italic' }}>{company?.invoice_footer || "Merci de votre visite !"}<div className="mt-1 fw-bold">FUSIONSTOCK PRO</div></div>
      </div>
    </div>
  );
};

export default POS;
