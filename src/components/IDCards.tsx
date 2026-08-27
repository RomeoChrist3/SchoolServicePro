import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface IDCardsProps {
  anneeScolaire: string;
}

const IDCards: React.FC<IDCardsProps> = ({ anneeScolaire }) => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'student' | 'teacher'>('student');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
        const url = await (window as any).electronAPI.mediaGetBaseUrl();
        setBaseUrl(url);

        const resClasses = await (window as any).electronAPI.dbQuery('SELECT * FROM classes ORDER BY nom');
        const classesData = resClasses.success ? resClasses.data : [];
        setClasses(classesData);
        
        const resStudents = await (window as any).electronAPI.dbQuery(`
            SELECT id, nom, prenom, id_classe, image_path, telephone 
            FROM etudiants 
            WHERE statut = 'actif'
            ORDER BY nom, prenom
        `);
        
        if (resStudents.success) {
            const enriched = resStudents.data.map((s: any) => {
                const cl = classesData.find((c: any) => String(c.id) === String(s.id_classe));
                return { 
                    ...s, 
                    type: 'student',
                    classe_nom: cl ? cl.nom : 'Non classé'
                };
            });
            setStudents(enriched);
        }

        const resTeachers = await (window as any).electronAPI.dbQuery('SELECT * FROM professeurs ORDER BY nom, prenom');
        if (resTeachers.success) {
            setTeachers(resTeachers.data.map((t: any) => ({ ...t, type: 'teacher' })));
        }

    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handlePrintCards = async (singleItem?: any) => {
    try {
        const resSettings = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        const settings = resSettings.success && resSettings.data?.[0] ? resSettings.data[0] : {};
        
        let logoBase64 = '';
        try {
            if (settings.logo_path) {
                const resLogo = await (window as any).electronAPI.mediaGetBase64(settings.logo_path);
                if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
            }
            if (!logoBase64) {
                const resLogo = await (window as any).electronAPI.mediaGetBase64('logo.png');
                if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
            }
        } catch (err) {}

        const itemsToPrint = singleItem ? [singleItem] : (targetType === 'student' ? filteredStudents : filteredTeachers);

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
                        background: #f8f9fa;
                        color: #000;
                        padding: 5px;
                        text-align: center;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        height: 55px;
                        border-bottom: 2px solid #198754;
                    }
                    .card-logo { height: 40px; width: 40px; object-fit: contain; background: white; border-radius: 4px; padding: 2px; border: 1px solid #198754; }
                    .school-info-header { display: flex; flex-direction: column; text-align: left; flex-grow: 1; }
                    .school-name { font-size: 10px; font-weight: bold; text-transform: uppercase; line-height: 1.1; margin-bottom: 2px; color: #000; }
                    .school-contact { font-size: 8px; line-height: 1.1; color: #333; font-weight: 500; }
                    
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
                    ${itemsToPrint.map(s => `
                        <div class="id-card">
                            <div class="card-header">
                                ${logoBase64 ? `<img src="${logoBase64}" class="card-logo">` : ''}
                                <div class="school-info-header">
                                    <div class="school-name">${settings.company_name || 'MON ÉTABLISSEMENT'}</div>
                                    <div class="school-contact">${settings.address || ''}</div>
                                    <div class="school-contact">Tél: ${settings.phone || ''}</div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="photo-container">
                                    ${s.image_path ? 
                                        `<img src="${baseUrl}${s.image_path}">` : 
                                        `<div class="photo-placeholder">${s.type === 'teacher' ? '👨‍🏫' : '👤'}</div>`
                                    }
                                </div>
                                <div class="student-info">
                                    <div class="card-title">${s.type === 'teacher' ? t('print.card_title_teacher') : t('print.card_title_student')}</div>
                                    <div class="info-row">${t('print.card_lastname')} <span class="info-value">${s.nom.toUpperCase()}</span></div>
                                    <div class="info-row">${t('print.card_firstname')} <span class="info-value">${s.prenom}</span></div>
                                    ${s.type === 'teacher' ? 
                                        `<div class="info-row">${t('print.card_function')} <span class="info-value">${s.specialite || t('print.teacher_default')}</span></div>` :
                                        `<div class="info-row">${t('print.card_class')} <span class="info-value">${s.classe_nom === 'Non classé' ? t('print.not_classed') : s.classe_nom}</span></div>`
                                    }
                                    <div class="info-row">${t('print.card_phone')} <span class="info-value">${s.telephone || '-'}</span></div>
                                </div>
                            </div>
                            <div class="card-footer">
                                <span>${t('print.card_matricule')} #${s.type === 'teacher' ? 'PR' : 'SS'}-${String(s.id).padStart(4, '0')}</span>
                                <span class="validity">${t('print.card_year')} ${anneeScolaire}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `;

        await (window as any).electronAPI.printBulletin(html);
    } catch (err) { alert("Erreur: " + err); }
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.nom} ${s.prenom}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    const matchesClass = !selectedClass || String(s.id_classe) === String(selectedClass);
    return matchesSearch && matchesClass;
  });

  const filteredTeachers = teachers.filter(t => {
    const fullName = `${t.nom} ${t.prenom}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3">
        <div className="row g-2 align-items-center">
            <div className="col-md-2">
                <h5 className="mb-0 fw-bold text-success">🪪 {t('idcards.title')}</h5>
            </div>
            <div className="col-md-3">
                <div className="btn-group w-100 shadow-sm">
                    <button className={`btn btn-sm ${targetType === 'student' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setTargetType('student')}>{t('sidebar.students').toUpperCase()}</button>
                    <button className={`btn btn-sm ${targetType === 'teacher' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setTargetType('teacher')}>{t('sidebar.teachers').toUpperCase()}</button>
                </div>
            </div>
            <div className="col-md-2">
                {targetType === 'student' && (
                    <select className="form-select form-select-sm border-success" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                        <option value="">{t('students.all_classes')}</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                )}
            </div>
            <div className="col-md-2">
                <input type="text" className="form-control form-control-sm border-success" placeholder={t('common.search')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="col-md-3 text-end">
                <button className="btn btn-success btn-sm fw-bold w-100" onClick={() => handlePrintCards()} disabled={(targetType === 'student' ? filteredStudents.length : filteredTeachers.length) === 0}>🖨️ {t('idcards.btn_print_selected').replace('🖨️ ', '')}</button>
            </div>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive" style={{ maxHeight: '600px' }}>
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '60px' }} className="ps-3">{t('students.table_photo')}</th>
                <th>{t('students.table_name')}</th>
                <th>{targetType === 'student' ? t('students.table_class') : t('sidebar.discipline')}</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {(targetType === 'student' ? filteredStudents : filteredTeachers).map(item => (
                <tr key={item.id}>
                  <td className="ps-3">
                    {item.image_path ? (
                      <img src={`${baseUrl}${item.image_path}`} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                      <div className="bg-light d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', borderRadius: '4px' }}>{item.type === 'teacher' ? '👨‍🏫' : '👤'}</div>
                    )}
                  </td>
                  <td className="fw-bold">{item.nom} {item.prenom}</td>
                  <td>
                    {item.type === 'student' ? (
                        <span className="badge bg-info-subtle text-info border border-info-subtle">{item.classe_nom}</span>
                    ) : (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle">{item.specialite || 'Enseignant'}</span>
                    )}
                  </td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-success fw-bold" onClick={() => handlePrintCards(item)}>🖨️ {t('idcards.btn_print_card').replace('🖨️ ', '')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IDCards;
