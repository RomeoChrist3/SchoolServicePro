import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const Etablissement = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    company_name: '',
    activity: '',
    address: '',
    phone: '',
    email: '',
    niu: '',
    rccm: '',
    entete_facture: '',
    invoice_footer: '',
    logo_path: '',
    primary_color: '#198754',
    region: '',
    departement: '',
    arrondissement: '',
    ville: '',
    quartier: '',
    chef_etablissement: ''
  });
  const [logoFile, setLogoFile] = useState<{ fileName: string, base64Data: string } | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  const fetchData = async () => {
    const url = await (window as any).electronAPI.mediaGetBaseUrl();
    setBaseUrl(url);

    const res = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (res.success && res.data.length > 0) {
      const data = res.data[0];
      setFormData({
        company_name: data.company_name || '',
        activity: data.activity || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        niu: data.niu || '',
        rccm: data.rccm || '',
        entete_facture: data.entete_facture || '',
        invoice_footer: data.invoice_footer || '',
        logo_path: data.logo_path || '',
        primary_color: data.primary_color || '#198754',
        region: data.region || '',
        departement: data.departement || '',
        arrondissement: data.arrondissement || '',
        ville: data.ville || '',
        quartier: data.quartier || '',
        chef_etablissement: data.chef_etablissement || ''
      });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        const fileName = `logo_${Date.now()}_${file.name}`;
        setLogoFile({ fileName, base64Data });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalLogoPath = formData.logo_path;

    if (logoFile) {
      const resMedia = await (window as any).electronAPI.mediaSave(logoFile);
      if (resMedia.success) finalLogoPath = resMedia.fileName;
    }

    const check = await (window as any).electronAPI.dbQuery('SELECT id FROM settings LIMIT 1');
    const params = [
        formData.company_name, 
        formData.activity,
        formData.address, 
        formData.phone, 
        formData.email, 
        formData.niu, 
        formData.rccm, 
        formData.entete_facture,
        formData.invoice_footer, 
        finalLogoPath, 
        formData.primary_color,
        formData.region,
        formData.departement,
        formData.arrondissement,
        formData.ville,
        formData.quartier,
        formData.chef_etablissement
    ];

    let result;
    if (check.success && check.data.length > 0) {
      result = await (window as any).electronAPI.dbQuery(
        'UPDATE settings SET company_name=?, activity=?, address=?, phone=?, email=?, niu=?, rccm=?, entete_facture=?, invoice_footer=?, logo_path=?, primary_color=?, region=?, departement=?, arrondissement=?, ville=?, quartier=?, chef_etablissement=? WHERE id=?',
        [...params, check.data[0].id]
      );
    } else {
      result = await (window as any).electronAPI.dbQuery(
        'INSERT INTO settings (company_name, activity, address, phone, email, niu, rccm, entete_facture, invoice_footer, logo_path, primary_color, region, departement, arrondissement, ville, quartier, chef_etablissement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params
      );
    }

    if (result.success) {
        alert('Paramètres enregistrés avec succès !');
        setLogoFile(null);
        fetchData();
    } else {
        alert('Erreur lors de l\'enregistrement : ' + result.error);
    }
  };

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-success text-white py-3"><h5 className="mb-0 fw-bold">🏛️ {t('etablissement.title')}</h5></div>
      <div className="card-body p-4">
        <form onSubmit={handleSave}>
          <div className="row g-4">
            <div className="col-md-3 text-center border-end">
                <div className="mb-3">
                    <label className="form-label small fw-bold d-block text-danger">{t('etablissement.logo_title')}</label>
                    <div className="border rounded bg-light d-flex align-items-center justify-content-center mx-auto mb-2" style={{ width: '150px', height: '150px', overflow: 'hidden' }}>
                        {logoFile ? (
                            <img src={`data:image/png;base64,${logoFile.base64Data}`} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        ) : formData.logo_path ? (
                            <img src={`${baseUrl}${formData.logo_path}`} alt="Bulletin Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        ) : (
                            <span className="text-muted" style={{ fontSize: '3rem' }}>📜</span>
                        )}
                    </div>
                    <label className="btn btn-sm btn-outline-danger">
                        📷 {t('etablissement.logo_btn')}
                        <input type="file" hidden accept="image/*" onChange={handleLogoChange} />
                    </label>
                    <p className="mt-2 small text-muted italic" style={{ fontSize: '10px' }}>{t('etablissement.logo_hint')}</p>
                </div>
                <div className="mt-4">
                    <label className="form-label small fw-bold">{t('etablissement.form_color')}</label>
                    <input type="color" className="form-control form-control-color w-100" value={formData.primary_color} onChange={e => setFormData({...formData, primary_color: e.target.value})} />
                </div>
            </div>

            <div className="col-md-9">
                <div className="row g-3">
                    <div className="col-md-8">
                        <label className="form-label small fw-bold">{t('etablissement.form_name')}</label>
                        <input type="text" className="form-control" required value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small fw-bold">{t('etablissement.form_activity')}</label>
                        <input type="text" className="form-control" value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})} placeholder="Ex: École Primaire & Secondaire" />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small fw-bold">{t('etablissement.form_address')}</label>
                        <input type="text" className="form-control" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-bold">{t('etablissement.form_phone')}</label>
                        <input type="text" className="form-control" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-bold">{t('etablissement.form_email')}</label>
                        <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small fw-bold">NIU (Identifiant Unique)</label>
                        <input type="text" className="form-control" value={formData.niu} onChange={e => setFormData({...formData, niu: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small fw-bold">RCCM / Agrément</label>
                        <input type="text" className="form-control" value={formData.rccm} onChange={e => setFormData({...formData, rccm: e.target.value})} />
                    </div>

                    <hr className="my-3"/>
                    <h6 className="fw-bold text-success small text-uppercase">Localisation & Direction</h6>
                    
                    <div className="col-md-4">
                        <label className="form-label small fw-bold">Région</label>
                        <input type="text" className="form-control" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small fw-bold">Département</label>
                        <input type="text" className="form-control" value={formData.departement} onChange={e => setFormData({...formData, departement: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small fw-bold">Arrondissement</label>
                        <input type="text" className="form-control" value={formData.arrondissement} onChange={e => setFormData({...formData, arrondissement: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small fw-bold">Ville</label>
                        <input type="text" className="form-control" value={formData.ville} onChange={e => setFormData({...formData, ville: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small fw-bold">Quartier</label>
                        <input type="text" className="form-control" value={formData.quartier} onChange={e => setFormData({...formData, quartier: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label small fw-bold text-primary">Chef de l'établissement</label>
                        <input type="text" className="form-control border-primary" value={formData.chef_etablissement} onChange={e => setFormData({...formData, chef_etablissement: e.target.value})} />
                    </div>

                    <div className="col-md-12 mt-3">
                        <label className="form-label small fw-bold text-success">Entête de Facture / Reçu (Slogan ou Texte Haut)</label>
                        <textarea className="form-control" rows={2} value={formData.entete_facture} onChange={e => setFormData({...formData, entete_facture: e.target.value})} placeholder="Ce texte apparaîtra en haut de vos documents..."></textarea>
                    </div>
                    <div className="col-md-12">
                        <label className="form-label small fw-bold text-primary">Pied de page (Message bas de page)</label>
                        <textarea className="form-control" rows={2} value={formData.invoice_footer} onChange={e => setFormData({...formData, invoice_footer: e.target.value})} placeholder="Ex: Merci pour votre confiance en notre enseignement..."></textarea>
                    </div>
                </div>
                <div className="text-end mt-4">
                    <button type="submit" className="btn btn-success px-5 fw-bold shadow">{t('etablissement.btn_save')}</button>
                </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Etablissement;
