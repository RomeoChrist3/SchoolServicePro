import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import UserManual from './components/UserManual';

// Nouveaux composants
import Students from './components/Students';
import Teachers from './components/Teachers';
import Pedagogy from './components/Pedagogy';
import Grades from './components/Grades';
import Discipline from './components/Discipline';
import Finances from './components/Finances';
import IDCards from './components/IDCards';
import Etablissement from './components/Etablissement';
import HR from './components/HR';
import CashManagement from './components/CashManagement';

function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  const [anneeScolaire, setAnneeScolaire] = useState(() => {
    return localStorage.getItem('schoolservice_annee_scolaire') || '2025-2026';
  });
  const [anneesDisponibles, setAnneesDisponibles] = useState<string[]>(() => {
    const list = localStorage.getItem('schoolservice_annees_list');
    return list ? JSON.parse(list) : ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];
  });

  const [isAddingYear, setIsAddingYear] = useState(false);

  const handleAnneeScolaireChange = (val: string) => {
    if (val === 'new') {
        setIsAddingYear(true);
    } else {
        setAnneeScolaire(val);
        localStorage.setItem('schoolservice_annee_scolaire', val);
    }
  };

  const addNewYear = (newYear: string) => {
    const formatted = newYear.trim();
    if (formatted) {
        if (!anneesDisponibles.includes(formatted)) {
            const newList = [...anneesDisponibles, formatted].sort();
            setAnneesDisponibles(newList);
            localStorage.setItem('schoolservice_annees_list', JSON.stringify(newList));
            setAnneeScolaire(formatted);
            localStorage.setItem('schoolservice_annee_scolaire', formatted);
        } else {
            setAnneeScolaire(formatted);
            localStorage.setItem('schoolservice_annee_scolaire', formatted);
        }
    }
    setIsAddingYear(false);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const LanguageSelector = () => (
    <div className="d-flex gap-2 justify-content-center mb-3">
        <button 
            className={`btn btn-sm ${i18n.language === 'fr' ? 'btn-success' : 'btn-outline-success opacity-50'}`}
            onClick={() => changeLanguage('fr')}
            style={{ fontSize: '12px', fontWeight: 'bold' }}
        >
            FR 🇫🇷
        </button>
        <button 
            className={`btn btn-sm ${i18n.language === 'en' ? 'btn-success' : 'btn-outline-success opacity-50'}`}
            onClick={() => changeLanguage('en')}
            style={{ fontSize: '12px', fontWeight: 'bold' }}
        >
            EN 🇺🇸
        </button>
    </div>
  );

  const [isActivated, setIsActivated] = useState(false);
  const [machineId, setMachineId] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [loadingLicense, setLoadingLicense] = useState(true);
  const isWebMode = !navigator.userAgent.toLowerCase().includes('electron');

  const [showDbConfig, setShowDbConfig] = useState(false);
  const [dbConfig, setDbConfig] = useState<any>({ 
    driver: 'mysql',
    host: 'localhost', 
    port: 3308, 
    user: 'root', 
    password: '', 
    database: 'schoolservice_db'
  });

  const checkLicenseStatus = async () => {
    if (!(window as any).electronAPI) {
      setLoadingLicense(false);
      return;
    }
    try {
      const mid = await (window as any).electronAPI.getMachineId();
      setMachineId(mid);
      const resLic = await (window as any).electronAPI.checkLicense();
      if (resLic.active) setIsActivated(true);
    } catch (err) { console.error("License Check Error:", err); }
    setLoadingLicense(false);
  };

  const loadDbConfig = async () => {
    if (!(window as any).electronAPI) return;
    try {
      const config = await (window as any).electronAPI.dbConfigGet();
      if (config) setDbConfig(config);
    } catch (e) {}
  };

  const autoInitDB = async () => {
    if (!(window as any).electronAPI) return;
    try {
        // Déclencher l'initialisation côté Electron
        await (window as any).electronAPI.dbQuery("SELECT 1", []);
        
        // S'assurer qu'au moins un utilisateur existe
        const resUser = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM users');
        if (resUser.success && resUser.data && resUser.data[0] && resUser.data[0].total === 0) {
            await (window as any).electronAPI.dbQuery(
                "INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
                ['admin', 'admin123', 'admin', 'Administrateur']
            );
        }

        // S'assurer qu'une entrée settings existe
        const resSettings = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM settings');
        if (resSettings.success && resSettings.data && resSettings.data[0] && resSettings.data[0].total === 0) {
            await (window as any).electronAPI.dbQuery(
                "INSERT INTO settings (company_name, address, phone, primary_color) VALUES (?, ?, ?, ?)",
                ['MON ÉCOLE PRO', 'Adresse de l\'établissement', '000000000', '#198754']
            );
        }
    } catch (e) { console.error("Auto-Init DB Error:", e); }
  };

  useEffect(() => {
    const init = async () => {
      await checkLicenseStatus();
      await loadDbConfig();
      await autoInitDB();
    };
    init();
  }, []);

  const handleSaveDbConfig = async () => {
    const res = await (window as any).electronAPI.dbConfigSave(dbConfig);
    if (res.success) {
      alert("Configuration enregistrée. Redémarrage...");
      window.location.reload();
    }
  };

  const handleActivate = async () => {
    try {
      const mid = machineId.replace(/[^a-zA-Z0-9]/g, '').trim();
      const expectedKey = "SS-" + mid.split('').reverse().join('').substring(0, 8).toUpperCase() + "-PRO";
      
      const res = await (window as any).electronAPI.activateApp({ machineId, key: activationKey });
      if (res.success) {
        alert(t('activation.success'));
        setIsActivated(true);
      } else {
        alert(`${t('activation.error')}\n\nID: ${mid}\nAttendue: ${expectedKey}`);
      }
    } catch (err) { alert("Erreur lors de l'activation."); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await (window as any).electronAPI.dbQuery(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [loginForm.username, loginForm.password]
      );
      if (res.success && res.data.length > 0) {
        setUser(res.data[0]);
      } else {
        alert(t('login.error_invalid'));
      }
    } catch (err) { alert(t('login.error_db')); }
  };

  if (loadingLicense) return <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white fw-bold">{t('common.loading')}</div>;

  if (!isActivated) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center bg-dark" style={{ background: 'linear-gradient(135deg, #1e5128 0%, #000000 100%)' }}>
        <div className="card shadow-lg border-0" style={{ width: '450px', borderRadius: '15px' }}>
          <div className="card-body p-5 text-center">
            <LanguageSelector />
            <div className="mb-4"><span style={{ fontSize: '4rem' }}>🎓</span></div>
            <h3 className="fw-bold mb-3">{t('activation.title')}</h3>
            <div className="bg-light p-3 rounded mb-4 border text-center">
              <label className="small fw-bold text-uppercase text-muted d-block mb-1">{t('activation.machine_id')}</label>
              <code className="fs-5 text-dark fw-bold">{machineId}</code>
            </div>
            <input type="text" className="form-control form-control-lg text-center fw-bold border-success mb-4" placeholder={t('activation.key_placeholder')} value={activationKey} onChange={e => setActivationKey(e.target.value.toUpperCase())} />
            <button className="btn btn-success btn-lg w-100 fw-bold shadow" onClick={handleActivate}>✅ {t('activation.button')}</button>
            <button className="btn btn-link btn-sm mt-3 text-muted" onClick={() => setShowDbConfig(!showDbConfig)}>⚙️ {t('login.db_config')}</button>
            {showDbConfig && (
              isWebMode ? (
                <div className="mt-3 p-3 border rounded bg-light text-start shadow-sm">
                    <label className="small fw-bold text-muted">{t('login.db_host')}</label>
                    <input type="text" className="form-control form-control-sm mb-2" placeholder="ex: https://mon-serveur.up.railway.app" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} />
                    <button className="btn btn-dark btn-sm w-100 fw-bold mt-2" onClick={handleSaveDbConfig}>💾 {t('login.db_save')}</button>
                </div>
              ) : (
                <div className="mt-3 p-3 border rounded bg-light text-start shadow-sm">
                    <div className="row g-2">
                        <div className="col-md-8">
                            <label className="small fw-bold text-muted">{t('login.db_host_mysql')}</label>
                            <input type="text" className="form-control form-control-sm" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} />
                        </div>
                        <div className="col-md-4">
                            <label className="small fw-bold text-muted">{t('login.db_port')}</label>
                            <input type="number" className="form-control form-control-sm" value={dbConfig.port} onChange={e => setDbConfig({...dbConfig, port: Number(e.target.value)})} />
                        </div>
                        <div className="col-md-6">
                            <label className="small fw-bold text-muted">{t('login.db_user')}</label>
                            <input type="text" className="form-control form-control-sm" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} />
                        </div>
                        <div className="col-md-6">
                            <label className="small fw-bold text-muted">{t('login.db_password')}</label>
                            <input type="password" className="form-control form-control-sm" value={dbConfig.password} onChange={e => setDbConfig({...dbConfig, password: e.target.value})} />
                        </div>
                        <div className="col-12">
                            <label className="small fw-bold text-muted">{t('login.db_name_short')}</label>
                            <input type="text" className="form-control form-control-sm" value={dbConfig.database} onChange={e => setDbConfig({...dbConfig, database: e.target.value})} />
                        </div>
                        <div className="col-12 mt-2">
                            <button className="btn btn-dark btn-sm w-100 fw-bold" onClick={handleSaveDbConfig}>💾 {t('login.db_save')}</button>
                        </div>
                    </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 flex-column" style={{ background: '#f0f7f0' }}>
        <div className="card shadow-lg border-0 mb-3" style={{ width: '400px', borderRadius: '12px' }}>
          <div className="card-body p-5">
            <LanguageSelector />
            <div className="text-center mb-4">
                <img src="/logo.png" alt="LOGO" style={{ width: '100px', marginBottom: '20px' }} />
                <h2 className="fw-bold text-success mb-1">{t('login.title')}</h2>
                <small className="text-muted text-uppercase fw-bold">{t('login.subtitle')}</small>
            </div>
            <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted text-uppercase">{t('login.username')}</label>
                  <input type="text" className="form-control form-control-lg bg-light border-0 shadow-sm" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">{t('login.password')}</label>
                  <input type="password" className="form-control form-control-lg bg-light border-0 shadow-sm" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
                </div>
                <button type="submit" className="btn btn-success btn-lg w-100 py-3 shadow fw-bold text-uppercase">{t('login.button')}</button>
            </form>
          </div>
        </div>
        
        <button className="btn btn-link btn-sm text-success fw-bold text-uppercase" onClick={() => setShowDbConfig(!showDbConfig)}>⚙️ {t('login.db_config')}</button>
        
        {showDbConfig && (
          isWebMode ? (
            <div className="card shadow border-0 mt-2 p-3 text-start" style={{ width: '400px' }}>
                <div className="text-center border-bottom pb-2 mb-3">
                    <label className="fw-bold text-success text-uppercase">⚙️ {t('login.db_config_cloud')}</label>
                </div>
                <div className="mb-3">
                    <label className="small fw-bold">{t('login.db_host')}</label>
                    <input type="text" className="form-control form-control-sm" placeholder="ex: https://mon-serveur.up.railway.app" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} />
                </div>
                <button className="btn btn-success w-100 fw-bold shadow-sm mb-2" onClick={handleSaveDbConfig}>💾 {t('login.db_save')}</button>
            </div>
          ) : (
            <div className="card shadow border-0 mt-2 p-3 text-start" style={{ width: '400px' }}>
                <div className="row g-2">
                    <div className="col-12 mb-2 text-center border-bottom pb-2">
                        <label className="fw-bold text-success text-uppercase">⚙️ {t('login.db_config_mysql')}</label>
                    </div>

                    <div className="col-8">
                        <label className="small fw-bold">{t('login.db_host_mysql')}</label>
                        <input type="text" className="form-control form-control-sm" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} />
                    </div>
                    <div className="col-4">
                        <label className="small fw-bold">{t('login.db_port')}</label>
                        <input type="number" className="form-control form-control-sm" value={dbConfig.port} onChange={e => setDbConfig({...dbConfig, port: Number(e.target.value)})} />
                    </div>
                    <div className="col-6">
                        <label className="small fw-bold">{t('login.db_user')}</label>
                        <input type="text" className="form-control form-control-sm" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} />
                    </div>
                    <div className="col-6">
                        <label className="small fw-bold">{t('login.db_password')}</label>
                        <input type="password" className="form-control form-control-sm" value={dbConfig.password} onChange={e => setDbConfig({...dbConfig, password: e.target.value})} />
                    </div>
                    <div className="col-12">
                        <label className="small fw-bold">{t('login.db_name')}</label>
                        <input type="text" className="form-control form-control-sm" value={dbConfig.database} onChange={e => setDbConfig({...dbConfig, database: e.target.value})} />
                    </div>
                    
                    <div className="col-12 mt-2">
                        <button className="btn btn-dark btn-sm w-100 fw-bold" onClick={handleSaveDbConfig}>💾 {t('login.db_apply')}</button>
                    </div>
                </div>
            </div>
          )
        )}
        
        <p className="mt-4 text-center text-muted" style={{ fontSize: '10px' }}>SCHOOLSERVICE PRO V2.0 © 2026<br/>SION COMPANY - Excellence Académique</p>
      </div>
    );
  }

  return (
    <div className="d-flex bg-white animate__animated animate__fadeIn">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={user.role} />
      <main className="flex-grow-1 p-4 overflow-auto" style={{ height: '100vh', backgroundColor: '#f8fdf8' }}>
        <div className="container-fluid">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="fw-bold mb-0 text-capitalize text-success">{t('sidebar.' + activeTab, activeTab.replace('_', ' ')) as string}</h2>
            <div className="d-flex align-items-center">
              <div className="me-3 d-flex align-items-center gap-2">
                {isAddingYear ? (
                  <div className="d-flex align-items-center gap-1">
                    <input 
                      type="text" 
                      placeholder="2026-2027" 
                      className="form-control form-control-sm border-success fw-bold text-success rounded-pill px-3" 
                      style={{ width: '120px', fontSize: '12px' }}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          addNewYear((e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                          setIsAddingYear(false);
                        }
                      }}
                      onBlur={e => {
                        // Let click on '✕' button happen without blur overriding it immediately
                        setTimeout(() => addNewYear(e.target.value), 200);
                      }}
                    />
                    <button type="button" className="btn btn-sm btn-outline-danger border-0 p-1" style={{ fontSize: '11px' }} onClick={() => setIsAddingYear(false)}>✕</button>
                  </div>
                ) : (
                  <select className="form-select form-select-sm border-success fw-bold text-success shadow-sm rounded-pill px-3" style={{ fontSize: '12px', width: '135px' }} value={anneeScolaire} onChange={e => handleAnneeScolaireChange(e.target.value)}>
                    {anneesDisponibles.map(y => <option key={y} value={y}>{y}</option>)}
                    <option value="new">➕ {t('common.new_year', 'Nouvelle...')}</option>
                  </select>
                )}
                <LanguageSelector />
              </div>
              <span className="badge bg-white text-dark border p-2 px-3 me-3 shadow-sm rounded-pill d-flex align-items-center">
                <span className="text-success me-2">●</span> {user.username} <span className="ms-2 small text-muted text-uppercase">({t('roles.' + user.role, String(user.role)) as string})</span>
              </span>
              <button className="btn btn-sm btn-outline-danger rounded-pill px-3 transition-all" onClick={() => setUser(null)}>{t('sidebar.logout', 'Déconnexion') as string}</button>
            </div>
          </div>
          <hr className="mb-4" />
          
          <div className="animate__animated animate__fadeInUp animate__faster">
            {activeTab === 'dashboard' && <Dashboard user={user} />}
            {activeTab === 'etudiants' && <Students anneeScolaire={anneeScolaire} />}
            {activeTab === 'professeurs' && <Teachers anneeScolaire={anneeScolaire} />}
            {activeTab === 'pedagogie' && <Pedagogy />}
            {activeTab === 'notes' && <Grades user={user} anneeScolaire={anneeScolaire} />}
            {activeTab === 'discipline' && <Discipline anneeScolaire={anneeScolaire} />}
            {activeTab === 'finances' && <Finances anneeScolaire={anneeScolaire} />}
            {activeTab === 'caisse' && <CashManagement anneeScolaire={anneeScolaire} user={user} />}
            {activeTab === 'rh' && <HR anneeScolaire={anneeScolaire} />}
            {activeTab === 'idcards' && <IDCards anneeScolaire={anneeScolaire} />}
            {activeTab === 'etablissement' && <Etablissement />}
            {activeTab === 'parametres' && <Settings user={user} anneeScolaire={anneeScolaire} />}
            {activeTab === 'manuel' && <UserManual />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
