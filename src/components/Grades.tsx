import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface GradesProps {
  user: any;
  anneeScolaire: string;
}

const Grades: React.FC<GradesProps> = ({ user, anneeScolaire }) => {
  const { t } = useTranslation();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [matieres, setMatieres] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [disciplineSummary, setDisciplineSummary] = useState({ total_heures: 0, justifiees: 0 });
  const [applySanction, setApplySanction] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);

  const [gradeForm, setGradeForm] = useState({ id_matiere: '', note: '', periode: 'Trimestre 1' });

  const getTermSequences = (term: string) => {
    if (term === 'Trimestre 1') return ['Séquence 1', 'Séquence 2'];
    if (term === 'Trimestre 2') return ['Séquence 3', 'Séquence 4'];
    if (term === 'Trimestre 3') return ['Séquence 5', 'Séquence 6'];
    return [];
  };

  const fetchClassAverages = async (period: string) => {
    const isTerm = period.startsWith('Trimestre');
    if (isTerm) {
      const subPeriods = getTermSequences(period);
      const res = await (window as any).electronAPI.dbQuery(`
          SELECT n.id_etudiant, n.id_matiere, n.note, n.periode, m.coefficient
          FROM notes n
          JOIN matieres m ON n.id_matiere = m.id
          WHERE m.id_classe = ? AND n.periode IN (?, ?) AND n.annee_scolaire = ?
      `, [selectedClassId, subPeriods[0], subPeriods[1], anneeScolaire]);

      if (res.success && res.data) {
        const studentGrades: { [key: number]: { [key: number]: any[] } } = {};
        res.data.forEach((row: any) => {
          if (!studentGrades[row.id_etudiant]) {
            studentGrades[row.id_etudiant] = {};
          }
          if (!studentGrades[row.id_etudiant][row.id_matiere]) {
            studentGrades[row.id_etudiant][row.id_matiere] = [];
          }
          studentGrades[row.id_etudiant][row.id_matiere].push(row);
        });

        const averagesList = Object.keys(studentGrades).map(studIdStr => {
          const studId = Number(studIdStr);
          const matieresMap = studentGrades[studId];

          let totalPts = 0;
          let totalCf = 0;

          Object.keys(matieresMap).forEach(matiereIdStr => {
            const matiereId = Number(matiereIdStr);
            const mGrades = matieresMap[matiereId];

            const gradeA = mGrades.find(g => g.periode === subPeriods[0]);
            const gradeB = mGrades.find(g => g.periode === subPeriods[1]);

            let calculatedNote: number;
            if (gradeA && gradeB) {
              calculatedNote = (Number(gradeA.note || 0) + Number(gradeB.note || 0)) / 2;
            } else if (gradeA) {
              calculatedNote = Number(gradeA.note || 0);
            } else {
              calculatedNote = Number(gradeB.note || 0);
            }

            const coef = Number(mGrades[0].coefficient || 1);
            totalPts += calculatedNote * coef;
            totalCf += coef;
          });

          const moyenne = totalCf > 0 ? (totalPts / totalCf) : 0;
          return { id_etudiant: studId, moyenne };
        });

        averagesList.sort((a, b) => b.moyenne - a.moyenne);
        return { success: true, data: averagesList };
      }
      return { success: false, data: [] };
    } else {
      return await (window as any).electronAPI.dbQuery(`
          SELECT n.id_etudiant, SUM(n.note * m.coefficient) / SUM(m.coefficient) as moyenne
          FROM notes n
          JOIN matieres m ON n.id_matiere = m.id
          WHERE m.id_classe = ? AND n.periode = ? AND n.annee_scolaire = ?
          GROUP BY n.id_etudiant
          ORDER BY moyenne DESC
      `, [selectedClassId, period, anneeScolaire]);
    }
  };

  const fetchClosedPeriods = async () => {
    try {
        const res = await (window as any).electronAPI.dbQuery(
            'SELECT periode FROM clotures WHERE annee_scolaire = ? AND is_closed = 1',
            [anneeScolaire]
        );
        if (res && res.success) {
            setClosedPeriods(res.data.map((r: any) => r.periode));
        }
    } catch (err) {}
  };

  const fetchData = async () => {
    try {
        const resC = await (window as any).electronAPI.dbQuery('SELECT * FROM classes ORDER BY nom');
        if (resC.success) setClasses(resC.data || []);

        const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
        if (resComp.success && resComp.data && resComp.data.length > 0) setCompany(resComp.data[0]);
    } catch (err) {
        console.error("fetchData error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchClosedPeriods();
    if (selectedStudent) {
        selectStudent(selectedStudent);
    }
  }, [anneeScolaire]);

  const loadDiscipline = async (studentId: any, periode: string) => {
    try {
        const res = await (window as any).electronAPI.dbQuery(`
            SELECT 
                SUM(heures) as total,
                SUM(CASE WHEN justifie = 1 THEN heures ELSE 0 END) as justifiees
            FROM absences 
            WHERE id_etudiant = ? AND periode = ? AND annee_scolaire = ?
        `, [studentId, periode, anneeScolaire]);
        
        if (res.success && res.data.length > 0) {
            setDisciplineSummary({
                total_heures: res.data[0].total || 0,
                justifiees: res.data[0].justifiees || 0
            });
        } else {
            setDisciplineSummary({ total_heures: 0, justifiees: 0 });
        }
    } catch (err) {
        console.error("Error discipline:", err);
    }
  };

  useEffect(() => {
    if (selectedStudent && gradeForm.periode) {
        loadDiscipline(selectedStudent.id, gradeForm.periode);
    }
  }, [selectedStudent, gradeForm.periode]);

  useEffect(() => {
    if (selectedClassId) {
        const fetchClassData = async () => {
            try {
                const resS = await (window as any).electronAPI.dbQuery('SELECT * FROM etudiants WHERE id_classe = ? ORDER BY nom, prenom', [selectedClassId]);
                if (resS.success) {
                    setStudents(resS.data || []);
                }
                
                const resM = await (window as any).electronAPI.dbQuery('SELECT * FROM matieres WHERE id_classe = ? ORDER BY nom', [selectedClassId]);
                if (resM.success) {
                    setMatieres(resM.data || []);
                }
            } catch (err: any) {
                console.error("fetchClassData critical error:", err);
            }
        };
        fetchClassData();
    } else {
        setStudents([]);
        setMatieres([]);
    }
  }, [selectedClassId]);

  const selectStudent = async (s: any) => {
    if (!s) return;
    setSelectedStudent(s);
    try {
        const res = await (window as any).electronAPI.dbQuery(`
            SELECT n.*, m.nom as matiere_nom, m.coefficient 
            FROM notes n 
            JOIN matieres m ON n.id_matiere = m.id 
            WHERE n.id_etudiant = ? AND n.annee_scolaire = ? ORDER BY n.periode, m.nom
        `, [s.id, anneeScolaire]);
        
        if (res.success) {
            setGrades(Array.isArray(res.data) ? res.data : []);
        }
    } catch (err) {
        console.error("Error grades:", err);
    }
  };

  const handleAddGrade = async () => {
    try {
        const studentId = Number(selectedStudent?.id);
        const matiereId = Number(gradeForm.id_matiere);
        const noteValue = parseFloat(gradeForm.note);
        const periode = gradeForm.periode;

        if (!studentId || !matiereId || isNaN(noteValue)) {
            alert("Veuillez remplir tous les champs correctement.");
            return;
        }

        // Check closed periods
        if (closedPeriods.includes(periode) && user.role !== 'admin') {
            alert("Ce trimestre est clôturé. Seul l'administrateur peut modifier ces notes.");
            return;
        }

        const res = await (window as any).electronAPI.dbQuery(
            'INSERT INTO notes (id_etudiant, id_matiere, note, periode, annee_scolaire, date_saisie) VALUES (?, ?, ?, ?, ?, ?)',
            [studentId, matiereId, noteValue, periode, anneeScolaire, new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );

        if (res && res.success) {
            setGradeForm(prev => ({ ...prev, note: '' })); 
            await selectStudent(selectedStudent);
        } else {
            alert("Erreur lors de l'enregistrement : " + (res?.error || "Erreur inconnue"));
        }
    } catch (err: any) {
        console.error("Add grade error:", err);
        alert("Erreur système lors de l'ajout de la note.");
    }
  };

  const startEditGrade = (g: any) => {
    if (closedPeriods.includes(g.periode) && user.role !== 'admin') {
        alert("Ce trimestre est clôturé. Seul l'administrateur peut modifier ces notes.");
        return;
    }
    setEditingGradeId(g.id);
    setGradeForm({
        id_matiere: g.id_matiere.toString(),
        note: g.note.toString(),
        periode: g.periode
    });
  };

  const handleUpdateGrade = async () => {
    try {
        const noteValue = parseFloat(gradeForm.note);
        if (isNaN(noteValue) || !editingGradeId) {
            alert("Veuillez entrer une note valide.");
            return;
        }

        if (closedPeriods.includes(gradeForm.periode) && user.role !== 'admin') {
            alert("Ce trimestre est clôturé. Seul l'administrateur peut modifier ces notes.");
            return;
        }

        const res = await (window as any).electronAPI.dbQuery(
            'UPDATE notes SET note = ? WHERE id = ?',
            [noteValue, editingGradeId]
        );

        if (res && res.success) {
            setEditingGradeId(null);
            setGradeForm(prev => ({ ...prev, note: '' }));
            await selectStudent(selectedStudent);
        } else {
            alert("Erreur lors de la modification : " + (res?.error || "Erreur inconnue"));
        }
    } catch (err) {
        console.error("Update grade error:", err);
    }
  };

  const deleteGrade = async (id: number) => {
    const gradeToDelete = currentPeriodGrades.find(g => g.id === id);
    if (gradeToDelete && closedPeriods.includes(gradeToDelete.periode) && user.role !== 'admin') {
        alert("Ce trimestre est clôturé. Seul l'administrateur peut modifier ces notes.");
        return;
    }

    if (window.confirm('Supprimer cette note ?')) {
        try {
            await (window as any).electronAPI.dbQuery('DELETE FROM notes WHERE id = ?', [id]);
            selectStudent(selectedStudent);
        } catch (err) {
            console.error("Error deleting grade:", err);
        }
    }
  };

  const isTermPeriod = gradeForm.periode.startsWith('Trimestre');
  const termSeqs = isTermPeriod ? getTermSequences(gradeForm.periode) : [];

  let currentPeriodGrades: any[] = [];
  if (isTermPeriod) {
    const seqGrades = (Array.isArray(grades) ? grades : []).filter(
      g => g && (g.periode === termSeqs[0] || g.periode === termSeqs[1])
    );
    const gradesByMatiere: { [key: number]: any[] } = {};
    seqGrades.forEach(g => {
      if (g.id_matiere) {
        if (!gradesByMatiere[g.id_matiere]) {
          gradesByMatiere[g.id_matiere] = [];
        }
        gradesByMatiere[g.id_matiere].push(g);
      }
    });

    currentPeriodGrades = Object.keys(gradesByMatiere).map(subIdStr => {
      const subId = Number(subIdStr);
      const subGrades = gradesByMatiere[subId];
      const gradeA = subGrades.find(g => g.periode === termSeqs[0]);
      const gradeB = subGrades.find(g => g.periode === termSeqs[1]);

      let calculatedNote: number;
      if (gradeA && gradeB) {
        calculatedNote = (Number(gradeA.note || 0) + Number(gradeB.note || 0)) / 2;
      } else if (gradeA) {
        calculatedNote = Number(gradeA.note || 0);
      } else {
        calculatedNote = Number(gradeB.note || 0);
      }

      const firstGrade = gradeA || gradeB;
      return {
        id: `virtual_${subId}`,
        id_etudiant: firstGrade.id_etudiant,
        id_matiere: subId,
        matiere_nom: firstGrade.matiere_nom,
        coefficient: firstGrade.coefficient,
        note: calculatedNote.toFixed(2),
        periode: gradeForm.periode,
        isVirtual: true
      };
    });
  } else {
    currentPeriodGrades = (Array.isArray(grades) ? grades : []).filter(
      g => g && g.periode === (gradeForm?.periode || '')
    );
  }

  const totalPoints = currentPeriodGrades.reduce((s, g) => s + (Number(g?.note || 0) * Number(g?.coefficient || 0)), 0);
  const totalCoef = currentPeriodGrades.reduce((s, g) => s + Number(g?.coefficient || 0), 0);
  
  const rawMoyenne = totalCoef > 0 ? (totalPoints / totalCoef) : 0;
  const moyenne = rawMoyenne.toFixed(2);

  const getDisciplinaryStatus = () => {
    const unjustified = disciplineSummary.total_heures - disciplineSummary.justifiees;
    if (unjustified >= 30) return { label: 'EXCLUSION TEMPORAIRE', color: '#741b47', class: 'bg-dark' };
    if (unjustified >= 20) return { label: 'BLÂME DE CONDUITE', color: '#dc3545', class: 'bg-danger' };
    if (unjustified >= 10) return { label: 'AVERTISSEMENT DE CONDUITE', color: '#fd7e14', class: 'bg-warning' };
    if (unjustified > 0) return { label: 'R.A.S (À SURVEILLER)', color: '#0dcaf0', class: 'bg-info' };
    return { label: 'CONDUITE EXEMPLAIRE', color: '#198754', class: 'bg-success' };
  };

  const discStatus = getDisciplinaryStatus();

  const handleSendNotification = async (type: 'email' | 'sms') => {
    if (!selectedStudent || !currentPeriodGrades.length) {
        alert("Aucune donnée à envoyer.");
        return;
    }

    if (type === 'email' && !selectedStudent.email) {
        alert("Cet étudiant n'a pas d'adresse email enregistrée.");
        return;
    }
    if (type === 'sms' && !selectedStudent.telephone) {
        alert("Cet étudiant n'a pas de numéro de téléphone enregistré.");
        return;
    }

    // Calcul du rang
    let rank = '--';
    try {
        const resAverages = await fetchClassAverages(gradeForm.periode);

        if (resAverages.success && resAverages.data) {
            const index = resAverages.data.findIndex((r: any) => String(r.id_etudiant) === String(selectedStudent.id));
            if (index !== -1) rank = (index + 1).toString();
        }
    } catch (err) {}

    const subject = `Résultats Scolaires - ${gradeForm.periode}`;
    const message = `Bonjour, le relevé de ${selectedStudent.nom} ${selectedStudent.prenom} pour le ${gradeForm.periode} est disponible.\nMoyenne: ${moyenne}/20\nRang: ${rank} / ${students.length}\nÉtablissement: ${company?.company_name || 'Votre école'}`;

    const res = await (window as any).electronAPI.notificationSend({
        type,
        to: type === 'email' ? selectedStudent.email : selectedStudent.telephone,
        subject,
        message
    });

    if (res.success) {
        alert(`${type.toUpperCase()} envoyé avec succès !`);
    } else {
        alert(`Erreur lors de l'envoi : ${res.error}`);
    }
  };

  const handlePrint = async () => {
    if (!selectedStudent || !company) {
        alert("Erreur: Données de l'étudiant ou de l'établissement manquantes.");
        return;
    }
    
    let logoBase64 = '';
    let sealBase64 = '';
    let studentPhotoBase64 = '';
    
    try {
        if (company.logo_path) {
            const resLogo = await (window as any).electronAPI.mediaGetBase64(company.logo_path);
            if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
        }
        if (!logoBase64) {
            const resLogo = await (window as any).electronAPI.mediaGetBase64('logo.png');
            if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
        }
        const resSeal = await (window as any).electronAPI.mediaGetBase64('sceau.png');
        if (resSeal && resSeal.success) sealBase64 = resSeal.base64;
        if (selectedStudent.image_path) {
            const resPhoto = await (window as any).electronAPI.mediaGetBase64(selectedStudent.image_path);
            if (resPhoto && resPhoto.success) studentPhotoBase64 = resPhoto.base64;
        }
    } catch (err) {
        console.error("Image loading warning:", err);
    }

    let rank = '--';
    let firstAvg = '--';
    let lastAvg = '--';
    let classAvg = '--';

    try {
        const resAverages = await fetchClassAverages(gradeForm.periode);

        if (resAverages.success && resAverages.data && resAverages.data.length > 0) {
            const data = resAverages.data;
            const index = data.findIndex((r: any) => String(r.id_etudiant) === String(selectedStudent.id));
            if (index !== -1) rank = (index + 1).toString();
            firstAvg = parseFloat(data[0].moyenne).toFixed(2);
            lastAvg = parseFloat(data[data.length - 1].moyenne).toFixed(2);
            const sum = data.reduce((acc: number, r: any) => acc + parseFloat(r.moyenne), 0);
            classAvg = (sum / data.length).toFixed(2);
        }
    } catch (err) {
        console.error("Stats calculation error:", err);
    }

    const studentName = `${selectedStudent.nom || ''} ${selectedStudent.prenom || ''}`;
    const className = classes.find(c => String(c.id) === String(selectedClassId))?.nom || 'N/A';
    const periodStr = (gradeForm.periode || 'TRIMESTRE 1').toUpperCase();
    const dateStr = new Date().toLocaleDateString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px 30px; color: #111; line-height: 1.1; background: #fff; position: relative; z-index: 1; }
          
          .watermark-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 450px;
            height: 450px;
            object-fit: contain;
            opacity: 0.05;
            pointer-events: none;
            z-index: -1;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .official-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 8px; font-weight: bold; text-align: center; border-bottom: 1px solid #000; padding-bottom: 5px; }
          .side-header { width: 35%; }
          .seal-center { width: 25%; text-align: center; }
          .seal-img { max-height: 80px; max-width: 100%; object-fit: contain; }

          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #198754; padding-bottom: 8px; margin-bottom: 10px; }
          .logo-container { width: 90px; text-align: center; }
          .logo { max-width: 100%; max-height: 70px; object-fit: contain; }
          .school-info { text-align: center; flex-grow: 1; padding: 0 10px; }
          .school-name { font-size: 16px; font-weight: bold; color: #198754; margin-bottom: 2px; text-transform: uppercase; }
          .school-details { font-size: 9px; color: #444; margin-bottom: 1px; }
          
          .bulletin-title-container { display: flex; align-items: center; justify-content: space-between; margin: 10px 0; }
          .bulletin-title { text-align: center; flex-grow: 1; }
          .bulletin-title h1 { border: 2px solid #000; display: inline-block; padding: 4px 30px; font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; background: #f0f0f0; }
          .period-title { font-size: 14px; font-weight: bold; margin-top: 4px; color: #198754; }
          .student-photo-container { width: 80px; height: 90px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; background: #fff; }
          .student-photo { max-width: 100%; max-height: 100%; object-fit: cover; }

          .student-info { display: flex; border: 1px solid #000; background: #fff; margin-bottom: 10px; }
          .info-left { flex: 7; padding: 8px; border-right: 1px solid #000; }
          .info-right { flex: 5; padding: 8px; background: #f9f9f9; }
          .info-row { display: flex; margin-bottom: 2px; font-size: 11px; }
          .info-label { font-weight: bold; width: 110px; text-transform: uppercase; color: #555; }
          .info-value { font-weight: bold; font-size: 12px; }

          .grades-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .grades-table th { border: 1px solid #000; padding: 5px; background: #198754; color: white; text-align: center; font-size: 10px; }
          .grades-table td { border: 1px solid #000; padding: 4px; font-size: 11px; }
          .matiere-cell { font-weight: bold; padding-left: 8px !important; }
          .center-cell { text-align: center; font-weight: bold; }
          .empty-row { height: 22px; }

          .total-row { background: #f2f2f2; font-weight: bold; }
          .moyenne-section { border: 2px solid #000; margin-top: 5px; display: flex; align-items: center; }
          .moyenne-label { flex: 3; text-align: right; padding: 8px; font-size: 14px; font-weight: bold; text-transform: uppercase; border-right: 1px solid #000; }
          .moyenne-value { flex: 1; text-align: center; padding: 8px; font-size: 18px; font-weight: bold; color: #198754; border-right: 1px solid #000; }
          .moyenne-result { flex: 1; text-align: center; padding: 8px; font-size: 14px; font-weight: bold; }

          .footer-stats { display: flex; margin-top: 8px; text-align: center; gap: 6px; }
          .stat-box { flex: 1; border: 1px solid #000; padding: 4px; font-size: 10px; font-weight: bold; }
          .stat-label { background: #f2f2f2; display: block; margin-bottom: 2px; padding: 1px; font-size: 8px; }

          .signatures { display: flex; margin-top: 25px; text-align: center; }
          .signature-col { flex: 1; }
          .signature-label { font-weight: bold; text-decoration: underline; font-size: 11px; margin-bottom: 35px; display: block; }
          .signature-date { font-size: 9px; margin-top: 25px; }
          
          .footer-copyright { position: fixed; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 7px; color: #888; border-top: 1px dashed #ccc; padding-top: 2px; }
        </style>
      </head>
      <body>
        ${logoBase64 ? `<img src="${logoBase64}" class="watermark-overlay">` : ''}
        <div class="official-header">
            <div class="side-header">
                REPUBLIQUE DU CAMEROUN<br>
                Paix - Travail - Patrie<br>
                **********<br>
                MINISTERE DE L'EDUCATION DE BASE<br>
                **********<br>
                INSPECTION GENERALE DES ENSEIGNEMENTS
            </div>
            <div class="seal-center">
                ${sealBase64 ? `<img src="${sealBase64}" class="seal-img">` : 'SCEAU'}
            </div>
            <div class="side-header">
                REPUBLIC OF CAMEROON<br>
                Peace - Work - Fatherland<br>
                **********<br>
                MINISTRY OF BASIC EDUCATION<br>
                **********<br>
                GENERAL INSPECTION OF EDUCATION
            </div>
        </div>

        <div class="header">
          <div class="logo-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo">` : '<div style="border:1px solid #ccc; padding:10px; font-size: 10px;">LOGO</div>'}
          </div>
          <div class="school-info">
            <div class="school-name">${company.company_name}</div>
            <div class="school-details">${company.activity || ''}</div>
            <div class="school-details">${company.address} | Tél: ${company.phone}</div>
            <div class="school-details">NIU: ${company.niu} | RCCM: ${company.rccm}</div>
          </div>
          <div style="width: 100px; text-align: right; border: 1px solid #000; padding: 4px; font-size: 10px;">
            <b>${t('print.school_year')}</b><br>
            <span style="font-size: 12px; color: #0d6efd;">${anneeScolaire}</span>
          </div>
        </div>

        <div class="bulletin-title-container">
          <div style="width: 80px;"></div> 
          <div class="bulletin-title">
            <h1>${t('print.report_card_title')}</h1>
            <div class="period-title">${periodStr}</div>
          </div>
          <div class="student-photo-container">
            ${studentPhotoBase64 ? `<img src="${studentPhotoBase64}" class="student-photo">` : '<span style="font-size:8px; color:#ccc;">PHOTO</span>'}
          </div>
        </div>

        <div class="student-info">
          <div class="info-left">
            <div class="info-row"><span class="info-label">${t('print.student_name')}</span><span class="info-value">${studentName.toUpperCase()}</span></div>
            <div class="info-row"><span class="info-label">${t('print.born_on')}</span><span class="info-value">${selectedStudent.date_naissance ? new Date(selectedStudent.date_naissance).toLocaleDateString() : 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">${t('print.matricule')}</span><span class="info-value">#${String(selectedStudent.id || '').padStart(5, '0')}</span></div>
          </div>
          <div class="info-right">
            <div class="info-row"><span class="info-label">${t('print.class_label')}</span><span class="info-value" style="color:#0d6efd;">${className}</span></div>
            <div class="info-row"><span class="info-label">${t('print.class_size')}</span><span class="info-value">${students.length} ${t('sidebar.students')}</span></div>
            <div class="info-row"><span class="info-label">${t('print.edit_date')}</span><span class="info-value">${dateStr}</span></div>
          </div>
        </div>

        <table class="grades-table">
          <thead>
            <tr>
              <th style="width: 35%;">${t('print.subjects_teachers')}</th>
              <th style="width: 8%;">${t('print.coef')}</th>
              <th style="width: 12%;">${t('print.grade_20')}</th>
              <th style="width: 12%;">${t('print.total_nxc')}</th>
              <th style="width: 18%;">${t('print.appreciation')}</th>
              <th style="width: 15%;">${t('print.signature')}</th>
            </tr>
          </thead>
          <tbody>
            ${currentPeriodGrades.map(g => `
              <tr>
                <td class="matiere-cell">${g.matiere_nom}</td>
                <td class="center-cell">${g.coefficient}</td>
                <td class="center-cell" style="font-size: 12px;">${g.note}</td>
                <td class="center-cell">${(Number(g.note || 0) * Number(g.coefficient || 0)).toFixed(2)}</td>
                <td class="center-cell" style="font-size: 9px;">${g.note >= 16 ? t('print.passed_remark_16') : g.note >= 14 ? t('print.passed_remark_14') : g.note >= 12 ? t('print.passed_remark_12') : g.note >= 10 ? t('print.passed_remark_10') : t('print.passed_remark_fail')}</td>
                <td class="center-cell"></td>
              </tr>
            `).join('')}
            ${[...Array(Math.max(0, 8 - currentPeriodGrades.length))].map(() => `
              <tr class="empty-row"><td colspan="6"></td></tr>
            `).join('')}
            <tr class="total-row">
              <td style="text-align: right; padding-right: 15px;">${t('print.totals')}</td>
              <td class="center-cell">${totalCoef}</td>
              <td style="background: #fff;"></td>
              <td class="center-cell">${totalPoints.toFixed(2)}</td>
              <td style="background: #fff;" colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <div class="moyenne-section">
          <div class="moyenne-label">${t('print.general_average')}</div>
          <div class="moyenne-value">${moyenne} / 20</div>
          <div class="moyenne-result" style="color: ${parseFloat(moyenne) >= 10 ? '#198754' : '#dc3545'};">
            ${parseFloat(moyenne) >= 10 ? t('print.passed') : t('print.failed')}
          </div>
        </div>

        <!-- SECTION DISCIPLINE ET MENTION -->
        <div style="margin-top: 10px; display: flex; gap: 10px;">
            <div style="flex: 1; border: 1px solid #000; padding: 8px; background: #fdfdfd;">
                <div style="font-size: 10px; font-weight: bold; text-decoration: underline; margin-bottom: 5px; text-transform: uppercase;">${t('print.discipline_summary')}</div>
                <div style="font-size: 11px; margin-bottom: 3px;">${t('print.total_absences')} <b>${disciplineSummary.total_heures} h</b></div>
                <div style="font-size: 11px;">${t('print.unjustified')} <b style="color: #dc3545;">${disciplineSummary.total_heures - disciplineSummary.justifiees} h</b></div>
            </div>
            <div style="flex: 2; border: 2px solid #000; padding: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center; background: ${discStatus.color}22;">
                <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666;">${t('print.disciplinary_mention')}</div>
                <div style="font-size: 16px; font-weight: 900; color: ${discStatus.color}; text-transform: uppercase;">${discStatus.label}</div>
            </div>
        </div>

        <div class="footer-stats">
          <div class="stat-box"><span class="stat-label">${t('print.highest_avg')}</span>${firstAvg}</div>
          <div class="stat-box"><span class="stat-label">${t('print.lowest_avg')}</span>${lastAvg}</div>
          <div class="stat-box"><span class="stat-label">${t('print.class_avg')}</span>${classAvg}</div>
          <div class="stat-box"><span class="stat-label">${t('print.student_rank')}</span>${rank} / ${students.length}</div>
        </div>

        <div class="signatures">
          <div class="signature-col">
            <span class="signature-label">${t('print.parent_sig')}</span>
          </div>
          <div class="signature-col">
            <span class="signature-label">${t('print.teacher_sig')}</span>
          </div>
          <div class="signature-col">
            <span class="signature-label">${t('print.director_sig')}</span>
            <div class="signature-date">${t('print.done_at', { ville: company.address?.split('-')[0] || 'Yaoundé', date: dateStr })}</div>
          </div>
        </div>

        <div class="footer-copyright">
          ${t('print.print_footer_copyright')}
        </div>
      </body>
      </html>
    `;

    try {
        await (window as any).electronAPI.printBulletin(html);
    } catch (printErr) {
        console.error("Printing error:", printErr);
        alert("Erreur lors du lancement de l'impression.");
    }
  };

  return (
    <div className="row g-4">
      <div className="col-md-4 d-print-none">
        <div className="card shadow-sm border-0 mb-4">
            <div className="card-body">
                <label className="form-label small fw-bold">{t('grades.select_class')}</label>
                <select className="form-select border-primary" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                    <option value="">-- {t('grades.select_class')} --</option>
                    {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
            </div>
        </div>

        <div className="card shadow-sm border-0 overflow-auto" style={{ maxHeight: '500px' }}>
            <div className="list-group list-group-flush">
                {Array.isArray(students) && students.map(s => (
                    <button key={s.id} className={`list-group-item list-group-item-action p-3 ${selectedStudent?.id === s.id ? 'active' : ''}`} onClick={() => selectStudent(s)}>
                        <div className="fw-bold">{s.nom} {s.prenom}</div>
                        <small className={selectedStudent?.id === s.id ? 'text-white' : 'text-muted'}>ID: {String(s.id || '').padStart(4, '0')}</small>
                    </button>
                ))}
                {(!students || students.length === 0) && <div className="p-4 text-center text-muted small italic">{t('grades.empty_class_students', 'Aucun élève dans cette classe')}</div>}
            </div>
        </div>
      </div>

      <div className="col-md-8 d-print-none">
        {selectedStudent ? (
            <div className="card shadow-sm border-0">
                <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center py-3">
                    <h5 className="mb-0 fw-bold">📝 {t('grades.grades_entry')} : {selectedStudent.nom} {selectedStudent.prenom}</h5>
                    <div className="d-flex gap-2">
                        <div className="btn-group shadow-sm">
                            <button className="btn btn-info btn-sm text-white fw-bold" title="Envoyer par Email" onClick={() => handleSendNotification('email')}>📧 Mail</button>
                            <button className="btn btn-warning btn-sm fw-bold" title="Envoyer par SMS" onClick={() => handleSendNotification('sms')}>📱 SMS</button>
                        </div>
                        <button className="btn btn-light btn-sm fw-bold shadow-sm" onClick={handlePrint}>{t('grades.btn_bulletins').replace('🖨️ ', '')}</button>
                    </div>
                </div>
                <div className="card-body">
                    {/* OPTION DE SANCTION DISCIPLINAIRE */}
                    <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center justify-content-between border-0 shadow-sm rounded-pill">
                        <div className="d-flex align-items-center">
                            <span className="fs-4 me-2">⚖️</span>
                            <div>
                                <div className="small fw-bold">{t('grades.discipline_option', 'Option de Discipline')}</div>
                                <div className="text-muted" style={{fontSize: '11px'}}>{t('grades.discipline_option_desc', 'Sanctionner les absences injustifiées sur la moyenne ?')}</div>
                            </div>
                        </div>
                        <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" role="switch" checked={applySanction} onChange={e => setApplySanction(e.target.checked)} />
                            <label className="form-check-label small fw-bold">{applySanction ? 'OUI' : 'NON'}</label>
                        </div>
                    </div>

                    <div className="row g-2 bg-light p-3 rounded border mb-4">
                        <div className="col-md-4">
                            <label className="small fw-bold">{t('grades.select_period')}</label>
                            <select className="form-select form-select-sm" value={gradeForm.periode} onChange={e => setGradeForm({...gradeForm, periode: e.target.value})}>
                                <option value="Trimestre 1">{t('grades.period_1')}</option>
                                <option value="Trimestre 2">{t('grades.period_2')}</option>
                                <option value="Trimestre 3">{t('grades.period_3')}</option>
                                <option value="Séquence 1">Séquence 1</option>
                                <option value="Séquence 2">Séquence 2</option>
                                <option value="Séquence 3">Séquence 3</option>
                                <option value="Séquence 4">Séquence 4</option>
                                <option value="Séquence 5">Séquence 5</option>
                                <option value="Séquence 6">Séquence 6</option>
                            </select>
                        </div>
                        {isTermPeriod ? (
                            <div className="col-md-8 d-flex align-items-center">
                                <div className="alert alert-warning py-2 px-3 mb-0 w-100 small fw-bold shadow-sm">
                                    ⚠️ {t('grades.term_auto_calculated', 'Calcul automatique activé (lecture seule). Saisissez les notes dans les séquences.')}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="col-md-4">
                                    <label className="small fw-bold">{t('grades.select_subject')}</label>
                                    <select className="form-select form-select-sm" required value={gradeForm.id_matiere} onChange={e => setGradeForm({...gradeForm, id_matiere: e.target.value})}>
                                        <option value="">-- {t('grades.select_subject')} --</option>
                                        {Array.isArray(matieres) && matieres.map(m => <option key={m.id} value={m.id}>{m.nom} (Coef {m.coefficient})</option>)}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="small fw-bold">{t('grades.table_grade_test')}</label>
                                    <input type="number" step="0.25" min="0" max="20" className="form-control form-control-sm" required value={gradeForm.note} onChange={e => setGradeForm({...gradeForm, note: e.target.value})} />
                                </div>
                                <div className="col-md-2 d-flex align-items-end">
                                    {editingGradeId ? (
                                        <div className="d-flex gap-1 w-100">
                                            <button type="button" 
                                                onClick={handleUpdateGrade} 
                                                className="btn btn-success btn-sm flex-grow-1 fw-bold">
                                                💾
                                            </button>
                                            <button type="button" 
                                                onClick={() => { setEditingGradeId(null); setGradeForm(prev => ({ ...prev, note: '' })); }} 
                                                className="btn btn-secondary btn-sm fw-bold">
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" 
                                            onClick={handleAddGrade} 
                                            className="btn btn-primary btn-sm w-100 fw-bold">
                                            {t('grades.btn_enter_grades').replace('📝 ', '')}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <h6 className="fw-bold mb-3 border-bottom pb-2">{t('grades.grades_saved', 'Notes enregistrées')} ({gradeForm.periode})</h6>
                    <div className="table-responsive">
                        <table className="table table-sm table-hover">
                            <thead className="table-light">
                              <tr>
                                <th>{t('pedagogy.table_subj_name')}</th>
                                <th className="text-center">{t('pedagogy.table_subj_coeff')}</th>
                                <th className="text-center">{t('grades.table_grade_test')}</th>
                                <th className="text-end">Total</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                                {currentPeriodGrades.map(g => (
                                    <tr key={g.id}>
                                        <td>{g.matiere_nom}</td>
                                        <td className="text-center">{g.coefficient}</td>
                                        <td className="text-center fw-bold">{g.note}</td>
                                        <td className="text-end fw-bold">{(Number(g.note || 0) * Number(g.coefficient || 0)).toFixed(2)}</td>
                                        <td className="text-end">
                                            {!isTermPeriod ? (
                                                <>
                                                    <button className="btn btn-sm text-primary me-2" onClick={() => startEditGrade(g)}>✏️</button>
                                                    <button className="btn btn-sm text-danger" onClick={() => deleteGrade(g.id)}>✕</button>
                                                </>
                                            ) : (
                                                <span className="badge bg-light text-muted small border">Calculée</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="table-dark">
                                <tr>
                                    <td colSpan={2} className="text-end fw-bold">MOYENNE {gradeForm.periode.toUpperCase()} :</td>
                                    <td className="text-center fw-bold" style={{ fontSize: '1.2rem', color: parseFloat(moyenne) >= 10 ? '#00ff00' : '#ff4444' }}>{moyenne}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            <div className="h-100 d-flex align-items-center justify-content-center border rounded bg-white p-5 text-muted">
                {t('grades.select_prompt', 'Sélectionnez une classe puis un élève pour gérer ses notes.')}
            </div>
        )}
      </div>
    </div>
  );
};

export default Grades;
