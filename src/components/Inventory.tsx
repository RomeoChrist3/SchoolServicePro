import React, { useState, useEffect } from 'react';

const Inventory = ({ user }: { user: any }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [lastBatch, setLastBatch] = useState<any>(null);
  const [batchItems, setBatchItems] = useState<any[]>([]);
  
  // États pour l'historique (Fiche de Stock)
  const [showHistory, setShowHistory] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historySummary, setHistorySummary] = useState({ initial: 0, final: 0, entrees: 0, sorties: 0 });
  const [dateStart, setDateStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);

  const [headerData, setHeaderData] = useState({
    id_magasin: user.id_magasin || '',
    id_fournisseur: '',
    numero_achat: '',
    statut_paiement: 'NON_PAYE',
    tva_rate: 0,
    precompte_rate: 0
  });

  const [currentItem, setCurrentItem] = useState({
    id_product: '',
    quantite: '',
    prix_unitaire: ''
  });

  const fetchData = async () => {
    try {
      const resProds = await (window as any).electronAPI.dbQuery('SELECT * FROM products ORDER BY designation');
      if (resProds.success) setProducts(resProds.data);
      const resMags = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
      if (resMags.success) setMagasins(resMags.data);
      const resFours = await (window as any).electronAPI.dbQuery('SELECT * FROM fournisseurs ORDER BY nom');
      if (resFours.success) setFournisseurs(resFours.data);
      const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
      if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
      
      const resStocks = await (window as any).electronAPI.dbQuery(`
        SELECT p.id as id_product, p.designation, m.id as id_magasin, m.nom as magasin_nom, IFNULL(s.quantite, 0) as quantite, p.unite, p.stock_alerte 
        FROM products p
        CROSS JOIN magasins m
        LEFT JOIN stock s ON p.id = s.id_product AND m.id = s.id_magasin
        ORDER BY m.nom, p.designation
      `);
      if (resStocks.success) setStocks(resStocks.data);
    } catch (err: any) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  // --- LOGIQUE FICHE DE STOCK ---
  const openHistory = async (stockItem: any) => {
    setSelectedStock(stockItem);
    setShowHistory(true);
    fetchHistory(stockItem.id_product, stockItem.id_magasin);
  };

  const fetchHistory = async (prodId: number, magId: number) => {
    const start = `${dateStart} 00:00:00`;
    const end = `${dateEnd} 23:59:59`;
    
    // 1. Stock Initial (Avant la période)
    const resInit = await (window as any).electronAPI.dbQuery(`
        SELECT SUM(CASE WHEN type_mouvement = 'ENTREE' THEN quantite ELSE -quantite END) as initial
        FROM stock_movements 
        WHERE id_product = ? AND id_magasin = ? AND date_mouvement < ?
    `, [prodId, magId, start]);
    const stockInitial = resInit.success ? (Number(resInit.data[0]?.initial) || 0) : 0;

    // 2. Mouvements de la période
    const res = await (window as any).electronAPI.dbQuery(`
        SELECT sm.*, 
               f.numero_facture, 
               a.numero_achat,
               aud.numero_audit
        FROM stock_movements sm
        LEFT JOIN factures f ON sm.id_achat = f.id AND sm.type_mouvement = 'SORTIE'
        LEFT JOIN achats a ON sm.id_achat = a.id AND sm.type_mouvement = 'ENTREE'
        LEFT JOIN audits aud ON sm.id_audit = aud.id
        WHERE sm.id_product = ? AND sm.id_magasin = ? 
        AND sm.date_mouvement BETWEEN ? AND ?
        ORDER BY sm.date_mouvement ASC
    `, [prodId, magId, start, end]);

    if (res.success) {
        let running = stockInitial;
        let totalE = 0;
        let totalS = 0;
        const processed = res.data.map((m: any) => {
            const before = running;
            const qte = Number(m.quantite) || 0;
            if (m.type_mouvement === 'ENTREE') {
                running += qte;
                totalE += qte;
            } else {
                running -= qte;
                totalS += qte;
            }
            return { ...m, stock_before: before, stock_after: running };
        });
        setHistoryData(processed);
        setHistorySummary({ initial: stockInitial, final: running, entrees: totalE, sorties: totalS });
    }
  };

  useEffect(() => {
    if (showHistory && selectedStock) fetchHistory(selectedStock.id_product, selectedStock.id_magasin);
  }, [dateStart, dateEnd]);

  // --- LOGIQUE SAISIE ---
  const addToBatch = () => {
    if (!currentItem.id_product || !currentItem.quantite) return;
    const product = products.find(p => p.id.toString() === currentItem.id_product);
    const newItem = {
      ...currentItem,
      id_product: parseInt(currentItem.id_product),
      designation: product?.designation,
      unite: product?.unite,
      total: parseFloat(currentItem.quantite) * (parseFloat(currentItem.prix_unitaire) || 0)
    };
    setBatchItems([...batchItems, newItem]);
    setCurrentItem({ id_product: '', quantite: '', prix_unitaire: '' });
  };

  const validateBatch = async (type: 'ENTREE' | 'SORTIE') => {
    if (batchItems.length === 0 || !headerData.id_magasin) {
      alert('Veuillez ajouter des articles et sélectionner un magasin.');
      return;
    }

    const magId = parseInt(headerData.id_magasin);
    let idAchat = null;

    try {
        if (type === 'ENTREE') {
            const resAchat = await (window as any).electronAPI.dbQuery(
                'INSERT INTO achats (numero_achat, id_fournisseur, montant_total, id_magasin, statut_paiement, montant_regle) VALUES (?, ?, ?, ?, ?, ?)',
                [headerData.numero_achat || `STK-${Date.now()}`, headerData.id_fournisseur || null, totalTTC, magId, headerData.statut_paiement, headerData.statut_paiement === 'PAYE' ? totalTTC : 0]
            );
            if (resAchat.success) idAchat = resAchat.data.insertId || resAchat.data;
            else throw new Error(resAchat.error);
        }

        for (const item of batchItems) {
            const finalQty = type === 'ENTREE' ? parseFloat(item.quantite) : -parseFloat(item.quantite);
            
            // Correction : Utilisation de ON DUPLICATE KEY UPDATE pour plus de robustesse
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO stock (id_product, id_magasin, quantite) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantite = quantite + ?',
                [item.id_product, magId, finalQty, finalQty]
            );
            
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO stock_movements (id_product, id_magasin, id_fournisseur, id_achat, type_mouvement, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [item.id_product, magId, headerData.id_fournisseur || null, idAchat, type, item.quantite, item.prix_unitaire || 0, item.total]
            );
        }

        if (type === 'ENTREE' && headerData.statut_paiement === 'PAYE' && totalTTC > 0) {
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO caisse (type_mouvement, montant, motif, beneficiaire, id_magasin) VALUES (?, ?, ?, ?, ?)',
                ['SORTIE', totalTTC, `Achat Stock ${headerData.numero_achat}`, fournisseurs.find(f => f.id.toString() === headerData.id_fournisseur)?.nom || 'Fournisseur', magId]
            );
        }

        alert('Stock mis à jour avec succès !');
        setBatchItems([]);
        setHeaderData({ ...headerData, numero_achat: '', tva_rate: 0, precompte_rate: 0 });
        fetchData();
    } catch (err: any) {
        alert("Erreur lors de la validation : " + err.message);
    }
  };

  const subtotalHT = batchItems.reduce((sum, item) => sum + item.total, 0);
  const totalTVA = subtotalHT * (headerData.tva_rate / 100);
  const totalPrecompte = subtotalHT * (headerData.precompte_rate / 100);
  const totalTTC = subtotalHT + totalTVA + totalPrecompte;

  const filteredStocks = stocks.filter(s => s.designation.toLowerCase().includes(searchTerm.toLowerCase()) || s.magasin_nom.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="row g-4">
      <style>{`
        @media print {
          @page { size: auto; margin: 5mm; }
          body * { visibility: hidden; }
          .stock-print-area, .stock-print-area * { visibility: visible; }
          .stock-print-area { 
            position: absolute; left: 0; top: 0; width: 100% !important; 
            max-width: none !important;
            display: block !important; padding: 0 !important; 
            background: #fff !important; color: #000 !important;
            border: none !important;
          }
          .modal-content { border: none !important; box-shadow: none !important; }
          .d-print-none { display: none !important; }
          
          /* Forcer la synthèse sur une ligne et pleine largeur */
          .print-summary-row {
            display: flex !important;
            flex-direction: row !important;
            width: 100% !important;
            gap: 2px !important;
            margin-bottom: 10px !important;
          }
          .print-summary-row > div {
            flex: 1 !important;
            padding: 4px !important;
            border: 1px solid #000 !important;
            text-align: center !important;
            min-width: 0 !important; /* Évite l'éclatement sur POS 80mm */
          }
          .print-summary-row h4 { font-size: 12px !important; margin: 0 !important; font-weight: bold; }
          .print-summary-row .small { font-size: 8px !important; font-weight: bold; }

          table { width: 100% !important; border-collapse: collapse; margin-top: 5px; table-layout: auto; }
          th, td { border: 1px solid #000 !important; padding: 4px !important; font-size: 9px; word-wrap: break-word; }
          th { 
            background-color: #eee !important; 
            color: #000 !important; 
            font-weight: bold !important;
            text-transform: uppercase !important;
            -webkit-print-color-adjust: exact; 
            text-align: center !important;
          }
          .print-header { border-bottom: 2px solid #000; margin-bottom: 10px; padding-bottom: 5px; }
        }
      `}</style>

      {/* GAUCHE : SAISIE AJUSTEMENT */}
      <div className="col-md-6 d-print-none">
        <div className="card shadow-sm border-0 mb-4 h-100">
          <div className="card-header bg-primary text-white py-3">
            <h5 className="mb-0 fw-bold small text-uppercase">📦 Mouvement de Stock (Ajustement)</h5>
          </div>
          <div className="card-body">
            <div className="bg-light p-3 rounded border mb-3">
                <div className="row g-2 mb-2">
                    <div className="col-md-6">
                        <label className="small fw-bold">Dépôt concerné *</label>
                        <select className="form-select form-select-sm" value={headerData.id_magasin} onChange={e => setHeaderData({...headerData, id_magasin: e.target.value})} disabled={user.role !== 'admin'}>
                            <option value="">-- Choisir --</option>
                            {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                        </select>
                    </div>
                    <div className="col-md-6">
                        <label className="small fw-bold">Ref / Motif</label>
                        <input type="text" className="form-control form-control-sm" value={headerData.numero_achat} onChange={e => setHeaderData({...headerData, numero_achat: e.target.value})} placeholder="Inventaire, Retour..." />
                    </div>
                </div>
                <div className="row g-2 align-items-end">
                    <div className="col-md-5">
                        <label className="small fw-bold">Article</label>
                        <select className="form-select form-select-sm" value={currentItem.id_product} onChange={e => setCurrentItem({...currentItem, id_product: e.target.value})}>
                            <option value="">-- Choisir --</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="small fw-bold">Quantité</label>
                        <input type="number" className="form-control form-control-sm" value={currentItem.quantite} onChange={e => setCurrentItem({...currentItem, quantite: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                        <label className="small fw-bold">P.U (Optionnel)</label>
                        <input type="number" className="form-control form-control-sm" value={currentItem.prix_unitaire} onChange={e => setCurrentItem({...currentItem, prix_unitaire: e.target.value})} />
                    </div>
                    <div className="col-md-1">
                        <button className="btn btn-primary btn-sm w-100" onClick={addToBatch}>+</button>
                    </div>
                </div>
            </div>

            <div className="table-responsive border rounded" style={{ minHeight: '200px', maxHeight: '300px' }}>
                <table className="table table-sm table-striped mb-0">
                    <thead className="table-dark small"><tr><th>Désignation</th><th className="text-center">Qté</th><th className="text-end">Total</th><th></th></tr></thead>
                    <tbody className="small">
                        {batchItems.map((item, idx) => (
                            <tr key={idx} className="align-middle">
                                <td className="ps-2">{item.designation}</td>
                                <td className="text-center fw-bold">{item.quantite}</td>
                                <td className="text-end">{item.total.toLocaleString()}</td>
                                <td className="text-end pe-2"><button className="btn btn-xs text-danger" onClick={() => setBatchItems(batchItems.filter((_, i) => i !== idx))}>✕</button></td>
                            </tr>
                        ))}
                        {batchItems.length === 0 && <tr><td colSpan={4} className="text-center py-5 text-muted small italic">Aucun article dans la liste.</td></tr>}
                    </tbody>
                </table>
            </div>

            <div className="row g-2 mt-4">
                <div className="col-6"><button className="btn btn-success btn-lg w-100 fw-bold shadow-sm" onClick={() => validateBatch('ENTREE')} disabled={batchItems.length === 0}>📥 ENTRÉE (+)</button></div>
                <div className="col-6"><button className="btn btn-outline-danger btn-lg w-100 fw-bold shadow-sm" onClick={() => validateBatch('SORTIE')} disabled={batchItems.length === 0}>📤 SORTIE (-)</button></div>
            </div>
          </div>
        </div>
      </div>

      {/* DROITE : ETAT STOCKS & HISTORIQUE */}
      <div className="col-md-6 d-print-none">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold small text-uppercase">📋 État des Stocks par Dépôt</h5>
            <input type="text" className="form-control form-control-sm w-50 border-primary" placeholder="🔍 Rechercher un produit ou dépôt..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="card-body p-0">
            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top"><tr className="small text-uppercase" style={{fontSize:'10px'}}><th>Article</th><th>Dépôt</th><th className="text-center">En Stock</th><th className="text-end pe-3">Actions</th></tr></thead>
                <tbody style={{fontSize:'13px'}}>
                  {filteredStocks.map((s, i) => (
                    <tr key={i}>
                      <td className="ps-3">
                        <div className="fw-bold">{s.designation}</div>
                        <small className="text-muted">{s.unite || 'Pcs'}</small>
                      </td>
                      <td><span className="badge bg-light text-dark border">{s.magasin_nom}</span></td>
                      <td className={`text-center fw-bold fs-5 ${s.quantite > 0 ? 'text-success' : 'text-danger'}`} style={{ minWidth: '100px' }}>
                        {s.quantite.toLocaleString()}
                      </td>
                      <td className="text-end pe-3">
                        <button className="btn btn-sm btn-outline-dark" title="Historique / Fiche de stock" onClick={() => openHistory(s)}>📜 Fiche</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE FICHE DE STOCK (HISTORIQUE) */}
      {showHistory && selectedStock && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content border-0 shadow-lg stock-print-area">
                    <div className="modal-header bg-dark text-white border-0 d-print-none">
                        <h5 className="modal-title fw-bold">📈 Fiche de Stock : {selectedStock.designation}</h5>
                        <button className="btn-close btn-close-white" onClick={() => setShowHistory(false)}></button>
                    </div>
                    <div className="modal-body p-4">
                        {/* En-tête impression A4 */}
                        <div className="d-none d-print-block print-header">
                            <div className="row align-items-center">
                                <div className="col-8">
                                    <h3 className="fw-bold mb-1" style={{ color: company?.primary_color || '#000' }}>{company?.company_name}</h3>
                                    <p className="small m-0"><b>Activité :</b> {company?.activity}</p>
                                    <p className="small m-0"><b>Adresse :</b> {company?.address} | <b>Tél :</b> {company?.phone}</p>
                                    {company?.niu && <p className="small m-0"><b>NIU :</b> {company.niu} | <b>RCCM :</b> {company.rccm}</p>}
                                </div>
                                <div className="col-4 text-end">
                                    <h4 className="fw-bold mb-0 text-uppercase">FICHE DE STOCK</h4>
                                    <p className="small mb-0">Imprimé le : {new Date().toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="d-none d-print-block mb-3 p-2 bg-light border rounded">
                            <div className="row g-2 small">
                                <div className="col-6"><b>ARTICLE :</b> <span className="fs-6 fw-bold">{selectedStock.designation}</span></div>
                                <div className="col-3"><b>DÉPÔT :</b> {selectedStock.magasin_nom}</div>
                                <div className="col-3 text-end"><b>PÉRIODE :</b> {new Date(dateStart).toLocaleDateString()} au {new Date(dateEnd).toLocaleDateString()}</div>
                            </div>
                        </div>

                        <div className="row g-3 mb-4 p-3 bg-light rounded border align-items-end d-print-none">
                            <div className="col-md-3"><label className="small fw-bold">Du</label><input type="date" className="form-control" value={dateStart} onChange={e => setDateStart(e.target.value)} /></div>
                            <div className="col-md-3"><label className="small fw-bold">Au</label><input type="date" className="form-control" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></div>
                            <div className="col-md-6 text-end">
                                <span className="badge bg-primary fs-6 me-2">Dépôt : {selectedStock.magasin_nom}</span>
                                <button className="btn btn-outline-dark fw-bold" onClick={() => window.print()}>🖨️ Imprimer la Fiche</button>
                            </div>
                        </div>

                        {/* SYNTHÈSE FICHE DE STOCK */}
                        <div className="row g-3 mb-4 text-center print-summary-row">
                            <div className="col-md-2">
                                <div className="p-3 border rounded bg-white shadow-sm h-100">
                                    <div className="small text-muted text-uppercase">Stock Initial</div>
                                    <h4 className="fw-bold mb-0">{historySummary.initial}</h4>
                                </div>
                            </div>
                            <div className="col-md-2"><div className="p-3 border rounded bg-white shadow-sm h-100"><div className="small text-success text-uppercase">Total Entrées</div><h4 className="fw-bold mb-0 text-success">+{historySummary.entrees}</h4></div></div>
                            <div className="col-md-2"><div className="p-3 border rounded bg-white shadow-sm h-100"><div className="small text-danger text-uppercase">Total Sorties</div><h4 className="fw-bold mb-0 text-danger">-{historySummary.sorties}</h4></div></div>
                            <div className="col-md-3"><div className="p-3 border rounded bg-dark text-white shadow-sm h-100"><div className="small text-uppercase opacity-75">Stock Final (Calculé)</div><h4 className="fw-bold mb-0">{historySummary.final}</h4></div></div>
                            <div className="col-md-3">
                                <div className={`p-3 border rounded shadow-sm h-100 ${historySummary.final !== selectedStock.quantite ? 'bg-danger text-white' : 'bg-primary text-white'}`}>
                                    <div className="small text-uppercase opacity-75">Stock Réel (Base)</div>
                                    <h4 className="fw-bold mb-0">{selectedStock.quantite}</h4>
                                    {historySummary.final !== selectedStock.quantite && <div style={{fontSize: '10px'}} className="fw-bold">⚠️ ÉCART DÉTECTÉ</div>}
                                </div>
                            </div>
                        </div>

                        <div className="table-responsive border rounded bg-white">
                            <table className="table table-sm table-hover align-middle mb-0">
                                <thead className="table-dark">
                                    <tr>
                                        <th className="ps-3">Date & Heure</th>
                                        <th>Opération</th>
                                        <th>Référence / Doc</th>
                                        <th className="text-center">Stock Avant</th>
                                        <th className="text-center">Mouvement</th>
                                        <th className="text-center">Stock Après</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyData.map((h, i) => (
                                        <tr key={i}>
                                            <td className="ps-3 small text-muted">{new Date(h.date_mouvement).toLocaleString()}</td>
                                            <td><span className={`badge ${h.type_mouvement === 'ENTREE' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>{h.type_mouvement}</span></td>
                                            <td className="fw-bold">
                                                {h.numero_achat || h.numero_facture || h.numero_audit || h.motif || 'Ajustement Manuel'}
                                            </td>
                                            <td className="text-center text-muted">{h.stock_before}</td>
                                            <td className={`text-center fw-bold ${h.type_mouvement === 'ENTREE' ? 'text-success' : 'text-danger'}`}>
                                                {h.type_mouvement === 'ENTREE' ? '+' : '-'}{h.quantite}
                                            </td>
                                            <td className="text-center fw-bold bg-light">{h.stock_after}</td>
                                        </tr>
                                    ))}
                                    {historyData.length === 0 && <tr><td colSpan={6} className="text-center py-5 text-muted">Aucun mouvement trouvé pour cette période.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
