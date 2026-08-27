import React, { useState, useEffect } from 'react';

const Categories = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchCategories = async () => {
    const result = await (window as any).electronAPI.dbQuery('SELECT * FROM categories ORDER BY nom');
    if (result.success) setCategories(result.data);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    if (editingId) {
      const result = await (window as any).electronAPI.dbQuery('UPDATE categories SET nom = ? WHERE id = ?', [newCategory, editingId]);
      if (result.success) {
        setEditingId(null);
        setNewCategory('');
      }
    } else {
      const result = await (window as any).electronAPI.dbQuery('INSERT INTO categories (nom) VALUES (?)', [newCategory]);
      if (result.success) setNewCategory('');
    }
    fetchCategories();
  };

  const handleEdit = (cat: any) => {
    setEditingId(cat.id);
    setNewCategory(cat.nom);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Voulez-vous supprimer cette catégorie ? Cela ne supprimera pas les produits associés.')) {
      const result = await (window as any).electronAPI.dbQuery('DELETE FROM categories WHERE id = ?', [id]);
      if (result.success) fetchCategories();
    }
  };

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-header bg-white py-3">
        <h5 className="mb-0 fw-bold">📁 Catégories</h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSave} className="d-flex gap-2 mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Nom..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button type="submit" className={`btn ${editingId ? 'btn-warning' : 'btn-primary'}`}>
            {editingId ? 'OK' : 'Ajouter'}
          </button>
        </form>
        <div className="list-group">
          {categories.map((cat) => (
            <div key={cat.id} className="list-group-item d-flex justify-content-between align-items-center">
              {cat.nom}
              <div className="btn-group">
                <button className="btn btn-sm text-primary" onClick={() => handleEdit(cat)}>✏️</button>
                <button className="btn btn-sm text-danger" onClick={() => handleDelete(cat.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Categories;
