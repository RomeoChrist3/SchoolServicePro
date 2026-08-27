import React, { useState, useEffect } from 'react';

const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [imageFile, setImageFile] = useState<{ fileName: string, base64Data: string } | null>(null);

  const [formData, setFormData] = useState({
    code_barre: '',
    designation: '',
    id_categorie: '',
    prix_achat: '',
    prix_revient: '',
    prix_vente: '',
    unite: 'Pcs',
    stock_alerte: '5',
    tva_taux: '0',
    precompte_taux: '0',
    image_path: ''
  });

  const fetchData = async () => {
    try {
        const url = await (window as any).electronAPI.mediaGetBaseUrl();
        setBaseUrl(url);

        const cats = await (window as any).electronAPI.dbQuery('SELECT * FROM categories ORDER BY nom');
        if (cats.success) setCategories(cats.data);
        
        const prods = await (window as any).electronAPI.dbQuery('SELECT p.*, c.nom as cat_nom FROM products p LEFT JOIN categories c ON p.id_categorie = c.id ORDER BY designation');
        if (prods.success) {
            const cleanedProds = prods.data.map((p: any) => ({
                ...p,
                prix_vente: Math.round(parseFloat(p.prix_vente) || 0),
                prix_achat: Math.round(parseFloat(p.prix_achat) || 0),
                prix_revient: Math.round(parseFloat(p.prix_revient) || 0),
                stock_alerte: parseFloat(p.stock_alerte) || 0
            }));
            setProducts(cleanedProds);
        }
    } catch (err) {
        console.error("Erreur chargement catalogue:", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        const fileName = `prod_${Date.now()}_${file.name}`;
        setImageFile({ fileName, base64Data });
        setFormData({ ...formData, image_path: fileName });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalImagePath = formData.image_path;
    if (imageFile) {
      const resMedia = await (window as any).electronAPI.mediaSave(imageFile);
      if (resMedia.success) {
        finalImagePath = resMedia.fileName;
      }
    }

    const params = [
        formData.code_barre, formData.designation, formData.id_categorie || null, 
        Math.round(parseFloat(formData.prix_achat) || 0), 
        Math.round(parseFloat(formData.prix_revient) || 0), 
        Math.round(parseFloat(formData.prix_vente) || 0), 
        formData.unite, 
        parseFloat(formData.stock_alerte) || 5, 
        parseFloat(formData.tva_taux) || 0, 
        parseFloat(formData.precompte_taux) || 0,
        finalImagePath
    ];

    if (editingId) {
      const sql = `UPDATE products SET code_barre=?, designation=?, id_categorie=?, prix_achat=?, prix_revient=?, prix_vente=?, unite=?, stock_alerte=?, tva_taux=?, precompte_taux=?, image_path=? WHERE id=?`;
      const result = await (window as any).electronAPI.dbQuery(sql, [...params, editingId]);
      if (result.success) closeModal();
    } else {
      const sql = `INSERT INTO products (code_barre, designation, id_categorie, prix_achat, prix_revient, prix_vente, unite, stock_alerte, tva_taux, precompte_taux, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const result = await (window as any).electronAPI.dbQuery(sql, params);
      if (result.success) closeModal();
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Voulez-vous vraiment supprimer cet article ?')) {
      const result = await (window as any).electronAPI.dbQuery('DELETE FROM products WHERE id = ?', [id]);
      if (result.success) fetchData();
    }
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      code_barre: p.code_barre || '',
      designation: p.designation || '',
      id_categorie: p.id_categorie || '',
      prix_achat: Math.round(p.prix_achat || 0).toString(),
      prix_revient: Math.round(p.prix_revient || 0).toString(),
      prix_vente: Math.round(p.prix_vente || 0).toString(),
      unite: p.unite || 'Pcs',
      stock_alerte: (p.stock_alerte || 5).toString(),
      tva_taux: (p.tva_taux || 0).toString(),
      precompte_taux: (p.precompte_taux || 0).toString(),
      image_path: p.image_path || ''
    });
    setImageFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setImageFile(null);
    setFormData({ 
      code_barre: '', designation: '', id_categorie: '', prix_achat: '', 
      prix_revient: '', prix_vente: '', unite: 'Pcs', stock_alerte: '5',
      tva_taux: '0', precompte_taux: '0', image_path: '' 
    });
  };

  const exportToCSV = () => {
    if (products.length === 0) return;
    const headers = ['CodeBarre', 'Designation', 'Categorie', 'PA', 'PR', 'PV', 'Unite', 'StockAlerte'];
    const rows = products.map(p => [
      p.code_barre || '',
      p.designation || '',
      p.cat_nom || '',
      Math.round(p.prix_achat || 0),
      Math.round(p.prix_revient || 0),
      Math.round(p.prix_vente || 0),
      p.unite || 'Pcs',
      p.stock_alerte || 5
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Catalogue_Articles_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    link.click();
  };

  const importFromCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
          const text = event.target?.result as string;
          const lines = text.split('\n');
          const data = lines.slice(1).filter(l => l.trim() !== '');

          let created = 0;
          let updated = 0;

          for (const line of data) {
            const columns = line.split(';');
            if (columns.length < 6) continue;

            const [code, designation, catName, pa, pr, pv, unite, alerte] = columns.map(c => c?.trim() || '');

            let catId = null;
            if (catName) {
              const resCat = await (window as any).electronAPI.dbQuery('SELECT id FROM categories WHERE nom = ?', [catName]);
              if (resCat.success && resCat.data.length > 0) {
                catId = resCat.data[0].id;
              } else {
                const insCat = await (window as any).electronAPI.dbQuery('INSERT INTO categories (nom) VALUES (?)', [catName]);
                catId = insCat.data.insertId || insCat.data;
              }
            }

            const checkProd = await (window as any).electronAPI.dbQuery('SELECT id FROM products WHERE designation = ?', [designation]);
            
            const pParams = [
                code || null, catId, 
                Math.round(parseFloat(pa.replace(',', '.')) || 0), 
                Math.round(parseFloat(pr.replace(',', '.')) || 0), 
                Math.round(parseFloat(pv.replace(',', '.')) || 0), 
                unite||'Pcs', parseFloat(alerte)||5
            ];

            if (checkProd.success && checkProd.data.length > 0) {
              await (window as any).electronAPI.dbQuery(
                'UPDATE products SET code_barre=?, id_categorie=?, prix_achat=?, prix_revient=?, prix_vente=?, unite=?, stock_alerte=? WHERE id=?',
                [...pParams, checkProd.data[0].id]
              );
              updated++;
            } else {
              await (window as any).electronAPI.dbQuery(
                'INSERT INTO products (code_barre, id_categorie, prix_achat, prix_revient, prix_vente, unite, stock_alerte, designation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [...pParams, designation]
              );
              created++;
            }
          }
          alert(`Import terminé !\nCréés : ${created}\nMises à jour : ${updated}`);
          fetchData();
      } catch (err) {
          alert("Erreur lors de la lecture du fichier CSV. Vérifiez le format (Séparateur point-virgule).");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredProducts = products.filter(p => 
    (p.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.code_barre && p.code_barre.includes(searchTerm))
  );

  const displayedProducts = filteredProducts.slice(0, 100);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center d-print-none">
        <div className="d-flex align-items-center gap-3 flex-grow-1">
            <h5 className="mb-0 fw-bold text-primary text-nowrap">📦 Catalogue</h5>
            <input 
                type="text" 
                className="form-control form-control-sm border-primary" 
                style={{ maxWidth: '300px' }}
                placeholder="🔍 Rechercher un article..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
            />
            <small className="text-muted text-nowrap">
                {filteredProducts.length} articles {filteredProducts.length > 100 && `(100 affichés)`}
            </small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success btn-sm fw-bold" onClick={exportToCSV}>📤 Export</button>
          <label className="btn btn-outline-primary btn-sm fw-bold mb-0">
            📥 Import
            <input type="file" hidden accept=".csv" onChange={importFromCSV} />
          </label>
          <button className="btn btn-primary btn-sm fw-bold" onClick={() => setShowModal(true)}>+ Ajouter</button>
        </div>
      </div>
      
      <div className="card-body p-0 d-print-none">
        <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 250px)' }}>
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light sticky-top">
              <tr>
                <th style={{ width: '60px' }}>Image</th>
                <th>Désignation</th>
                <th>Catégorie</th>
                <th className="text-center">Alerte</th>
                <th>P. Vente</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedProducts.map((p) => (
                <tr key={p.id}>
                  <td className="ps-3">
                    {p.image_path ? (
                      <img src={`${baseUrl}${p.image_path}`} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                      <div className="bg-light d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', borderRadius: '4px', fontSize: '20px' }}>📦</div>
                    )}
                  </td>
                  <td>
                    <div className="fw-bold">{p.designation || 'Sans nom'}</div>
                    <small className="text-muted">{p.code_barre || 'Sans code'}</small>
                  </td>
                  <td><span className="badge bg-light text-dark border">{p.cat_nom || 'Général'}</span></td>
                  <td className="text-center"><span className="badge bg-warning text-dark">{p.stock_alerte || 0}</span></td>
                  <td className="fw-bold text-primary">{(p.prix_vente || 0).toLocaleString()} <small>FCFA</small></td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-light border me-1" onClick={() => openEdit(p)}>✏️</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && <tr><td colSpan={6} className="text-center py-5 text-muted">Aucun produit trouvé.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white border-0">
                <h5 className="modal-title fw-bold">{editingId ? 'Modifier l\'Article' : 'Ajouter un Nouvel Article'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-4 text-center">
                        <div className="border rounded p-2 mb-2 bg-light d-flex align-items-center justify-content-center" style={{ height: '180px' }}>
                            {imageFile ? (
                                <img src={`data:image/png;base64,${imageFile.base64Data}`} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                            ) : formData.image_path ? (
                                <img src={`${baseUrl}${formData.image_path}`} alt="Product" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                            ) : (
                                <span className="text-muted">Aucune Image</span>
                            )}
                        </div>
                        <label className="btn btn-sm btn-outline-secondary w-100">
                            📷 Choisir Image
                            <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                        </label>
                    </div>
                    <div className="col-md-8">
                        <div className="row g-3">
                            <div className="col-md-12">
                                <label className="form-label small fw-bold">Désignation du Produit</label>
                                <input type="text" className="form-control" required value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold">Code Barre</label>
                                <input type="text" className="form-control" value={formData.code_barre} onChange={(e) => setFormData({...formData, code_barre: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold">Catégorie</label>
                                <select className="form-select" required value={formData.id_categorie} onChange={(e) => setFormData({...formData, id_categorie: e.target.value})}>
                                    <option value="">Sélectionner...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label small fw-bold">Unité</label>
                      <input type="text" className="form-control" value={formData.unite} onChange={(e) => setFormData({...formData, unite: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-warning">Seuil d'Alerte</label>
                      <input type="number" className="form-control border-warning" value={formData.stock_alerte} onChange={(e) => setFormData({...formData, stock_alerte: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Prix d'Achat</label>
                      <input type="number" className="form-control bg-light" value={formData.prix_achat} onChange={(e) => setFormData({...formData, prix_achat: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold text-muted">Prix de Revient</label>
                      <input type="number" className="form-control bg-light" value={formData.prix_revient} onChange={(e) => setFormData({...formData, prix_revient: e.target.value})} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-success">Prix de Vente (HT)</label>
                      <input type="number" className="form-control border-success fw-bold" required value={formData.prix_vente} onChange={(e) => setFormData({...formData, prix_vente: e.target.value})} />
                    </div>

                    <div className="col-md-4">
                      <div className="p-2 bg-light rounded border">
                        <label className="form-label small fw-bold text-success">Taux TVA (%)</label>
                        <input type="number" step="0.1" className="form-control" value={formData.tva_taux} onChange={(e) => setFormData({...formData, tva_taux: e.target.value})} />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="p-2 bg-light rounded border">
                        <label className="form-label small fw-bold text-info">Précompte (%)</label>
                        <input type="number" step="0.1" className="form-control" value={formData.precompte_taux} onChange={(e) => setFormData({...formData, precompte_taux: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light" onClick={closeModal}>Annuler</button>
                  <button type="submit" className="btn btn-primary px-4 shadow-sm">{editingId ? 'Mettre à jour' : 'Enregistrer le Produit'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
