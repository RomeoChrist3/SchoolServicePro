import React, { useState, useEffect } from 'react';

const PaymentJournal = ({ user }: { user: any }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

  const fetchPayments = async () => {
    // 0. Infos Société
    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);

    // Requête pour récupérer les règlements clients et fournisseurs avec les détails de la facture
    const query = `
      SELECT c.*, 
             f.numero_facture as ref_client, cl.nom as client_nom,
             a.numero_achat as ref_fourn, fr.nom as fournisseur_nom,
             m.nom as magasin_nom
      FROM caisse c
      LEFT JOIN factures f ON c.id_facture_client = f.id
      LEFT JOIN clients cl ON f.id_client = cl.id
      LEFT JOIN achats a ON c.id_facture_fournisseur = a.id
      LEFT JOIN fournisseurs fr ON a.id_fournisseur = fr.id
      LEFT JOIN magasins m ON c.id_magasin = m.id
      WHERE (c.id_facture_client IS NOT NULL OR c.id_facture_fournisseur IS NOT NULL)
      AND DATE(c.date_operation) = ?
      ORDER BY c.date_operation DESC
    `;
    const res = await (window as any).electronAPI.dbQuery(query, [filterDate]);
    if (res.success) setPayments(res.data);
  };

  useEffect(() => { fetchPayments(); }, [filterDate]);

  const handlePrintAgain = (p: any) => {
    setSelectedReceipt({
      type: p.id_facture_client ? 'CLIENT' : 'FOURNISSEUR',
      nom: p.client_nom || p.fournisseur_nom,
      numero: p.ref_client || p.ref_fourn,
      date: new Date(p.date_operation).toLocaleString(),
      montantRegle: p.montant,
      motif: p.motif
    });
    setTimeout(() => { window.print(); }, 300);
  };

  return (
    <div className="container-fluid p-0">
      <div className="card shadow-sm border-0 d-print-none">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold">🧾 Journal des Règlements (Reçus)</h5>
          <input type="date" className="form-control w-auto" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
        <div className="card-body px-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-uppercase">
                <tr>
                  <th className="ps-4">Date/Heure</th>
                  <th>Type</th>
                  <th>Bénéficiaire / Client</th>
                  <th>Référence Facture</th>
                  <th className="text-end">Montant</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-5 text-muted">Aucun règlement enregistré ce jour.</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id}>
                      <td className="ps-4 small">{new Date(p.date_operation).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${p.type_mouvement === 'ENTREE' ? 'bg-success' : 'bg-danger'}`}>
                          {p.type_mouvement === 'ENTREE' ? 'ENCAISSEMENT' : 'DÉCAISSEMENT'}
                        </span>
                      </td>
                      <td className="fw-bold">{p.client_nom || p.fournisseur_nom || 'N/A'}</td>
                      <td className="small">{p.ref_client || p.ref_fourn || '-'}</td>
                      <td className="text-end fw-bold">{p.montant.toLocaleString()} FCFA</td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-dark rounded-pill px-3" onClick={() => handlePrintAgain(p)}>🖨️ Réimprimer</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ZONE D'IMPRESSION DU REÇU (invisible à l'écran) */}
      {selectedReceipt && (
        <div className="d-none d-print-block p-4 border text-center mx-auto" style={{ maxWidth: '400px', fontFamily: 'monospace' }}>
          <h3 className="fw-bold mb-0">{company?.company_name || 'VOTRE ENTREPRISE'}</h3>
          <p className="small mb-1">{company?.address || ''}</p>
          <p className="small mb-3">{company?.phone ? `Tél: ${company.phone}` : ''}</p>
          <hr />
          <p className="small mb-3 text-uppercase">DUPLICATA DE REÇU</p>
          <h5 className="fw-bold mb-3">REÇU DE PAIEMENT</h5>
          <div className="text-start mb-3">
            <p className="mb-1"><b>Date:</b> {selectedReceipt.date}</p>
            <p className="mb-1"><b>{selectedReceipt.type === 'CLIENT' ? 'Client:' : 'Fournisseur:'}</b> {selectedReceipt.nom}</p>
            <p className="mb-1"><b>Référence:</b> {selectedReceipt.numero}</p>
          </div>
          <hr />
          <div className="text-start mb-3">
            <div className="d-flex justify-content-between fs-5 fw-bold my-2 py-1 border-top border-bottom">
                <span>MONTANT RÉGLÉ:</span> <span>{selectedReceipt.montantRegle.toLocaleString()} FCFA</span>
            </div>
            <p className="small mt-2"><b>Motif:</b> {selectedReceipt.motif}</p>
          </div>
          <hr />
          <p className="small mt-4">Document généré le {new Date().toLocaleString()}</p>
          <div className="mt-2 text-muted" style={{ fontSize: '8px' }}>Logiciel FUSIONSTOCK PRO</div>
        </div>
      )}
    </div>
  );
};

export default PaymentJournal;
