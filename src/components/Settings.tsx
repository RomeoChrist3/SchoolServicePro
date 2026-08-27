import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsProps {
  user: any;
  anneeScolaire: string;
}

const Settings: React.FC<SettingsProps> = ({ user, anneeScolaire }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'secretaire' });
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);

  const fetchClosedPeriods = async () => {
    const res = await (window as any).electronAPI.dbQuery(
      'SELECT periode FROM clotures WHERE annee_scolaire = ? AND is_closed = 1',
      [anneeScolaire]
    );
    if (res && res.success) {
      setClosedPeriods(res.data.map((r: any) => r.periode));
    }
  };

  const togglePeriodClosure = async (periode: string) => {
    const isClosed = closedPeriods.includes(periode);
    let res;
    if (isClosed) {
      res = await (window as any).electronAPI.dbQuery(
        'DELETE FROM clotures WHERE annee_scolaire = ? AND periode = ?',
        [anneeScolaire, periode]
      );
    } else {
      res = await (window as any).electronAPI.dbQuery(
        'INSERT INTO clotures (annee_scolaire, periode, is_closed) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE is_closed = 1',
        [anneeScolaire, periode]
      );
    }
    if (res && res.success) {
      fetchClosedPeriods();
    } else {
      alert("Erreur lors de la modification de clôture : " + (res?.error || "Erreur inconnue"));
    }
  };

  const [dbConfig, setDbConfig] = useState<any>({
    driver: 'mysql',
    host: 'localhost',
    port: 3308,
    user: 'root',
    password: 'root',
    database: 'schoolservice_db',
    sqlitePath: ''
  });

  const [notifConfig, setNotifConfig] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    sms_api_key: '',
    sms_url: ''
  });

  const fetchData = async () => {
    const resUsers = await (window as any).electronAPI.dbQuery(`SELECT id, username, role, full_name FROM users`);
    if (resUsers.success) setUsers(resUsers.data);

    const config = await (window as any).electronAPI.dbConfigGet();
    if (config) setDbConfig(config);

    const resNotif = await (window as any).electronAPI.dbQuery('SELECT smtp_host, smtp_port, smtp_user, smtp_pass, sms_api_key, sms_url FROM settings LIMIT 1');
    if (resNotif.success && resNotif.data.length > 0) {
        const d = resNotif.data[0];
        setNotifConfig({
            smtp_host: d.smtp_host || '',
            smtp_port: d.smtp_port?.toString() || '587',
            smtp_user: d.smtp_user || '',
            smtp_pass: d.smtp_pass || '',
            sms_api_key: d.sms_api_key || '',
            sms_url: d.sms_url || ''
        });
    }
  };

  const saveDbSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await (window as any).electronAPI.dbConfigSave(dbConfig);
    if (res.success) {
      alert('Configuration réseau enregistrée !');
      window.location.reload();
    }
  };

  const saveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const sql = `UPDATE settings SET smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, sms_api_key=?, sms_url=? WHERE id > 0 LIMIT 1`;
    const params = [notifConfig.smtp_host, parseInt(notifConfig.smtp_port), notifConfig.smtp_user, notifConfig.smtp_pass, notifConfig.sms_api_key, notifConfig.sms_url];
    const res = await (window as any).electronAPI.dbQuery(sql, params);
    if (res.success) alert('Paramètres de notification enregistrés !');
    else alert('Erreur : ' + res.error);
  };

  const testSmtp = async () => {
    if (!notifConfig.smtp_host || !notifConfig.smtp_user || !notifConfig.smtp_pass) {
        alert("Veuillez remplir les informations SMTP avant de tester.");
        return;
    }
    const res = await (window as any).electronAPI.notificationTestSmtp(notifConfig);
    if (res.success) {
        alert("✅ Succès : La connexion au serveur SMTP est établie !");
    } else {
        alert("❌ Échec : " + res.error);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    fetchClosedPeriods();
  }, [anneeScolaire]);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    
    const result = await (window as any).electronAPI.dbQuery(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [newUser.username, newUser.password, newUser.role]
    );
    
    if (result.success) {
      alert('Compte utilisateur créé !');
      setNewUser({ username: '', password: '', role: 'secretaire' });
      fetchData();
    }
  };

  const deleteUser = async (id: number) => {
    if (window.confirm(t('settings.delete_user_confirm', 'Supprimer cet utilisateur ?'))) {
      await (window as any).electronAPI.dbQuery('DELETE FROM users WHERE id = ?', [id]);
      fetchData();
    }
  };

  return (
    <div className="row g-4">
      {/* SECTION UTILISATEURS */}
      <div className="col-md-6">
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-success text-white py-3">
            <h5 className="mb-0 fw-bold">👥 {t('settings.section_users')}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={addUser} className="mb-4 p-3 bg-light rounded border">
              <h6 className="fw-bold mb-3 small text-uppercase">{t('settings.add_user')}</h6>
              <div className="row g-2">
                <div className="col-md-6">
                    <label className="small fw-bold">{t('settings.form_username')}</label>
                    <input type="text" className="form-control form-control-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
                </div>
                <div className="col-md-6">
                    <label className="small fw-bold">{t('settings.form_password')}</label>
                    <input type="text" className="form-control form-control-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                </div>
                <div className="col-md-12 mt-2">
                    <label className="small fw-bold">{t('settings.form_role')}</label>
                    <select className="form-select form-select-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                        <option value="admin">{t('roles.admin')} (Tous les droits)</option>
                        <option value="gestionnaire">{t('roles.gestionnaire')} ({t('sidebar.pedagogy')} & {t('sidebar.finances')})</option>
                        <option value="secretaire">{t('roles.secretaire')} ({t('sidebar.students')} & {t('sidebar.grades')})</option>
                    </select>
                </div>
                <div className="col-12 mt-3">
                    <button type="submit" className="btn btn-success btn-sm w-100 fw-bold">+ {t('settings.btn_create_user').replace('Créer l\'', '')}</button>
                </div>
              </div>
            </form>

            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle">
                <thead className="table-light small">
                  <tr>
                    <th>{t('settings.table_username')}</th>
                    <th>{t('settings.table_role')}</th>
                    <th className="text-end">{t('students.table_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="fw-bold">{u.username}</td>
                      <td><span className={`badge ${u.role === 'admin' ? 'bg-danger' : 'bg-info'}`}>{u.role.toUpperCase()}</span></td>
                      <td className="text-end">
                        {u.username !== 'admin' && (
                          <button className="btn btn-sm text-danger" onClick={() => deleteUser(u.id)}>🗑️</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION VERROUILLAGE DES TRIMESTRES */}
        <div className="card shadow-sm border-0">
          <div className="card-header bg-danger text-white py-3">
            <h5 className="mb-0 fw-bold">🔒 {t('settings.section_closures', 'Clôture des Périodes')} ({anneeScolaire})</h5>
          </div>
          <div className="card-body">
            <p className="small text-muted mb-3">
              {t('settings.closures_desc', 'Verrouillez les trimestres ou séquences de l\'année en cours pour empêcher les modifications de notes par les autres utilisateurs.')}
            </p>
            <div className="list-group">
              {['Trimestre 1', 'Trimestre 2', 'Trimestre 3', 'Séquence 1', 'Séquence 2', 'Séquence 3', 'Séquence 4', 'Séquence 5', 'Séquence 6'].map(p => {
                const isClosed = closedPeriods.includes(p);
                return (
                  <div key={p} className="list-group-item d-flex align-items-center justify-content-between py-2 border-bottom">
                    <div>
                      <span className="fw-bold">{t('grades.period_' + p.toLowerCase().replace(' ', '_'), p)}</span>
                      {isClosed ? (
                        <span className="badge bg-danger ms-2">{t('settings.status_closed', 'Clôturé')}</span>
                      ) : (
                        <span className="badge bg-success ms-2">{t('settings.status_open', 'Ouvert')}</span>
                      )}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => togglePeriodClosure(p)} 
                      className={`btn btn-xs py-1 px-2 fw-bold shadow-sm ${isClosed ? 'btn-success' : 'btn-danger'}`}
                    >
                      {isClosed ? `🔓 ${t('settings.btn_open', 'Ouvrir')}` : `🔒 ${t('settings.btn_close_period', 'Clôturer')}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION TECHNIQUE */}
      <div className="col-md-6">
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-dark text-white py-3">
            <h5 className="mb-0 fw-bold">💾 {t('settings.section_data')}</h5>
          </div>
          <div className="card-body">
            <div className="alert alert-info small">
                Il est fortement recommandé d'effectuer une sauvegarde régulière de votre base de données sur une clé USB.
            </div>
            <div className="d-grid gap-2">
                <button className="btn btn-primary fw-bold" onClick={async () => {
                  const res = await (window as any).electronAPI.dbBackup();
                  if (res.success) alert('Sauvegarde effectuée avec succès !');
                }}>📥 EXPORTER UNE SAUVEGARDE (.SQL)</button>
                
                <button className="btn btn-outline-danger fw-bold" onClick={async () => {
                  if (window.confirm("Attention : La restauration remplacera toutes les données actuelles. Continuer ?")) {
                    const res = await (window as any).electronAPI.dbRestore();
                    if (res.success) window.location.reload();
                  }
                }}>📂 RESTAURER UNE SAUVEGARDE</button>

                <button className="btn btn-warning fw-bold mt-2" onClick={async () => {
                    if (window.confirm("Forcer la création des tables manquantes ? (Ne supprime pas les données)")) {
                        await (window as any).electronAPI.dbQuery("SELECT 1", []);
                        alert("Initialisation forcée envoyée. Veuillez redémarrer l'application.");
                    }
                }}>🔄 FORCER L'INITIALISATION DB</button>
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-header bg-secondary text-white py-3">
            <h5 className="mb-0 fw-bold small text-uppercase">🌐 {t('login.db_config')}</h5>
          </div>
          <div className="card-body">
            <form onSubmit={saveDbSettings}>
              <div className="row g-2 mb-3">
                <div className="col-12 mb-2">
                    <label className="small fw-bold">Moteur de Base de données</label>
                    <select className="form-select form-select-sm fw-bold border-primary" value={dbConfig.driver} onChange={e => setDbConfig({...dbConfig, driver: e.target.value})}>
                        <option value="mysql">MySQL (Réseau / Multi-postes)</option>
                        <option value="sqlite">SQLite (Fichier local)</option>
                    </select>
                </div>

                {dbConfig.driver === 'mysql' ? (
                    <>
                        <div className="col-md-8">
                            <label className="small fw-bold">Adresse IP du Serveur</label>
                            <input type="text" className="form-control form-control-sm" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} required={dbConfig.driver === 'mysql'} />
                        </div>
                        <div className="col-md-4">
                            <label className="small fw-bold">Port</label>
                            <input type="number" className="form-control form-control-sm" value={dbConfig.port} onChange={e => setDbConfig({...dbConfig, port: Number(e.target.value)})} required={dbConfig.driver === 'mysql'} />
                        </div>
                        <div className="col-md-6">
                            <label className="small fw-bold">Utilisateur</label>
                            <input type="text" className="form-control form-control-sm" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} required={dbConfig.driver === 'mysql'} />
                        </div>
                        <div className="col-md-6">
                            <label className="small fw-bold">Mot de passe</label>
                            <input type="password" className="form-control form-control-sm" value={dbConfig.password} onChange={e => setDbConfig({...dbConfig, password: e.target.value})} />
                        </div>
                        <div className="col-md-12">
                            <label className="small fw-bold">Nom de la Base de données</label>
                            <input type="text" className="form-control form-control-sm" value={dbConfig.database} onChange={e => setDbConfig({...dbConfig, database: e.target.value})} required={dbConfig.driver === 'mysql'} />
                        </div>
                    </>
                ) : (
                    <div className="col-12">
                        <label className="small fw-bold">Chemin du fichier SQLite (.db)</label>
                        <input type="text" className="form-control form-control-sm" value={dbConfig.sqlitePath} onChange={e => setDbConfig({...dbConfig, sqlitePath: e.target.value})} required={dbConfig.driver === 'sqlite'} placeholder="Ex: C:\Users\Ecritures\ecole.db" />
                    </div>
                )}
              </div>
              <button type="submit" className="btn btn-dark btn-sm w-100 fw-bold">💾 Appliquer Configuration Réseau</button>
            </form>
          </div>
        </div>

        {/* SECTION NOTIFICATIONS */}
        <div className="card shadow-sm border-0 mt-4 mb-4">
          <div className="card-header bg-info text-white py-3">
            <h5 className="mb-0 fw-bold small text-uppercase">📩 Paramètres de Notification (SMS/Email)</h5>
          </div>
          <div className="card-body">
            <form onSubmit={saveNotifSettings}>
                <div className="row g-2">
                    <h6 className="fw-bold small text-muted border-bottom pb-1">Configuration Email (SMTP)</h6>
                    <div className="col-md-9">
                        <label className="small fw-bold">Serveur SMTP</label>
                        <input type="text" className="form-control form-control-sm" placeholder="ex: smtp.gmail.com" value={notifConfig.smtp_host} onChange={e => setNotifConfig({...notifConfig, smtp_host: e.target.value})} />
                    </div>
                    <div className="col-md-3">
                        <label className="small fw-bold">Port</label>
                        <input type="number" className="form-control form-control-sm" value={notifConfig.smtp_port} onChange={e => setNotifConfig({...notifConfig, smtp_port: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                        <label className="small fw-bold">Email / Utilisateur</label>
                        <input type="email" className="form-control form-control-sm" value={notifConfig.smtp_user} onChange={e => setNotifConfig({...notifConfig, smtp_user: e.target.value})} />
                    </div>
                    <div className="col-md-6">
                        <label className="small fw-bold">Mot de passe d'application</label>
                        <input type="password" className="form-control form-control-sm" value={notifConfig.smtp_pass} onChange={e => setNotifConfig({...notifConfig, smtp_pass: e.target.value})} />
                    </div>

                    <h6 className="fw-bold small text-muted border-bottom pb-1 mt-3">Configuration SMS (API)</h6>
                    <div className="col-md-12">
                        <label className="small fw-bold">Clé API SMS</label>
                        <input type="password" className="form-control form-control-sm" placeholder="Votre clé secrète API" value={notifConfig.sms_api_key} onChange={e => setNotifConfig({...notifConfig, sms_api_key: e.target.value})} />
                    </div>
                    <div className="col-md-12">
                        <label className="small fw-bold">URL de la Passerelle (Optionnel)</label>
                        <input type="text" className="form-control form-control-sm" placeholder="https://api.monsms.com/send" value={notifConfig.sms_url} onChange={e => setNotifConfig({...notifConfig, sms_url: e.target.value})} />
                    </div>
                </div>
                <div className="d-flex gap-2 mt-3">
                    <button type="submit" className="btn btn-info text-white btn-sm flex-grow-1 fw-bold shadow-sm">💾 Enregistrer les accès</button>
                    <button type="button" className="btn btn-outline-info btn-sm fw-bold shadow-sm" onClick={testSmtp}>🧪 Tester la connexion</button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
