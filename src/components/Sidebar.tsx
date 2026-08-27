import React from 'react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole }) => {
  const { t } = useTranslation();
  
  // Définition des accès par rôle pour la gestion scolaire
  const menuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard', 'Tableau de Bord'), icon: '📊', roles: ['admin', 'gestionnaire', 'secretaire'] },
    { id: 'etudiants', label: t('sidebar.students', 'Étudiants'), icon: '👨‍🎓', roles: ['admin', 'gestionnaire', 'secretaire'] },
    { id: 'idcards', label: t('sidebar.idcards', 'Cartes Scolaires'), icon: '🪪', roles: ['admin', 'gestionnaire', 'secretaire'] },
    { id: 'professeurs', label: t('sidebar.teachers', 'Professeurs'), icon: '👨‍🏫', roles: ['admin', 'gestionnaire'] },
    { id: 'pedagogie', label: t('sidebar.pedagogy', 'Classes & Matières'), icon: '📚', roles: ['admin', 'gestionnaire'] },
    { id: 'notes', label: t('sidebar.grades', 'Notes & Bulletins'), icon: '📝', roles: ['admin', 'gestionnaire', 'secretaire'] },
    { id: 'discipline', label: t('sidebar.discipline', 'Discipline'), icon: '⚖️', roles: ['admin', 'gestionnaire', 'secretaire'] },
    { id: 'finances', label: t('sidebar.finances', 'Finance & Paiements'), icon: '💰', roles: ['admin', 'gestionnaire'] },
    { id: 'caisse', label: t('sidebar.caisse', 'Gestion Caisse'), icon: '💵', roles: ['admin', 'gestionnaire', 'secretaire'] },
    { id: 'rh', label: t('sidebar.hr', 'RH & Salaires'), icon: '👥', roles: ['admin'] },
    { id: 'etablissement', label: t('sidebar.etablissement', 'Établissement'), icon: '🏛️', roles: ['admin'] },
    { id: 'parametres', label: t('sidebar.settings', 'Paramètres Système'), icon: '⚙️', roles: ['admin'] },
    { id: 'manuel', label: t('sidebar.manual', 'Guide d\'Utilisation'), icon: '📖', roles: ['admin', 'gestionnaire', 'secretaire'] },
  ];

  const visibleMenu = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="d-flex flex-column flex-shrink-0 p-3 bg-white d-print-none shadow-sm" style={{ width: '260px', height: '100vh', borderRight: '1px solid #eee' }}>
      <div className="d-flex align-items-center mb-4 px-2">
        <img src="/logo.png" alt="LOGO" style={{ width: '45px', height: '45px', objectFit: 'contain' }} className="me-2" />
        <span className="fs-5 fw-bold text-dark tracking-tight">SCHOOLSERVICE</span>
      </div>
      
      <div className="mb-2 px-2 small text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
        {t('sidebar.academic_system', 'Gestion Scolaire')}
      </div>

      <ul className="nav nav-pills flex-column mb-auto overflow-auto pe-1 custom-scrollbar">
        {visibleMenu.map((item) => (
          <li key={item.id} className="nav-item mb-1">
            <button
              onClick={() => setActiveTab(item.id)}
              className={`nav-link w-100 text-start border-0 d-flex align-items-center py-2 px-3 rounded-3 transition-all ${
                activeTab === item.id 
                ? 'active shadow-sm bg-success text-white' 
                : 'text-secondary bg-transparent hover-bg-light'
              }`}
              style={{ fontSize: '14.5px' }}
            >
              <span className="me-3 fs-5">{item.icon}</span>
              <span className="fw-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      
      <hr className="text-muted opacity-25" />
      
      <div className="px-2 pb-2">
        <div className="p-3 bg-light rounded-4 border">
          <div className="d-flex align-items-center mb-1">
            <div className="bg-success rounded-circle me-2" style={{ width: '8px', height: '8px' }}></div>
            <span className="small text-muted fw-medium">{t('sidebar.academic_system', 'Système Académique')}</span>
          </div>
          <div className="small text-dark fw-bold" style={{ fontSize: '12px' }}>{t('sidebar.pro_edition', 'PRO Edition')} V2.0</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
