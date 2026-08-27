import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TeachersProps {
  anneeScolaire: string;
}

const Teachers: React.FC<TeachersProps> = ({ anneeScolaire }) => {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [imageFile, setImageFile] = useState<{ fileName: string, base64Data: string } | null>(null);

  const [formData, setFormData] = useState({ 
    nom: '', 
    prenom: '', 
    sexe: 'M',
    specialite: '', 
    telephone: '', 
    email: '',
    image_path: ''
  });

  const fetchData = async () => {
    try {
        const url = await (window as any).electronAPI.mediaGetBaseUrl();
        setBaseUrl(url);

        const res = await (window as any).electronAPI.dbQuery('SELECT * FROM professeurs ORDER BY nom, prenom');
        if (res.success) setTeachers(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        const fileName = `prof_${Date.now()}_${file.name}`;
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
      if (resMedia.success) finalImagePath = resMedia.fileName;
    }

    const params = [formData.nom, formData.prenom, formData.sexe, formData.specialite, formData.telephone, formData.email, finalImagePath];
    if (editingId) {
        await (window as any).electronAPI.dbQuery('UPDATE professeurs SET nom=?, prenom=?, sexe=?, specialite=?, telephone=?, email=?, image_path=? WHERE id=?', [...params, editingId]);
    } else {
        await (window as any).electronAPI.dbQuery('INSERT INTO professeurs (nom, prenom, sexe, specialite, telephone, email, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)', params);
    }
    closeModal();
    fetchData();
  };

  const openEdit = (t_teacher: any) => {
    setEditingId(t_teacher.id);
    setFormData({ 
        nom: t_teacher.nom, 
        prenom: t_teacher.prenom, 
        sexe: t_teacher.sexe || 'M',
        specialite: t_teacher.specialite||'', 
        telephone: t_teacher.telephone||'', 
        email: t_teacher.email||'',
        image_path: t_teacher.image_path || ''
    });
    setImageFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setImageFile(null);
    setFormData({ nom: '', prenom: '', sexe: 'M', specialite: '', telephone: '', email: '', image_path: '' });
  };

  const handlePrintSingleTeacher = async (teacher: any) => {
    try {
        const resSettings = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        const settings = (resSettings.success && resSettings.data && resSettings.data.length > 0) ? resSettings.data[0] : {};

        let logoBase64 = '';
        let photoBase64 = '';
        
        try {
            if (settings.logo_path) {
                const res = await (window as any).electronAPI.mediaGetBase64(settings.logo_path);
                if (res.success) logoBase64 = res.base64;
            }
            if (!logoBase64) {
                const res = await (window as any).electronAPI.mediaGetBase64('logo.png');
                if (res.success) logoBase64 = res.base64;
            }
            if (teacher.image_path) {
                const res = await (window as any).electronAPI.mediaGetBase64(teacher.image_path);
                if (res.success) photoBase64 = res.base64;
            }
        } catch (e) {}

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @page { size: 86mm 54mm; margin: 0; }
                    body { font-family: sans-serif; margin: 0; padding: 0; width: 86mm; height: 54mm; }
                    .badge-container {
                        width: 86mm; height: 54mm; border: 1px solid #198754; border-radius: 8px;
                        display: flex; flex-direction: column; overflow: hidden; position: relative;
                    }
                    .header { background: #198754; color: white; padding: 5px; text-align: center; font-size: 10px; font-weight: bold; }
                    .content { display: flex; padding: 10px; gap: 15px; flex-grow: 1; }
                    .photo { width: 60px; height: 70px; border: 1px solid #ddd; object-fit: cover; }
                    .info { flex-grow: 1; font-size: 11px; }
                    .info b { display: block; margin-top: 3px; font-size: 12px; }
                    .footer { background: #f8f9fa; border-top: 1px solid #ddd; padding: 3px; text-align: center; font-size: 9px; }
                    .logo { position: absolute; top: 5px; right: 5px; height: 25px; }
                </style>
            </head>
            <body>
                <div class="badge-container">
                    <div class="header">${settings.company_name}</div>
                    <div class="content">
                        ${photoBase64 ? `<img src="${photoBase64}" class="photo">` : '<div class="photo" style="background:#eee; text-align:center; line-height:70px;">PHOTO</div>'}
                        <div class="info">
                            ${t('idcards.btn_print_card').replace('🖨️ ', '')}<br>
                            <b>${teacher.nom} ${teacher.prenom}</b>
                            <div style="margin-top:5px; color:#555;">${teacher.specialite || 'Enseignant'}</div>
                            <div style="margin-top:5px; font-size:10px;">Tél: ${teacher.telephone || '-'}</div>
                        </div>
                    </div>
                    <div class="footer">Année Scolaire ${anneeScolaire}</div>
                </div>
            </body>
            </html>
        `;
        await (window as any).electronAPI.printBulletin(html);
    } catch (err) {
        alert("Erreur lors de l'impression du badge.");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t('teachers.delete_confirm', 'Supprimer ce professeur ?'))) {
        await (window as any).electronAPI.dbQuery('DELETE FROM professeurs WHERE id = ?', [id]);
        fetchData();
    }
  };

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold text-primary">👨‍🏫 {t('teachers.title')}</h5>
        <button className="btn btn-primary btn-sm fw-bold" onClick={() => setShowModal(true)}>{t('teachers.new_teacher')}</button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '60px' }}>{t('students.table_photo')}</th>
                <th>{t('teachers.table_name')}</th>
                <th>{t('teachers.form_subjects')}</th>
                <th>Tarif / Heures</th>
                <th>{t('students.table_phone')}</th>
                <th>Email</th>
                <th className="text-end pe-3">{t('students.table_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(teach => (
                <tr key={teach.id}>
                  <td className="ps-3">
                    {teach.image_path ? (
                      <img src={`${baseUrl}${teach.image_path}`} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <div className="bg-light d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', borderRadius: '50%', fontSize: '20px' }}>👨‍🏫</div>
                    )}
                  </td>
                  <td className="fw-bold">{teach.nom} {teach.prenom}</td>
                  <td><span className="badge bg-light text-dark border">{teach.specialite || '-'}</span></td>
                  <td>
                    {teach.taux_horaire ? (
                      <span className="fw-bold text-success">{teach.taux_horaire.toLocaleString()} F/h</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                    {teach.heures_mensuelles_prevues ? (
                      <span className="badge bg-light text-dark border ms-1">{teach.heures_mensuelles_prevues} h/m</span>
                    ) : null}
                  </td>
                  <td>{teach.telephone || '-'}</td>
                  <td>{teach.email || '-'}</td>
                  <td className="text-end pe-3">
                    <button className="btn btn-sm btn-outline-info me-1" title={t('idcards.btn_print_card').replace('🖨️ ', '')} onClick={() => handlePrintSingleTeacher(teach)}>🪪</button>
                    <button className="btn btn-sm btn-light border me-1" onClick={() => openEdit(teach)}>✏️</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(teach.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white border-0">
                <h5 className="modal-title fw-bold">{editingId ? t('teachers.modal_edit_title') : t('teachers.modal_add_title')}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-3 text-center">
                        <div className="border rounded-circle p-1 mb-2 bg-light d-flex align-items-center justify-content-center mx-auto" style={{ width: '120px', height: '120px', overflow: 'hidden' }}>
                            {imageFile ? (
                                <img src={`data:image/png;base64,${imageFile.base64Data}`} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : formData.image_path ? (
                                <img src={`${baseUrl}${formData.image_path}`} alt="Teacher" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span className="text-muted" style={{ fontSize: '2.5rem' }}>👨‍🏫</span>
                            )}
                        </div>
                        <label className="btn btn-xs btn-outline-secondary">
                            {t('students.form_photo')}
                            <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                        </label>
                    </div>
                    <div className="col-md-9">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label small fw-bold">{t('teachers.form_lastname')}</label>
                                <input type="text" className="form-control" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value.toUpperCase()})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold">{t('teachers.form_firstname')}</label>
                                <input type="text" className="form-control" required value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold">{t('students.form_gender')}</label>
                                <select className="form-select" required value={formData.sexe} onChange={e => setFormData({...formData, sexe: e.target.value})}>
                                    <option value="M">Masculin</option>
                                    <option value="F">Féminin</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold">{t('teachers.form_subjects')}</label>
                                <input type="text" className="form-control" value={formData.specialite} onChange={e => setFormData({...formData, specialite: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small fw-bold">{t('students.form_phone')}</label>
                        <input type="text" className="form-control" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small fw-bold">Email</label>
                        <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light" onClick={closeModal}>{t('common.cancel')}</button>
                  <button type="submit" className="btn btn-primary px-4 shadow-sm">{t('teachers.btn_save')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;
