import React, { useState, useEffect } from 'react';

const StockJournal = ({ user }: { user: any }) => {
  const [operations, setOperations] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState<string>('');
  
  // Filtres
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedOp, setSelectedOp] = useState<any>(null);
  const [opItems, setOpItems] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  const fetchMagasins = async () => {
    const res = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (res.success) setMagasins(res.data);
    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
  };

  const fetchOperations = async () => {
    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    let query = `
      SELECT 
        sm.type_mouvement, 
        sm.date_mouvement, 
        sm.motif,
        m.nom as magasin_nom,
        m.id as id_magasin,
        ach.numero_achat,
        fac.numero_facture,
        aud.numero_audit,
        COUNT(sm.id) as nb_articles,
        SUM(sm.total_ligne) as total_operation,
        COALESCE(ach.numero_achat, fac.numero_facture, aud.numero_audit, sm.motif, 'AJUSTEMENT') as reference
      FROM stock_movements sm
      JOIN magasins m ON sm.id_magasin = m.id
      LEFT JOIN achats ach ON sm.id_achat = ach.id
      LEFT JOIN factures fac ON sm.id_achat = fac.id
      LEFT JOIN audits aud ON sm.id_audit = aud.id
      WHERE sm.date_mouvement BETWEEN ? AND ?
      ${selectedMagasin ? 'AND sm.id_magasin = ?' : ''}
    `;
    const params: any[] = [start, end];
    if (selectedMagasin) params.push(selectedMagasin);

    query += `
      GROUP BY 
        sm.type_mouvement, 
        sm.date_mouvement, 
        sm.motif, 
        sm.id_magasin, 
        sm.id_achat, 
        sm.id_audit
      ORDER BY sm.date_mouvement DESC
    `;

    const res = await (window as any).electronAPI.dbQuery(query, params);
    
    if (res.success) {
      // Filtrage par recherche en JS pour plus de flexibilité si le HAVING pose problème
      const filtered = res.data.filter((op: any) => {
        const search = searchQuery.toLowerCase();
        return !search || 
               (op.reference && op.reference.toLowerCase().includes(search)) ||
               (op.magasin_nom && op.magasin_nom.toLowerCase().includes(search));
      });
      setOperations(filtered);
    }
  };

  useEffect(() => { fetchMagasins(); }, []);
  useEffect(() => { fetchOperations(); }, [startDate, endDate, selectedMagasin, searchQuery]);

  const viewDetails = async (op: any) => {
    // Récupérer tous les articles du même groupe
    let query = `
      SELECT sm.*, p.designation, p.unite
      FROM stock_movements sm
      JOIN products p ON sm.id_product = p.id
      WHERE sm.date_mouvement = ? 
      AND sm.type_mouvement = ? 
      AND sm.id_magasin = ?
    `;
    const params = [op.date_mouvement, op.type_mouvement, op.id_magasin];
    
    // Si l'opération est liée à un ID spécifique, on filtre aussi par là pour être précis
    if (op.numero_achat) { query += " AND id_achat = (SELECT id FROM achats WHERE numero_achat = ?)"; params.push(op.numero_achat); }
    else if (op.numero_facture) { query += " AND id_achat = (SELECT id FROM factures WHERE numero_facture = ?)"; params.push(op.numero_facture); }
    else if (op.numero_audit) { query += " AND id_audit = (SELECT id FROM audits WHERE numero_audit = ?)"; params.push(op.numero_audit); }
    else if (op.motif) { query += " AND motif = ?"; params.push(op.motif); }
    else { query += " AND motif IS NULL AND id_achat IS NULL AND id_audit IS NULL"; }

    const res = await (window as any).electronAPI.dbQuery(query, params);
    if (res.success) {
      setOpItems(res.data);
      setSelectedOp(op);
    }
  };

  return (
    <div className="container-fluid p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .d-print-none { display: none !important; }
        }
      `}</style>

      {/* LISTE DES OPÉRATIONS */}
      {!selectedOp && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold text-primary">📜 Journal des Opérations de Stock</h5>
            <div className="d-flex gap-2">
               <button className="btn btn-outline-secondary btn-sm" onClick={() => fetchOperations()}>Actualiser</button>
            </div>
          </div>
          <div className="card-body">
            {/* FILTRES */}
            <div className="row g-3 align-items-end mb-4">
              <div className="col-md-2"><label className="small fw-bold">Du</label><input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="col-md-2"><label className="small fw-bold">Au</label><input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              <div className="col-md-3"><label className="small fw-bold">Magasin</label><select className="form-select" value={selectedMagasin} onChange={e => setSelectedMagasin(e.target.value)}><option value="">Tous les magasins</option>{magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></div>
              <div className="col-md-5"><label className="small fw-bold">Recherche (Réf, Motif...)</label><input type="text" className="form-control" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover table-bordered align-middle">
                <thead className="table-light small text-uppercase">
                  <tr>
                    <th>Date / Heure</th>
                    <th>Type</th>
                    <th>Référence / Motif</th>
                    <th>Dépôt</th>
                    <th className="text-center">Nb Articles</th>
                    <th className="text-end">Valeur Totale</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((op, i) => (
                    <tr key={i}>
                      <td className="small">{new Date(op.date_mouvement).toLocaleString()}</td>
                      <td><span className={`badge ${op.type_mouvement === 'ENTREE' ? 'bg-success' : 'bg-danger'}`}>{op.type_mouvement}</span></td>
                      <td className="fw-bold">{op.reference}</td>
                      <td>{op.magasin_nom}</td>
                      <td className="text-center"><span className="badge bg-secondary rounded-pill">{op.nb_articles}</span></td>
                      <td className="text-end fw-bold">{Number(op.total_operation || 0).toLocaleString()} FCFA</td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-primary px-3" onClick={() => viewDetails(op)}>👁️ Détails</button>
                      </td>
                    </tr>
                  ))}
                  {operations.length === 0 && <tr><td colSpan={7} className="text-center py-5 text-muted">Aucune opération trouvée.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DÉTAILS DE L'OPÉRATION (Bordereau / Justificatif) */}
      {selectedOp && (
        <div className="printable-area">
          <div className="d-flex justify-content-between mb-3 d-print-none">
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOp(null)}>← Retour au Journal</button>
            <button className="btn btn-success" onClick={() => window.print()}>🖨️ Imprimer le Bordereau</button>
          </div>

          <div className="card shadow border-0 p-5 mx-auto bg-white" style={{ maxWidth: '850px' }}>
            <div className="row mb-4 pb-3 border-bottom align-items-center">
              <div className="col-7">
                 <h3 className="fw-bold m-0 text-primary">{company?.company_name}</h3>
                 <p className="small m-0 text-muted">{company?.activity}</p>
                 <p className="small m-0">{company?.address} | Tél: {company?.phone}</p>
              </div>
              <div className="col-5 text-end">
                <h4 className="fw-bold mb-0 text-uppercase">BORDEREAU DE {selectedOp.type_mouvement === 'ENTREE' ? 'RÉCEPTION' : 'LIVRAISON'}</h4>
                <p className="small m-0">Document de justification interne</p>
              </div>
            </div>

            <div className="bg-light p-3 rounded border mb-4">
                <div className="row g-3">
                    <div className="col-6 small">
                        <b>DATE & HEURE :</b> {new Date(selectedOp.date_mouvement).toLocaleString()}<br/>
                        <b>DÉPÔT :</b> {selectedOp.magasin_nom}
                    </div>
                    <div className="col-6 text-end small">
                        <b>RÉFÉRENCE :</b> <span className="fw-bold text-primary">{selectedOp.reference}</span><br/>
                        <b>TYPE :</b> <span className={`badge ${selectedOp.type_mouvement === 'ENTREE' ? 'bg-success' : 'bg-danger'}`}>{selectedOp.type_mouvement}</span>
                    </div>
                </div>
            </div>

            <table className="table table-bordered align-middle mb-4">
                <thead className="table-dark small text-uppercase">
                    <tr>
                        <th className="ps-3">Désignation de l'Article</th>
                        <th className="text-center">Quantité</th>
                        <th className="text-center">Unité</th>
                        <th className="text-end pe-3">Prix Unit.</th>
                        <th className="text-end pe-3">Total Ligne</th>
                    </tr>
                </thead>
                <tbody>
                    {opItems.map((item, i) => (
                        <tr key={i}>
                            <td className="ps-3 fw-bold">{item.designation}</td>
                            <td className="text-center fw-bold fs-5">{item.quantite}</td>
                            <td className="text-center small">{item.unite || 'Pcs'}</td>
                            <td className="text-end pe-3">{Number(item.prix_unitaire || 0).toLocaleString()}</td>
                            <td className="text-end pe-3 fw-bold">{Number(item.total_ligne || 0).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="table-light">
                    <tr>
                        <td colSpan={4} className="text-end fw-bold py-3">VALEUR TOTALE DU BORDEREAU</td>
                        <td className="text-end fw-bold py-3 fs-5 pe-3">{Number(selectedOp.total_operation || 0).toLocaleString()} FCFA</td>
                    </tr>
                </tfoot>
            </table>

            <div className="mb-5">
                <label className="small fw-bold text-muted text-uppercase">MOTIF / OBSERVATIONS :</label>
                <div className="p-3 border rounded bg-light italic">
                    {selectedOp.motif || "Opération de stock standard (Vente, Achat ou Ajustement)."}
                </div>
            </div>

            <div className="row mt-5 text-center">
              <div className="col-4"><div className="small fw-bold text-decoration-underline mb-5">Magasinier</div><div className="mt-4">........................</div></div>
              <div className="col-4"><div className="small fw-bold text-decoration-underline mb-5">Contrôleur</div><div className="mt-4">........................</div></div>
              <div className="col-4"><div className="small fw-bold text-decoration-underline mb-5">La Direction</div><div className="mt-4">........................</div></div>
            </div>

            <div className="mt-5 text-center small italic border-top pt-2 text-muted">
              FUSIONSTOCK PRO - {new Date().toLocaleString()} - Duplicata Justificatif
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockJournal;
