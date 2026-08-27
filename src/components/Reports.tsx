import React, { useState, useEffect } from 'react';

const Reports = () => {
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState('');
  const [dateStart, setDateStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
  
  const [summary, setSummary] = useState({ total_ca: 0, total_benefice_brut: 0, total_factures: 0, total_credit: 0, total_depenses: 0 });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [agencyPerformance, setAgencyPerformance] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [deadStock, setDeadStock] = useState<any[]>([]);

  const fetchData = async () => {
    const resMags = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (resMags.success) setMagasins(resMags.data);

    const magFilter = selectedMagasin ? `AND f.id_magasin = ${selectedMagasin}` : '';
    const magFilterCaisse = selectedMagasin ? `AND id_magasin = ${selectedMagasin}` : '';
    const dateParams = [`${dateStart} 00:00:00`, `${dateEnd} 23:59:59`];

    // 1. Synthèse financière
    const resSum = await (window as any).electronAPI.dbQuery(`
      SELECT 
        SUM(total_ttc) as total_ca,
        COUNT(id) as total_factures,
        SUM(CASE WHEN type_paiement = 'credit' THEN total_ttc ELSE 0 END) as total_credit
      FROM factures f
      WHERE date_facture BETWEEN ? AND ? ${magFilter}
    `, dateParams);

    const resBen = await (window as any).electronAPI.dbQuery(`
      SELECT SUM((fi.prix_unitaire - p.prix_achat) * fi.quantite) as total_benefice
      FROM facture_items fi
      JOIN factures f ON fi.id_facture = f.id
      JOIN products p ON fi.id_product = p.id
      WHERE f.date_facture BETWEEN ? AND ? ${magFilter}
    `, dateParams);

    const resDep = await (window as any).electronAPI.dbQuery(`
      SELECT SUM(montant) as total_depenses FROM caisse 
      WHERE type_mouvement = 'SORTIE' AND date_operation BETWEEN ? AND ? ${magFilterCaisse}
    `, dateParams);

    if (resSum.success) {
        setSummary({ 
            ...resSum.data[0], 
            total_benefice_brut: resBen.data[0]?.total_benefice || 0,
            total_depenses: resDep.data[0]?.total_depenses || 0
        });
    }

    // 2. Top Produits
    const resTop = await (window as any).electronAPI.dbQuery(`
      SELECT p.designation, SUM(fi.quantite) as total_qty, SUM(fi.total_ligne) as total_val
      FROM facture_items fi
      JOIN factures f ON fi.id_facture = f.id
      JOIN products p ON fi.id_product = p.id
      WHERE f.date_facture BETWEEN ? AND ? ${magFilter}
      GROUP BY p.id
      ORDER BY total_qty DESC
      LIMIT 8
    `, dateParams);
    if (resTop.success) setTopProducts(resTop.data);

    // 3. Répartition des Dépenses
    const resExp = await (window as any).electronAPI.dbQuery(`
      SELECT motif, SUM(montant) as total FROM caisse 
      WHERE type_mouvement = 'SORTIE' AND date_operation BETWEEN ? AND ? ${magFilterCaisse}
      GROUP BY motif ORDER BY total DESC LIMIT 5
    `, dateParams);
    if (resExp.success) setExpenses(resExp.data);

    // 4. Stock Mort (Produits avec 0 ventes sur la période mais ayant du stock)
    const resDead = await (window as any).electronAPI.dbQuery(`
      SELECT p.designation, IFNULL(s.quantite, 0) as stock_actuel, p.prix_achat
      FROM products p
      LEFT JOIN stock s ON p.id = s.id_product ${selectedMagasin ? `AND s.id_magasin = ${selectedMagasin}` : ''}
      WHERE p.id NOT IN (
        SELECT fi.id_product FROM facture_items fi 
        JOIN factures f ON fi.id_facture = f.id 
        WHERE f.date_facture BETWEEN ? AND ? ${magFilter}
      )
      AND IFNULL(s.quantite, 0) > 0
      ORDER BY stock_actuel DESC LIMIT 10
    `, dateParams);
    if (resDead.success) setDeadStock(resDead.data);

    // 5. Performance Agences
    const resAgency = await (window as any).electronAPI.dbQuery(`
      SELECT m.nom, SUM(f.total_ttc) as ca, COUNT(f.id) as ventes
      FROM magasins m
      LEFT JOIN factures f ON m.id = f.id_magasin AND f.date_facture BETWEEN ? AND ?
      GROUP BY m.id ORDER BY ca DESC
    `, dateParams);
    if (resAgency.success) setAgencyPerformance(resAgency.data);
  };

  useEffect(() => { fetchData(); }, [selectedMagasin, dateStart, dateEnd]);

  const totalNet = summary.total_benefice_brut - summary.total_depenses;

  return (
    <div className="container-fluid p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; }
        }
      `}</style>

      {/* FILTRES */}
      <div className="card shadow-sm border-0 mb-4 no-print">
        <div className="card-body bg-light">
          <div className="row g-3 align-items-end">
            <div className="col-md-3"><label className="small fw-bold">Du</label><input type="date" className="form-control" value={dateStart} onChange={e => setDateStart(e.target.value)} /></div>
            <div className="col-md-3"><label className="small fw-bold">Au</label><input type="date" className="form-control" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></div>
            <div className="col-md-3">
              <label className="small fw-bold">Agence</label>
              <select className="form-select" value={selectedMagasin} onChange={e => setSelectedMagasin(e.target.value)}>
                <option value="">-- Toutes les agences --</option>
                {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div className="col-md-3"><button className="btn btn-primary w-100 fw-bold" onClick={() => window.print()}>🖨️ IMPRIMER LE BILAN</button></div>
          </div>
        </div>
      </div>

      <div className="print-content">
        <div className="text-center mb-4 d-none d-print-block">
            <h2 className="fw-bold text-primary">BILAN D'ACTIVITÉ PÉRIODIQUE</h2>
            <p className="text-muted">Période : {new Date(dateStart).toLocaleDateString()} au {new Date(dateEnd).toLocaleDateString()}</p>
            <hr/>
        </div>

        {/* SYNTHÈSE FINANCIÈRE */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-primary text-white p-3">
              <div className="small opacity-75 text-uppercase fw-bold">Chiffre d'Affaires</div>
              <h3 className="fw-bold mb-0">{(summary.total_ca || 0).toLocaleString()} <small>FCFA</small></h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-danger text-white p-3">
              <div className="small opacity-75 text-uppercase fw-bold">Total Dépenses</div>
              <h3 className="fw-bold mb-0">{(summary.total_depenses || 0).toLocaleString()} <small>FCFA</small></h3>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-success text-white p-3">
              <div className="small opacity-75 text-uppercase fw-bold">Bénéfice NET Estimé</div>
              <h3 className="fw-bold mb-0">{(totalNet || 0).toLocaleString()} <small>FCFA</small></h3>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* TOP PRODUITS */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white py-3 fw-bold">🏆 Top Produits (Ventes)</div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <thead className="table-light small"><tr><th className="ps-3">Produit</th><th className="text-center">Qté</th><th className="text-end pe-3">Valeur</th></tr></thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={i}><td className="ps-3 small fw-bold">{p.designation}</td><td className="text-center small">{p.total_qty}</td><td className="text-end pe-3 small">{(p.total_val || 0).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* STOCK MORT */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 h-100 border-start border-danger border-4">
              <div className="card-header bg-white py-3 fw-bold text-danger">💤 Stock Dormant (Sans vente)</div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <thead className="table-light small"><tr><th className="ps-3">Produit</th><th className="text-center">En Stock</th><th className="text-end pe-3">Valeur Achat</th></tr></thead>
                  <tbody>
                    {deadStock.map((p, i) => (
                      <tr key={i}><td className="ps-3 small">{p.designation}</td><td className="text-center small"><span className="badge bg-warning text-dark">{p.stock_actuel}</span></td><td className="text-end pe-3 small">{(p.prix_achat * p.stock_actuel).toLocaleString()}</td></tr>
                    ))}
                    {deadStock.length === 0 && <tr><td colSpan={3} className="text-center py-3 text-muted">Aucun stock dormant détecté.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ANALYSE DES DÉPENSES */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white py-3 fw-bold">💸 Répartition des Dépenses</div>
              <div className="card-body">
                {expenses.map((e, i) => (
                  <div key={i} className="mb-3">
                    <div className="d-flex justify-content-between small fw-bold mb-1"><span>{e.motif}</span><span>{e.total.toLocaleString()} FCFA</span></div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div className="progress-bar bg-danger" style={{ width: `${(e.total / summary.total_depenses) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && <p className="text-center text-muted py-4">Aucune dépense enregistrée.</p>}
              </div>
            </div>
          </div>

          {/* PERFORMANCE AGENCES */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white py-3 fw-bold">🏢 Chiffre d'Affaires par Agence</div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <thead className="table-light small"><tr><th className="ps-3">Agence</th><th className="text-center">Ventes</th><th className="text-end pe-3">CA</th></tr></thead>
                  <tbody>
                    {agencyPerformance.map((a, i) => (
                      <tr key={i}><td className="ps-3 small fw-bold">{a.nom}</td><td className="text-center small">{a.ventes}</td><td className="text-end pe-3 small fw-bold text-success">{(a.ca || 0).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center d-none d-print-block small text-muted border-top pt-3">
            Bilan généré numériquement le {new Date().toLocaleString()} | FusionStock Pro V2.0
        </div>
      </div>
    </div>
  );
};

export default Reports;
