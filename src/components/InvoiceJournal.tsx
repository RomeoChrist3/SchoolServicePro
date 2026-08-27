import React, { useState, useEffect } from 'react';

const InvoiceJournal = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState<string>('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [printType, setPrintType] = useState<'duplicata' | 'bordereau'>('duplicata');

  const fetchMagasins = async () => {
    const res = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (res.success) setMagasins(res.data);
  };

  const fetchInvoices = async () => {
    let query = `
       SELECT f.*, IFNULL(c.nom, 'Client Comptant') as client_nom 
       FROM factures f 
       LEFT JOIN clients c ON f.id_client = c.id
       WHERE DATE(f.date_facture) BETWEEN ? AND ?
       AND (f.numero_facture LIKE ? OR IFNULL(c.nom, '') LIKE ?)
    `;
    const params: any[] = [startDate, endDate, `%${searchQuery}%`, `%${searchQuery}%`];

    if (selectedMagasin) {
      query += ` AND f.id_magasin = ? `;
      params.push(selectedMagasin);
    }

    query += ` ORDER BY f.date_facture DESC `;

    const result = await (window as any).electronAPI.dbQuery(query, params);
    if (result.success) setInvoices(result.data);
    
    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
  };

  useEffect(() => {
    fetchMagasins();
  }, []);

  useEffect(() => { fetchInvoices(); }, [startDate, endDate, searchQuery, selectedMagasin]);

  const viewInvoice = async (invoice: any) => {
    const result = await (window as any).electronAPI.dbQuery(
      `SELECT fi.*, p.designation 
       FROM facture_items fi 
       JOIN products p ON fi.id_product = p.id 
       WHERE fi.id_facture = ?`, 
      [invoice.id]
    );
    if (result.success) {
      setInvoiceItems(result.data);
      setSelectedInvoice(invoice);
      setPrintType('duplicata');
    }
  };

  const totalPeriod = invoices.reduce((sum, inv) => sum + Number(inv.total_ttc), 0);

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

      {/* SECTION LISTE (Journal) */}
      {!selectedInvoice && (
        <div className="printable-area">
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center d-print-none">
              <h5 className="mb-0 fw-bold text-primary">📊 Journal des Ventes & Recettes</h5>
              <div className="d-flex gap-2">
                 <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                   setStartDate(new Date().toISOString().split('T')[0]);
                   setEndDate(new Date().toISOString().split('T')[0]);
                   setSearchQuery('');
                   setSelectedMagasin('');
                 }}>Actualiser</button>
                 <button className="btn btn-dark btn-sm shadow-sm" onClick={() => window.print()}>🖨️ Rapport Global</button>
              </div>
            </div>
            <div className="card-body">
              {/* FILTRES UI */}
              <div className="row g-3 align-items-end mb-4 d-print-none">
                <div className="col-md-2">
                  <label className="form-label small fw-bold">Du</label>
                  <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-bold">Au</label>
                  <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Magasin</label>
                  <select className="form-select" value={selectedMagasin} onChange={(e) => setSelectedMagasin(e.target.value)}>
                    <option value="">Tous les magasins</option>
                    {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
                <div className="col-md-5">
                  <label className="form-label small fw-bold">Rechercher</label>
                  <input type="text" className="form-control" placeholder="N°, Client..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {/* EN-TÊTE RAPPORT IMPRIMÉ */}
              <div className="d-none d-print-block mb-4">
                 <div className="row">
                    <div className="col-6">
                       <h3 className="fw-bold m-0">{company?.company_name}</h3>
                       <p className="small m-0">{company?.address}</p>
                    </div>
                    <div className="col-6 text-end">
                       <h4 className="text-decoration-underline">RAPPORT JOURNALIER DES VENTES</h4>
                       <p className="small m-0">Période: {new Date(startDate).toLocaleDateString()} au {new Date(endDate).toLocaleDateString()}</p>
                    </div>
                 </div>
                 <hr/>
              </div>

              {/* RÉSUMÉ CARDS (D-PRINT-NONE) */}
              <div className="row mb-4 d-print-none">
                <div className="col-md-4">
                  <div className="card bg-primary text-white p-3 border-0 shadow-sm">
                    <div className="small opacity-75">Chiffre d'Affaire</div>
                    <h4 className="fw-bold mb-0">{totalPeriod.toLocaleString()} FCFA</h4>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card bg-success text-white p-3 border-0 shadow-sm">
                    <div className="small opacity-75">Nombre de Ventes</div>
                    <h4 className="fw-bold mb-0">{invoices.length}</h4>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card bg-info text-white p-3 border-0 shadow-sm">
                    <div className="small opacity-75">Panier Moyen</div>
                    <h4 className="fw-bold mb-0">{invoices.length > 0 ? (totalPeriod / invoices.length).toFixed(0).toLocaleString() : 0} FCFA</h4>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover table-bordered align-middle">
                  <thead className="table-light small text-uppercase">
                    <tr>
                      <th>Date / Heure</th>
                      <th>N° Facture</th>
                      <th>Client</th>
                      <th className="text-end">Montant TTC</th>
                      <th className="text-end d-print-none">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="small">{new Date(inv.date_facture).toLocaleString()}</td>
                        <td className="fw-bold">{inv.numero_facture}</td>
                        <td className="small">{inv.client_nom}</td>
                        <td className="text-end fw-bold">{inv.total_ttc?.toLocaleString()} FCFA</td>
                        <td className="text-end d-print-none">
                          <button className="btn btn-sm btn-link" onClick={() => viewInvoice(inv)}>👁️ Détails</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-dark fw-bold">
                      <td colSpan={3} className="text-end">TOTAL GÉNÉRAL :</td>
                      <td className="text-end">{totalPeriod.toLocaleString()} FCFA</td>
                      <td className="d-print-none"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-5 d-none d-print-block">
                 <div className="row text-center mt-5">
                    <div className="col-4"><div className="fw-bold text-decoration-underline mb-5">Le Comptable</div></div>
                    <div className="col-4"><div className="fw-bold text-decoration-underline mb-5">Le Caissier</div></div>
                    <div className="col-4"><div className="fw-bold text-decoration-underline mb-5">La Direction</div></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION DUPLICATA / BORDEREAU (Détails) */}
      {selectedInvoice && (
        <div className="printable-area">
          <div className="d-flex justify-content-between mb-3 d-print-none">
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedInvoice(null)}>← Retour</button>
            <div className="d-flex gap-2">
                <button className={`btn ${printType === 'duplicata' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => { setPrintType('duplicata'); setTimeout(() => window.print(), 100); }}>🖨️ Imprimer Duplicata</button>
                <button className={`btn ${printType === 'bordereau' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => { setPrintType('bordereau'); setTimeout(() => window.print(), 100); }}>📦 Imprimer Bordereau de Livraison</button>
            </div>
          </div>

          <div className="card shadow border-0 p-5 mx-auto" style={{ maxWidth: '800px', background: '#fff' }}>
            <div className="row mb-4 pb-4 border-bottom">
              <div className="col-6">
                 {company?.logo_path && <img src={company.logo_path} alt="Logo" style={{ maxHeight: '80px' }} />}
                 {!company?.logo_path && <h2 className="fw-bold m-0 text-primary">{company?.company_name}</h2>}
              </div>
              <div className="col-6 text-end small">
                <h4 className="fw-bold mb-1">{company?.company_name}</h4>
                {company?.address}<br/>Tél: {company?.phone}<br/>NIU: {company?.niu}
              </div>
            </div>

            <div className="row mb-4">
              <div className="col-6">
                <h5 className="fw-bold text-decoration-underline" style={{ color: company?.primary_color || '#000' }}>
                    {printType === 'duplicata' ? 'DUPLICATA FACTURE' : 'BORDEREAU DE LIVRAISON'}
                </h5>
                <div className="small">
                  <b>N° :</b> {selectedInvoice.numero_facture}<br/>
                  <b>Date :</b> {new Date(selectedInvoice.date_facture).toLocaleString()}
                </div>
              </div>
              <div className="col-6 text-end">
                <div className="text-muted small">Client :</div>
                <h6 className="fw-bold">{selectedInvoice.client_nom}</h6>
              </div>
            </div>

            <table className="table table-bordered table-sm small">
              <thead className="table-light">
                <tr>
                    <th>Désignation</th>
                    <th className="text-center">Qté</th>
                    {printType === 'duplicata' && (
                        <>
                            <th className="text-end">P.U</th>
                            <th className="text-end">Total</th>
                        </>
                    )}
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, i) => (
                  <tr key={i}>
                    <td>{item.designation}</td>
                    <td className="text-center fw-bold">{item.quantite}</td>
                    {printType === 'duplicata' && (
                        <>
                            <td className="text-end">{item.prix_unitaire?.toLocaleString()}</td>
                            <td className="text-end">{item.total_ligne?.toLocaleString()}</td>
                        </>
                    )}
                  </tr>
                ))}
              </tbody>
              {printType === 'duplicata' && (
                <tfoot className="fw-bold">
                    <tr><td colSpan={3} className="text-end">TOTAL HT :</td><td className="text-end">{selectedInvoice.total_ht?.toLocaleString()}</td></tr>
                    {selectedInvoice.tva > 0 && <tr><td colSpan={3} className="text-end">TVA :</td><td className="text-end">{selectedInvoice.tva?.toLocaleString()}</td></tr>}
                    <tr><td colSpan={3} className="text-end bg-light">NET À PAYER (TTC) :</td><td className="text-end bg-light" style={{ fontSize: '1.2rem' }}>{selectedInvoice.total_ttc?.toLocaleString()} FCFA</td></tr>
                </tfoot>
              )}
            </table>

            <div className="row mt-5 pt-4 text-center">
              <div className="col-6"><div className="small text-muted mb-5">Signature Client</div></div>
              <div className="col-6"><div className="small text-muted mb-5">Signature Magasinier</div></div>
            </div>
            <div className="mt-5 text-center small italic border-top pt-2">
              {company?.invoice_footer || "Merci pour votre confiance !"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceJournal;
