import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const Pedagogy = () => {
  const { t } = useTranslation();
  const [classes, setClasses] = useState<any[]>([]);
  const [matieres, setMatieres] = useState<any[]>([]);
  const [professeurs, setProfesseurs] = useState<any[]>([]);
  
  const [classForm, setClassForm] = useState({ id: null as number | null, nom: '', niveau: '', frais_inscription: '0', frais_scolarite: '0' });
  const [matiereForm, setMatiereForm] = useState({ id: null as number | null, nom: '', coefficient: '1', id_professeur: '', id_classe: '' });

  const fetchData = async () => {
    const resC = await (window as any).electronAPI.dbQuery('SELECT * FROM classes ORDER BY nom');
    if (resC.success) setClasses(resC.data);

    const resP = await (window as any).electronAPI.dbQuery('SELECT * FROM professeurs ORDER BY nom');
    if (resP.success) setProfesseurs(resP.data);

    const resM = await (window as any).electronAPI.dbQuery(`
        SELECT m.*, c.nom as classe_nom, p.nom as prof_nom 
        FROM matieres m 
        LEFT JOIN classes c ON m.id_classe = c.id 
        LEFT JOIN professeurs p ON m.id_professeur = p.id 
        ORDER BY c.nom, m.nom
    `);
    if (resM.success) setMatieres(resM.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const params = [classForm.nom, classForm.niveau, parseFloat(classForm.frais_inscription), parseFloat(classForm.frais_scolarite)];
    if (classForm.id) {
        await (window as any).electronAPI.dbQuery('UPDATE classes SET nom=?, niveau=?, frais_inscription=?, frais_scolarite=? WHERE id=?', [...params, classForm.id]);
    } else {
        await (window as any).electronAPI.dbQuery('INSERT INTO classes (nom, niveau, frais_inscription, frais_scolarite) VALUES (?, ?, ?, ?)', params);
    }
    setClassForm({ id: null, nom: '', niveau: '', frais_inscription: '0', frais_scolarite: '0' });
    fetchData();
  };

  const handleSaveMatiere = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation : Vérifier si la matière existe déjà dans cette classe
    const checkRes = await (window as any).electronAPI.dbQuery(
        'SELECT id FROM matieres WHERE nom = ? AND id_classe = ?',
        [matiereForm.nom.trim(), matiereForm.id_classe]
    );

    if (checkRes.success && checkRes.data && checkRes.data.length > 0) {
        const existingId = checkRes.data[0].id;
        // Si on est en mode création ou si l'ID trouvé n'est pas celui qu'on modifie
        if (!matiereForm.id || existingId !== matiereForm.id) {
            alert(t('pedagogy.subject_exists_warning', 'Attention : La matière "{{subject}}" est déjà attribuée à cette classe.').replace('{{subject}}', matiereForm.nom));
            return;
        }
    }

    const params = [matiereForm.nom.trim(), parseInt(matiereForm.coefficient), matiereForm.id_professeur || null, matiereForm.id_classe || null];
    if (matiereForm.id) {
        await (window as any).electronAPI.dbQuery('UPDATE matieres SET nom=?, coefficient=?, id_professeur=?, id_classe=? WHERE id=?', [...params, matiereForm.id]);
    } else {
        await (window as any).electronAPI.dbQuery('INSERT INTO matieres (nom, coefficient, id_professeur, id_classe) VALUES (?, ?, ?, ?)', params);
    }
    setMatiereForm({ id: null, nom: '', coefficient: '1', id_professeur: '', id_classe: '' });
    fetchData();
  };

  const deleteItem = async (table: string, id: number) => {
    const confirmMsg = table === 'classes' ? t('pedagogy.delete_class_confirm') : t('pedagogy.delete_subj_confirm');
    if (window.confirm(confirmMsg)) {
        await (window as any).electronAPI.dbQuery(`DELETE FROM ${table} WHERE id = ?`, [id]);
        fetchData();
    }
  };

  return (
    <div className="row g-4">
      {/* SECTION CLASSES */}
      <div className="col-md-5">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-header bg-primary text-white py-3">
            <h5 className="mb-0 fw-bold">🏫 {t('pedagogy.tab_classes')}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveClass} className="bg-light p-3 rounded mb-4 border">
                <div className="row g-2">
                    <div className="col-7">
                        <input type="text" className="form-control form-control-sm" placeholder={t('pedagogy.table_class_name')} required value={classForm.nom} onChange={e => setClassForm({...classForm, nom: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="col-5">
                        <input type="text" className="form-control form-control-sm" placeholder="Niveau" value={classForm.niveau} onChange={e => setClassForm({...classForm, niveau: e.target.value})} />
                    </div>
                    <div className="col-6">
                        <label className="small fw-bold">{t('pedagogy.table_class_reg')}</label>
                        <input type="number" className="form-control form-control-sm" value={classForm.frais_inscription} onChange={e => setClassForm({...classForm, frais_inscription: e.target.value})} />
                    </div>
                    <div className="col-6">
                        <label className="small fw-bold">{t('pedagogy.table_class_fee')}</label>
                        <input type="number" className="form-control form-control-sm" value={classForm.frais_scolarite} onChange={e => setClassForm({...classForm, frais_scolarite: e.target.value})} />
                    </div>
                    <div className="col-12 mt-2">
                        <button type="submit" className="btn btn-primary btn-sm w-100 fw-bold">{classForm.id ? t('common.edit') : t('pedagogy.add_class')}</button>
                        {classForm.id && <button type="button" className="btn btn-link btn-sm w-100 mt-1" onClick={() => setClassForm({ id: null, nom: '', niveau: '', frais_inscription: '0', frais_scolarite: '0' })}>{t('common.cancel')}</button>}
                    </div>
                </div>
            </form>

            <div className="table-responsive" style={{ maxHeight: '400px' }}>
                <table className="table table-sm table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>{t('pedagogy.table_class_name')}</th>
                        <th>{t('pedagogy.table_class_reg')}</th>
                        <th>{t('pedagogy.table_class_fee')}</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                        {classes.map(c => (
                            <tr key={c.id}>
                                <td className="fw-bold">{c.nom} <small className="text-muted">({c.niveau})</small></td>
                                <td>{Math.round(c.frais_inscription).toLocaleString()}</td>
                                <td>{Math.round(c.frais_scolarite).toLocaleString()}</td>
                                <td className="text-end">
                                    <button className="btn btn-sm text-primary p-0 me-2" onClick={() => setClassForm({...c, frais_inscription: c.frais_inscription.toString(), frais_scolarite: c.frais_scolarite.toString()})}>✏️</button>
                                    <button className="btn btn-sm text-danger p-0" onClick={() => deleteItem('classes', c.id)}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION MATIÈRES */}
      <div className="col-md-7">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-header bg-success text-white py-3">
            <h5 className="mb-0 fw-bold">📖 {t('pedagogy.tab_subjects')}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveMatiere} className="bg-light p-3 rounded mb-4 border">
                <div className="row g-2">
                    <div className="col-6">
                        <input type="text" className="form-control form-control-sm" placeholder={t('pedagogy.table_subj_name')} required value={matiereForm.nom} onChange={e => setMatiereForm({...matiereForm, nom: e.target.value})} />
                    </div>
                    <div className="col-2">
                        <input type="number" className="form-control form-control-sm" placeholder="Coef" required value={matiereForm.coefficient} onChange={e => setMatiereForm({...matiereForm, coefficient: e.target.value})} />
                    </div>
                    <div className="col-4">
                        <select className="form-select form-select-sm" required value={matiereForm.id_classe} onChange={e => setMatiereForm({...matiereForm, id_classe: e.target.value})}>
                            <option value="">-- {t('pedagogy.table_class_name')} --</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                    </div>
                    <div className="col-8">
                        <select className="form-select form-select-sm" value={matiereForm.id_professeur} onChange={e => setMatiereForm({...matiereForm, id_professeur: e.target.value})}>
                            <option value="">-- {t('sidebar.teachers')} ({t('common.optional', 'Optionnel')}) --</option>
                            {professeurs.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
                        </select>
                    </div>
                    <div className="col-4">
                        <button type="submit" className="btn btn-success btn-sm w-100 fw-bold">{matiereForm.id ? t('common.edit') : t('pedagogy.add_subject')}</button>
                    </div>
                </div>
            </form>

            <div className="table-responsive" style={{ maxHeight: '400px' }}>
                <table className="table table-sm table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>{t('pedagogy.table_subj_name')}</th>
                        <th>{t('pedagogy.table_class_name')}</th>
                        <th>{t('pedagogy.table_subj_coeff')}</th>
                        <th>{t('sidebar.teachers')}</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                        {matieres.map(m => (
                            <tr key={m.id}>
                                <td className="fw-bold text-success">{m.nom}</td>
                                <td><span className="badge bg-info">{m.classe_nom}</span></td>
                                <td className="text-center">{m.coefficient}</td>
                                <td className="small">{m.prof_nom || '-'}</td>
                                <td className="text-end">
                                    <button className="btn btn-sm text-primary p-0 me-2" onClick={() => setMatiereForm({...m, id_professeur: m.id_professeur?.toString()||'', id_classe: m.id_classe?.toString()||'', coefficient: m.coefficient.toString()})}>✏️</button>
                                    <button className="btn btn-sm text-danger p-0" onClick={() => deleteItem('matieres', m.id)}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pedagogy;
