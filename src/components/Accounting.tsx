import React, { useState, useEffect } from 'react';

const Accounting = () => {
  const [activeSubTab, setActiveSubTab] = useState('clients'); 
  const [clientDebts, setClientDebts] = useState<any[]>([]);
  const [supplierDebts, setSupplierDebts] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [company, setCompany] = useState<any>(null);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState('');

  // États pour le Relevé de Compte
  const [tierType, setTierType] = useState('client');
  const [tiers, setTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState('');
  const [dateStart, setDateStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
  const [statementData, setStatementData] = useState<any[]>([]);
  const [statementSummary, setStatementSummary] = useState({ debit: 0, credit: 0, solde: 0 });

  // États pour la Balance
  const [balanceData, setBalanceData] = useState<any[]>([]);

  // États pour le paiement et reçu
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const fetchData = async () => {
    try {
      const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
      if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);

      const resMags = await (window as any).electronAPI.dbQuery('SELECT id, nom_caisse as nom, code_caisse FROM points_caisse ORDER BY nom_caisse');
      if (resMags.success) setMagasins(resMags.data);

      const magF = selectedMagasin ? `AND f.id_caisse = ${selectedMagasin}` : '';
      const magA = selectedMagasin ? `AND a.id_caisse = ${selectedMagasin}` : '';
      const magC = selectedMagasin ? `AND id_caisse = ${selectedMagasin}` : '';

      // Dettes Clients
      const resClients = await (window as any).electronAPI.dbQuery(`
        SELECT f.id, f.numero_facture, f.date_facture, f.total_ttc, c.nom as client_nom,
        (f.total_ttc - IFNULL((SELECT SUM(montant) FROM caisse WHERE id_facture_client = f.id), 0)) as reste_a_payer
        FROM factures f JOIN clients c ON f.id_client = c.id 
        WHERE f.type_paiement = 'credit' ${magF} HAVING reste_a_payer > 0
      `);
      if (resClients.success) setClientDebts(resClients.data);

      // Dettes Fournisseurs
      const resSuppliers = await (window as any).electronAPI.dbQuery(`
        SELECT a.id, a.numero_achat, a.date_achat, a.montant_total, f.nom as fournisseur_nom, a.montant_regle,
        (a.montant_total - a.montant_regle) as reste_a_payer
        FROM achats a JOIN fournisseurs f ON a.id_fournisseur = f.id 
        WHERE a.statut_paiement != 'PAYE' ${magA} HAVING reste_a_payer > 0
      `);
      if (resSuppliers.success) setSupplierDebts(resSuppliers.data);

      // Solde Caisse
      const resCash = await (window as any).electronAPI.dbQuery(`SELECT SUM(CASE WHEN type_mouvement = 'ENTREE' THEN montant ELSE -montant END) as solde FROM caisse WHERE 1=1 ${magC}`);
      if (resCash.success) setCashBalance(resCash.data[0]?.solde || 0);

      // Tiers
      const resT = await (window as any).electronAPI.dbQuery(tierType === 'client' ? 'SELECT id, nom FROM clients ORDER BY nom' : 'SELECT id, nom FROM fournisseurs ORDER BY nom');
      if (resT.success) setTiers(resT.data);

    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, [activeSubTab, tierType, selectedMagasin]);

  const fetchStatement = async () => {
    if (!selectedTierId) return;
    const start = `${dateStart} 00:00:00`, end = `${dateEnd} 23:59:59`;
    const magF = selectedMagasin ? `AND f.id_caisse = ${selectedMagasin}` : '';
    const magC = selectedMagasin ? `AND c.id_caisse = ${selectedMagasin}` : '';
    const magA = selectedMagasin ? `AND a.id_caisse = ${selectedMagasin}` : '';
    
    let operations: any[] = [];
    if (tierType === 'client') {
        const resFac = await (window as any).electronAPI.dbQuery(`SELECT date_facture as date, numero_facture as ref, 'Facture' as type, total_ttc as debit, 0 as credit FROM factures f WHERE id_client = ? AND date_facture BETWEEN ? AND ? AND type_paiement='credit' ${magF}`, [selectedTierId, start, end]);
        const resReg = await (window as any).electronAPI.dbQuery(`SELECT c.date_operation as date, f.numero_facture as ref, 'Règlement' as type, 0 as debit, c.montant as credit FROM caisse c JOIN factures f ON c.id_facture_client = f.id WHERE f.id_client = ? AND c.date_operation BETWEEN ? AND ? ${magC}`, [selectedTierId, start, end]);
        operations = [...(resFac.data || []), ...(resReg.data || [])];
    } else {
        const resAch = await (window as any).electronAPI.dbQuery(`SELECT date_achat as date, numero_achat as ref, 'Achat' as type, 0 as debit, montant_total as credit FROM achats a WHERE id_fournisseur = ? AND date_achat BETWEEN ? AND ? ${magA}`, [selectedTierId, start, end]);
        const resPay = await (window as any).electronAPI.dbQuery(`SELECT c.date_operation as date, a.numero_achat as ref, 'Paiement' as type, c.montant as debit, 0 as credit FROM caisse c JOIN achats a ON c.id_facture_fournisseur = a.id WHERE a.id_fournisseur = ? AND c.date_operation BETWEEN ? AND ? ${magC}`, [selectedTierId, start, end]);
        operations = [...(resAch.data || []), ...(resPay.data || [])];
    }
    operations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setStatementData(operations);
    const d = operations.reduce((s, x) => s + (Number(x.debit) || 0), 0);
    const c = operations.reduce((s, x) => s + (Number(x.credit) || 0), 0);
    setStatementSummary({ debit: d, credit: c, solde: d - c });
  };

  const fetchBalance = async () => {
    const magF = selectedMagasin ? `AND f.id_caisse = ${selectedMagasin}` : '';
    const magCA = selectedMagasin ? `AND id_caisse = ${selectedMagasin}` : '';
    let sql = tierType === 'client' 
        ? `SELECT c.nom, SUM(f.total_ttc) as total_du, IFNULL((SELECT SUM(montant) FROM caisse WHERE id_facture_client IN (SELECT id FROM factures f WHERE id_client = c.id ${magF}) ${magCA}), 0) as total_paye FROM clients c LEFT JOIN factures f ON c.id = f.id_client AND f.type_paiement = 'credit' ${magF} GROUP BY c.id ORDER BY nom`
        : `SELECT f.nom, SUM(a.montant_total) as total_du, IFNULL((SELECT SUM(montant) FROM caisse WHERE id_facture_fournisseur IN (SELECT id FROM achats a WHERE id_fournisseur = f.id ${selectedMagasin ? `AND id_caisse = ${selectedMagasin}` : ''}) ${magCA}), 0) as total_paye FROM fournisseurs f LEFT JOIN achats a ON f.id = a.id_fournisseur ${selectedMagasin ? `AND a.id_caisse = ${selectedMagasin}` : ''} GROUP BY f.id ORDER BY nom`;
    const res = await (window as any).electronAPI.dbQuery(sql);
    if (res.success) setBalanceData(res.data);
  };

  useEffect(() => {
    if (activeSubTab === 'releve') fetchStatement();
    if (activeSubTab === 'balance') fetchBalance();
  }, [selectedTierId, dateStart, dateEnd, tierType, activeSubTab, selectedMagasin]);

  const handleProcessPayment = async () => {
    const montant = parseFloat(paymentAmount);
    if (montant <= 0 || isNaN(montant)) return;
    
    if (activeSubTab === 'fournisseurs' && montant > cashBalance) { alert('Solde de caisse insuffisant !'); return; }

    const isClient = activeSubTab === 'clients';
    const res = await (window as any).electronAPI.dbQuery(
        isClient ? 'INSERT INTO caisse (type_mouvement, montant, motif, id_facture_client, id_caisse) VALUES (?, ?, ?, ?, ?)' : 'INSERT INTO caisse (type_mouvement, montant, motif, id_facture_fournisseur, id_caisse) VALUES (?, ?, ?, ?, ?)',
        isClient ? ['ENTREE', montant, `Règlement FAC ${selectedItem.numero_facture}`, selectedItem.id, selectedMagasin || 1] : ['SORTIE', montant, `Paiement ACH ${selectedItem.numero_achat}`, selectedItem.id, selectedMagasin || 1]
    );
    
    if (res.success) {
        if (!isClient && montant >= selectedItem.reste_a_payer) await (window as any).electronAPI.dbQuery('UPDATE achats SET statut_paiement = "PAYE" WHERE id = ?', [selectedItem.id]);
        
        setLastReceipt({
            type: isClient ? 'CLIENT' : 'FOURNISSEUR',
            nom: isClient ? selectedItem.client_nom : selectedItem.fournisseur_nom,
            ref: isClient ? selectedItem.numero_facture : selectedItem.numero_achat,
            montant: montant,
            reste: selectedItem.reste_a_payer - montant,
            date: new Date().toLocaleString()
        });
        
        setSelectedItem(null); fetchData();
    }
  };

  const totalClients = clientDebts.reduce((s, x) => s + x.reste_a_payer, 0);
  const totalSuppliers = supplierDebts.reduce((s, x) => s + x.reste_a_payer, 0);

  return (
    <div className="container-fluid p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* 1. RÉSUMÉ FINANCIER (NO PRINT) */}
      <div className="row g-4 mb-4 no-print">
        <div className="col-md-4"><div className="card border-0 shadow-sm bg-primary text-white p-3"><div className="small opacity-75 text-uppercase fw-bold">Créances Clients</div><h3 className="fw-bold mb-0">{totalClients.toLocaleString()} FCFA</h3></div></div>
        <div className="col-md-4"><div className="card border-0 shadow-sm bg-danger text-white p-3"><div className="small opacity-75 text-uppercase fw-bold">Dettes Fournisseurs</div><h3 className="fw-bold mb-0">{totalSuppliers.toLocaleString()} FCFA</h3></div></div>
        <div className="col-md-4"><div className="card border-0 shadow-sm bg-dark text-white p-3"><div className="small opacity-75 text-uppercase fw-bold">Solde Caisse</div><h3 className="fw-bold mb-0 text-warning">{cashBalance.toLocaleString()} FCFA</h3></div></div>
      </div>

      {/* 2. FILTRE CAISSE & TABS (NO PRINT) */}
      <div className="card border-0 shadow-sm mb-4 no-print">
        <div className="card-header bg-light d-flex justify-content-between align-items-center py-2">
            <div className="nav nav-pills">
                <button className={`nav-link small fw-bold ${activeSubTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveSubTab('clients')}>Dettes Clients</button>
                <button className={`nav-link small fw-bold ${activeSubTab === 'fournisseurs' ? 'active' : ''}`} onClick={() => setActiveSubTab('fournisseurs')}>Dettes Fournisseurs</button>
                <button className={`nav-link small fw-bold ${activeSubTab === 'releve' ? 'active' : ''}`} onClick={() => setActiveSubTab('releve')}>Grand Livre</button>
                <button className={`nav-link small fw-bold ${activeSubTab === 'balance' ? 'active' : ''}`} onClick={() => setActiveSubTab('balance')}>Balance</button>
            </div>
            <div style={{ width: '250px' }}>
                <select className="form-select form-select-sm fw-bold border-primary" value={selectedMagasin} onChange={e => setSelectedMagasin(e.target.value)}>
                    <option value="">-- Toutes les Caisses --</option>
                    {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* 3. AFFICHAGE DU REÇU APRÈS PAIEMENT (NO PRINT) */}
      {lastReceipt && (
        <div className="alert alert-success border-success shadow-sm mb-4 no-print d-flex justify-content-between align-items-center">
            <div className="fw-bold">✅ Règlement de {lastReceipt.montant.toLocaleString()} FCFA validé !</div>
            <div className="d-flex gap-2">
                <button className="btn btn-dark btn-sm fw-bold" onClick={() => window.print()}>🖨️ IMPRIMER LE REÇU</button>
                <button className="btn btn-outline-success btn-sm" onClick={() => setLastReceipt(null)}>Fermer</button>
            </div>
        </div>
      )}

      {/* 4. ZONE D'IMPRESSION DU REÇU (PRINT ONLY) */}
      {lastReceipt && (
        <div className="print-area d-none d-print-block" style={{ width: '80mm', padding: '5mm', fontFamily: 'monospace' }}>
            <div className="text-center">
                <h4 className="fw-bold mb-0">{company?.company_name}</h4>
                <p className="small mb-1">{company?.address}<br/>Tél: {company?.phone}</p>
                <hr style={{ borderTop: '1px dashed #000' }}/>
                <h5 className="fw-bold">REÇU DE PAIEMENT</h5>
                <hr style={{ borderTop: '1px dashed #000' }}/>
            </div>
            <div className="small">
                <p className="mb-1"><b>Date:</b> {lastReceipt.date}</p>
                <p className="mb-1"><b>{lastReceipt.type}:</b> {lastReceipt.nom}</p>
                <p className="mb-1"><b>Réf Doc:</b> {lastReceipt.ref}</p>
                <div style={{ padding: '5px', border: '1px solid #000', margin: '10px 0', textAlign: 'center' }}>
                    <h4 className="fw-bold mb-0">{lastReceipt.montant.toLocaleString()} FCFA</h4>
                </div>
                <div className="d-flex justify-content-between fw-bold"><span>Reste à payer :</span><span>{Math.max(0, lastReceipt.reste).toLocaleString()} FCFA</span></div>
            </div>
            <hr style={{ borderTop: '1px dashed #000' }}/>
            <p className="text-center small italic">Merci pour votre confiance !</p>
        </div>
      )}

      {/* LISTES ET RAPPORTS */}
      {(activeSubTab === 'clients' || activeSubTab === 'fournisseurs') && (
        <div className="card border-0 shadow-sm no-print">
            <div className="card-body p-0"><table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th className="ps-4">Date</th><th>Référence</th><th>Nom</th><th className="text-end">Total</th><th className="text-end text-danger">Reste</th><th className="text-center">Action</th></tr></thead>
                <tbody>{(activeSubTab === 'clients' ? clientDebts : supplierDebts).map(d => (
                    <tr key={d.id}><td className="ps-4 small">{new Date(d.date_facture || d.date_achat).toLocaleDateString()}</td><td className="fw-bold">{d.numero_facture || d.numero_achat}</td><td className="text-uppercase small">{d.client_nom || d.fournisseur_nom}</td><td className="text-end small">{(d.total_ttc || d.montant_total).toLocaleString()}</td><td className="text-end fw-bold text-danger">{d.reste_a_payer.toLocaleString()}</td><td className="text-center"><button className="btn btn-sm btn-primary fw-bold" onClick={() => { setSelectedItem(d); setPaymentAmount(d.reste_a_payer.toString()); setLastReceipt(null); }}>Régler</button></td></tr>
                ))}</tbody>
            </table></div>
        </div>
      )}

      {activeSubTab === 'releve' && (
        <div className="print-area">
            <div className="card border-0 shadow-sm no-print mb-4 bg-light">
                <div className="card-body row g-2 align-items-end">
                    <div className="col-md-2"><label className="small fw-bold">Type</label><select className="form-select" value={tierType} onChange={e => {setTierType(e.target.value); setSelectedTierId('');}}><option value="client">Client</option><option value="fournisseur">Fournisseur</option></select></div>
                    <div className="col-md-3"><label className="small fw-bold">Tiers</label><select className="form-select" value={selectedTierId} onChange={e => setSelectedTierId(e.target.value)}><option value="">-- Choisir --</option>{tiers.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
                    <div className="col-md-2"><label className="small fw-bold">Du</label><input type="date" className="form-control" value={dateStart} onChange={e => setDateStart(e.target.value)} /></div>
                    <div className="col-md-2"><label className="small fw-bold">Au</label><input type="date" className="form-control" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></div>
                    <div className="col-md-3"><button className="btn btn-dark w-100 fw-bold" onClick={() => window.print()}>🖨️ IMPRIMER RELEVÉ</button></div>
                </div>
            </div>
            <div className="bg-white p-4 border rounded">
                <div className="d-flex justify-content-between mb-4">
                    <div><h3 className="fw-bold text-primary">{company?.company_name}</h3><p className="small text-muted">{company?.address} | {company?.phone}</p></div>
                    <div className="text-end"><h4 className="fw-bold">RELEVÉ DE COMPTE</h4><p className="small text-muted">Période du {new Date(dateStart).toLocaleDateString()} au {new Date(dateEnd).toLocaleDateString()}</p></div>
                </div>
                <h5 className="p-3 bg-light rounded border fw-bold text-uppercase mb-4">{tiers.find(t => t.id == selectedTierId)?.nom || 'Aucun tiers'}</h5>
                <table className="table table-bordered align-middle">
                    <thead className="table-dark"><tr><th>Date</th><th>Référence</th><th>Libellé</th><th className="text-end">Débit (+)</th><th className="text-end">Crédit (-)</th><th className="text-end">Solde</th></tr></thead>
                    <tbody>{statementData.map((op, i) => {
                        const currentSolde = statementData.slice(0, i+1).reduce((sum, item) => sum + (item.debit - item.credit), 0);
                        return (<tr key={i}><td>{new Date(op.date).toLocaleDateString()}</td><td className="fw-bold">{op.ref}</td><td>{op.type}</td><td className="text-end">{op.debit.toLocaleString()}</td><td className="text-end">{op.credit.toLocaleString()}</td><td className={`text-end fw-bold ${currentSolde > 0 ? 'text-danger' : 'text-success'}`}>{currentSolde.toLocaleString()}</td></tr>);
                    })}</tbody>
                    <tfoot className="table-dark fw-bold">
                        <tr>
                            <td colSpan={3} className="text-center text-uppercase">Totaux de la période</td>
                            <td className="text-end">{statementSummary.debit.toLocaleString()}</td>
                            <td className="text-end">{statementSummary.credit.toLocaleString()}</td>
                            <td className="text-end">{statementSummary.solde.toLocaleString()} FCFA</td>
                        </tr>
                    </tfoot>
                </table>
                <div className="mt-4 p-3 border rounded bg-light d-flex justify-content-between align-items-center"><div className="fw-bold">SOLDE FINAL :</div><div className={`fs-3 fw-bold ${statementSummary.solde > 0 ? 'text-danger' : 'text-success'}`}>{statementSummary.solde.toLocaleString()} FCFA</div></div>
            </div>
        </div>
      )}

      {activeSubTab === 'balance' && (
        <div className="print-area">
            <div className="card border-0 shadow-sm no-print mb-4 bg-light p-3 d-flex flex-row gap-3 align-items-center">
                <div className="fw-bold">Balance :</div>
                <div className="form-check"><input className="form-check-input" type="radio" checked={tierType === 'client'} onChange={() => setTierType('client')} /><label className="form-check-label">Clients</label></div>
                <div className="form-check"><input className="form-check-input" type="radio" checked={tierType === 'fournisseur'} onChange={() => setTierType('fournisseur')} /><label className="form-check-label">Fournisseurs</label></div>
                <button className="btn btn-dark ms-auto fw-bold" onClick={() => window.print()}>🖨️ IMPRIMER BALANCE</button>
            </div>
            <div className="bg-white p-4 border rounded">
                <h4 className="fw-bold text-center mb-4 text-uppercase">BALANCE GÉNÉRALE DES COMPTES</h4>
                <table className="table table-striped table-bordered">
                    <thead className="table-dark"><tr><th>Nom</th><th className="text-end">Total Facturé</th><th className="text-end">Total Réglé</th><th className="text-end">Solde restant</th></tr></thead>
                    <tbody>{balanceData.map((b, i) => {
                        const solde = (b.total_du || 0) - (b.total_paye || 0);
                        return (<tr key={i}><td className="fw-bold">{b.nom}</td><td className="text-end">{(b.total_du || 0).toLocaleString()}</td><td className="text-end">{(b.total_paye || 0).toLocaleString()}</td><td className={`text-end fw-bold ${solde > 0 ? 'text-danger' : 'text-success'}`}>{solde.toLocaleString()} FCFA</td></tr>);
                    })}</tbody>
                    <tfoot className="table-dark fw-bold">
                        <tr>
                            <td>TOTAUX GÉNÉRAUX</td>
                            <td className="text-end">{balanceData.reduce((s, x) => s + (x.total_du || 0), 0).toLocaleString()}</td>
                            <td className="text-end">{balanceData.reduce((s, x) => s + (x.total_paye || 0), 0).toLocaleString()}</td>
                            <td className="text-end">{(balanceData.reduce((s, x) => s + (x.total_du || 0), 0) - balanceData.reduce((s, x) => s + (x.total_paye || 0), 0)).toLocaleString()} FCFA</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
      )}

      {/* MODALE PAIEMENT */}
      {selectedItem && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-dialog-centered"><div className="modal-content border-0 shadow-lg">
                <div className="modal-header bg-primary text-white border-0"><h5 className="modal-title fw-bold">💳 Règlement {selectedItem.numero_facture || selectedItem.numero_achat}</h5><button className="btn-close btn-close-white" onClick={() => setSelectedItem(null)}></button></div>
                <div className="modal-body p-4 text-center">
                    <h4 className="fw-bold text-primary mb-4">{selectedItem.client_nom || selectedItem.fournisseur_nom}</h4>
                    <div className="mb-3"><label className="small fw-bold">Montant à régler</label><input type="number" className="form-control form-control-lg text-center fw-bold border-primary" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                    <div className="alert alert-warning small">Reste : <b>{selectedItem.reste_a_payer.toLocaleString()} FCFA</b></div>
                </div>
                <div className="modal-footer border-0"><button className="btn btn-light px-4" onClick={() => setSelectedItem(null)}>Annuler</button><button className="btn btn-primary px-4 fw-bold" onClick={handleProcessPayment}>🚀 Valider</button></div>
            </div></div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
