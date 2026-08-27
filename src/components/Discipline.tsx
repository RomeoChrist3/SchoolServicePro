import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface DisciplineProps {
  anneeScolaire: string;
}

const Discipline: React.FC<DisciplineProps> = ({ anneeScolaire }) => {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState<'absences' | 'sanctions' | 'bilan'>('absences');
    const [students, setStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClasse, setSelectedClasse] = useState('');
    const [selectedClasseSanc, setSelectedClasseSanc] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedStudentInfo, setSelectedStudentInfo] = useState<any>(null);
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [editingAbsence, setEditingAbsence] = useState<any>(null);
    const [editingSanction, setEditingSanction] = useState<any>(null);

    // Form states
    const [absenceData, setAbsenceData] = useState({
        id_etudiant: '',
        date_absence: new Date().toISOString().split('T')[0],
        heures: 1,
        type_absence: 'ABSENCE',
        justifie: 0,
        motif: '',
        periode: 'Trimestre 1'
    });

    const [sanctionData, setSanctionData] = useState({
        id_etudiant: '',
        type_sanction: 'AVERTISSEMENT',
        date_sanction: new Date().toISOString().split('T')[0],
        date_fin: '',
        motif: '',
        punition: ''
    });

    const [history, setHistory] = useState<{absences: any[], sanctions: any[]}>({ absences: [], sanctions: [] });
    const [recentAbsences, setRecentAbsences] = useState<any[]>([]);
    const [recentSanctions, setRecentSanctions] = useState<any[]>([]);

    const fetchData = async () => {
        if (!(window as any).electronAPI) return;
        const resClasses = await (window as any).electronAPI.dbQuery('SELECT * FROM classes ORDER BY nom');
        if (resClasses.success) setClasses(resClasses.data || []);

        const resStudents = await (window as any).electronAPI.dbQuery('SELECT id, nom, prenom, id_classe, matricule FROM etudiants WHERE statut = "actif" ORDER BY nom');
        if (resStudents.success) setStudents(resStudents.data || []);

        const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
        
        loadRecentData();
        setLoading(false);
    };

    const loadRecentData = async () => {
        const resAbs = await (window as any).electronAPI.dbQuery(`
            SELECT a.*, e.nom as student_nom, e.prenom as student_prenom 
            FROM absences a 
            JOIN etudiants e ON a.id_etudiant = e.id 
            WHERE a.annee_scolaire = ?
            ORDER BY a.date_creation DESC LIMIT 15
        `, [anneeScolaire]);
        if (resAbs.success) setRecentAbsences(resAbs.data || []);

        const resSanc = await (window as any).electronAPI.dbQuery(`
            SELECT s.*, e.nom as student_nom, e.prenom as student_prenom 
            FROM sanctions s 
            JOIN etudiants e ON s.id_etudiant = e.id 
            ORDER BY s.date_creation DESC LIMIT 15
        `);
        if (resSanc.success) setRecentSanctions(resSanc.data || []);
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        loadRecentData();
    }, [anneeScolaire]);

    const handleSaveAbsence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!absenceData.id_etudiant) return alert(t('discipline.select_student_alert', 'Sélectionnez un étudiant'));
        
        let res;
        if (editingAbsence) {
            res = await (window as any).electronAPI.dbQuery(
                'UPDATE absences SET id_etudiant = ?, date_absence = ?, heures = ?, type_absence = ?, justifie = ?, motif = ?, periode = ?, annee_scolaire = ? WHERE id = ?',
                [absenceData.id_etudiant, absenceData.date_absence, absenceData.heures, absenceData.type_absence, absenceData.justifie, absenceData.motif, absenceData.periode, anneeScolaire, editingAbsence.id]
            );
        } else {
            res = await (window as any).electronAPI.dbQuery(
                'INSERT INTO absences (id_etudiant, date_absence, heures, type_absence, justifie, motif, periode, annee_scolaire) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [absenceData.id_etudiant, absenceData.date_absence, absenceData.heures, absenceData.type_absence, absenceData.justifie, absenceData.motif, absenceData.periode, anneeScolaire]
            );
        }

        if (res.success) {
            alert(editingAbsence ? 'Absence modifiée !' : 'Absence enregistrée !');
            setAbsenceData({...absenceData, id_etudiant: '', motif: ''});
            setEditingAbsence(null);
            loadRecentData();
            if (activeSubTab === 'bilan' && absenceData.id_etudiant === selectedStudentId) loadStudentHistory(absenceData.id_etudiant);
        }
    };

    const handleSaveSanction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sanctionData.id_etudiant) return alert(t('discipline.select_student_alert', 'Sélectionnez un étudiant'));

        let res;
        if (editingSanction) {
            res = await (window as any).electronAPI.dbQuery(
                'UPDATE sanctions SET id_etudiant = ?, type_sanction = ?, date_sanction = ?, date_fin = ?, motif = ?, punition = ? WHERE id = ?',
                [sanctionData.id_etudiant, sanctionData.type_sanction, sanctionData.date_sanction, sanctionData.date_fin || null, sanctionData.motif, sanctionData.punition, editingSanction.id]
            );
        } else {
            res = await (window as any).electronAPI.dbQuery(
                'INSERT INTO sanctions (id_etudiant, type_sanction, date_sanction, date_fin, motif, punition) VALUES (?, ?, ?, ?, ?, ?)',
                [sanctionData.id_etudiant, sanctionData.type_sanction, sanctionData.date_sanction, sanctionData.date_fin || null, sanctionData.motif, sanctionData.punition]
            );
        }

        if (res.success) {
            alert(editingSanction ? 'Sanction modifiée !' : 'Sanction enregistrée !');
            setSanctionData({...sanctionData, id_etudiant: '', motif: '', punition: ''});
            setEditingSanction(null);
            loadRecentData();
            if (activeSubTab === 'bilan' && sanctionData.id_etudiant === selectedStudentId) loadStudentHistory(sanctionData.id_etudiant);
        }
    };

    const startEditAbsence = (a: any) => {
        setEditingAbsence(a);
        setAbsenceData({
            id_etudiant: a.id_etudiant.toString(),
            date_absence: new Date(a.date_absence).toISOString().split('T')[0],
            heures: a.heures,
            type_absence: a.type_absence,
            justifie: a.justifie,
            motif: a.motif || '',
            periode: a.periode || 'Trimestre 1'
        });
        setActiveSubTab('absences');
    };

    const startEditSanction = (s: any) => {
        setEditingSanction(s);
        setSanctionData({
            id_etudiant: s.id_etudiant.toString(),
            type_sanction: s.type_sanction,
            date_sanction: new Date(s.date_sanction).toISOString().split('T')[0],
            date_fin: s.date_fin ? new Date(s.date_fin).toISOString().split('T')[0] : '',
            motif: s.motif || '',
            punition: s.punition || ''
        });
        setActiveSubTab('sanctions');
    };

    const deleteEntry = async (type: 'absence' | 'sanction', id: number) => {
        if (!confirm(t('discipline.delete_confirm', 'Voulez-vous vraiment supprimer cette entrée ?'))) return;
        const table = type === 'absence' ? 'absences' : 'sanctions';
        const res = await (window as any).electronAPI.dbQuery(`DELETE FROM ${table} WHERE id = ?`, [id]);
        if (res.success) {
            alert('Supprimé !');
            loadRecentData();
            if (activeSubTab === 'bilan' && selectedStudentId) loadStudentHistory(selectedStudentId);
        }
    };

    const loadStudentHistory = async (id: string) => {
        if (!id) {
            setSelectedStudentId('');
            setSelectedStudentInfo(null);
            setHistory({ absences: [], sanctions: [] });
            return;
        }
        setSelectedStudentId(id);
        
        // Fetch student info with class name
        const resInfo = await (window as any).electronAPI.dbQuery(`
            SELECT e.*, c.nom as classe_nom 
            FROM etudiants e 
            LEFT JOIN classes c ON e.id_classe = c.id 
            WHERE e.id = ?`, [id]);
        if (resInfo.success && resInfo.data.length > 0) setSelectedStudentInfo(resInfo.data[0]);

        const resAbs = await (window as any).electronAPI.dbQuery('SELECT * FROM absences WHERE id_etudiant = ? AND annee_scolaire = ? ORDER BY date_absence DESC', [id, anneeScolaire]);
        const resSanc = await (window as any).electronAPI.dbQuery('SELECT * FROM sanctions WHERE id_etudiant = ? ORDER BY date_sanction DESC', [id]);
        setHistory({
            absences: resAbs.success ? resAbs.data : [],
            sanctions: resSanc.success ? resSanc.data : []
        });
    };

    const filteredStudents = selectedClasse 
        ? students.filter(s => s.id_classe.toString() === selectedClasse)
        : students;

    const filteredStudentsSanc = selectedClasseSanc 
        ? students.filter(s => s.id_classe.toString() === selectedClasseSanc)
        : students;

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <div className="card shadow-sm border-0 animate__animated animate__fadeIn">
            <div className="card-header bg-white py-3 border-0">
                <div className="btn-group w-100 shadow-sm rounded-pill p-1 bg-light">
                    <button className={`btn rounded-pill fw-bold ${activeSubTab === 'absences' ? 'btn-success text-white' : 'btn-light'}`} onClick={() => setActiveSubTab('absences')}>📊 {t('discipline.tab_history').replace('📜 ', '')}</button>
                    <button className={`btn rounded-pill fw-bold ${activeSubTab === 'sanctions' ? 'btn-success text-white' : 'btn-light'}`} onClick={() => setActiveSubTab('sanctions')}>⚖️ {t('discipline.tab_add').replace('⚖️ ', '')}</button>
                    <button className={`btn rounded-pill fw-bold ${activeSubTab === 'bilan' ? 'btn-success text-white' : 'btn-light'}`} onClick={() => setActiveSubTab('bilan')}>📜 {t('discipline.title').toUpperCase()}</button>
                </div>
            </div>

            <div className="card-body p-4">
                {activeSubTab === 'absences' && (
                    <div className="row g-4">
                        <div className="col-md-5">
                            <div className="p-4 bg-light rounded-4 border">
                                <h5 className="fw-bold mb-4 text-success">{t('discipline.tab_history')}</h5>
                                <form onSubmit={handleSaveAbsence}>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">{t('students.table_class')}</label>
                                        <select className="form-select border-0 shadow-sm" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
                                            <option value="">{t('students.all_classes')}</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">{t('discipline.form_student')}</label>
                                        <select className="form-select border-0 shadow-sm" required value={absenceData.id_etudiant} onChange={e => setAbsenceData({...absenceData, id_etudiant: e.target.value})}>
                                            <option value="">-- {t('discipline.form_student_placeholder')} --</option>
                                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.nom} {s.prenom} ({s.matricule})</option>)}
                                        </select>
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">{t('discipline.form_date')}</label>
                                            <input type="date" className="form-control border-0 shadow-sm" value={absenceData.date_absence} onChange={e => setAbsenceData({...absenceData, date_absence: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Durée (Heures)</label>
                                            <input type="number" className="form-control border-0 shadow-sm" value={absenceData.heures} onChange={e => setAbsenceData({...absenceData, heures: parseInt(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Type</label>
                                            <select className="form-select border-0 shadow-sm" value={absenceData.type_absence} onChange={e => setAbsenceData({...absenceData, type_absence: e.target.value})}>
                                                <option value="ABSENCE">{t('discipline.form_incident_abs')}</option>
                                                <option value="RETARD">{t('discipline.form_incident_late')}</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">{t('grades.select_period')}</label>
                                            <select className="form-select border-0 shadow-sm" value={absenceData.periode} onChange={e => setAbsenceData({...absenceData, periode: e.target.value})}>
                                                <option value="Trimestre 1">{t('grades.period_1')}</option>
                                                <option value="Trimestre 2">{t('grades.period_2')}</option>
                                                <option value="Trimestre 3">{t('grades.period_3')}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Justifiée ?</label>
                                        <select className="form-select border-0 shadow-sm" value={absenceData.justifie} onChange={e => setAbsenceData({...absenceData, justifie: parseInt(e.target.value)})}>
                                            <option value={0}>{t('common.no', 'Non')}</option>
                                            <option value={1}>{t('common.yes', 'Oui')}</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Motif</label>
                                        <textarea className="form-control border-0 shadow-sm" rows={2} value={absenceData.motif} onChange={e => setAbsenceData({...absenceData, motif: e.target.value})}></textarea>
                                    </div>
                                    <button type="submit" className={`btn ${editingAbsence ? 'btn-warning' : 'btn-success'} w-100 fw-bold py-3 shadow-sm rounded-3`}>
                                        {editingAbsence ? '💾 MODIFIER L\'ABSENCE' : '📥 ENREGISTRER L\'ABSENCE'}
                                    </button>
                                    {editingAbsence && <button type="button" className="btn btn-link w-100 mt-2 text-muted" onClick={() => { setEditingAbsence(null); setAbsenceData({...absenceData, id_etudiant: '', motif: ''}); }}>Annuler la modification</button>}
                                </form>
                            </div>
                        </div>
                        <div className="col-md-7">
                            <h6 className="fw-bold mb-3">Dernières saisies (Absences)</h6>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle small">
                                    <thead className="table-light">
                                        <tr>
                                            <th>{t('discipline.form_date')}</th>
                                            <th>{t('discipline.form_student')}</th>
                                            <th>Type</th>
                                            <th className="text-center">Heures</th>
                                            <th>{t('students.table_status')}</th>
                                            <th className="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentAbsences.map(a => (
                                            <tr key={a.id}>
                                                <td>{new Date(a.date_absence).toLocaleDateString()}</td>
                                                <td className="fw-bold">{a.student_nom} {a.student_prenom}</td>
                                                <td>{a.type_absence}</td>
                                                <td className="text-center">{a.heures}h</td>
                                                <td>{a.justifie ? <span className="badge bg-success">Justifiée</span> : <span className="badge bg-danger">Non justifiée</span>}</td>
                                                <td className="text-end">
                                                    <button className="btn btn-sm btn-outline-primary me-1 border-0" onClick={() => startEditAbsence(a)}>✏️</button>
                                                    <button className="btn btn-sm btn-outline-danger border-0" onClick={() => deleteEntry('absence', a.id)}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {recentAbsences.length === 0 && <tr className="text-muted italic"><td colSpan={6} className="text-center py-4">Aucune absence enregistrée récemment.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'sanctions' && (
                    <div className="row g-4">
                        <div className="col-md-5">
                            <div className="p-4 bg-light rounded-4 border">
                                <h5 className="fw-bold mb-4 text-danger">{t('discipline.tab_add')}</h5>
                                <form onSubmit={handleSaveSanction}>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">{t('grades.select_class')}</label>
                                        <select className="form-select border-0 shadow-sm" value={selectedClasseSanc} onChange={e => setSelectedClasseSanc(e.target.value)}>
                                            <option value="">{t('students.all_classes')}</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">{t('discipline.form_student')}</label>
                                        <select className="form-select border-0 shadow-sm" required value={sanctionData.id_etudiant} onChange={e => setSanctionData({...sanctionData, id_etudiant: e.target.value})}>
                                            <option value="">-- {t('discipline.form_student_placeholder')} --</option>
                                            {filteredStudentsSanc.map(s => <option key={s.id} value={s.id}>{s.nom} {s.prenom} ({s.matricule})</option>)}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">{t('discipline.form_incident')}</label>
                                        <select className="form-select border-0 shadow-sm" value={sanctionData.type_sanction} onChange={e => setSanctionData({...sanctionData, type_sanction: e.target.value})}>
                                            <option value="AVERTISSEMENT">{t('discipline.form_incident_warn')}</option>
                                            <option value="BLAME">Blâme de conduite</option>
                                            <option value="COLLE">Heures de colle</option>
                                            <option value="EXCLUSION_TEMP">{t('discipline.form_incident_excl_temp')}</option>
                                            <option value="EXCLUSION_DEF">{t('discipline.form_incident_excl_def')}</option>
                                        </select>
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Date de début</label>
                                            <input type="date" className="form-control border-0 shadow-sm" value={sanctionData.date_sanction} onChange={e => setSanctionData({...sanctionData, date_sanction: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Date de fin (Optionnel)</label>
                                            <input type="date" className="form-control border-0 shadow-sm" value={sanctionData.date_fin} onChange={e => setSanctionData({...sanctionData, date_fin: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Motif / Faute commise</label>
                                        <textarea className="form-control border-0 shadow-sm" rows={2} required value={sanctionData.motif} onChange={e => setSanctionData({...sanctionData, motif: e.target.value})}></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">{t('discipline.form_sanction')}</label>
                                        <textarea className="form-control border-0 shadow-sm" rows={2} value={sanctionData.punition} onChange={e => setSanctionData({...sanctionData, punition: e.target.value})}></textarea>
                                    </div>
                                    <button type="submit" className={`btn ${editingSanction ? 'btn-warning' : 'btn-danger'} w-100 fw-bold py-3 shadow-sm rounded-3 text-uppercase`}>
                                        {editingSanction ? '💾 MODIFIER LA SANCTION' : '⚖️ Enregistrer la Sanction'}
                                    </button>
                                    {editingSanction && <button type="button" className="btn btn-link w-100 mt-2 text-muted" onClick={() => { setEditingSanction(null); setSanctionData({...sanctionData, id_etudiant: '', motif: '', punition: ''}); }}>Annuler la modification</button>}
                                </form>
                            </div>
                        </div>
                        <div className="col-md-7">
                            <h6 className="fw-bold mb-3">Dernières Sanctions</h6>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle small">
                                    <thead className="table-light">
                                        <tr>
                                            <th>{t('discipline.form_date')}</th>
                                            <th>{t('discipline.form_student')}</th>
                                            <th>Sanction</th>
                                            <th>Motif</th>
                                            <th className="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentSanctions.map(s => (
                                            <tr key={s.id}>
                                                <td>{new Date(s.date_sanction).toLocaleDateString()}</td>
                                                <td className="fw-bold">{s.student_nom} {s.student_prenom}</td>
                                                <td><span className="badge bg-danger">{s.type_sanction}</span></td>
                                                <td className="text-truncate" style={{maxWidth: '150px'}}>{s.motif}</td>
                                                <td className="text-end">
                                                    <button className="btn btn-sm btn-outline-primary me-1 border-0" onClick={() => startEditSanction(s)}>✏️</button>
                                                    <button className="btn btn-sm btn-outline-danger border-0" onClick={() => deleteEntry('sanction', s.id)}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {recentSanctions.length === 0 && <tr className="text-muted italic"><td colSpan={5} className="text-center py-4">Aucune sanction enregistrée récemment.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="alert alert-warning p-3 rounded-4 small border-0 shadow-sm mt-3">
                                <b>Conseil :</b> Toute sanction grave (exclusion) devrait être notifiée aux parents par SMS ou mail via le module de notification.
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'bilan' && (
                    <div>
                        <div className="row mb-4 align-items-end g-3 d-print-none">
                            <div className="col-md-3">
                                <label className="form-label small fw-bold">{t('grades.select_class')}</label>
                                <select className="form-select border-0 shadow-sm" value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
                                    <option value="">{t('students.all_classes')}</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                </select>
                            </div>
                            <div className="col-md-5">
                                <label className="form-label small fw-bold">Rechercher un Étudiant</label>
                                <select className="form-select border-0 shadow-sm" value={selectedStudentId} onChange={e => loadStudentHistory(e.target.value)}>
                                    <option value="">-- Sélectionner l'étudiant pour voir son bilan --</option>
                                    {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.nom} {s.prenom} ({s.matricule})</option>)}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <button className="btn btn-dark w-100 fw-bold shadow-sm" onClick={() => window.print()} disabled={!selectedStudentId}>🖨️ IMPRIMER BILAN</button>
                            </div>
                        </div>

                        {/* ZONE D'IMPRESSION DU BILAN */}
                        <div className="print-report">
                            <style>{`
                                @media print {
                                    /* Masquer tous les éléments de l'interface utilisateur */
                                    nav, .sidebar, header, .navbar, .d-print-none, .btn, .btn-group, .card-header, .alert, .no-print {
                                        display: none !important;
                                    }
                                    
                                    /* Cibler spécifiquement les textes mentionnés par l'utilisateur s'ils sont hors des balises standards */
                                    body * { visibility: hidden; }
                                    .print-report, .print-report * { visibility: visible; }
                                    .print-report { 
                                        position: absolute; 
                                        left: 0; 
                                        top: 0; 
                                        width: 100%; 
                                        display: block !important; 
                                        padding: 0 !important;
                                        margin: 0 !important;
                                    }

                                    .card { border: none !important; box-shadow: none !important; }
                                    body { background: white !important; }
                                }
                            `}</style>

                            {selectedStudentInfo && (
                                <div className="mb-4">
                                    {/* En-tête Établissement */}
                                    <div className="row mb-4 border-bottom pb-3">
                                        <div className="col-8">
                                            <h4 className="fw-bold text-success mb-1">{company?.company_name || t('dashboard.default_school_name', 'ÉTABLISSEMENT SCOLAIRE')}</h4>
                                            <p className="small mb-0 text-muted">
                                                {company?.address}<br/>
                                                Tél: {company?.phone} | Email: {company?.email}
                                            </p>
                                        </div>
                                        <div className="col-4 text-end">
                                            <h5 className="fw-bold text-uppercase border p-2 bg-light">Bilan Disciplinaire</h5>
                                            <div className="small">{t('common.academic_year', 'Année Scolaire:')} {anneeScolaire}</div>
                                        </div>
                                    </div>

                                    {/* Info Étudiant */}
                                    <div className="p-3 bg-light rounded-4 mb-4 border shadow-sm">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="small text-muted text-uppercase fw-bold">{t('students.form_lastname')}</div>
                                                <div className="fs-5 fw-bold text-dark">{selectedStudentInfo.nom} {selectedStudentInfo.prenom}</div>
                                            </div>
                                            <div className="col-md-3 border-start">
                                                <div className="small text-muted text-uppercase fw-bold">{t('students.table_matricule')}</div>
                                                <div className="fw-bold">{selectedStudentInfo.matricule}</div>
                                            </div>
                                            <div className="col-md-3 border-start">
                                                <div className="small text-muted text-uppercase fw-bold">{t('students.table_class')}</div>
                                                <div className="fw-bold text-success">{selectedStudentInfo.classe_nom || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row g-4">
                                        <div className="col-md-6">
                                            <div className="card border shadow-sm rounded-4 h-100">
                                                <div className="card-header bg-success text-white fw-bold py-2">{t('discipline.tab_history')}</div>
                                                <div className="card-body p-0">
                                                    <table className="table table-sm align-middle mb-0 small">
                                                        <thead className="table-light"><tr><th>{t('discipline.form_date')}</th><th>Type</th><th>Heures</th><th className="text-center">Justifié</th><th className="text-end d-print-none">Actions</th></tr></thead>
                                                        <tbody>
                                                            {history.absences.map(a => (
                                                                <tr key={a.id}>
                                                                    <td>{new Date(a.date_absence).toLocaleDateString()}</td>
                                                                    <td className="fw-bold">{a.type_absence}</td>
                                                                    <td>{a.heures}h</td>
                                                                    <td className="text-center">{a.justifie ? '✅' : '❌'}</td>
                                                                    <td className="text-end d-print-none">
                                                                        <button className="btn btn-sm py-0 btn-outline-primary border-0" onClick={() => startEditAbsence(a)}>✏️</button>
                                                                        <button className="btn btn-sm py-0 btn-outline-danger border-0" onClick={() => deleteEntry('absence', a.id)}>🗑️</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {history.absences.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted italic">Aucune absence enregistrée.</td></tr>}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="card border shadow-sm rounded-4 h-100">
                                                <div className="card-header bg-danger text-white fw-bold py-2">Sanctions & Punitions</div>
                                                <div className="card-body p-0">
                                                    <table className="table table-sm align-middle mb-0 small">
                                                        <thead className="table-light"><tr><th>{t('discipline.form_date')}</th><th>Sanction</th><th>Motif</th><th className="text-end d-print-none">Actions</th></tr></thead>
                                                        <tbody>
                                                            {history.sanctions.map(s => (
                                                                <tr key={s.id}>
                                                                    <td>{new Date(s.date_sanction).toLocaleDateString()}</td>
                                                                    <td className="fw-bold">{s.type_sanction}</td>
                                                                    <td className="small">{s.motif}</td>
                                                                    <td className="text-end d-print-none">
                                                                        <button className="btn btn-sm py-0 btn-outline-primary border-0" onClick={() => startEditSanction(s)}>✏️</button>
                                                                        <button className="btn btn-sm py-0 btn-outline-danger border-0" onClick={() => deleteEntry('sanction', s.id)}>🗑️</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {history.sanctions.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted italic">Aucune sanction enregistrée.</td></tr>}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 d-none d-print-block">
                                        <div className="row text-center">
                                            <div className="col-6">
                                                <div className="fw-bold text-decoration-underline">Le Surveillant Général</div>
                                            </div>
                                            <div className="col-6">
                                                <div className="fw-bold text-decoration-underline">Le Chef d'Établissement</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!selectedStudentId && (
                                <div className="text-center py-5 text-muted">
                                    <div className="fs-1 opacity-25 mb-3">⚖️</div>
                                    <h5>{t('discipline.select_student_prompt', 'Sélectionnez un étudiant pour générer son bilan disciplinaire.')}</h5>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Discipline;
