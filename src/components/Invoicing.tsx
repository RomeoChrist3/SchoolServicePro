import React, { useState, useEffect } from 'react';

const Invoicing = ({ user }: { user: any }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | string>('');
  const [selectedClientName, setSelectedClientName] = useState('Client Comptant');
  const [selectedMagasinId, setSelectedMagasinId] = useState<number | string>(user.id_magasin || '');
  const [printMode, setPrintMode] = useState<'A4' | 'POS'>('A4');
  const [company, setCompany] = useState<any>(null);
  const [lastInvoiceNum, setLastInvoiceNum] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const [tvaRate, setTvaRate] = useState(0);
  const [precompteRate, setPrecompteRate] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('comptant'); 
  const [paymentMode, setPaymentMode] = useState('espece'); 

  const [historyMode, setHistoryMode] = useState(false);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);

  const fetchData = async () => {
    const url = await (window as any).electronAPI.mediaGetBaseUrl();
    setBaseUrl(url);

    const resMags = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (resMags.success) setMagasins(resMags.data);

    const resClients = await (window as any).electronAPI.dbQuery('SELECT id, nom FROM clients ORDER BY nom');
    if (resClients.success) setClients(resClients.data);

    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);

    const prodQuery = `
      SELECT p.*, IFNULL(s.quantite, 0) as stock_total 
      FROM products p 
      LEFT JOIN stock s ON p.id = s.id_product AND s.id_magasin = ?
      ORDER BY p.designation
    `;
    const resProds = await (window as any).electronAPI.dbQuery(prodQuery, [selectedMagasinId || 0]);
    if (resProds.success) {
        // Sécurité : Prix arrondis
        const cleaned = resProds.data.map((p: any) => ({
            ...p,
            prix_vente: Math.round(parseFloat(p.prix_vente) || 0),
            prix_achat: Math.round(parseFloat(p.prix_achat) || 0),
            prix_revient: Math.round(parseFloat(p.prix_revient) || 0)
        }));
        setProducts(cleaned);
    }
  };

  const loadHistory = async () => {
    const res = await (window as any).electronAPI.dbQuery(`
        SELECT f.*, c.nom as client_nom, m.nom as magasin_nom
        FROM factures f
        LEFT JOIN clients c ON f.id_client = c.id
        LEFT JOIN magasins m ON f.id_magasin = m.id
        ORDER BY f.date_facture DESC LIMIT 50
    `);
    if (res.success) setHistoryInvoices(res.data);
  };

  const loadInvoiceDetails = async (invoice: any) => {
    const res = await (window as any).electronAPI.dbQuery(`
        SELECT fi.*, p.designation 
        FROM facture_items fi 
        JOIN products p ON fi.id_product = p.id 
        WHERE fi.id_facture = ?
    `, [invoice.id]);
    if (res.success) {
        setSelectedInvoice(invoice);
        setReturnItems(res.data.map((i: any) => ({ ...i, qte_retour: 0 })));
    }
  };

  const processReturn = async () => {
    if (!selectedInvoice) return;
    const itemsToReturn = returnItems.filter(i => i.qte_retour > 0);
    if (itemsToReturn.length === 0) { alert('Aucun article sélectionné pour le retour.'); return; }

    if (!window.confirm('Confirmer le retour de ces articles ? Cela va créer un AVOIR et réintégrer le stock.')) return;

    // 1. Créer la facture d'AVOIR
    const totalAvoir = Math.round(itemsToReturn.reduce((s: number, i: any) => s + (i.qte_retour * i.prix_unitaire), 0));
    const invoiceNum = `AVOIR-${selectedInvoice.numero_facture}`;
    
    const resAv = await (window as any).electronAPI.dbQuery(
        'INSERT INTO factures (numero_facture, id_client, total_ttc, type_paiement, mode_reglement, id_magasin, id_facture_origine, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceNum, selectedInvoice.id_client, -totalAvoir, selectedInvoice.type_paiement, selectedInvoice.mode_reglement, selectedInvoice.id_magasin, selectedInvoice.id, 'AVOIR']
    );

    if (resAv.success) {
        const avoirId = resAv.data.insertId;
        
        for (const item of itemsToReturn) {
            // Ligne d'avoir (négatif)
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO facture_items (id_facture, id_product, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?)',
                [avoirId, item.id_product, -item.qte_retour, item.prix_unitaire, -(item.qte_retour * item.prix_unitaire)]
            );
            
            // Réintégration Stock
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO stock (id_product, id_magasin, quantite) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantite = quantite + ?',
                [item.id_product, selectedInvoice.id_magasin, item.qte_retour, item.qte_retour]
            );
            
            // Mouvement Stock (ENTREE par RETOUR)
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO stock_movements (id_product, id_magasin, type_mouvement, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?)',
                [item.id_product, selectedInvoice.id_magasin, 'ENTREE', item.qte_retour, item.prix_unitaire, item.qte_retour * item.prix_unitaire]
            );
        }

        // Annuler la facture d'origine si retour total
        const allReturned = returnItems.every(i => i.qte_retour === i.quantite);
        if (allReturned) {
            await (window as any).electronAPI.dbQuery('UPDATE factures SET statut = "ANNULE" WHERE id = ?', [selectedInvoice.id]);
        }

        // Remboursement Caisse si comptant
        if (selectedInvoice.type_paiement === 'comptant') {
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO caisse (type_mouvement, montant, motif, id_magasin) VALUES (?, ?, ?, ?)',
                ['SORTIE', totalAvoir, `Remboursement AVOIR ${invoiceNum}`, selectedInvoice.id_magasin]
            );
        }

        alert('Retour effectué avec succès ! Avoir généré.');
        setSelectedInvoice(null);
        loadHistory();
    }
  };

  useEffect(() => { fetchData(); }, [selectedMagasinId]);

  if (historyMode) {
    return (
        <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">📜 Historique & Retours</h5>
                <button className="btn btn-dark btn-sm fw-bold" onClick={() => setHistoryMode(false)}>Retour Vente</button>
            </div>
            <div className="card-body row">
                <div className="col-md-5 border-end">
                    <h6 className="text-muted fw-bold mb-3">Dernières Factures</h6>
                    <div className="list-group">
                        {historyInvoices.map(inv => (
                            <button key={inv.id} className={`list-group-item list-group-item-action ${selectedInvoice?.id === inv.id ? 'active' : ''}`} onClick={() => loadInvoiceDetails(inv)}>
                                <div className="d-flex justify-content-between">
                                    <span className="fw-bold">{inv.numero_facture}</span>
                                    <small>{new Date(inv.date_facture).toLocaleDateString()}</small>
                                </div>
                                <div className="small d-flex justify-content-between">
                                    <span>{inv.client_nom || 'Client Comptant'}</span>
                                    <span className="fw-bold">{Math.round(inv.total_ttc).toLocaleString()} FCFA</span>
                                </div>
                                {inv.statut === 'ANNULE' && <span className="badge bg-danger mt-1">ANNULÉ</span>}
                                {inv.statut === 'AVOIR' && <span className="badge bg-info mt-1">AVOIR</span>}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="col-md-7">
                    {selectedInvoice ? (
                        <div>
                            <h5 className="fw-bold text-primary mb-3">Détail Facture {selectedInvoice.numero_facture}</h5>
                            {selectedInvoice.statut === 'VALIDE' ? (
                                <>
                                    <div className="alert alert-info small">Sélectionnez la quantité à retourner pour chaque article.</div>
                                    <table className="table table-sm align-middle">
                                        <thead><tr><th>Article</th><th>Vendu</th><th>Retour</th></tr></thead>
                                        <tbody>
                                            {returnItems.map(item => (
                                                <tr key={item.id}>
                                                    <td>{item.designation}</td>
                                                    <td>{item.quantite}</td>
                                                    <td style={{width: '100px'}}>
                                                        <input type="number" min="0" max={item.quantite} className="form-control form-control-sm" value={item.qte_retour} onChange={e => {
                                                            const val = Math.min(parseInt(e.target.value)||0, item.quantite);
                                                            setReturnItems(returnItems.map(i => i.id === item.id ? {...i, qte_retour: val} : i));
                                                        }} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="text-end mt-3">
                                        <button className="btn btn-danger fw-bold" onClick={processReturn}>🚫 VALIDER LE RETOUR / AVOIR</button>
                                    </div>
                                </>
                            ) : (
                                <div className="alert alert-warning">Cette facture ne peut plus être modifiée (Statut : {selectedInvoice.statut}).</div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-muted py-5">Sélectionnez une facture pour voir les détails.</div>
                    )}
                </div>
            </div>
        </div>
    );
  }

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedClientId(id);
    if (id === '') {
      setSelectedClientName('Client Comptant');
    } else {
      const client = clients.find(c => c.id.toString() === id);
      setSelectedClientName(client ? client.nom : 'Client Comptant');
    }
  };

  const addToCart = (product: any) => {
    if (!selectedMagasinId) { alert('Veuillez d\'abord sélectionner un dépôt !'); return; }
    if (product.stock_total <= 0) { alert('Stock insuffisant !'); return; }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock_total) { alert('Stock max atteint !'); return; }
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeOne = (id: number) => {
    const existing = cart.find(item => item.id === id);
    if (existing && existing.qty > 1) {
      setCart(cart.map(item => item.id === id ? { ...item, qty: item.qty - 1 } : item));
    } else {
      setCart(cart.filter(item => item.id !== id));
    }
  };

  const subtotalHT = Math.round(cart.reduce((sum, item) => sum + (item.prix_vente * item.qty), 0));
  const totalTVA = Math.round(subtotalHT * (tvaRate / 100));
  const totalPrecompte = Math.round(subtotalHT * (precompteRate / 100));
  const totalTTC = subtotalHT + totalTVA + totalPrecompte;

  const validateSale = async () => {
    if (cart.length === 0) return;
    if (!selectedMagasinId) { alert('Sélectionnez un dépôt.'); return; }

    // Vérification anti-vente à perte (par rapport au prix de revient)
    const sousPrixRevient = cart.find(item => item.prix_vente < item.prix_revient);
    if (sousPrixRevient) {
        alert(`⚠️ VENTE INTERDITE : Le prix de vente de "${sousPrixRevient.designation}" (${sousPrixRevient.prix_vente.toLocaleString()} FCFA) est inférieur au prix de revient (${sousPrixRevient.prix_revient.toLocaleString()} FCFA).\nVente à perte non autorisée.`);
        return;
    }

    const resCount = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM factures');
    const nextSeq = (resCount.success && resCount.data[0]?.total ? resCount.data[0].total + 1 : 1);
    const invoiceNum = `FAC-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;
    setLastInvoiceNum(invoiceNum);

    const resInvoice = await (window as any).electronAPI.dbQuery(
      'INSERT INTO factures (numero_facture, id_client, total_ht, tva, total_ttc, type_paiement, mode_reglement, id_magasin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [invoiceNum, selectedClientId || null, subtotalHT, totalTVA, totalTTC, paymentStatus, paymentMode, selectedMagasinId]
    );

    if (resInvoice.success) {
      const invoiceId = resInvoice.data.insertId || resInvoice.data; 
      for (const item of cart) {
          await (window as any).electronAPI.dbQuery('INSERT INTO facture_items (id_facture, id_product, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?)', [invoiceId, item.id, item.qty, item.prix_vente, item.qty * item.prix_vente]);
          
          await (window as any).electronAPI.dbQuery(
              'INSERT INTO stock (id_product, id_magasin, quantite) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantite = quantite - ?',
              [item.id, selectedMagasinId, -item.qty, item.qty]
          );

          await (window as any).electronAPI.dbQuery('INSERT INTO stock_movements (id_product, id_magasin, type_mouvement, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?)', [item.id, selectedMagasinId, 'SORTIE', item.qty, item.prix_vente, item.qty * item.prix_vente]);
      }
      
      if (paymentStatus === 'comptant' && paymentMode === 'espece') {
          await (window as any).electronAPI.dbQuery('INSERT INTO caisse (type_mouvement, montant, motif, beneficiaire, id_magasin) VALUES (?, ?, ?, ?, ?)', ['ENTREE', totalTTC, `Vente ${invoiceNum}`, selectedClientName, selectedMagasinId]);
      }
      
      alert('Vente validée !');
      setTimeout(() => {
        window.print();
        setCart([]); fetchData(); setSelectedClientId(''); setSelectedClientName('Client Comptant'); setTvaRate(0); setPrecompteRate(0);
      }, 500);
    }
  };

  const filteredProducts = products.filter(p => p.designation.toLowerCase().includes(search.toLowerCase()) || (p.code_barre && p.code_barre.includes(search)));
  const displayedProducts = filteredProducts.slice(0, 50);
  const selectedMagasinName = magasins.find(m => m.id.toString() === selectedMagasinId.toString())?.nom || 'N/A';

  return (
    <div className="row g-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>

      {/* UI GAUCHE : PRODUITS */}
      <div className="col-md-7 d-print-none">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
            <div className="flex-grow-1 me-3">
                <input type="text" className="form-control border-success" placeholder="🔍 Scanner ou taper le nom d'un produit..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <small className="text-muted text-nowrap">{filteredProducts.length} articles trouvés</small>
          </div>
          <div className="card-body p-0" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div className="list-group list-group-flush">
              {displayedProducts.map(p => (
                <button key={p.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3" onClick={() => addToCart(p)}>
                  <div className="d-flex align-items-center gap-3">
                    {p.image_path ? (
                        <img src={`${baseUrl}${p.image_path}`} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                        <div className="bg-light d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', borderRadius: '4px', fontSize: '20px' }}>📦</div>
                    )}
                    <div>
                        <div className="fw-bold">{p.designation}</div>
                        <small className={`fw-bold ${p.stock_total > 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '14px' }}>
                            Stock: {p.stock_total}
                        </small>
                    </div>
                  </div>
                  <div className="text-primary fw-bold fs-5">{Math.round(p.prix_vente).toLocaleString()}</div>
                </button>
              ))}
              {filteredProducts.length > 50 && (
                <div className="p-3 text-center bg-light small text-muted italic">
                    Affinez votre recherche pour voir les autres articles...
                </div>
              )}
              {filteredProducts.length === 0 && (
                <div className="p-5 text-center text-muted">Aucun article trouvé.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* UI DROITE : CART */}
      <div className="col-md-5 d-print-none">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-success text-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">🧾 Facturation</h5>
            <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => { setHistoryMode(true); loadHistory(); }}>📜 Historique & Retours</button>
          </div>
          <div className="card-body p-4">
            <div className="mb-3">
              <label className="small fw-bold">Dépôt (Obligatoire)</label>
              <select 
                className={`form-select ${cart.length > 0 ? 'bg-light text-muted' : 'border-primary fw-bold'}`} 
                value={selectedMagasinId} 
                onChange={e => setSelectedMagasinId(e.target.value)}
                disabled={cart.length > 0}
              >
                <option value="">-- Sélectionner Dépôt --</option>
                {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              {cart.length > 0 && <small className="text-danger fw-bold">Videz le panier pour changer de dépôt.</small>}
            </div>
            <div className="mb-3">
              <label className="small fw-bold">Client</label>
              <select className="form-select" value={selectedClientId} onChange={handleClientChange}>
                <option value="">-- Client Comptant --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            <table className="table table-sm align-middle">
              <thead><tr className="small text-muted border-bottom"><th>Article</th><th className="text-center">Qté</th><th className="text-end" style={{width: '100px'}}>P.U</th><th className="text-end">Total</th></tr></thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.id}>
                    <td className="small">
                        <div className="d-flex align-items-center gap-2">
                            {item.image_path && <img src={`${baseUrl}${item.image_path}`} alt="" style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '2px' }} />}
                            <span className="text-truncate" style={{ maxWidth: '100px' }}>{item.designation}</span>
                        </div>
                    </td>
                    <td className="text-center">
                        <div className="d-flex align-items-center justify-content-center gap-2">
                            <button className="btn btn-xs btn-outline-secondary px-1 py-0" onClick={() => removeOne(item.id)}>-</button>
                            <span className="fw-bold">{item.qty}</span>
                            <button className="btn btn-xs btn-outline-secondary px-1 py-0" onClick={() => addToCart(item)}>+</button>
                        </div>
                    </td>
                    <td className="text-end">
                      <input 
                        type="number" 
                        className={`form-control form-control-sm text-end fw-bold ${Number(item.prix_vente) < Number(item.prix_revient) ? 'border-danger text-danger' : 'text-primary'}`} 
                        value={item.prix_vente} 
                        onChange={e => {
                          const val = Math.round(parseFloat(e.target.value) || 0);
                          setCart(cart.map(i => i.id === item.id ? {...i, prix_vente: val} : i));
                        }}
                      />
                      {Number(item.prix_vente) < Number(item.prix_revient) && <div style={{fontSize: '9px'}} className="text-danger fw-bold">Sous prix de revient ({Number(item.prix_revient).toLocaleString()})</div>}
                    </td>
                    <td className="text-end small">{(item.prix_vente * item.qty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="row g-2 mb-3 pt-3 border-top">
                <div className="col-6">
                    <label className="small fw-bold">Type de Vente</label>
                    <select className="form-select form-select-sm" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                        <option value="comptant">CASH (Payé)</option>
                        <option value="credit">À CRÉDIT (Dette)</option>
                    </select>
                </div>
                <div className="col-6">
                    <label className="small fw-bold">Mode Règlement</label>
                    <select className="form-select form-select-sm" value={paymentMode} onChange={e => setPaymentMode(e.target.value)} disabled={paymentStatus === 'credit'}>
                        <option value="espece">Espèce</option>
                        <option value="mobile">Mobile Money</option>
                        <option value="virement">Virement</option>
                        <option value="cheque">Chèque</option>
                    </select>
                </div>
            </div>

            <div className="row g-2 mb-3">
                <div className="col-6"><label className="small fw-bold">TVA (%)</label><input type="number" className="form-control form-control-sm" value={tvaRate} onChange={e => setTvaRate(parseFloat(e.target.value) || 0)} /></div>
                <div className="col-6"><label className="small fw-bold">Précompte (%)</label><input type="number" className="form-control form-control-sm" value={precompteRate} onChange={e => setPrecompteRate(parseFloat(e.target.value) || 0)} /></div>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3">
                <h4 className="fw-bold mb-0">TOTAL TTC</h4>
                <h4 className="fw-bold text-success mb-0">{totalTTC.toLocaleString()} FCFA</h4>
            </div>

            <div className="btn-group w-100 mt-4">
                <button className={`btn ${printMode === 'A4' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setPrintMode('A4')}>A4</button>
                <button className={`btn ${printMode === 'POS' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setPrintMode('POS')}>POS</button>
            </div>
            <button className="btn btn-primary btn-lg w-100 mt-2 shadow fw-bold" onClick={validateSale}>🚀 VALIDER LA VENTE</button>
          </div>
        </div>
      </div>

      {/* ZONE IMPRESSION */}
      <div className="print-section" style={{ display: 'none' }}>
         {printMode === 'POS' ? (
           <div style={{ width: '80mm', padding: '5mm', fontFamily: 'monospace' }}>
             <div style={{ textAlign: 'center' }}>
                {company?.logo_path && <img src={company.logo_path} alt="Logo" style={{ maxHeight: '50px', maxWidth: '100px', marginBottom: '10px' }} />}
                <h4 style={{ margin: '0 0 5px 0' }}>{company?.company_name}</h4>
                <div style={{ fontSize: '10px', marginBottom: '5px' }}>
                    {company?.address}<br/>
                    Tél: {company?.phone}<br/>
                    {company?.niu && <span>NIU: {company.niu} </span>}
                    {company?.rccm && <span>| RCCM: {company.rccm}</span>}
                </div>
             </div>
             <hr style={{ borderTop: '1px dashed #000' }}/>
             <div style={{ fontSize: '11px' }}>
                <b>Ticket:</b> {lastInvoiceNum}<br/>
                <b>Date:</b> {new Date().toLocaleString()}<br/>
                <b>Dépôt:</b> {selectedMagasinName}<br/>
                <b>Client:</b> {selectedClientName}<br/>
                <div style={{ marginTop: '3px', padding: '2px', border: '1px solid #000', textAlign: 'center' }}>
                    <b style={{ textTransform: 'uppercase' }}>MODE DE RÈGLEMENT: {paymentStatus === 'credit' ? 'À CRÉDIT' : paymentMode.toUpperCase()}</b>
                </div>
             </div>
             <hr style={{ borderTop: '1px dashed #000' }}/>
             <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
               <thead>
                 <tr style={{ borderBottom: '1px solid #000' }}>
                   <th align="left">Désignation</th>
                   <th align="center">Qté</th>
                   <th align="center">P.U</th>
                   <th align="right">Total</th>
                 </tr>
               </thead>
               <tbody>
                 {cart.map(item => (
                   <tr key={item.id}>
                     <td>{item.designation}</td>
                     <td align="center">{item.qty}</td>
                     <td align="center">{Math.round(item.prix_vente).toLocaleString()}</td>
                     <td align="right">{(Math.round(item.prix_vente) * item.qty).toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
             <hr style={{ borderTop: '1px dashed #000' }}/>
             <div style={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>S/Total HT:</span><span>{subtotalHT.toLocaleString()}</span></div>
                {tvaRate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA ({tvaRate}%):</span><span>{totalTVA.toLocaleString()}</span></div>}
                {precompteRate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Préc. ({precompteRate}%):</span><span>{totalPrecompte.toLocaleString()}</span></div>}
             </div>
             <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
               <span>NET À PAYER:</span><span>{totalTTC.toLocaleString()} FCFA</span>
             </div>
             <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '9px', fontStyle: 'italic' }}>
                {company?.invoice_footer || "Merci de votre visite !"}
             </div>
           </div>
         ) : (
           <div style={{ width: '210mm', padding: '5mm 10mm', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
               <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                 {company?.logo_path && <img src={company.logo_path} alt="Logo" style={{ maxHeight: '60px', maxWidth: '120px' }} />}
                 <div>
                    <h3 style={{ color: company?.primary_color || '#0d6efd', margin: '0' }}>{company?.company_name}</h3>
                    {company?.activity && <div style={{ fontSize: '12px', fontWeight: 'bold', fontStyle: 'italic', marginBottom: '2px' }}>{company.activity}</div>}
                    <p style={{ fontSize: '11px', margin: '0', lineHeight: '1.2' }}>
                      {company?.address}<br/>
                      Tél: {company?.phone} {company?.email && `| ${company.email}`}<br/>
                      {company?.niu && <b>NIU: {company.niu} </b>}
                      {company?.rccm && <span>| <b>RCCM:</b> {company.rccm}</span>}
                    </p>
                 </div>
               </div>
               <div style={{ textAlign: 'right' }}>
                 <h4 style={{ margin: '0' }}>FACTURE N° {lastInvoiceNum}</h4>
                 <p style={{ fontSize: '11px', margin: '0' }}>
                   <b>Date:</b> {new Date().toLocaleDateString()}<br/>
                   <b>Vendeur:</b> {user.username}
                 </p>
               </div>
             </div>
             
             <div style={{ padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', backgroundColor: '#f9f9f9' }}>
                <div><b>CLIENT :</b> {selectedClientName}</div>
                <div><b>RÈGLEMENT :</b> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{paymentStatus === 'credit' ? 'À CRÉDIT' : paymentMode}</span></div>
                <div><b>DÉPÔT :</b> {selectedMagasinName}</div>
             </div>

             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
               <thead>
                 <tr style={{ background: '#eee', border: '1px solid #000' }}>
                   <th style={{ padding: '5px', border: '1px solid #000', textAlign: 'left' }}>Désignation</th>
                   <th style={{ padding: '5px', border: '1px solid #000', textAlign: 'center', width: '80px' }}>Qté</th>
                   <th style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', width: '100px' }}>P.U (HT)</th>
                   <th style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', width: '120px' }}>Total HT</th>
                 </tr>
               </thead>
               <tbody>
                 {cart.map(item => (
                   <tr key={item.id}>
                     <td style={{ padding: '5px', border: '1px solid #000' }}>{item.designation}</td>
                     <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center' }}>{item.qty} {item.unite}</td>
                     <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right' }}>{Math.round(item.prix_vente).toLocaleString()}</td>
                     <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right' }}>{(Math.round(item.prix_vente) * item.qty).toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
               <tfoot>
                  <tr>
                    <td colSpan={2} rowSpan={4} style={{ border: '1px solid #000', verticalAlign: 'top', padding: '10px' }}>
                        <div style={{ fontSize: '10px', fontStyle: 'italic' }}>
                            <b>Note :</b> {company?.invoice_footer || "Merci pour votre confiance !"}
                        </div>
                    </td>
                    <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>Total HT</td>
                    <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right' }}>{subtotalHT.toLocaleString()}</td>
                  </tr>
                  {tvaRate > 0 && (
                    <tr>
                      <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>TVA ({tvaRate}%)</td>
                      <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right' }}>{totalTVA.toLocaleString()}</td>
                    </tr>
                  )}
                  {precompteRate > 0 && (
                    <tr>
                      <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>Précompte ({precompteRate}%)</td>
                      <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right' }}>{totalPrecompte.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#eee', fontSize: '14px' }}>
                    <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>NET À PAYER</td>
                    <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>{totalTTC.toLocaleString()} FCFA</td>
                  </tr>
               </tfoot>
             </table>

             <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', fontSize: '12px' }}>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '40px' }}>Signature Client</div></div>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '40px' }}>Le Responsable</div></div>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

export default Invoicing;
