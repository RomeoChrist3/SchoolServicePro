import React, { useState, useEffect } from 'react';

const StockTransfer = ({ user }: { user: any }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  const [sourceMagasin, setSourceMagasin] = useState(user.id_magasin || '');
  const [destMagasin, setDestMagasin] = useState('');

  const [lastTransfer, setLastTransfer] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

  const fetchData = async () => {
    // Récupérer tous les magasins
    const resMags = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (resMags.success) setMagasins(resMags.data);

    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);

    // Récupérer les produits avec le stock du magasin de départ
    let query = `
      SELECT p.*, IFNULL(s.quantite, 0) as stock_source
      FROM products p
      LEFT JOIN stock s ON p.id = s.id_product AND s.id_magasin = ?
      ORDER BY p.designation
    `;
    const resProds = await (window as any).electronAPI.dbQuery(query, [sourceMagasin || 0]);
    if (resProds.success) setProducts(resProds.data);
  };

  useEffect(() => { 
    fetchData(); 
  }, [sourceMagasin]);

  const addToTransfer = (product: any) => {
    if (product.stock_source <= 0) {
      alert('Stock insuffisant dans le dépôt de départ.');
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock_source) {
        alert('Quantité maximale atteinte par rapport au stock disponible.');
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const validateTransfer = async () => {
    if (cart.length === 0 || !sourceMagasin || !destMagasin) {
      alert('Informations manquantes (Dépôts ou articles).');
      return;
    }
    if (sourceMagasin === destMagasin) {
      alert('Le dépôt de départ et d\'arrivée doivent être différents.');
      return;
    }

    const resCount = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM stock_transfers');
    const nextSeq = (resCount.success && resCount.data[0]?.total ? resCount.data[0].total + 1 : 1);
    const transferNum = `TRF-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;

    const resTrf = await (window as any).electronAPI.dbQuery(
      'INSERT INTO stock_transfers (numero_transfert, id_magasin_depart, id_magasin_arrivee) VALUES (?, ?, ?)',
      [transferNum, sourceMagasin, destMagasin]
    );

    if (resTrf.success) {
      const transferId = resTrf.data.insertId || resTrf.data;
      for (const item of cart) {
        // 1. Enregistrer l'item du transfert
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO stock_transfer_items (id_transfert, id_product, quantite) VALUES (?, ?, ?)',
          [transferId, item.id, item.qty]
        );

        // 2. Sortie du stock de départ
        await (window as any).electronAPI.dbQuery(
          'UPDATE stock SET quantite = quantite - ? WHERE id_product = ? AND id_magasin = ?',
          [item.qty, item.id, sourceMagasin]
        );
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO stock_movements (id_product, id_magasin, type_mouvement, quantite, motif, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.id, sourceMagasin, 'SORTIE', item.qty, `TRANSFERT VERS DEPOT #${destMagasin} (${transferNum})`, 0, 0]
        );

        // 3. Entrée dans le stock d'arrivée (Correction avec ON DUPLICATE KEY UPDATE)
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO stock (id_product, id_magasin, quantite) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantite = quantite + ?',
          [item.id, destMagasin, item.qty, item.qty]
        );
        
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO stock_movements (id_product, id_magasin, type_mouvement, quantite, motif, prix_unitaire, total_ligne) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.id, destMagasin, 'ENTREE', item.qty, `TRANSFERT DEPUIS DEPOT #${sourceMagasin} (${transferNum})`, 0, 0]
        );
      }

      setLastTransfer({
        num: transferNum,
        date: new Date().toLocaleString(),
        source: magasins.find(m => m.id.toString() === sourceMagasin.toString())?.nom,
        dest: magasins.find(m => m.id.toString() === destMagasin.toString())?.nom,
        items: cart
      });

      alert(`Transfert ${transferNum} validé !`);
      setTimeout(() => {
        window.print();
        setCart([]);
        setDestMagasin('');
        fetchData();
      }, 500);
    }
  };

  const filteredProducts = products.filter(p => p.designation.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container-fluid p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>

      <div className="row g-4 d-print-none">
        <div className="col-md-7">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white py-3">
              <input type="text" className="form-control" placeholder="🔍 Rechercher un produit à transférer..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="card-body p-0" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <div className="list-group list-group-flush">
                {filteredProducts.map(p => (
                  <button key={p.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3" onClick={() => addToTransfer(p)}>
                    <div>
                        <div className="fw-bold">{p.designation}</div>
                        <small className="text-muted">Stock Disponible: <span className={p.stock_source > 0 ? 'text-success fw-bold' : 'text-danger'}>{p.stock_source} {p.unite || ''}</span></small>
                    </div>
                    <span className={`badge ${p.stock_source > 0 ? 'bg-primary' : 'bg-secondary'} rounded-pill`}>Ajouter +</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-5">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-primary text-white py-3">
              <h5 className="mb-0 fw-bold">📦 Nouveau Transfert entre Dépôts</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="small fw-bold">🚀 Dépôt de Départ (Source)</label>
                <select className="form-select border-primary fw-bold text-primary" value={sourceMagasin} onChange={e => setSourceMagasin(e.target.value)} disabled={user.role !== 'admin'}>
                  <option value="">-- Choisir le départ --</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              
              <div className="mb-3 text-center">
                <div className="badge bg-light text-primary border p-2">VERS</div>
              </div>

              <div className="mb-4">
                <label className="small fw-bold">🏁 Dépôt de Destination (Arrivée)</label>
                <select className="form-select border-success" value={destMagasin} onChange={e => setDestMagasin(e.target.value)}>
                  <option value="">-- Choisir la destination --</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>

              <div className="table-responsive mb-4" style={{ minHeight: '150px' }}>
                <table className="table table-sm align-middle">
                  <thead>
                    <tr className="small text-muted text-uppercase" style={{ fontSize: '10px' }}>
                        <th>Article</th>
                        <th className="text-center">Qté</th>
                        <th className="text-end"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td className="small fw-bold">{item.designation}</td>
                        <td className="text-center">
                          <input 
                            type="number" 
                            className="form-control form-control-sm text-center mx-auto" 
                            style={{ width: '70px' }} 
                            value={item.qty} 
                            max={item.stock_source}
                            onChange={e => {
                                const val = parseInt(e.target.value);
                                if (val > item.stock_source) { alert(`Stock insuffisant (${item.stock_source} max)`); return; }
                                setCart(cart.map(i => i.id === item.id ? {...i, qty: val || 0} : i))
                            }} 
                          />
                        </td>
                        <td className="text-end"><button className="btn btn-sm text-danger" onClick={() => setCart(cart.filter(i => i.id !== item.id))}>✕</button></td>
                      </tr>
                    ))}
                    {cart.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-muted italic small">Aucun article sélectionné</td></tr>}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-primary btn-lg w-100 fw-bold shadow" onClick={validateTransfer} disabled={cart.length === 0 || !destMagasin}>
                🚀 VALIDER LE TRANSFERT
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* ZONE IMPRESSION BORDEREAU DE TRANSFERT */}
      {lastTransfer && (
        <div className="print-section" style={{ display: 'none' }}>
           <div style={{ width: '210mm', padding: '10mm', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
               <div>
                  <h3 style={{ margin: '0', color: '#0d6efd' }}>{company?.company_name}</h3>
                  <p style={{ fontSize: '12px', margin: '0' }}>{company?.address}<br/>Tél: {company?.phone}</p>
               </div>
               <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: '0' }}>BORDEREAU DE TRANSFERT</h4>
                  <p style={{ fontSize: '12px', margin: '0' }}><b>N° :</b> {lastTransfer.num}<br/><b>Date :</b> {lastTransfer.date}</p>
               </div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <small style={{ color: '#666', fontWeight: 'bold' }}>DÉPÔT D'ORIGINE (DÉPART) :</small>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>🚀 {lastTransfer.source}</div>
                </div>
                <div style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                    <small style={{ color: '#666', fontWeight: 'bold' }}>DÉPÔT DE DESTINATION (ARRIVÉE) :</small>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>🏁 {lastTransfer.dest}</div>
                </div>
             </div>

             <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#eee' }}>
                        <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Désignation de l'Article</th>
                        <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '100px' }}>Quantité</th>
                        <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '100px' }}>Unité</th>
                    </tr>
                </thead>
                <tbody>
                    {lastTransfer.items.map((item: any, i: number) => (
                        <tr key={i}>
                            <td style={{ border: '1px solid #000', padding: '8px' }}>{item.designation}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{item.unite || 'Pcs'}</td>
                        </tr>
                    ))}
                </tbody>
             </table>

             <div style={{ marginTop: '50px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', fontSize: '12px' }}>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '60px' }}>Le Magasinier (Départ)</div><div>........................</div></div>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '60px' }}>Le Transporteur</div><div>........................</div></div>
                <div><div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '60px' }}>Le Magasinier (Arrivée)</div><div>........................</div></div>
             </div>

             <div style={{ marginTop: '100px', textAlign: 'center', fontSize: '10px', color: '#999', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '5px' }}>
                Document de transfert de stock interne - Généré par FusionStock Pro le {new Date().toLocaleString()}
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StockTransfer;
