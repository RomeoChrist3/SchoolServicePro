import React, { useState, useEffect } from 'react';

const Purchases = ({ user }: { user: any }) => {
  const [activeTab, setActiveTab] = useState('list'); // list, new, reception
  const [products, setProducts] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderHeader, setOrderData] = useState({ id_fournisseur: '', id_magasin: user.id_magasin || '', numero: '' });
  const [currentItem, setCurrentItem] = useState({ id_product: '', quantite: '', prix: '' });

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [receptionItems, setReceptionItems] = useState<any[]>([]);
  const [lastReceivedOrder, setLastReceivedOrder] = useState<any>(null);

  const fetchData = async () => {
    try {
        const resP = await (window as any).electronAPI.dbQuery('SELECT * FROM products ORDER BY designation');
        if (resP.success) {
            const cleaned = resP.data.map((p: any) => ({
                ...p,
                prix_achat: Math.round(parseFloat(p.prix_achat) || 0),
                prix_vente: Math.round(parseFloat(p.prix_vente) || 0)
            }));
            setProducts(cleaned);
        }
        const resF = await (window as any).electronAPI.dbQuery('SELECT * FROM fournisseurs ORDER BY nom');
        if (resF.success) setFournisseurs(resF.data);
        const resM = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
        if (resM.success) setMagasins(resM.data);
        const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
        
        const resO = await (window as any).electronAPI.dbQuery(`
            SELECT cf.*, f.nom as fournisseur_nom, m.nom as magasin_nom 
            FROM commandes_fournisseurs cf 
            JOIN fournisseurs f ON cf.id_fournisseur = f.id 
            JOIN magasins m ON cf.id_magasin_prevu = m.id
            WHERE cf.statut = 'EN_ATTENTE' ORDER BY cf.date_commande DESC
        `);
        if (resO.success) setOrders(resO.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const [selectedProductStock, setSelectedProductStock] = useState<number | null>(null);
  useEffect(() => {
    const checkStock = async () => {
        if (currentItem.id_product && orderHeader.id_magasin) {
            const res = await (window as any).electronAPI.dbQuery('SELECT quantite FROM stock WHERE id_product = ? AND id_magasin = ?', [currentItem.id_product, orderHeader.id_magasin]);
            setSelectedProductStock(res.success && res.data.length > 0 ? res.data[0].quantite : 0);
        } else setSelectedProductStock(null);
    };
    checkStock();
  }, [currentItem.id_product, orderHeader.id_magasin]);

  const addToOrder = () => {
    if (!currentItem.id_product || !currentItem.quantite) return;
    const p = products.find(x => x.id.toString() === currentItem.id_product);
    if (!p) return;
    const qte = parseFloat(currentItem.quantite);
    const prix = Math.round(parseFloat(currentItem.prix) || p.prix_achat);
    setOrderItems([...orderItems, { 
        id_product: p.id, 
        designation: p.designation, 
        quantite: qte, 
        prix: prix, 
        total: Math.round(qte * prix) 
    }]);
    setCurrentItem({ id_product: '', quantite: '', prix: '' });
  };

  const saveOrder = async () => {
    if (orderItems.length === 0 || !orderHeader.id_fournisseur || !orderHeader.id_magasin) { alert('Champs requis manquants.'); return; }
    const num = orderHeader.numero || `CMD-${Date.now()}`;
    const totalEstime = Math.round(orderItems.reduce((s,i)=>s+i.total,0));
    const res = await (window as any).electronAPI.dbQuery('INSERT INTO commandes_fournisseurs (numero_commande, id_fournisseur, total_estime, id_magasin_prevu) VALUES (?, ?, ?, ?)', [num, orderHeader.id_fournisseur, totalEstime, orderHeader.id_magasin]);
    if (res.success) {
        const cmdId = res.data.insertId || res.data;
        for (const item of orderItems) { await (window as any).electronAPI.dbQuery('INSERT INTO commande_items (id_commande, id_product, quantite_commandee, prix_achat_prevu) VALUES (?, ?, ?, ?)', [cmdId, item.id_product, item.quantite, item.prix]); }
        alert('Commande enregistrée !'); setOrderItems([]); setActiveTab('list'); fetchData();
    }
  };

  const openReception = async (order: any) => {
    const res = await (window as any).electronAPI.dbQuery(`SELECT ci.*, p.designation, p.unite FROM commande_items ci JOIN products p ON ci.id_product = p.id WHERE ci.id_commande = ?`, [order.id]);
    if (res.success) { setSelectedOrder(order); setReceptionItems(res.data.map((i: any) => ({ ...i, qte_recue: i.quantite_commandee }))); setActiveTab('reception'); }
  };

  const validateReception = async () => {
    if (!window.confirm('Confirmer la réception et l\'entrée en stock ?')) return;
    const totalAchat = Math.round(receptionItems.reduce((s, i) => s + (parseFloat(i.qte_recue) * i.prix_achat_prevu), 0));
    const numAchat = `FAC-ACH-${selectedOrder.numero_commande}`;
    
    // 1. Créer la fiche achat (Dette fournisseur)
    const resA = await (window as any).electronAPI.dbQuery(
        'INSERT INTO achats (numero_achat, id_fournisseur, montant_total, id_magasin, statut_paiement, montant_regle) VALUES (?, ?, ?, ?, ?, ?)',
        [numAchat, selectedOrder.id_fournisseur, totalAchat, selectedOrder.id_magasin_prevu, 'NON_PAYE', 0]
    );

    if (resA.success) {
        const idAchat = resA.data.insertId || resA.data;
        for (const item of receptionItems) {
            const qte = parseFloat(item.qte_recue) || 0;
            if (qte <= 0) continue;
            
            await (window as any).electronAPI.dbQuery(
                'INSERT INTO stock (id_product, id_magasin, quantite) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantite = quantite + ?',
                [item.id_product, selectedOrder.id_magasin_prevu, qte, qte]
            );

            await (window as any).electronAPI.dbQuery('INSERT INTO stock_movements (id_product, id_magasin, id_fournisseur, id_achat, type_mouvement, quantite, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [item.id_product, selectedOrder.id_magasin_prevu, selectedOrder.id_fournisseur, idAchat, 'ENTREE', qte, item.prix_achat_prevu, Math.round(qte * item.prix_achat_prevu)]);
            await (window as any).electronAPI.dbQuery('UPDATE products SET prix_achat = ? WHERE id = ?', [item.prix_achat_prevu, item.id_product]);
            await (window as any).electronAPI.dbQuery('UPDATE commande_items SET quantite_recue = ? WHERE id = ?', [qte, item.id]);
        }
        await (window as any).electronAPI.dbQuery('UPDATE commandes_fournisseurs SET statut = "RECUE" WHERE id = ?', [selectedOrder.id]);
        
        setLastReceivedOrder({ ...selectedOrder, numAchat, total: totalAchat, items: receptionItems, date: new Date().toLocaleString() });
        alert('RÉCEPTION VALIDÉE !\nLe stock a été mis à jour et la facture est prête.');
        setTimeout(() => { window.print(); setActiveTab('list'); fetchData(); }, 500);
    } else {
        alert("Erreur lors de la création de la fiche d'achat : " + (resA.error || "Vérifiez que ce bon n'a pas déjà été réceptionné."));
    }
  };

  return (
    <div className="container-fluid p-0">
      <style>{`
        @media print { body * { visibility: hidden; } .print-invoice, .print-invoice * { visibility: visible; } .print-invoice { position: absolute; left: 0; top: 0; width: 100%; display: block !important; padding: 10mm; } .no-print { display: none !important; } }
      `}</style>

      {lastReceivedOrder && (
        <div className="print-invoice d-none d-print-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
               <div style={{ display: 'flex', gap: '15px' }}>
                 {company?.logo_path && <img src={company.logo_path} alt="Logo" style={{ maxHeight: '60px' }} />}
                 <div><h3>{company?.company_name}</h3><p className="small">{company?.address}<br/>Tél: {company?.phone} | {company?.niu}</p></div>
               </div>
               <div className="text-end">
                  <h4 className="fw-bold">BON D'ENTRÉE : {lastReceivedOrder.numAchat}</h4>
                  <p className="small">
                    <b>N° Commande :</b> {lastReceivedOrder.numero_commande}<br/>
                    <b>Date :</b> {lastReceivedOrder.date}
                  </p>
               </div>
            </div>
            <div style={{ padding: '10px', border: '1px solid #ccc', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div><b>FOURNISSEUR :</b> {lastReceivedOrder.fournisseur_nom}</div><div><b>DÉPÔT :</b> {lastReceivedOrder.magasin_nom}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
               <thead><tr style={{ background: '#eee', border: '1px solid #000' }}><th style={{ padding: '8px', border: '1px solid #000' }}>Article</th><th style={{ padding: '8px', border: '1px solid #000' }}>Qté Reçue</th><th style={{ padding: '8px', border: '1px solid #000' }}>P.U Achat</th><th style={{ padding: '8px', border: '1px solid #000' }}>Total</th></tr></thead>
               <tbody>{lastReceivedOrder.items.map((item: any, i: number) => (<tr key={i}><td style={{ padding: '8px', border: '1px solid #000' }}>{item.designation}</td><td style={{ textAlign: 'center', border: '1px solid #000' }}>{item.qte_recue} {item.unite}</td><td style={{ textAlign: 'right', border: '1px solid #000' }}>{Math.round(item.prix_achat_prevu).toLocaleString()}</td><td style={{ textAlign: 'right', border: '1px solid #000' }}>{(item.qte_recue * item.prix_achat_prevu).toLocaleString()}</td></tr>))}</tbody>
               <tfoot><tr style={{ background: '#eee', fontWeight: 'bold' }}><td colSpan={3} style={{ padding: '10px', textAlign: 'right', border: '1px solid #000' }}>TOTAL RÉCEPTIONNÉ</td><td style={{ padding: '10px', textAlign: 'right', border: '1px solid #000' }}>{Math.round(lastReceivedOrder.total).toLocaleString()} FCFA</td></tr></tfoot>
            </table>
            <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', fontSize: '12px' }}>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '50px' }}>Le Fournisseur</div></div>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '50px' }}>Le Magasinier</div></div>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '50px' }}>La Direction</div></div>
            </div>
        </div>
      )}

      <div className="card border-0 shadow-sm mb-4 no-print">
        <div className="card-header bg-white p-0"><div className="nav nav-tabs border-0">
            <button className={`nav-link border-0 py-3 px-4 fw-bold ${activeTab === 'list' ? 'active text-primary border-bottom border-primary' : 'text-muted'}`} onClick={() => setActiveTab('list')}>📦 Commandes en cours</button>
            <button className={`nav-link border-0 py-3 px-4 fw-bold ${activeTab === 'new' ? 'active text-primary border-bottom border-primary' : 'text-muted'}`} onClick={() => setActiveTab('new')}>➕ Nouveau Bon de Commande</button>
        </div></div>
        
        <div className="card-body">
          {activeTab === 'list' && (
            <div className="table-responsive"><table className="table table-hover align-middle">
                <thead className="table-light"><tr><th>Date</th><th>N° Commande</th><th>Fournisseur</th><th>Dépôt Prévu</th><th className="text-end">Total Estimé</th><th>Action</th></tr></thead>
                <tbody>{orders.map(o => (
                    <tr key={o.id}><td>{new Date(o.date_commande).toLocaleDateString()}</td><td className="fw-bold">{o.numero_commande}</td><td>{o.fournisseur_nom}</td><td><span className="badge bg-light text-dark border">{o.magasin_nom}</span></td><td className="text-end">{Math.round(o.total_estime || 0).toLocaleString()}</td><td><button className="btn btn-sm btn-success fw-bold" onClick={() => openReception(o)}>📥 Réceptionner</button></td></tr>
                ))}</tbody>
            </table></div>
          )}

          {activeTab === 'new' && (
            <div className="row g-4">
                <div className="col-md-4"><div className="p-3 bg-light rounded border shadow-sm">
                    <h6 className="fw-bold mb-3 border-bottom pb-2">Infos Commande</h6>
                    <div className="mb-2"><label className="small fw-bold">Fournisseur *</label><select className="form-select form-select-sm" value={orderHeader.id_fournisseur} onChange={e => setOrderData({...orderHeader, id_fournisseur: e.target.value})}><option value="">-- Choisir --</option>{fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}</select></div>
                    <div className="mb-2"><label className="small fw-bold">Dépôt réception *</label><select className="form-select form-select-sm" value={orderHeader.id_magasin} onChange={e => setOrderData({...orderHeader, id_magasin: e.target.value})}><option value="">-- Dépôt --</option>{magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></div>
                    <div className="mb-3"><label className="small fw-bold">N° Bon</label><input type="text" className="form-control form-control-sm" value={orderHeader.numero} onChange={e => setOrderData({...orderHeader, numero: e.target.value})} /></div>
                    <h6 className="fw-bold mb-2 mt-4 border-bottom pb-2">Ajouter Article</h6>
                    <div className="mb-2"><select className="form-select form-select-sm" value={currentItem.id_product} onChange={e => setCurrentItem({...currentItem, id_product: e.target.value})}><option value="">-- Article --</option>{products.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}</select>
                    {selectedProductStock !== null && <div className={`small fw-bold mt-1 ${selectedProductStock > 0 ? 'text-success' : 'text-danger'}`}>Stock actuel : {selectedProductStock}</div>}</div>
                    <div className="row g-2 mb-3"><div className="col-6"><label className="small fw-bold">Qté *</label><input type="number" className="form-control form-control-sm" value={currentItem.quantite} onChange={e => setCurrentItem({...currentItem, quantite: e.target.value})} /></div><div className="col-6"><label className="small fw-bold">P.U Achat</label><input type="number" className="form-control form-control-sm" value={currentItem.prix} onChange={e => setCurrentItem({...currentItem, prix: e.target.value})} /></div></div>
                    <button className="btn btn-primary btn-sm w-100 fw-bold" onClick={addToOrder}>+ Ajouter à la liste</button>
                </div></div>
                <div className="col-md-8">
                    <div className="table-responsive border rounded mb-3 bg-white" style={{minHeight: '350px'}}><table className="table table-sm table-striped">
                        <thead className="table-dark"><tr><th>Article</th><th className="text-center">Qté</th><th className="text-end">P.U</th><th className="text-end">Total</th><th></th></tr></thead>
                        <tbody>{orderItems.map((item, idx) => (<tr key={idx}><td>{item.designation}</td><td className="text-center fw-bold">{item.quantite}</td><td className="text-end">{item.prix.toLocaleString()}</td><td className="text-end fw-bold">{item.total.toLocaleString()}</td><td className="text-center"><button className="btn btn-sm text-danger" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}>✕</button></td></tr>))}</tbody>
                    </table></div>
                    <div className="d-flex justify-content-between align-items-center bg-dark text-white p-3 rounded shadow"><h5 className="mb-0 fw-bold">TOTAL ESTIMÉ</h5><h4 className="mb-0 fw-bold text-warning">{Math.round(orderItems.reduce((s, i) => s + i.total, 0)).toLocaleString()} FCFA</h4></div>
                    <button className="btn btn-success btn-lg w-100 mt-3 fw-bold shadow py-3" onClick={saveOrder} disabled={orderItems.length === 0}>🚀 VALIDER LE BON DE COMMANDE</button>
                </div>
            </div>
          )}

          {activeTab === 'reception' && selectedOrder && (
            <div>
                <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-primary text-white rounded"><h5 className="mb-0 fw-bold">RÉCEPTION COMMANDE : {selectedOrder.numero_commande}</h5><button className="btn btn-light btn-sm fw-bold" onClick={() => setActiveTab('list')}>✕ Annuler</button></div>
                <div className="alert alert-info border-info mb-4">💡 Vérifiez les quantités réellement reçues avant de valider l'entrée en stock.</div>
                <div className="table-responsive border rounded mb-4 bg-white shadow-sm"><table className="table table-bordered align-middle">
                    <thead className="table-light"><tr><th>Désignation Article</th><th className="text-center">Commandé</th><th className="text-center bg-primary text-white">REÇU RÉELLEMENT</th><th className="text-end">P.U Achat</th><th className="text-end">Total</th></tr></thead>
                    <tbody>{receptionItems.map((item, idx) => (
                        <tr key={idx}><td className="fw-bold ps-3">{item.designation}</td><td className="text-center">{item.quantite_commandee}</td><td className="text-center" style={{ width: '180px' }}><input type="number" className="form-control form-control-sm text-center fw-bold border-primary" value={item.qte_recue} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceptionItems(receptionItems.map((it, i) => i === idx ? { ...it, qte_recue: val } : it));
                        }} /></td><td className="text-end">{Math.round(item.prix_achat_prevu).toLocaleString()}</td><td className="text-end fw-bold">{Math.round(item.qte_recue * item.prix_achat_prevu).toLocaleString()}</td></tr>
                    ))}</tbody>
                    <tfoot className="table-dark"><tr><td colSpan={4} className="text-end fw-bold py-3">MONTANT TOTAL DE L'ENTRÉE</td><td className="text-end fw-bold py-3 fs-5 text-warning">{Math.round(receptionItems.reduce((s, i) => s + (i.qte_recue * i.prix_achat_prevu), 0)).toLocaleString()} FCFA</td></tr></tfoot>
                </table></div>
                <button className="btn btn-success btn-lg w-100 fw-bold shadow py-3" onClick={validateReception}>✅ VALIDER L'ENTRÉE EN STOCK & IMPRIMER</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Purchases;
