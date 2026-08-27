import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';

interface StudentsProps {
  anneeScolaire: string;
}

const Students: React.FC<StudentsProps> = ({ anneeScolaire }) => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [imageFile, setImageFile] = useState<{ fileName: string, base64Data: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    sexe: 'M',
    date_naissance: '',
    adresse: '',
    telephone: '',
    email: '',
    id_classe: '',
    date_inscription: new Date().toISOString().split('T')[0],
    statut: 'actif',
    image_path: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
        if (!(window as any).electronAPI) return;
        
        const url = await (window as any).electronAPI.mediaGetBaseUrl();
        setBaseUrl(url);

        // Récupération des classes (MySQL simple)
        const resClasses = await (window as any).electronAPI.dbQuery('SELECT * FROM classes ORDER BY nom');
        const classesData = (resClasses.success && resClasses.data) ? resClasses.data : [];
        setClasses(classesData);
        
        // Récupération des étudiants (MySQL simple avec colonnes garanties par init_db.ts)
        const resStudents = await (window as any).electronAPI.dbQuery(`
            SELECT id, matricule, nom, prenom, sexe, date_naissance, adresse, telephone, email, id_classe, date_inscription, image_path, statut 
            FROM etudiants 
            ORDER BY nom, prenom
        `);
        
        if (resStudents.success && resStudents.data) {
            const enriched = resStudents.data.map((s: any) => {
                const cl = classesData.find((c: any) => String(c.id) === String(s.id_classe));
                return { 
                    ...s, 
                    nom: s.nom || 'SANS NOM',
                    prenom: s.prenom || '',
                    classe_nom: cl ? cl.nom : 'Non classé',
                    statut: s.statut || 'actif'
                };
            });
            setStudents(enriched);
        } else if (!resStudents.success) {
            setErrorMsg("Erreur Base de données: " + resStudents.error);
        }
    } catch (err: any) {
        setErrorMsg("Erreur Système: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        const fileName = `std_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        setImageFile({ fileName, base64Data });
        setFormData({ ...formData, image_path: fileName });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
        let finalImagePath = formData.image_path;
        if (imageFile) {
          const resMedia = await (window as any).electronAPI.mediaSave(imageFile);
          if (resMedia.success) finalImagePath = resMedia.fileName;
        }

        let matricule = formData.matricule.trim();
        if (!matricule && !editingId) {
            // Génération auto si vide pour une nouvelle inscription
            matricule = `MAT-${Date.now().toString().slice(-6)}`;
        }

        const params = [
            matricule,
            formData.nom.toUpperCase(), 
            formData.prenom, 
            formData.sexe,
            formData.date_naissance || null,
            formData.adresse, 
            formData.telephone, 
            formData.email,
            formData.id_classe || null, 
            formData.date_inscription,
            formData.statut, 
            finalImagePath
        ];

        let result;
        if (editingId) {
          const sql = `UPDATE etudiants SET matricule=?, nom=?, prenom=?, sexe=?, date_naissance=?, adresse=?, telephone=?, email=?, id_classe=?, date_inscription=?, statut=?, image_path=? WHERE id=?`;
          result = await (window as any).electronAPI.dbQuery(sql, [...params, editingId]);
        } else {
          const sql = `INSERT INTO etudiants (matricule, nom, prenom, sexe, date_naissance, adresse, telephone, email, id_classe, date_inscription, statut, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          result = await (window as any).electronAPI.dbQuery(sql, params);
        }

        if (result.success) {
            closeModal();
            fetchData();
        } else {
            alert("Erreur lors de l'enregistrement: " + result.error);
        }
    } catch (err: any) {
        alert("Erreur critique: " + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
        // Vérifier si l'étudiant a des notes
        const resNotes = await (window as any).electronAPI.dbQuery('SELECT id FROM notes WHERE id_etudiant = ? LIMIT 1', [id]);
        if (resNotes.success && resNotes.data && resNotes.data.length > 0) {
            alert(t('students.delete_error_has_notes'));
            return;
        }

        if (window.confirm(t('students.delete_confirm'))) {
          const result = await (window as any).electronAPI.dbQuery('DELETE FROM etudiants WHERE id = ?', [id]);
          if (result.success) fetchData();
        }
    } catch (err: any) {
        alert("Erreur lors de la vérification : " + err.message);
    }
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setFormData({
      matricule: s.matricule || '',
      nom: s.nom || '',
      prenom: s.prenom || '',
      sexe: s.sexe || 'M',
      date_naissance: s.date_naissance ? new Date(s.date_naissance).toISOString().split('T')[0] : '',
      adresse: s.adresse || '',
      telephone: s.telephone || '',
      email: s.email || '',
      id_classe: s.id_classe ? s.id_classe.toString() : '',
      date_inscription: s.date_inscription ? new Date(s.date_inscription).toISOString().split('T')[0] : '',
      statut: s.statut || 'actif',
      image_path: s.image_path || ''
    });
    setImageFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setImageFile(null);
    setFormData({ 
      matricule: '', nom: '', prenom: '', sexe: 'M', date_naissance: '', adresse: '', telephone: '', 
      email: '', id_classe: '', date_inscription: new Date().toISOString().split('T')[0], 
      statut: 'actif', image_path: '' 
    });
  };

  const handleExport = () => {
    const dataToExport = filteredStudents.map(s => ({
        Matricule: s.matricule || '',
        Nom: s.nom,
        Prenom: s.prenom,
        Sexe: s.sexe,
        Classe: s.classe_nom,
        Date_Naissance: s.date_naissance || '',
        Telephone: s.telephone || '',
        Email: s.email || '',
        Adresse: s.adresse || '',
        Statut: s.statut
    }));
    
    // Utilisation du point-virgule pour une meilleure compatibilité Excel en français
    const csv = Papa.unparse(dataToExport, { delimiter: ';' });
    
    // Ajout du BOM UTF-8 pour que Excel reconnaisse l'encodage et les accents
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `liste_etudiants_${selectedClass ? classes.find(c => String(c.id) === String(selectedClass))?.nom : 'tous'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: "", // Auto-détection du délimiteur (virgule ou point-virgule)
        complete: async (results) => {
            const data = results.data as any[];
            let count = 0;
            
            for (const row of data) {
                const matricule = (row.Matricule || row.matricule || '').trim();
                const nom = (row.Nom || row.nom || '').trim().toUpperCase();
                const prenom = (row.Prenom || row.prenom || '').trim();
                if (!nom && !matricule) continue;

                const sexe = row.Sexe || row.sexe || 'M';
                const date_n = row.Date_Naissance || row.date_naissance || null;
                const tel = row.Telephone || row.telephone || '';
                const email = row.Email || row.email || '';
                const adresse = row.Adresse || row.adresse || '';
                const statut = row.Statut || row.statut || 'actif';
                const classe_nom = row.Classe || row.classe || '';

                // Trouver l'ID de la classe par son nom
                let id_classe = null;
                if (classe_nom) {
                    const cl = classes.find(c => c.nom.toLowerCase() === classe_nom.toLowerCase());
                    if (cl) id_classe = cl.id;
                }

                // Vérifier si l'étudiant existe déjà (Priorité au Matricule, sinon Nom+Prénom)
                let checkRes;
                if (matricule) {
                    checkRes = await (window as any).electronAPI.dbQuery('SELECT id FROM etudiants WHERE matricule = ?', [matricule]);
                } else {
                    checkRes = await (window as any).electronAPI.dbQuery('SELECT id FROM etudiants WHERE nom = ? AND prenom = ?', [nom, prenom]);
                }

                if (checkRes.success && checkRes.data && checkRes.data.length > 0) {
                    // MISE À JOUR
                    const existingId = checkRes.data[0].id;
                    const sqlUpdate = `UPDATE etudiants SET matricule=?, nom=?, prenom=?, sexe=?, date_naissance=?, adresse=?, telephone=?, email=?, id_classe=?, statut=? WHERE id=?`;
                    await (window as any).electronAPI.dbQuery(sqlUpdate, [matricule || row.matricule, nom, prenom, sexe, date_n, adresse, tel, email, id_classe, statut, existingId]);
                } else {
                    // INSERTION
                    const sqlInsert = `INSERT INTO etudiants (matricule, nom, prenom, sexe, date_naissance, adresse, telephone, email, id_classe, date_inscription, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
                    await (window as any).electronAPI.dbQuery(sqlInsert, [matricule || `MAT-${Date.now().toString().slice(-6)}`, nom, prenom, sexe, date_n, adresse, tel, email, id_classe, statut]);
                }
                count++;
            }
            alert(t('students.import_success', { count }));
            fetchData();
        }
    });
  };

  const handlePrint = async () => {
    try {
        const resSettings = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        const settings = (resSettings.success && resSettings.data && resSettings.data.length > 0) ? resSettings.data[0] : {};
        
        const filtered = students.filter(s => !selectedClass || String(s.id_classe) === String(selectedClass));
        const className = selectedClass ? (classes.find(c => String(c.id) === String(selectedClass))?.nom || 'Classe inconnue') : 'Toutes les classes';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #198754; padding-bottom: 10px; }
                    .header h1 { margin: 0; color: #198754; text-transform: uppercase; font-size: 24px; }
                    .header p { margin: 5px 0; font-size: 14px; }
                    .report-title { text-align: center; margin-bottom: 20px; text-decoration: underline; font-size: 18px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
                    th { bg-color: #f8f9fa; font-weight: bold; text-transform: uppercase; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .footer { margin-top: 30px; text-align: right; font-size: 12px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${settings.company_name || t('dashboard.default_school_name', 'ÉTABLISSEMENT SCOLAIRE')}</h1>
                    <p>${settings.activity || ''}</p>
                    <p>${settings.address || ''} | Tel: ${settings.phone || ''}</p>
                </div>
                
                <div class="report-title">${t('dashboard.print_roster_title', 'LISTE DES ÉLÈVES : {{classNom}}').replace('{{classNom}}', className.toUpperCase())}</div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">${t('dashboard.table_num')}</th>
                            <th style="width: 40%">${t('dashboard.table_name_fn')}</th>
                            <th style="width: 15%">${t('dashboard.table_class')}</th>
                            <th style="width: 20%">${t('dashboard.table_parent_phone')}</th>
                            <th style="width: 20%">${t('dashboard.table_status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((s, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${s.nom} ${s.prenom}</td>
                                <td>${s.classe_nom}</td>
                                <td>${s.telephone || '-'}</td>
                                <td>${s.statut.toUpperCase()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    Généré le ${new Date().toLocaleDateString()}
                </div>
            </body>
            </html>
        `;

        await (window as any).electronAPI.printBulletin(html);
    } catch (err: any) {
        alert("Erreur lors de l'impression: " + err.message);
    }
  };

  const handlePrintCards = async (singleStudent?: any) => {
    try {
        const resSettings = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        const settings = resSettings.success && resSettings.data?.[0] ? resSettings.data[0] : {};
        
        let sealBase64 = '';
        try {
            const resSeal = await (window as any).electronAPI.mediaGetBase64('logo.png');
            if (resSeal && resSeal.success) sealBase64 = resSeal.base64;
        } catch (err) {}

        const targetStudents = singleStudent ? [singleStudent] : filteredStudents;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page { size: A4; margin: 5mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 10px; background: #fff; }
                    .cards-container { 
                        display: grid; 
                        grid-template-columns: repeat(2, 1fr); 
                        gap: 15px; 
                        justify-items: center;
                    }
                    .id-card { 
                        width: 86mm; 
                        height: 54mm; 
                        border: 2px solid #198754; 
                        border-radius: 10px; 
                        position: relative; 
                        overflow: hidden;
                        background: #fff;
                        box-shadow: 0 0 5px rgba(0,0,0,0.1);
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 5px;
                    }
                    .card-header {
                        background: #198754;
                        color: white;
                        padding: 5px;
                        text-align: center;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        height: 45px;
                    }
                    .card-logo { height: 35px; width: 35px; object-fit: contain; background: white; border-radius: 4px; padding: 2px; }
                    .school-name { font-size: 11px; font-weight: bold; text-transform: uppercase; line-height: 1.1; }
                    
                    .card-body {
                        display: flex;
                        padding: 8px;
                        flex-grow: 1;
                        gap: 10px;
                    }
                    .photo-container {
                        width: 65px;
                        height: 75px;
                        border: 1px solid #ddd;
                        overflow: hidden;
                        border-radius: 5px;
                    }
                    .photo-container img { width: 100%; height: 100%; object-fit: cover; }
                    .photo-placeholder { font-size: 40px; text-align: center; line-height: 75px; background: #f8f9fa; color: #ccc; }
                    
                    .student-info { flex-grow: 1; display: flex; flex-direction: column; gap: 3px; }
                    .info-row { font-size: 10px; color: #555; }
                    .info-value { font-weight: bold; color: #000; font-size: 11px; }
                    .card-title {
                        font-size: 12px;
                        font-weight: bold;
                        color: #198754;
                        text-decoration: underline;
                        margin-bottom: 5px;
                        text-align: center;
                    }
                    
                    .card-footer {
                        background: #f8f9fa;
                        border-top: 1px solid #198754;
                        padding: 3px 8px;
                        font-size: 9px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        height: 25px;
                    }
                    .validity { font-weight: bold; color: #d63384; }
                </style>
            </head>
            <body>
                <div class="cards-container">
                    ${targetStudents.map(s => `
                        <div class="id-card">
                            <div class="card-header">
                                ${sealBase64 ? `<img src="${sealBase64}" class="card-logo">` : ''}
                                <div class="school-name">${settings.company_name || t('dashboard.default_school_name', 'ÉTABLISSEMENT SCOLAIRE')}</div>
                            </div>
                            <div class="card-body">
                                <div class="photo-container">
                                    ${s.image_path ? 
                                        `<img src="${baseUrl}${s.image_path}">` : 
                                        `<div class="photo-placeholder">👤</div>`
                                    }
                                </div>
                                <div class="student-info">
                                    <div class="card-title">${t('idcards.btn_print_card').replace('🖨️ ', '')}</div>
                                    <div class="info-row">Nom: <span class="info-value">${s.nom.toUpperCase()}</span></div>
                                    <div class="info-row">Prénom: <span class="info-value">${s.prenom}</span></div>
                                    <div class="info-row">Classe: <span class="info-value">${s.classe_nom}</span></div>
                                    <div class="info-row">Tél Parent: <span class="info-value">${s.telephone || '-'}</span></div>
                                </div>
                            </div>
                            <div class="card-footer">
                                <span>Matricule: #SS-${String(s.id).padStart(4, '0')}</span>
                                <span class="validity">ANNÉE : ${anneeScolaire}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `;

        await (window as any).electronAPI.printBulletin(html);
    } catch (err: any) {
        alert("Erreur lors de la génération: " + err.message);
    }
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.nom || ''} ${s.prenom || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || (s.telephone && s.telephone.includes(searchTerm));
    const matchesClass = !selectedClass || String(s.id_classe) === String(selectedClass);
    return matchesSearch && matchesClass;
  });

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2 flex-grow-1">
            <h5 className="mb-0 fw-bold text-success text-nowrap">👨‍🎓 {t('students.title')}</h5>
            
            <select 
                className="form-select form-select-sm border-success shadow-none ms-2" 
                style={{ maxWidth: '200px' }}
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
            >
                <option value="">{t('students.all_classes')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>

            <input 
                type="text" 
                className="form-control form-control-sm border-success shadow-none" 
                style={{ maxWidth: '250px' }}
                placeholder={t('students.search_placeholder')}
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
            />
            
            {loading && <div className="spinner-border spinner-border-sm text-success"></div>}
            
            <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={fetchData}>{t('students.refresh')}</button>
            <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={handlePrint} disabled={filteredStudents.length === 0}>{t('students.print_list')}</button>
            <button className="btn btn-sm btn-outline-dark rounded-pill px-3" onClick={handleExport} disabled={filteredStudents.length === 0}>{t('students.export_csv')}</button>
            <label className="btn btn-sm btn-outline-success rounded-pill px-3 mb-0">
                {t('students.import_csv')}
                <input type="file" hidden accept=".csv" onChange={handleImport} />
            </label>
        </div>
        <button className="btn btn-success btn-sm fw-bold shadow-sm px-4" onClick={() => setShowModal(true)}>{t('students.new_student')}</button>
      </div>
      
      <div className="card-body p-0">
        {errorMsg && <div className="alert alert-danger m-3">{errorMsg}</div>}
        
        <div className="table-responsive" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 250px)' }}>
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light sticky-top">
              <tr>
                <th style={{ width: '70px' }} className="ps-3 text-muted small text-uppercase">{t('students.table_photo')}</th>
                <th className="text-muted small text-uppercase">{t('students.table_matricule')}</th>
                <th className="text-muted small text-uppercase">{t('students.table_name')}</th>
                <th className="text-muted small text-uppercase">{t('students.table_class')}</th>
                <th className="text-muted small text-uppercase">{t('students.table_phone')}</th>
                <th className="text-center text-muted small text-uppercase">{t('students.table_status')}</th>
                <th className="text-end pe-3 text-muted small text-uppercase">{t('students.table_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id}>
                  <td className="ps-3">
                    {s.image_path ? (
                      <img src={`${baseUrl}${s.image_path}`} alt="" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #f0f0f0' }} />
                    ) : (
                      <div className="bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', borderRadius: '50%', fontSize: '20px', border: '2px solid #f0f0f0' }}>👤</div>
                    )}
                  </td>
                  <td><span className="fw-bold text-primary small">{s.matricule || '-'}</span></td>
                  <td>
                    <div className="fw-bold text-dark">{s.nom} {s.prenom}</div>
                    <div className="text-muted" style={{ fontSize: '12px' }}>{s.email || `ID: #${s.id}`}</div>
                  </td>
                  <td><span className="badge bg-info-subtle text-info border border-info-subtle px-3">{s.classe_nom}</span></td>
                  <td className="small">{s.telephone || '-'}</td>
                  <td className="text-center">
                    <span className={`badge rounded-pill ${s.statut === 'actif' ? 'bg-success' : 'bg-danger'} px-3`} style={{ fontSize: '11px' }}>
                        {s.statut.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-end pe-3">
                    <div className="btn-group shadow-sm">
                        <button className="btn btn-sm btn-white border" title="Modifier" onClick={() => openEdit(s)}>✏️</button>
                        <button className="btn btn-sm btn-white border text-danger" title="Supprimer" onClick={() => handleDelete(s.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredStudents.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-5">
                        <div className="mb-3 display-4 text-muted opacity-25">📁</div>
                        <h5 className="text-muted fw-bold">{t('students.empty_title')}</h5>
                        <p className="small text-muted mb-4">{t('students.empty_desc')}</p>
                        <button className="btn btn-success px-4 fw-bold shadow-sm" onClick={() => setShowModal(true)}>{t('students.empty_button')}</button>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg animate__animated animate__zoomIn animate__faster">
              <div className="modal-header bg-success text-white border-0 py-3 px-4">
                <h5 className="modal-title fw-bold d-flex align-items-center">
                    <span className="me-2">{editingId ? '📝' : '👨‍🎓'}</span>
                    {editingId ? t('students.modal_edit_title') : t('students.modal_add_title')}
                </h5>
                <button type="button" className="btn-close btn-close-white shadow-none" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-4">
                    <div className="col-md-3 text-center border-end">
                        <div className="border rounded-circle p-1 mb-3 bg-light d-flex align-items-center justify-content-center mx-auto shadow-sm" style={{ width: '140px', height: '140px', overflow: 'hidden', border: '3px solid #198754' }}>
                            {imageFile ? (
                                <img src={`data:image/png;base64,${imageFile.base64Data}`} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : formData.image_path ? (
                                <img src={`${baseUrl}${formData.image_path}`} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span className="text-muted" style={{ fontSize: '3.5rem' }}>👤</span>
                            )}
                        </div>
                        <label className="btn btn-sm btn-outline-success w-100 shadow-sm fw-bold">
                            {t('students.form_photo')}
                            <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                        </label>
                    </div>
                    <div className="col-md-9">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_matricule')}</label>
                                <input type="text" className="form-control border-success-subtle bg-light-subtle fw-bold text-primary" placeholder={t('students.form_matricule_hint')} value={formData.matricule} onChange={(e) => setFormData({...formData, matricule: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_lastname')}</label>
                                <input type="text" className="form-control border-success-subtle bg-light-subtle" required value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_firstname')}</label>
                                <input type="text" className="form-control border-success-subtle bg-light-subtle" required value={formData.prenom} onChange={(e) => setFormData({...formData, prenom: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_gender')}</label>
                                <select className="form-select border-success-subtle bg-light-subtle" required value={formData.sexe} onChange={(e) => setFormData({...formData, sexe: e.target.value})}>
                                    <option value="M">Masculin</option>
                                    <option value="F">Féminin</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_class')}</label>
                                <select className="form-select border-success-subtle bg-light-subtle" required value={formData.id_classe} onChange={(e) => setFormData({...formData, id_classe: e.target.value})}>
                                    <option value="">-- Sélectionner --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_dob')}</label>
                                <input type="date" className="form-control border-success-subtle bg-light-subtle" value={formData.date_naissance} onChange={(e) => setFormData({...formData, date_naissance: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_phone')}</label>
                                <input type="text" className="form-control border-success-subtle bg-light-subtle" value={formData.telephone} onChange={(e) => setFormData({...formData, telephone: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_email')}</label>
                                <input type="email" className="form-control border-success-subtle bg-light-subtle" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                            </div>
                            <div className="col-md-12">
                                <label className="form-label small fw-bold text-muted">{t('students.form_address')}</label>
                                <input type="text" className="form-control border-success-subtle bg-light-subtle" value={formData.adresse} onChange={(e) => setFormData({...formData, adresse: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-muted">{t('students.form_status')}</label>
                                <select className="form-select border-success-subtle bg-light-subtle" value={formData.statut} onChange={(e) => setFormData({...formData, statut: e.target.value})}>
                                    <option value="actif">{t('students.status_active')}</option>
                                    <option value="inactif">{t('students.status_inactive')}</option>
                                    <option value="suspendu">{t('students.status_suspended')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 bg-light py-3 px-4">
                  <button type="button" className="btn btn-link text-secondary text-decoration-none fw-bold" onClick={closeModal}>{t('common.cancel').toUpperCase()}</button>
                  <button type="submit" className="btn btn-success px-5 fw-bold shadow">
                    {editingId ? t('students.btn_save') : t('students.btn_create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
