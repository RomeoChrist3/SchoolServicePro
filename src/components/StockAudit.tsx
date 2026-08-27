import React, { useState, useEffect } from 'react';

const StockAudit = ({ user }: { user: any }) => {
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState('');
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    const fetchMags = async () => {
      const res = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
      if (res.success) setMagasins(res.data);
    };
    fetchMags();
  }, []);

  // ÉTAPE 1: EXPORTER LE MODÈLE D'INVENTAIRE
  const exportToCSV = async () => {
    if (!selectedMagasin) { alert('Sélectionnez un magasin'); return; }
    
    const res = await (window as any).electronAPI.dbQuery(`
      SELECT p.id, p.designation, p.unite, IFNULL(s.quantite, 0) as stock_theorique
      FROM products p
      LEFT JOIN stock s ON p.id = s.id_product AND s.id_magasin = ?
      ORDER BY p.designation
    `, [selectedMagasin]);

    if (res.success) {
      const header = "ID;DESIGNATION;UNITE;STOCK_THEORIQUE;STOCK_PHYSIQUE_SAISIR\n";
      const rows = res.data.map((r: any) => `${r.id};${r.designation};${r.unite};${r.stock_theorique};`).join("\n");
      const csvContent = "data:text/csv;charset=utf-8," + header + rows;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `inventaire_${selectedMagasin}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ÉTAPE 2: IMPORTER LE FICHIER REMPLI
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim() !== "");
      // On ignore l'entête
      const data = lines.slice(1).map(line => {
        const cols = line.split(";");
        const theo = parseFloat(cols[3] || "0");
        const phys = parseFloat(cols[4] || "0");
        return {
          id: cols[0],
          designation: cols[1],
          unite: cols[2],
          stock_theorique: theo,
          stock_physique: isNaN(phys) ? theo : phys,
          ecart: (isNaN(phys) ? theo : phys) - theo
        };
      });
      setInventoryData(data);
      setIsComparing(true);
    };
    reader.readAsText(file);
  };

  // ÉTAPE 3: VALIDER ET RÉGULARISER
  const validateInventory = async () => {
    if (!window.confirm('Voulez-vous mettre à jour le stock selon les relevés physiques ?')) return;

    // 1. Créer la session d'audit
    const resCount = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM audits');
    const nextSeq = (resCount.success && resCount.data[0]?.total ? resCount.data[0].total + 1 : 1);
    const auditNum = `AUD-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;
    
    const resAudit = await (window as any).electronAPI.dbQuery(
      'INSERT INTO audits (numero_audit, id_magasin) VALUES (?, ?)',
      [auditNum, selectedMagasin]
    );

    if (resAudit.success) {
      const auditId = resAudit.data.insertId || resAudit.data;

      for (const item of inventoryData) {
        if (item.ecart !== 0) {
          // Mise à jour du stock réel
          await (window as any).electronAPI.dbQuery(`
            INSERT INTO stock (id_product, id_magasin, quantite) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE quantite = ?
          `, [item.id, selectedMagasin, item.stock_physique, item.stock_physique]);

          // Enregistrement de l'ajustement dans le journal lié à l'audit
          await (window as any).electronAPI.dbQuery(`
            INSERT INTO stock_movements (id_product, id_magasin, type_mouvement, quantite, motif, id_audit, prix_unitaire, total_ligne)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [item.id, selectedMagasin, item.ecart > 0 ? 'ENTREE' : 'SORTIE', Math.abs(item.ecart), `INVENTAIRE ${auditNum}`, auditId, 0, 0]);
        }
      }

      alert(`Inventaire ${auditNum} validé et stocks mis à jour !`);
      setIsComparing(false);
      setInventoryData([]);
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3">
          <h5 className="mb-0 fw-bold text-uppercase">Audit et Contrôle d'Inventaire</h5>
        </div>
        <div className="card-body">
          {!isComparing ? (
            <div className="row align-items-end g-3">
              <div className="col-md-4">
                <label className="small fw-bold">1. Choisir le Dépôt à contrôler</label>
                <select className="form-select" value={selectedMagasin} onChange={e => setSelectedMagasin(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <button className="btn btn-primary w-100 fw-bold" onClick={exportToCSV} disabled={!selectedMagasin}>
                  📥 Exporter pour Saisie
                </button>
              </div>
              <div className="col-md-4">
                <label className="small fw-bold">2. Importer le fichier rempli</label>
                <input type="file" className="form-control" accept=".csv" onChange={handleFileUpload} disabled={!selectedMagasin} />
              </div>
            </div>
          ) : (
            <div>
              <div className="alert alert-info d-flex justify-content-between align-items-center shadow-sm border-0 mb-4">
                <span>Analyse des écarts en cours pour le dépôt sélectionné.</span>
                <div className="d-flex gap-2">
                  <button className="btn btn-success fw-bold" onClick={validateInventory}>✅ Valider & Régulariser le Stock</button>
                  <button className="btn btn-outline-secondary" onClick={() => setIsComparing(false)}>Annuler</button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light small text-uppercase">
                    <tr>
                      <th>Article</th>
                      <th className="text-center">Théorique (Logiciel)</th>
                      <th className="text-center">Physique (Saisi)</th>
                      <th className="text-center">Écart</th>
                      <th className="text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.map((item, i) => (
                      <tr key={i} className={item.ecart !== 0 ? 'table-warning' : ''}>
                        <td className="fw-bold">{item.designation}</td>
                        <td className="text-center">{item.stock_theorique} {item.unite}</td>
                        <td className="text-center fw-bold text-primary">{item.stock_physique} {item.unite}</td>
                        <td className={`text-center fw-bold ${item.ecart < 0 ? 'text-danger' : item.ecart > 0 ? 'text-success' : 'text-muted'}`}>
                          {item.ecart > 0 ? '+' : ''}{item.ecart}
                        </td>
                        <td className="text-center">
                          {item.ecart === 0 ? <span className="badge bg-success">Conforme</span> : 
                           item.ecart < 0 ? <span className="badge bg-danger">Manquant</span> : 
                           <span className="badge bg-primary">Surplus</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="card bg-light border-0">
        <div className="card-body small">
          <h6 className="fw-bold">💡 Comment faire l'inventaire ?</h6>
          <ol className="mb-0">
            <li>Sélectionnez le magasin et cliquez sur <b>Exporter</b>.</li>
            <li>Ouvrez le fichier avec Excel, remplissez la colonne <b>STOCK_PHYSIQUE_SAISIR</b>.</li>
            <li>Enregistrez le fichier au format CSV (séparateur point-virgule).</li>
            <li>Revenez ici et <b>Importez</b> le fichier pour voir les écarts avant de valider.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default StockAudit;
