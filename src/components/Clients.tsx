import React, { useState, useEffect } from 'react';

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({ id: null, nom: '', telephone: '', email: '', adresse: '' });
  const [search, setSearch] = useState('');

  const fetchClients = async () => {
    const res = await (window as any).electronAPI.dbQuery('SELECT * FROM clients ORDER BY nom');
    if (res.success) setClients(res.data);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let sql = '';
    let params = [form.nom, form.telephone, form.email, form.adresse];

    if (form.id) {
      sql = 'UPDATE clients SET nom=?, telephone=?, email=?, adresse=? WHERE id=?';
      params.push(form.id);
    } else {
      sql = 'INSERT INTO clients (nom, telephone, email, adresse) VALUES (?, ?, ?, ?)';
    }

    const res = await (window as any).electronAPI.dbQuery(sql, params);
    if (res.success) {
      setForm({ id: null, nom: '', telephone: '', email: '', adresse: '' });
      fetchClients();
    }
  };

  const handleEdit = (c: any) => setForm(c);

  const handleDelete = async (id: number) => {
    if (window.confirm('Supprimer ce client ?')) {
      await (window as any).electronAPI.dbQuery('DELETE FROM clients WHERE id = ?', [id]);
      fetchClients();
    }
  };

  const filtered = clients.filter(c => c.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white fw-bold">👤 {form.id ? 'Modifier' : 'Nouveau'} Client</div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-2">
                <label className="small fw-bold">Nom Complet</label>
                <input type="text" className="form-control" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
              </div>
              <div className="mb-2">
                <label className="small fw-bold">Téléphone</label>
                <input type="text" className="form-control" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} />
              </div>
              <div className="mb-2">
                <label className="small fw-bold">Email</label>
                <input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="mb-3">
                <label className="small fw-bold">Adresse</label>
                <textarea className="form-control" rows={2} value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})}></textarea>
              </div>
              <button type="submit" className="btn btn-primary w-100">{form.id ? 'Mettre à jour' : 'Enregistrer'}</button>
              {form.id && <button type="button" className="btn btn-link w-100 mt-2 text-muted" onClick={() => setForm({id:null, nom:'', telephone:'', email:'', adresse:''})}>Annuler</button>}
            </form>
          </div>
        </div>
      </div>
      <div className="col-md-8">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white">
            <input type="text" className="form-control" placeholder="🔍 Rechercher un client..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nom</th>
                  <th>Contact</th>
                  <th>Adresse</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="fw-bold">{c.nom}</td>
                    <td className="small">{c.telephone}<br/>{c.email}</td>
                    <td className="small">{c.adresse}</td>
                    <td className="text-end">
                      <button className="btn btn-sm text-primary" onClick={() => handleEdit(c)}>✏️</button>
                      <button className="btn btn-sm text-danger" onClick={() => handleDelete(c.id)}>🗑️</button>
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

export default Clients;
