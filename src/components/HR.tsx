import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface HRProps {
  anneeScolaire: string;
}

const HR: React.FC<HRProps> = ({ anneeScolaire }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'profiles' | 'absences' | 'paie' | 'history'>('profiles');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [absences, setAbsences] = useState<any[]>([]);
  const [fichesPaie, setFichesPaie] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  // Mois de l'année scolaire
  const listMois = [
    'Septembre', 'Octobre', 'Novembre', 'Décembre', 
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août'
  ];
  
  // Année civile associée par défaut aux mois scolaires (ex: 2025 pour Sept-Déc, 2026 pour Janv-Août pour l'année 2025-2026)
  const getYearForMois = (mois: string) => {
    const years = anneeScolaire.split('-');
    const yearStart = years[0] || '2025';
    const yearEnd = years[1] || '2026';
    const firstPart = ['Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return firstPart.includes(mois) ? yearStart : yearEnd;
  };

  const [selectedMois, setSelectedMois] = useState<string>(listMois[1]!); // Octobre par défaut

  // Formulaires
  const [profileForm, setProfileForm] = useState({ id: '', taux_horaire: '', heures_mensuelles_prevues: '' });
  const [absenceForm, setAbsenceForm] = useState({ id_professeur: '', date_absence: '', heures_absentes: '1', justifie: false, motif: '' });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);

  // Fiche de paie en cours d'édition/saisie
  const [paieForm, setPaieForm] = useState<any>({
    id_professeur: '',
    heures_prevues: 0,
    heures_absentes_non_justifiees: 0,
    taux_horaire: 0,
    primes: 0,
    avances: 0,
    cnps: 0,
    retenues: 0
  });

  const fetchData = async () => {
    try {
      // Garantir que la structure de la base de données est à jour sans nécessiter de redémarrage d'Electron
      try {
        await (window as any).electronAPI.dbQuery("ALTER TABLE professeurs ADD COLUMN taux_horaire DECIMAL(15,2) DEFAULT 0 AFTER email");
      } catch (e) {}
      try {
        await (window as any).electronAPI.dbQuery("ALTER TABLE professeurs ADD COLUMN heures_mensuelles_prevues INTEGER DEFAULT 0 AFTER taux_horaire");
      } catch (e) {}

      try {
        await (window as any).electronAPI.dbQuery(`
          CREATE TABLE IF NOT EXISTS absences_professeurs (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            id_professeur INTEGER NOT NULL,
            date_absence DATE NOT NULL,
            heures_absentes INTEGER DEFAULT 1,
            justifie TINYINT(1) DEFAULT 0,
            motif TEXT,
            annee_scolaire VARCHAR(50) DEFAULT '2025-2026'
          )
        `);
      } catch (e) {}

      try {
        await (window as any).electronAPI.dbQuery(`
          CREATE TABLE IF NOT EXISTS fiches_paie (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            id_professeur INTEGER NOT NULL,
            mois VARCHAR(50) NOT NULL,
            heures_prevues INTEGER DEFAULT 0,
            heures_absentes_non_justifiees INTEGER DEFAULT 0,
            taux_horaire DECIMAL(15,2) DEFAULT 0,
            primes DECIMAL(15,2) DEFAULT 0,
            avances DECIMAL(15,2) DEFAULT 0,
            cnps DECIMAL(15,2) DEFAULT 0,
            retenues DECIMAL(15,2) DEFAULT 0,
            salaire_net DECIMAL(15,2) DEFAULT 0,
            date_paiement DATE,
            statut VARCHAR(20) DEFAULT 'en_attente',
            annee_scolaire VARCHAR(50) DEFAULT '2025-2026',
            UNIQUE KEY unique_paie (id_professeur, mois, annee_scolaire)
          )
        `);
      } catch (e) {}

      const resT = await (window as any).electronAPI.dbQuery('SELECT * FROM professeurs ORDER BY nom, prenom');
      if (resT.success) setTeachers(resT.data || []);

      const resA = await (window as any).electronAPI.dbQuery(`
        SELECT a.*, p.nom, p.prenom 
        FROM absences_professeurs a 
        JOIN professeurs p ON a.id_professeur = p.id 
        WHERE a.annee_scolaire = ? 
        ORDER BY a.date_absence DESC
      `, [anneeScolaire]);
      if (resA.success) setAbsences(resA.data || []);

      const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
      if (resComp.success && resComp.data && resComp.data.length > 0) setCompany(resComp.data[0]);

      await fetchFichesPaie();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFichesPaie = async () => {
    try {
      const moisComplet = `${selectedMois} ${getYearForMois(selectedMois)}`;
      const resF = await (window as any).electronAPI.dbQuery(`
        SELECT f.*, p.nom, p.prenom, p.specialite
        FROM fiches_paie f
        JOIN professeurs p ON f.id_professeur = p.id
        WHERE f.mois = ? AND f.annee_scolaire = ?
      `, [moisComplet, anneeScolaire]);
      if (resF.success) setFichesPaie(resF.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [anneeScolaire]);

  useEffect(() => {
    fetchFichesPaie();
  }, [selectedMois, anneeScolaire]);

  // Actions Profil Financier
  const openProfileEdit = (teach: any) => {
    setProfileForm({
      id: teach.id.toString(),
      taux_horaire: teach.taux_horaire ? teach.taux_horaire.toString() : '0',
      heures_mensuelles_prevues: teach.heures_mensuelles_prevues ? teach.heures_mensuelles_prevues.toString() : '0'
    });
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await (window as any).electronAPI.dbQuery(
        'UPDATE professeurs SET taux_horaire = ?, heures_mensuelles_prevues = ? WHERE id = ?',
        [parseFloat(profileForm.taux_horaire) || 0, parseInt(profileForm.heures_mensuelles_prevues) || 0, parseInt(profileForm.id)]
      );
      setShowProfileModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Actions Absences
  const [editingAbsenceId, setEditingAbsenceId] = useState<number | null>(null);

  const startEditAbsence = (abs: any) => {
    setEditingAbsenceId(abs.id);
    setAbsenceForm({
      id_professeur: abs.id_professeur.toString(),
      date_absence: abs.date_absence ? abs.date_absence.slice(0, 10) : '',
      heures_absentes: abs.heures_absentes.toString(),
      justifie: abs.justifie === 1,
      motif: abs.motif || ''
    });
  };

  const handleSaveAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAbsenceId) {
        await (window as any).electronAPI.dbQuery(
          'UPDATE absences_professeurs SET id_professeur = ?, date_absence = ?, heures_absentes = ?, justifie = ?, motif = ? WHERE id = ?',
          [
            parseInt(absenceForm.id_professeur),
            absenceForm.date_absence,
            parseInt(absenceForm.heures_absentes) || 1,
            absenceForm.justifie ? 1 : 0,
            absenceForm.motif,
            editingAbsenceId
          ]
        );
        setEditingAbsenceId(null);
      } else {
        await (window as any).electronAPI.dbQuery(
          'INSERT INTO absences_professeurs (id_professeur, date_absence, heures_absentes, justifie, motif, annee_scolaire) VALUES (?, ?, ?, ?, ?, ?)',
          [
            parseInt(absenceForm.id_professeur),
            absenceForm.date_absence,
            parseInt(absenceForm.heures_absentes) || 1,
            absenceForm.justifie ? 1 : 0,
            absenceForm.motif,
            anneeScolaire
          ]
        );
      }
      setAbsenceForm({ id_professeur: '', date_absence: '', heures_absentes: '1', justifie: false, motif: '' });
      setShowAbsenceModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAbsence = async (id: number) => {
    if (window.confirm('Supprimer cette absence ?')) {
      try {
        await (window as any).electronAPI.dbQuery('DELETE FROM absences_professeurs WHERE id = ?', [id]);
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleAbsenceJustification = async (abs: any) => {
    try {
      const newStatus = abs.justifie ? 0 : 1;
      await (window as any).electronAPI.dbQuery('UPDATE absences_professeurs SET justifie = ? WHERE id = ?', [newStatus, abs.id]);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Actions Calcul et Paiement des salaires
  const selectTeacherForPaie = async (teachId: string) => {
    if (!teachId) {
      setPaieForm({
        id_professeur: '',
        heures_prevues: 0,
        heures_absentes_non_justifiees: 0,
        taux_horaire: 0,
        primes: 0,
        avances: 0,
        cnps: 0,
        retenues: 0
      });
      return;
    }

    const teach = teachers.find(t => t.id.toString() === teachId);
    if (!teach) return;

    // Calculer les heures d'absences non justifiées pour ce prof sur le mois sélectionné
    const year = getYearForMois(selectedMois);
    const monthNamesFr = {
      'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11,
      'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3, 'Mai': 4, 'Juin': 5, 'Juillet': 6, 'Août': 7
    };
    const targetMonthIndex = (monthNamesFr as any)[selectedMois];
    const targetYear = parseInt(year);

    // Filtrer les absences non justifiées du mois
    const teacherAbsences = absences.filter(a => {
      if (a.id_professeur !== teach.id || a.justifie === 1) return false;
      const d = new Date(a.date_absence);
      return d.getMonth() === targetMonthIndex && d.getFullYear() === targetYear;
    });

    const totalAbsHrs = teacherAbsences.reduce((sum, abs) => sum + (abs.heures_absentes || 0), 0);
    const prevues = teach.heures_mensuelles_prevues || 0;
    const rate = teach.taux_horaire || 0;

    // Vérifier si une fiche existe déjà en base
    const moisComplet = `${selectedMois} ${year}`;
    const resExist = await (window as any).electronAPI.dbQuery(
      'SELECT * FROM fiches_paie WHERE id_professeur = ? AND mois = ? AND annee_scolaire = ?',
      [teach.id, moisComplet, anneeScolaire]
    );

    if (resExist.success && resExist.data && resExist.data.length > 0) {
      const f = resExist.data[0];
      setPaieForm({
        id: f.id,
        id_professeur: teach.id.toString(),
        heures_prevues: f.heures_prevues,
        heures_absentes_non_justifiees: f.heures_absentes_non_justifiees,
        taux_horaire: f.taux_horaire,
        primes: f.primes,
        avances: f.avances,
        cnps: f.cnps,
        retenues: f.retenues,
        statut: f.statut
      });
    } else {
      setPaieForm({
        id_professeur: teach.id.toString(),
        heures_prevues: prevues,
        heures_absentes_non_justifiees: totalAbsHrs,
        taux_horaire: rate,
        primes: 0,
        avances: 0,
        cnps: 0,
        retenues: 0,
        statut: 'en_attente'
      });
    }
  };

  const calculateBrut = () => {
    const prevues = Number(paieForm.heures_prevues || 0);
    const absentes = Number(paieForm.heures_absentes_non_justifiees || 0);
    const taux = Number(paieForm.taux_horaire || 0);
    const netHrs = Math.max(0, prevues - absentes);
    return netHrs * taux;
  };

  const calculateNet = () => {
    const brut = Number(calculateBrut() || 0);
    const primes = Number(paieForm.primes || 0);
    const avances = Number(paieForm.avances || 0);
    const cnps = Number(paieForm.cnps || 0);
    const retenues = Number(paieForm.retenues || 0);
    return brut + primes - avances - cnps - retenues;
  };

  const handleSavePaie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paieForm.id_professeur) return;

    try {
      const year = getYearForMois(selectedMois);
      const moisComplet = `${selectedMois} ${year}`;
      const netVal = calculateNet();

      if (paieForm.id) {
        // Mettre à jour
        await (window as any).electronAPI.dbQuery(`
          UPDATE fiches_paie 
          SET heures_prevues = ?, heures_absentes_non_justifiees = ?, taux_horaire = ?, 
              primes = ?, avances = ?, cnps = ?, retenues = ?, salaire_net = ?
          WHERE id = ?
        `, [
          paieForm.heures_prevues, paieForm.heures_absentes_non_justifiees, paieForm.taux_horaire,
          paieForm.primes, paieForm.avances, paieForm.cnps, paieForm.retenues, netVal, paieForm.id
        ]);
      } else {
        // Insérer
        await (window as any).electronAPI.dbQuery(`
          INSERT INTO fiches_paie (id_professeur, mois, heures_prevues, heures_absentes_non_justifiees, taux_horaire, primes, avances, cnps, retenues, salaire_net, statut, annee_scolaire)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)
        `, [
          parseInt(paieForm.id_professeur), moisComplet, paieForm.heures_prevues, paieForm.heures_absentes_non_justifiees,
          paieForm.taux_horaire, paieForm.primes, paieForm.avances, paieForm.cnps, paieForm.retenues, netVal, anneeScolaire
        ]);
      }

      alert("Fiche de paie enregistrée avec succès !");
      setSelectedTeacherId('');
      selectTeacherForPaie('');
      fetchFichesPaie();
    } catch (err) {
      console.error(err);
    }
  };

  const processPaiement = async (fiche: any) => {
    if (fiche.statut === 'paye') return;
    if (!window.confirm(`Confirmer le paiement de ${fiche.salaire_net.toLocaleString()} FCFA à ${fiche.nom} ${fiche.prenom} ?`)) return;

    try {
      const today = new Date().toISOString().slice(0, 10);
      
      // 1. Mettre à jour le statut de la fiche de paie
      await (window as any).electronAPI.dbQuery(
        "UPDATE fiches_paie SET statut = 'paye', date_paiement = ? WHERE id = ?",
        [today, fiche.id]
      );

      alert("Paiement enregistré avec succès !");
      fetchFichesPaie();
    } catch (err) {
      console.error(err);
    }
  };

  const startEditFiche = (fiche: any) => {
    setSelectedTeacherId(fiche.id_professeur.toString());
    setPaieForm({
      id: fiche.id,
      id_professeur: fiche.id_professeur.toString(),
      heures_prevues: fiche.heures_prevues,
      heures_absentes_non_justifiees: fiche.heures_absentes_non_justifiees,
      taux_horaire: fiche.taux_horaire,
      primes: fiche.primes,
      avances: fiche.avances,
      cnps: fiche.cnps,
      retenues: fiche.retenues,
      statut: fiche.statut
    });
    setActiveTab('paie');
  };

  const handlePrintPaie = async (fiche: any) => {
    try {
      let logoBase64 = '';
      if (company?.logo_path) {
        const resLogo = await (window as any).electronAPI.mediaGetBase64(company.logo_path);
        if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
      }
      if (!logoBase64) {
        const resLogo = await (window as any).electronAPI.mediaGetBase64('logo.png');
        if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
      }

      const brut = (Number(fiche.heures_prevues || 0) - Number(fiche.heures_absentes_non_justifiees || 0)) * Number(fiche.taux_horaire || 0);
      const dateEdition = new Date().toLocaleDateString();

      const bulletinContent = (copyLabel: string) => `
        <div class="bulletin-container">
          ${logoBase64 ? `<img src="${logoBase64}" class="watermark-overlay">` : ''}
          <div style="position: relative; z-index: 10;">
            <div class="copy-label">${copyLabel}</div>
            <table class="header-table">
              <tr>
                <td class="logo-cell">
                  ${logoBase64 ? `<img src="${logoBase64}" class="logo">` : '<b>[LOGO]</b>'}
                </td>
                <td class="title-cell">
                  ${company?.company_name || 'MON ÉTABLISSEMENT SCOLAIRE'}<br>
                  <span style="font-size: 10px; font-weight: normal;">${company?.address || ''} | Tél: ${company?.phone || ''}</span><br>
                  <span style="font-size: 12px; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px;">BULLETIN DE PAIE - ${fiche.mois.toUpperCase()}</span>
                </td>
              </tr>
            </table>

            <div class="bulletin-card">
              <div class="section-title">Informations Salarié</div>
              <table class="info-table">
                <tr>
                  <td class="info-label">Nom & Prénom :</td>
                  <td><b>${fiche.nom.toUpperCase()} ${fiche.prenom}</b></td>
                  <td class="info-label">Spécialité/Matière :</td>
                  <td>${fiche.specialite || 'Enseignant'}</td>
                </tr>
                <tr>
                  <td class="info-label">Année Scolaire :</td>
                  <td>${fiche.annee_scolaire}</td>
                  <td class="info-label">Date d'édition :</td>
                  <td>${dateEdition}</td>
                </tr>
              </table>

              <div class="section-title">Détails de la Rémunération</div>
              <table class="grid-table">
                <thead>
                  <tr>
                    <th>Élément de Salaire</th>
                    <th class="text-right">Base / Heures</th>
                    <th class="text-right">Taux Horaire</th>
                    <th class="text-right">Gains (+)</th>
                    <th class="text-right">Retenues (-)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Heures Contractuelles Prévues</td>
                    <td class="text-right">${fiche.heures_prevues} h</td>
                    <td class="text-right">${Number(fiche.taux_horaire || 0).toLocaleString()}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                  </tr>
                  <tr>
                    <td>Retenue pour Absences Non Justifiées</td>
                    <td class="text-right" style="color:red;">-${fiche.heures_absentes_non_justifiees} h</td>
                    <td class="text-right">${Number(fiche.taux_horaire || 0).toLocaleString()}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                  </tr>
                  <tr style="font-weight: bold;">
                    <td>Heures Effectives Payées (Brut)</td>
                    <td class="text-right">${fiche.heures_prevues - fiche.heures_absentes_non_justifiees} h</td>
                    <td class="text-right">${Number(fiche.taux_horaire || 0).toLocaleString()}</td>
                    <td class="text-right">${brut.toLocaleString()} FCFA</td>
                    <td class="text-right">-</td>
                  </tr>
                  ${Number(fiche.primes || 0) > 0 ? `
                  <tr>
                    <td>Primes & Gratifications</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">${Number(fiche.primes || 0).toLocaleString()} FCFA</td>
                    <td class="text-right">-</td>
                  </tr>` : ''}
                  ${Number(fiche.cnps || 0) > 0 ? `
                  <tr>
                    <td>Retenue Sociale (CNPS)</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">${Number(fiche.cnps || 0).toLocaleString()} FCFA</td>
                  </tr>` : ''}
                  ${Number(fiche.avances || 0) > 0 ? `
                  <tr>
                    <td>Acomptes / Avances sur salaire</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">${Number(fiche.avances || 0).toLocaleString()} FCFA</td>
                  </tr>` : ''}
                  ${Number(fiche.retenues || 0) > 0 ? `
                  <tr>
                    <td>Retenues diverses / Pénalités</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">${Number(fiche.retenues || 0).toLocaleString()} FCFA</td>
                  </tr>` : ''}
                </tbody>
              </table>

              <div class="net-box">
                NET À PAYER : ${Number(fiche.salaire_net || 0).toLocaleString()} FCFA
              </div>
            </div>
            
            <div class="signatures">
              <div class="sig-col">
                <span class="sig-label">Signature du Salarié</span>
                <p style="font-size:9px; color:#555; margin: 0;">(Précédé de la mention "Lu et approuvé")</p>
              </div>
              <div class="sig-col">
                <span class="sig-label">Le Chef d'Établissement</span>
                <p style="font-size:10px; font-weight:bold; margin: 0;">${company?.chef_etablissement || 'Le Directeur'}</p>
              </div>
            </div>
          </div>
        </div>
      `;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: A4; margin: 5mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 5px; font-size: 11px; color: #333; }
            .bulletin-container { border: 1.5px solid #000; padding: 10px; margin-bottom: 5px; border-radius: 8px; position: relative; overflow: hidden; height: 132mm; box-sizing: border-box; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .logo-cell { width: 12%; text-align: left; }
            .logo { height: 50px; object-fit: contain; }
            .title-cell { text-align: center; font-weight: bold; font-size: 14px; line-height: 1.2; }
            .bulletin-card { border: 1px solid #000; padding: 8px; margin-bottom: 8px; background: #fff; }
            .section-title { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; }
            .info-table { width: 100%; margin-bottom: 6px; }
            .info-table td { padding: 2px; font-size: 11px; }
            .info-label { font-weight: bold; width: 25%; }
            .grid-table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 10px; }
            .grid-table th, .grid-table td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 10.5px; }
            .grid-table th { background: #f2f2f2; font-weight: bold; }
            .text-right { text-align: right; }
            .net-box { border: 1.5px solid #000; background: #f9f9f9; padding: 8px; font-size: 13px; font-weight: bold; text-align: center; margin-top: 5px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 15px; }
            .sig-col { text-align: center; width: 45%; }
            .sig-label { font-weight: bold; text-decoration: underline; display: block; margin-bottom: 30px; font-size: 10.5px; }
            .watermark-overlay {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 250px;
              height: 250px;
              object-fit: contain;
              opacity: 0.12;
              pointer-events: none;
              z-index: 1;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .copy-label { font-size: 9px; font-weight: bold; text-align: right; text-transform: uppercase; color: #666; margin-bottom: 2px; }
            .scissors { border-top: 1px dashed #000; margin: 12px 0; position: relative; text-align: center; }
            .scissors::after { content: '✂️ COUPER ICI ✂️'; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 10px; font-size: 9px; font-weight: bold; }
          </style>
        </head>
        <body>
          ${bulletinContent('Copie Salarié')}
          <div class="scissors"></div>
          ${bulletinContent('Copie Établissement')}
        </body>
        </html>
      `;
      await (window as any).electronAPI.printBulletin(html);
    } catch (err) {
      alert("Erreur lors de l'impression du bulletin de paie.");
    }
  };

  const getAbsenceCountForMonth = (teachId: number) => {
    const year = getYearForMois(selectedMois);
    const monthNamesFr = {
      'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11,
      'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3, 'Mai': 4, 'Juin': 5, 'Juillet': 6, 'Août': 7
    };
    const targetMonthIndex = (monthNamesFr as any)[selectedMois];
    const targetYear = parseInt(year);

    return absences.filter(a => {
      if (a.id_professeur !== teachId || a.justifie === 1) return false;
      const d = new Date(a.date_absence);
      return d.getMonth() === targetMonthIndex && d.getFullYear() === targetYear;
    }).reduce((sum, a) => sum + (a.heures_absentes || 0), 0);
  };

  return (
    <div className="container-fluid p-0">
      {/* Navigation tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'profiles' ? 'active text-success' : 'text-secondary'}`} onClick={() => setActiveTab('profiles')}>
            👨‍🏫 Paramètres Financiers
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'absences' ? 'active text-success' : 'text-secondary'}`} onClick={() => setActiveTab('absences')}>
            ⚠️ Suivi des Absences
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'paie' ? 'active text-success' : 'text-secondary'}`} onClick={() => setActiveTab('paie')}>
            🪙 Calculateur de Paie
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${activeTab === 'history' ? 'active text-success' : 'text-secondary'}`} onClick={() => setActiveTab('history')}>
            📜 Historique des Paiements ({selectedMois})
          </button>
        </li>
      </ul>

      {/* Onglet A : Paramètres financiers */}
      {activeTab === 'profiles' && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3">
            <h6 className="mb-0 fw-bold text-success">Configuration des profils financiers des Enseignants</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Professeur</th>
                    <th>Spécialité</th>
                    <th className="text-center">Taux Horaire (FCFA)</th>
                    <th className="text-center">Heures Mensuelles Contrat</th>
                    <th className="text-center">Salaire Théorique Mensuel</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t_teach => (
                    <tr key={t_teach.id}>
                      <td className="fw-bold ps-3">{t_teach.nom} {t_teach.prenom}</td>
                      <td><span className="badge bg-light text-dark border">{t_teach.specialite || '-'}</span></td>
                      <td className="text-center fw-bold text-success">{(t_teach.taux_horaire || 0).toLocaleString()} FCFA</td>
                      <td className="text-center">{t_teach.heures_mensuelles_prevues || 0} h</td>
                      <td className="text-center fw-bold text-primary">{((t_teach.taux_horaire || 0) * (t_teach.heures_mensuelles_prevues || 0)).toLocaleString()} FCFA</td>
                      <td className="text-end pe-3">
                        <button className="btn btn-sm btn-outline-success" onClick={() => openProfileEdit(t_teach)}>
                          ⚙️ Paramétrer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Onglet B : Suivi des Absences */}
      {activeTab === 'absences' && (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-success">
                  {editingAbsenceId ? "Modifier l'absence Enseignant" : "Déclarer une absence Enseignant"}
                </h6>
                {editingAbsenceId && (
                  <button 
                    type="button" 
                    className="btn btn-xs btn-outline-secondary fw-bold" 
                    onClick={() => {
                      setEditingAbsenceId(null);
                      setAbsenceForm({ id_professeur: '', date_absence: '', heures_absentes: '1', justifie: false, motif: '' });
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
              <div className="card-body p-3">
                <form onSubmit={handleSaveAbsence}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Enseignant</label>
                    <select className="form-select" required value={absenceForm.id_professeur} onChange={e => setAbsenceForm({...absenceForm, id_professeur: e.target.value})}>
                      <option value="">-- Sélectionner l'enseignant --</option>
                      {teachers.map(t_teach => <option key={t_teach.id} value={t_teach.id}>{t_teach.nom} {t_teach.prenom}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Date d'absence</label>
                    <input type="date" className="form-control" required value={absenceForm.date_absence} onChange={e => setAbsenceForm({...absenceForm, date_absence: e.target.value})} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Nombre d'heures d'absence</label>
                    <input type="number" min="1" max="20" className="form-control" required value={absenceForm.heures_absentes} onChange={e => setAbsenceForm({...absenceForm, heures_absentes: e.target.value})} />
                  </div>
                  <div className="mb-3 form-check form-switch">
                    <input className="form-check-input" type="checkbox" role="switch" id="justifieSwitch" checked={absenceForm.justifie} onChange={e => setAbsenceForm({...absenceForm, justifie: e.target.checked})} />
                    <label className="form-check-label small fw-bold" htmlFor="justifieSwitch">Absence Justifiée ?</label>
                    <div className="text-muted small" style={{fontSize:'10px'}}>Les absences justifiées ne déclenchent pas de retenues sur la paie.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Motif</label>
                    <textarea className="form-control" rows={2} placeholder="Ex: Certificat médical, empêchement familial..." value={absenceForm.motif} onChange={e => setAbsenceForm({...absenceForm, motif: e.target.value})}></textarea>
                  </div>
                  <button type="submit" className="btn btn-success btn-sm w-100 fw-bold py-2 shadow-sm">
                    {editingAbsenceId ? "💾 Confirmer la modification" : "⚠️ Enregistrer l'absence"}
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-8">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white py-3">
                <h6 className="mb-0 fw-bold text-success">Journal des absences des professeurs ({anneeScolaire})</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-3">Nom</th>
                        <th>Date</th>
                        <th className="text-center">Heures</th>
                        <th className="text-center">Statut</th>
                        <th>Motif</th>
                        <th className="text-end pe-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absences.map(abs => (
                        <tr key={abs.id}>
                          <td className="fw-bold ps-3">{abs.nom} {abs.prenom}</td>
                          <td>{new Date(abs.date_absence).toLocaleDateString()}</td>
                          <td className="text-center">{abs.heures_absentes} h</td>
                          <td className="text-center">
                            <button 
                              type="button"
                              onClick={() => toggleAbsenceJustification(abs)} 
                              className={`btn btn-xs rounded-pill fw-bold border ${abs.justifie ? 'btn-success text-white' : 'btn-danger text-white'}`}
                              style={{fontSize: '10px', padding: '2px 8px'}}
                            >
                              {abs.justifie ? 'JUSTIFIÉE' : 'NON JUSTIFIÉE'}
                            </button>
                          </td>
                          <td className="small text-muted">{abs.motif || '-'}</td>
                          <td className="text-end pe-3">
                            <button className="btn btn-sm btn-outline-primary border-0 me-1" title="Modifier l'absence" onClick={() => startEditAbsence(abs)}>✏️</button>
                            <button className="btn btn-sm btn-outline-danger border-0" onClick={() => deleteAbsence(abs.id)}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                      {absences.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-4 text-muted italic small">Aucune absence enregistrée pour cette année scolaire.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet C : Calculateur de paie */}
      {activeTab === 'paie' && (
        <div className="row g-4">
          <div className="col-md-5">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-success">Calculer le salaire mensuel</h6>
                <select className="form-select form-select-sm" style={{width: '140px'}} value={selectedMois} onChange={e => { setSelectedMois(e.target.value); setSelectedTeacherId(''); selectTeacherForPaie(''); }}>
                  {listMois.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="card-body p-3">
                <form onSubmit={handleSavePaie}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Sélectionner l'Enseignant</label>
                    <select className="form-select" required value={selectedTeacherId} onChange={e => { setSelectedTeacherId(e.target.value); selectTeacherForPaie(e.target.value); }}>
                      <option value="">-- Choisir l'enseignant --</option>
                      {teachers.map(t_teach => <option key={t_teach.id} value={t_teach.id}>{t_teach.nom} {t_teach.prenom}</option>)}
                    </select>
                  </div>
                  
                  {selectedTeacherId && (
                    <div className="animate__animated animate__fadeIn">
                      <div className="row g-2">
                        <div className="col-md-6 mb-2">
                          <label className="form-label small fw-bold">Heures Prévues / Base</label>
                          <input type="number" className="form-control" required value={paieForm.heures_prevues} onChange={e => setPaieForm({...paieForm, heures_prevues: parseInt(e.target.value) || 0})} />
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="form-label small fw-bold">Absences Non Justifiées</label>
                          <input type="number" className="form-control" required value={paieForm.heures_absentes_non_justifiees} onChange={e => setPaieForm({...paieForm, heures_absentes_non_justifiees: parseInt(e.target.value) || 0})} />
                          <div className="text-muted small" style={{fontSize: '9px'}}>Retirées des heures effectives.</div>
                        </div>
                        <div className="col-md-12 mb-2">
                          <label className="form-label small fw-bold">Taux Horaire (FCFA)</label>
                          <input type="number" className="form-control" required value={paieForm.taux_horaire} onChange={e => setPaieForm({...paieForm, taux_horaire: parseFloat(e.target.value) || 0})} />
                        </div>
                      </div>

                      {/* ÉLÉMENTS DE PAIE MODULAIRES */}
                      <div className="bg-light p-3 rounded border my-3">
                        <span className="small fw-bold text-secondary mb-2 d-block border-bottom pb-1">Éléments Modulables (FCFA)</span>
                        <div className="row g-2">
                          <div className="col-md-6 mb-2">
                            <label className="form-label small fw-bold text-success">+ Primes</label>
                            <input type="number" className="form-control form-control-sm" value={paieForm.primes} onChange={e => setPaieForm({...paieForm, primes: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div className="col-md-6 mb-2">
                            <label className="form-label small fw-bold text-danger">- Avances (Acomptes)</label>
                            <input type="number" className="form-control form-control-sm" value={paieForm.avances} onChange={e => setPaieForm({...paieForm, avances: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div className="col-md-6 mb-2">
                            <label className="form-label small fw-bold text-danger">- Cotisation CNPS</label>
                            <input type="number" className="form-control form-control-sm" value={paieForm.cnps} onChange={e => setPaieForm({...paieForm, cnps: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div className="col-md-6 mb-2">
                            <label className="form-label small fw-bold text-danger">- Retenues diverses</label>
                            <input type="number" className="form-control form-control-sm" value={paieForm.retenues} onChange={e => setPaieForm({...paieForm, retenues: parseFloat(e.target.value) || 0})} />
                          </div>
                        </div>
                      </div>

                      {/* RÉSUMÉ FINANCIER */}
                      <div className="border rounded p-3 mb-3 bg-white">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="small text-muted">Heures Effectives :</span>
                          <span className="fw-bold">{paieForm.heures_prevues - paieForm.heures_absentes_non_justifiees} h / {paieForm.heures_prevues} h</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="small text-muted">Salaire de Base Brut :</span>
                          <span className="fw-bold">{calculateBrut().toLocaleString()} FCFA</span>
                        </div>
                        <div className="d-flex justify-content-between border-top pt-2 mt-2">
                          <span className="fw-bold text-dark">SALAIRE NET :</span>
                          <span className="fw-bold text-success fs-5">{calculateNet().toLocaleString()} FCFA</span>
                        </div>
                      </div>

                      {paieForm.statut === 'paye' ? (
                        <div className="alert alert-success py-2 px-3 small fw-bold text-center">
                          ✓ Cette fiche de paie a déjà été payée (non modifiable).
                        </div>
                      ) : (
                        <button type="submit" className="btn btn-primary btn-sm w-100 fw-bold py-2 shadow-sm">
                          💾 Enregistrer la Fiche de Paie
                        </button>
                      )}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-7 animate__animated animate__fadeIn">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white py-3">
                <h6 className="mb-0 fw-bold text-success">Notes explicatives & Synthèse pour {selectedMois}</h6>
              </div>
              <div className="card-body p-4 d-flex flex-column justify-content-center">
                {!selectedTeacherId ? (
                  <div className="text-center text-muted p-5">
                    <span className="fs-1 d-block mb-3">🪙</span>
                    Sélectionnez un enseignant pour commencer à paramétrer et calculer son bulletin de salaire pour le mois de <b>{selectedMois} {getYearForMois(selectedMois)}</b>.
                  </div>
                ) : (
                  <div>
                    <h6 className="fw-bold text-primary mb-3">Rappel des absences non justifiées détectées :</h6>
                    {getAbsenceCountForMonth(parseInt(selectedTeacherId)) > 0 ? (
                      <div className="alert alert-danger py-2 px-3 mb-3 small">
                        ⚠️ Cet enseignant comptabilise <b>{getAbsenceCountForMonth(parseInt(selectedTeacherId))} heures</b> d'absence non justifiées sur le mois de {selectedMois}. Elles ont été automatiquement pré-remplies et déduites de son salaire.
                      </div>
                    ) : (
                      <div className="alert alert-success py-2 px-3 mb-3 small">
                        ✓ Aucune absence non justifiée détectée pour cet enseignant en {selectedMois}.
                      </div>
                    )}
                    <div className="border rounded p-3 bg-light">
                      <span className="small fw-bold text-uppercase text-secondary d-block mb-2">Formule de calcul :</span>
                      <code className="d-block mb-1">Salaire_Brut = (Heures_Prevues - Absences_Non_Justifiees) * Taux_Horaire</code>
                      <code>Salaire_Net = Salaire_Brut + Primes - Avances - CNPS - Retenues</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet D : Historique des Paiements */}
      {activeTab === 'history' && (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-bold text-success">Fiches de paie générées pour {selectedMois} {getYearForMois(selectedMois)}</h6>
            <select className="form-select form-select-sm" style={{width: '140px'}} value={selectedMois} onChange={e => setSelectedMois(e.target.value)}>
              {listMois.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">Professeur</th>
                    <th>Spécialité</th>
                    <th className="text-center">Taux Horaire</th>
                    <th className="text-center">Heures de base</th>
                    <th className="text-center">Abs. déduites</th>
                    <th className="text-center">Net à Payer (FCFA)</th>
                    <th className="text-center">Statut</th>
                    <th className="text-end pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fichesPaie.map(fiche => (
                    <tr key={fiche.id}>
                      <td className="fw-bold ps-3">{fiche.nom} {fiche.prenom}</td>
                      <td><span className="badge bg-light text-dark border">{fiche.specialite || 'Enseignant'}</span></td>
                      <td className="text-center fw-bold text-success">{(fiche.taux_horaire || 0).toLocaleString()} F/h</td>
                      <td className="text-center">{fiche.heures_prevues} h</td>
                      <td className="text-center text-danger">{fiche.heures_absentes_non_justifiees > 0 ? `-${fiche.heures_absentes_non_justifiees} h` : '0 h'}</td>
                      <td className="text-center fw-bold text-success">{(fiche.salaire_net || 0).toLocaleString()} FCFA</td>
                      <td className="text-center">
                        <span className={`badge ${fiche.statut === 'paye' ? 'bg-success' : 'bg-warning'} px-2 py-1`}>
                          {fiche.statut === 'paye' ? 'PAYÉ' : 'EN ATTENTE'}
                        </span>
                      </td>
                      <td className="text-end pe-3">
                        <div className="d-flex gap-1 justify-content-end">
                          <button type="button" className="btn btn-sm btn-outline-info" title="Imprimer le Bulletin de Paie" onClick={() => handlePrintPaie(fiche)}>
                            🖨️ Bulletin
                          </button>
                          {fiche.statut !== 'paye' && (
                            <>
                              <button type="button" className="btn btn-sm btn-outline-warning" title="Modifier la Fiche de Paie" onClick={() => startEditFiche(fiche)}>
                                ✏️ Modifier
                              </button>
                              <button type="button" className="btn btn-sm btn-success" onClick={() => processPaiement(fiche)}>
                                🪙 Payer
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {fichesPaie.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center p-5 text-muted italic small">Aucune fiche de paie enregistrée pour ce mois. Rendez-vous dans l'onglet "Calculateur de Paie" pour les générer.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Profile Edit */}
      {showProfileModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white border-0">
                <h5 className="modal-title fw-bold">⚙️ Paramètres Financiers</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowProfileModal(false)}></button>
              </div>
              <form onSubmit={handleSaveProfile}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Taux Horaire par défaut (FCFA)</label>
                    <input type="number" className="form-control" required value={profileForm.taux_horaire} onChange={e => setProfileForm({...profileForm, taux_horaire: e.target.value})} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Heures Prévues par contrat mensuel</label>
                    <input type="number" className="form-control" required value={profileForm.heures_mensuelles_prevues} onChange={e => setProfileForm({...profileForm, heures_mensuelles_prevues: e.target.value})} />
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light" onClick={() => setShowProfileModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-success px-4">Sauvegarder</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HR;
