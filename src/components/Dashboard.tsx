import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const Dashboard = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    todayPayments: 0,
    totalExpected: 0,
    totalCollected: 0
  });
  const [classStats, setClassStats] = useState<any[]>([]);
  const [dbInfo, setDbInfo] = useState<any>(null);

  const fetchStats = async () => {
    try {
        if (!(window as any).electronAPI) return;
        
        const config = await (window as any).electronAPI.dbConfigGet();
        setDbInfo(config);

        const resS = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as count FROM etudiants');
        const resT = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as count FROM professeurs');
        const resC = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as count FROM classes');
        
        const resPayToday = await (window as any).electronAPI.dbQuery("SELECT SUM(montant) as total FROM paiements WHERE DATE(date_paiement) = CURRENT_DATE");
        
        const resTotalExpected = await (window as any).electronAPI.dbQuery(`
            SELECT SUM(IFNULL(c.frais_inscription, 0) + IFNULL(c.frais_scolarite, 0)) as total 
            FROM etudiants e 
            JOIN classes c ON e.id_classe = c.id
        `);
        const resTotalCollected = await (window as any).electronAPI.dbQuery("SELECT SUM(montant) as total FROM paiements");

        const resClassStats = await (window as any).electronAPI.dbQuery(`
            SELECT c.nom, COUNT(e.id) as student_count, 
            SUM(IFNULL(c.frais_inscription, 0) + IFNULL(c.frais_scolarite, 0)) as expected,
            IFNULL((SELECT SUM(p.montant) FROM paiements p JOIN etudiants e2 ON p.id_etudiant = e2.id WHERE e2.id_classe = c.id), 0) as collected
            FROM classes c
            LEFT JOIN etudiants e ON c.id = e.id_classe
            GROUP BY c.id
        `);

        setStats({
            totalStudents: resS.success ? resS.data[0].count : 0,
            totalTeachers: resT.success ? resT.data[0].count : 0,
            totalClasses: resC.success ? resC.data[0].count : 0,
            todayPayments: resPayToday.success ? (resPayToday.data[0].total || 0) : 0,
            totalExpected: resTotalExpected.success ? (resTotalExpected.data[0].total || 0) : 0,
            totalCollected: resTotalCollected.success ? (resTotalCollected.data[0].total || 0) : 0
        });
        setClassStats(resClassStats.success ? resClassStats.data : []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchStats(); }, []);

  const printClassRoster = async (classNom: string) => {
    const resSettings = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    const company = resSettings.success ? resSettings.data[0] : null;
    
    const resStudents = await (window as any).electronAPI.dbQuery(`
        SELECT e.* FROM etudiants e 
        JOIN classes c ON e.id_classe = c.id 
        WHERE c.nom = ? 
        ORDER BY e.nom, e.prenom
    `, [classNom]);

    if (!resStudents.success) return;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 30px; }
                .header { text-align: center; border-bottom: 2px solid #198754; padding-bottom: 10px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f0f0f0; border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
                td { border: 1px solid #ddd; padding: 8px; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div style="font-size: 20px; font-weight: bold;">${company?.company_name || t('dashboard.default_school_name', 'ÉTABLISSEMENT SCOLAIRE')}</div>
                <h2 style="margin: 10px 0; color: #198754;">${t('dashboard.print_roster_title', 'LISTE DES ÉLÈVES : {{classNom}}').replace('{{classNom}}', classNom)}</h2>
                <div>${t('dashboard.total_roster_effectif', 'Effectif Total : {{count}} élèves | Date : {{date}}').replace('{{count}}', String(resStudents.data.length)).replace('{{date}}', new Date().toLocaleDateString())}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">${t('dashboard.table_num', 'N°')}</th>
                        <th>${t('dashboard.table_matricule', 'MATRICULE')}</th>
                        <th>${t('dashboard.table_name_fn', 'NOM & PRÉNOM')}</th>
                        <th>${t('dashboard.table_parent_phone', 'TÉLÉPHONE PARENT')}</th>
                        <th>${t('dashboard.table_status', 'STATUT')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${resStudents.data.map((s: any, i: number) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>#${String(s.id).padStart(5, '0')}</td>
                            <td><b>${s.nom} ${s.prenom}</b></td>
                            <td>${s.telephone || '-'}</td>
                            <td>${s.statut.toUpperCase()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
    (window as any).electronAPI.printBulletin(html);
  };

  const collectionRate = stats.totalExpected > 0 ? ((stats.totalCollected / stats.totalExpected) * 100).toFixed(1) : 0;

  return (
    <div>
      {/* INFOS SERVEUR (DEBUG) */}
      {dbInfo && (
          <div className="alert alert-dark py-1 px-3 mb-4 d-flex justify-content-between align-items-center shadow-sm" style={{ fontSize: '11px' }}>
              <span>🔌 {t('dashboard.server', 'SERVEUR :')} <b>{dbInfo.host}</b> | {t('dashboard.port', 'PORT :')} <b>{dbInfo.port}</b> | {t('dashboard.db', 'BASE :')} <b className="text-warning">{dbInfo.database}</b></span>
              <span className="badge bg-success">{t('dashboard.connected', 'CONNECTÉ')} root/root</span>
          </div>
      )}

      {/* CARDS STATS */}
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-primary text-white p-3">
            <div className="d-flex justify-content-between">
                <div><div className="small opacity-75">{t('dashboard.stats_students', 'Étudiants Inscrits')}</div><h3 className="fw-bold mb-0">{stats.totalStudents}</h3></div>
                <div className="fs-1">👨‍🎓</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-success text-white p-3">
            <div className="d-flex justify-content-between">
                <div><div className="small opacity-75">{t('dashboard.stats_payments', 'Collecte du Jour')}</div><h3 className="fw-bold mb-0">{Math.round(stats.todayPayments).toLocaleString()}</h3></div>
                <div className="fs-1">💰</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-info text-white p-3">
            <div className="d-flex justify-content-between">
                <div><div className="small opacity-75">{t('dashboard.stats_rate', 'Taux de Recouvrement')}</div><h3 className="fw-bold mb-0">{collectionRate}%</h3></div>
                <div className="fs-1">📈</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-warning text-dark p-3">
            <div className="d-flex justify-content-between">
                <div><div className="small opacity-75">{t('dashboard.stats_teachers', 'Corps Enseignant')}</div><h3 className="fw-bold mb-0">{stats.totalTeachers}</h3></div>
                <div className="fs-1">👨‍🏫</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-8">
            <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white py-3"><h6 className="mb-0 fw-bold">📊 {t('dashboard.situation_class', 'Situation par Classe')}</h6></div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small">
                              <tr>
                                <th>{t('dashboard.table_class', 'Classe')}</th>
                                <th>{t('dashboard.table_effectif', 'Effectif')}</th>
                                <th>{t('dashboard.table_prevu', 'Prévu')}</th>
                                <th>{t('dashboard.table_recouvre', 'Recouvré')}</th>
                                <th>{t('dashboard.table_solde', 'Solde')}</th>
                                <th className="text-end px-3">{t('dashboard.table_action', 'Action')}</th>
                              </tr>
                            </thead>
                            <tbody>
                                {classStats.map((c, i) => (
                                    <tr key={i}>
                                        <td className="fw-bold">{c.nom}</td>
                                        <td>{c.student_count}</td>
                                        <td className="small">{Math.round(c.expected || 0).toLocaleString()}</td>
                                        <td className="text-success fw-bold small">{Math.round(c.collected || 0).toLocaleString()}</td>
                                        <td className="text-danger fw-bold small">{Math.round((c.expected || 0) - (c.collected || 0)).toLocaleString()}</td>
                                        <td className="text-end px-3">
                                            <button className="btn btn-sm btn-outline-success border-0 fw-bold" onClick={() => printClassRoster(c.nom)}>{t('dashboard.print_list', '🖨️ LISTE')}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-dark text-white p-4 h-100">
                <h6 className="fw-bold mb-4">💰 {t('dashboard.global_finances', 'État Global Finances')}</h6>
                <div className="mb-4">
                    <label className="small opacity-50 d-block">{t('dashboard.total_expected', 'TOTAL PRÉVU')}</label>
                    <h4 className="fw-bold text-info">{Math.round(stats.totalExpected).toLocaleString()} FCFA</h4>
                </div>
                <div className="mb-4">
                    <label className="small opacity-50 d-block">{t('dashboard.total_collected', 'TOTAL RECOUVRÉ')}</label>
                    <h4 className="fw-bold text-success">{Math.round(stats.totalCollected).toLocaleString()} FCFA</h4>
                </div>
                <div className="mb-4 border-top pt-3">
                    <label className="small opacity-50 d-block">{t('dashboard.rest_collected', 'RESTE À RECOUVRER')}</label>
                    <h4 className="fw-bold text-danger">{Math.round(stats.totalExpected - stats.totalCollected).toLocaleString()} FCFA</h4>
                </div>
                <div className="progress mt-auto" style={{ height: '10px' }}>
                    <div className="progress-bar bg-success" style={{ width: `${collectionRate}%` }}></div>
                </div>
                <small className="mt-2 text-center d-block opacity-50">{collectionRate}% {t('dashboard.goal_reached', "de l'objectif atteint")}</small>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
