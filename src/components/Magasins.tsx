import React, { useState, useEffect } from 'react';

const Magasins = () => {
  const [magasins, setMagasins] = useState<any[]>([]);
  const [formData, setFormData] = useState({ nom: '', lieu: '' });

  const fetchMagasins = async () => {
    const res = await (window as any).electronAPI.dbQuery('SELECT * FROM magasins ORDER BY nom');
    if (res.success) setMagasins(res.data);
  };

  useEffect(() => { fetchMagasins(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim()) return;
    const result = await (window as any).electronAPI.dbQuery('INSERT INTO magasins (nom, lieu) VALUES (?, ?)', [formData.nom, formData.lieu]);
    if (result.success) {
      setFormData({ nom: '', lieu: '' });
      fetchMagasins();
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Supprimer ce magasin ?')) {
      await (window as any).electronAPI.dbQuery('DELETE FROM magasins WHERE id = ?', [id]);
      fetchMagasins();
    }
  };

  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0 fw-bold">🏠 Nouveau Magasin</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="form-label small fw-bold">Nom du Dépôt</label>
                <input type="text" className="form-control" placeholder="ex: Dépôt Central" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} required />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold">Localisation / Ville</label>
                <input type="text" className="form-control" placeholder="ex: Yaoundé, Quartier..." value={formData.lieu} onChange={e => setFormData({...formData, lieu: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary w-100">Créer le Magasin</button>
            </form>
          </div>
        </div>
      </div>
      <div className="col-md-8">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0 fw-bold">Liste des Lieux de Stockage</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Nom</th>
                    <th>Lieu</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {magasins.map(m => (
                    <tr key={m.id}>
                      <td className="fw-bold">{m.nom}</td>
                      <td>{m.lieu}</td>
                      <td className="text-end">
                        <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(m.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {magasins.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-4">Aucun magasin créé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Magasins;
