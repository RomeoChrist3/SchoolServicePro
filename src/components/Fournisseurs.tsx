import React, { useState, useEffect } from 'react';

const Fournisseurs = () => {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [form, setForm] = useState({ id: null, nom: '', telephone: '', email: '' });
  const [search, setSearch] = useState('');

  const fetchFournisseurs = async () => {
    const res = await (window as any).electronAPI.dbQuery('SELECT * FROM fournisseurs ORDER BY nom');
    if (res.success) setFournisseurs(res.data);
  };

  useEffect(() => { fetchFournisseurs(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let sql = '';
    let params = [form.nom, form.telephone, form.email];

    if (form.id) {
      sql = 'UPDATE fournisseurs SET nom=?, telephone=?, email=? WHERE id=?';
      params.push(form.id);
    } else {
      sql = 'INSERT INTO fournisseurs (nom, telephone, email) VALUES (?, ?, ?)';
    }

    const res = await (window as any).electronAPI.dbQuery(sql, params);
    if (res.success) {
      setForm({ id: null, nom: '', telephone: '', email: '' });
      fetchFournisseurs();
    }
  };

  const handleEdit = (f: any) => setForm(f);

  const handleDelete = async (id: number) => {
    if (window.confirm('Supprimer ce fournisseur ?')) {
      await (window as any).electronAPI.dbQuery('DELETE FROM fournisseurs WHERE id = ?', [id]);
      fetchFournisseurs();
    }
  };

  const filtered = fournisseurs.filter(f => f.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white fw-bold">🚚 {form.id ? 'Modifier' : 'Nouveau'} Fournisseur</div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-2">
                <label className="small fw-bold">Nom Entreprise</label>
                <input type="text" className="form-control" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
              </div>
              <div className="mb-2">
                <label className="small fw-bold">Téléphone</label>
                <input type="text" className="form-control" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} />
              </div>
              <div className="mb-3">
                <label className="small fw-bold">Email</label>
                <input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-dark w-100">{form.id ? 'Mettre à jour' : 'Enregistrer'}</button>
              {form.id && <button type="button" className="btn btn-link w-100 mt-2 text-muted" onClick={() => setForm({id:null, nom:'', telephone:'', email:''})}>Annuler</button>}
            </form>
          </div>
        </div>
      </div>
      <div className="col-md-8">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white">
            <input type="text" className="form-control" placeholder="🔍 Rechercher un fournisseur..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nom / Société</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id}>
                    <td className="fw-bold">{f.nom}</td>
                    <td>{f.telephone}</td>
                    <td>{f.email}</td>
                    <td className="text-end">
                      <button className="btn btn-sm text-primary" onClick={() => handleEdit(f)}>✏️</button>
                      <button className="btn btn-sm text-danger" onClick={() => handleDelete(f.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Fournisseurs;
