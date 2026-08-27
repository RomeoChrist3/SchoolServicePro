import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const UserManual = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('general');

  const sections = [
    { id: 'general', title: t('manual.sec_general', '🏠 Accueil & Vision'), icon: '📊' },
    { id: 'eleves', title: t('manual.sec_eleves', '👨‍🎓 Gestion des Étudiants'), icon: '👤' },
    { id: 'pedagogie', title: t('manual.sec_pedagogie', '📚 Pédagogie & Classes'), icon: '📖' },
    { id: 'notes', title: t('manual.sec_notes', '📝 Notes & Bulletins'), icon: '🎓' },
    { id: 'finances', title: t('manual.sec_finances', '💰 Finance & Écolage'), icon: '🏦' },
  ];

  return (
    <div className="container-fluid p-0">
      <div className="row g-0" style={{ minHeight: '80vh' }}>
        <div className="col-md-3 bg-light border-end p-4">
          <h4 className="fw-bold mb-4 text-success">📚 {t('sidebar.manual')}</h4>
          <div className="list-group list-group-flush shadow-sm rounded">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`list-group-item list-group-item-action border-0 py-3 d-flex align-items-center ${activeSection === s.id ? 'active fw-bold bg-success text-white' : ''}`}
              >
                <span className="me-3 fs-5">{s.icon}</span> {s.title}
              </button>
            ))}
          </div>
          <div className="mt-5 p-3 bg-white border rounded small text-muted italic text-center">
            SchoolService Pro v2.0<br/>{t('manual.academic_excellence', 'Excellence Académique')}
          </div>
        </div>

        <div className="col-md-9 p-5 bg-white overflow-auto" style={{ maxHeight: '85vh' }}>
          
          {activeSection === 'general' && (
            <div className="animate__animated animate__fadeIn">
              <h2 className="fw-bold mb-4 text-success">🏫 {t('manual.welcome_title', 'Bienvenue sur SchoolService Pro')}</h2>
              <p className="lead">{t('manual.welcome_desc', 'Le système centralisé pour la gestion administrative, pédagogique et financière de votre établissement.')}</p>
              <div className="row mt-4">
                <div className="col-md-6">
                  <div className="card h-100 border-0 shadow-sm bg-light p-3">
                    <h5 className="fw-bold text-success">📊 {t('sidebar.dashboard')}</h5>
                    <p>{t('manual.desc_dashboard', 'Visualisez instantanément vos effectifs, vos collectes du jour et le taux de recouvrement des frais de scolarité.')}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card h-100 border-0 shadow-sm bg-light p-3">
                    <h5 className="fw-bold text-primary">🛡️ {t('manual.security_title', 'Sécurité')}</h5>
                    <p>{t('manual.desc_security', 'Les accès sont protégés par rôles : l\'Administrateur gère tout, tandis que les Secrétaires sont limités aux inscriptions et notes.')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'eleves' && (
            <div className="animate__animated animate__fadeIn">
              <h2 className="fw-bold mb-4 text-success">👨‍🎓 {t('manual.students_title', 'Inscriptions & Dossiers Étudiants')}</h2>
              <h5 className="fw-bold mt-4">{t('manual.students_step1', '1. Inscrire un nouvel élève')}</h5>
              <ul>
                <li>{t('manual.students_li1', 'Allez dans l\'onglet Étudiants.')}</li>
                <li>{t('manual.students_li2', 'Cliquez sur + Nouvel Étudiant.')}</li>
                <li>{t('manual.students_li3', 'Remplissez les informations et ajoutez une photo (recommandé pour le trombinoscope).')}</li>
                <li>{t('manual.students_li4', 'Assignez-le à une classe pour activer son suivi financier.')}</li>
              </ul>
              <div className="alert alert-info mt-3">
                <h6 className="fw-bold">💡 {t('manual.students_tip_title', 'Statut de l\'élève')}</h6>
                <p className="mb-0 small">{t('manual.students_tip_desc', 'Un élève "Suspendu" ne peut plus recevoir de notes ni de reçus de paiement jusqu\'à sa régularisation.')}</p>
              </div>
            </div>
          )}

          {activeSection === 'pedagogie' && (
            <div className="animate__animated animate__fadeIn">
              <h2 className="fw-bold mb-4 text-success">📖 {t('manual.pedagogy_title', 'Classes, Matières & Enseignants')}</h2>
              <p>{t('manual.pedagogy_desc', 'Ce module structure l\'organisation académique de l\'école.')}</p>
              <h5 className="fw-bold mt-4">{t('manual.pedagogy_structure', 'Structure hiérarchique :')}</h5>
              <ol>
                <li><b>{t('manual.pedagogy_li1_bold', 'Classes :')}</b> {t('manual.pedagogy_li1', 'Définissez les niveaux et les frais associés (Inscription + Scolarité).')}</li>
                <li><b>{t('manual.pedagogy_li2_bold', 'Professeurs :')}</b> {t('manual.pedagogy_li2', 'Enregistrez votre corps enseignant et leurs spécialités.')}</li>
                <li><b>{t('manual.pedagogy_li3_bold', 'Matières :')}</b> {t('manual.pedagogy_li3', 'Créez les matières, affectez-leur un coefficient et un enseignant responsable.')}</li>
              </ol>
            </div>
          )}

          {activeSection === 'notes' && (
            <div className="animate__animated animate__fadeIn">
              <h2 className="fw-bold mb-4 text-success">📝 {t('manual.grades_title', 'Notes & Bulletins Automatiques')}</h2>
              <p>{t('manual.grades_desc', 'SchoolService Pro calcule automatiquement les moyennes et génère les bulletins.')}</p>
              <ul>
                <li>{t('manual.grades_li1', 'Sélectionnez la classe puis l\'élève.')}</li>
                <li>{t('manual.grades_li2', 'Choisissez la période (Trimestre, Séquence).')}</li>
                <li>{t('manual.grades_li3', 'Saisissez les notes sur 20. Le système calcule le total selon le coefficient.')}</li>
                <li>{t('manual.grades_li4', 'Cliquez sur Imprimer Bulletin pour obtenir un document officiel prêt à être signé.')}</li>
              </ul>
            </div>
          )}

          {activeSection === 'finances' && (
            <div className="animate__animated animate__fadeIn">
              <h2 className="fw-bold mb-4 text-success">💰 {t('manual.finances_title', 'Gestion des Frais & Recouvrement')}</h2>
              <p>{t('manual.finances_desc', 'Suivez les paiements de chaque élève en temps réel.')}</p>
              <h5 className="fw-bold mt-4">{t('manual.finances_step1', 'Encaisser un versement :')}</h5>
              <ol>
                <li>{t('manual.finances_li1', 'Recherchez l\'élève dans la liste financière.')}</li>
                <li>{t('manual.finances_li2', 'Vérifiez son Reste à Payer.')}</li>
                <li>{t('manual.finances_li3', 'Saisissez le montant versé et le motif (Scolarité, Cantine, etc.).')}</li>
                <li>{t('manual.finances_li4', 'Validez pour imprimer le Reçu de Paiement officiel.')}</li>
              </ol>
              <p className="bg-light p-2 border rounded small">{t('manual.finances_tip', 'Le Dashboard global vous indiquera le pourcentage de scolarité déjà encaissé par rapport aux prévisions.')}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UserManual;
