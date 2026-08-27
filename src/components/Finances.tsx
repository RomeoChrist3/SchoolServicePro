import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface FinancesProps {
  anneeScolaire: string;
}

const Finances: React.FC<FinancesProps> = ({ anneeScolaire }) => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [moratoires, setMoratoires] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [company, setCompany] = useState<any>(null);
  
  const [paymentForm, setPaymentForm] = useState({ montant: '', mode: 'espece', motif: 'Scolarité' });
  const [moratoireForm, setMoratoireForm] = useState({ montant: '', date_echeance: '', motif: 'Engagement de paiement' });
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const fetchData = async () => {
    // Récupération des classes pour le filtre
    const resClasses = await (window as any).electronAPI.dbQuery('SELECT * FROM classes ORDER BY nom');
    if (resClasses.success) setClasses(resClasses.data);

    const res = await (window as any).electronAPI.dbQuery(`
        SELECT e.*, c.nom as classe_nom, c.frais_inscription, c.frais_scolarite,
        (IFNULL(c.frais_inscription, 0) + IFNULL(c.frais_scolarite, 0)) as total_du,
        IFNULL((SELECT SUM(montant) FROM paiements WHERE id_etudiant = e.id AND annee_scolaire = ?), 0) as total_paye,
        (SELECT COUNT(*) FROM moratoires WHERE id_etudiant = e.id AND statut = 'en_attente' AND annee_scolaire = ?) as nb_moratoires
        FROM etudiants e
        LEFT JOIN classes c ON e.id_classe = c.id
        ORDER BY e.nom, e.prenom
    `, [anneeScolaire, anneeScolaire]);
    if (res.success) setStudents(res.data);

    const resComp = await (window as any).electronAPI.dbQuery('SELECT * FROM settings LIMIT 1');
    if (resComp.success && resComp.data.length > 0) setCompany(resComp.data[0]);
  };

  useEffect(() => { fetchData(); }, [anneeScolaire]);

  const selectStudent = async (s: any) => {
    setSelectedStudent(s);
    
    // Historique des paiements
    const resPay = await (window as any).electronAPI.dbQuery('SELECT * FROM paiements WHERE id_etudiant = ? AND annee_scolaire = ? ORDER BY date_paiement DESC', [s.id, anneeScolaire]);
    if (resPay.success) setPayments(resPay.data);

    // Historique des moratoires
    const resMor = await (window as any).electronAPI.dbQuery('SELECT * FROM moratoires WHERE id_etudiant = ? AND annee_scolaire = ? ORDER BY date_echeance ASC', [s.id, anneeScolaire]);
    if (resMor.success) setMoratoires(resMor.data);
  };

  const handleMoratoire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !moratoireForm.montant || !moratoireForm.date_echeance) return;

    const res = await (window as any).electronAPI.dbQuery(
        'INSERT INTO moratoires (id_etudiant, montant, date_echeance, motif, annee_scolaire) VALUES (?, ?, ?, ?, ?)',
        [selectedStudent.id, parseFloat(moratoireForm.montant), moratoireForm.date_echeance, moratoireForm.motif, anneeScolaire]
    );

    if (res.success) {
        setMoratoireForm({ montant: '', date_echeance: '', motif: 'Engagement de paiement' });
        selectStudent(selectedStudent);
        fetchData();
        alert("Engagement de paiement enregistré !");
    }
  };

  const deleteMoratoire = async (id: number) => {
    if (window.confirm('Supprimer cet engagement ?')) {
        await (window as any).electronAPI.dbQuery('DELETE FROM moratoires WHERE id = ?', [id]);
        selectStudent(selectedStudent);
        fetchData();
    }
  };

  const handlePrintMoratoire = async (m: any) => {
    if (!m || !company || !selectedStudent) return;

    let logoBase64 = '';
    try {
        if (company.logo_path) {
            const resLogo = await (window as any).electronAPI.mediaGetBase64(company.logo_path);
            if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
        }
        if (!logoBase64) {
            const resLogo = await (window as any).electronAPI.mediaGetBase64('logo.png');
            if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
        }
    } catch (err) { console.error(err); }

    const moratoireContent = `
        <div class="text-center">
          <div class="header-official">${t('print.republic')}<br>${t('print.motto')}</div>
          <div class="school-name">${company.company_name}</div>
          <div style="font-size: 11px; font-weight: bold;">${company.address} | Tél: ${company.phone} | Année: ${anneeScolaire}</div>
          <hr>
          <div class="receipt-title" style="background: #fff3cd; border-color: #856404; color: #856404;">${t('print.moratoire_title')}</div>
          <div style="text-align: left; margin: 15px 0; font-size: 14px; line-height: 1.6;">
            ${t('print.moratoire_text', { student: `${selectedStudent.nom.toUpperCase()} ${selectedStudent.prenom.toUpperCase()}`, classe: selectedStudent.classe_nom })}
          </div>
          <div class="amount-box" style="border-color: #856404;">${parseFloat(m.montant).toLocaleString()} FCFA</div>
          <div style="text-align: left; font-size: 15px; margin-top: 10px;">
            <b>${t('print.due_date_set')}</b> <span style="text-decoration: underline;">${new Date(m.date_echeance).toLocaleDateString()}</span>
          </div>
          <div style="text-align: left; font-size: 13px; margin-top: 5px;">
            <b>${t('print.motif')}</b> ${m.motif || 'Engagement de paiement'}
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 12px; font-weight: bold;">
            <div style="text-decoration: underline;">${t('print.signature_parent')}</div>
            <div style="text-decoration: underline;">${t('print.signature_accountant')}</div>
          </div>
          <div class="footer" style="margin-top: 40px;">${t('print.done_at', { ville: company.address?.split('-')[0] || 'Yaoundé', date: new Date().toLocaleDateString() })}</div>
        </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 5mm; }
          body { font-family: 'Segoe UI', sans-serif; width: 100%; max-width: 190mm; margin: 0 auto; padding: 0; color: #000; line-height: 1.2; }
          .text-center { text-align: center; }
          .header-official { font-size: 9px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
          .school-name { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 2px 0; color: #198754; }
          .receipt-title { font-size: 16px; font-weight: bold; border: 2px solid #000; display: inline-block; padding: 4px 20px; margin: 8px 0; }
          .amount-box { border: 2px solid #000; padding: 8px; font-size: 22px; font-weight: bold; margin: 10px 0; background: #fff; display: inline-block; min-width: 200px; }
          hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
          .copy-label { font-size: 10px; font-weight: bold; text-align: right; text-transform: uppercase; color: #666; }
          .scissors { border-top: 1px dashed #000; margin: 25px 0; position: relative; text-align: center; }
          .scissors::after { content: '${t('print.cut_here')}'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 10px; font-size: 10px; font-weight: bold; }
          .receipt-container { border: 1px solid #ccc; padding: 15px; margin-bottom: 5px; border-radius: 8px; position: relative; overflow: hidden; }
          .watermark-logo {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 240px;
            height: 240px;
            object-fit: contain;
            opacity: 0.06;
            pointer-events: none;
            z-index: 1;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="watermark-logo">` : ''}
            <div style="position: relative; z-index: 10;">
                <div class="copy-label">${t('print.parent_copy')}</div>
                ${moratoireContent}
            </div>
        </div>
        <div class="scissors"></div>
        <div class="receipt-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="watermark-logo">` : ''}
            <div style="position: relative; z-index: 10;">
                <div class="copy-label">${t('print.school_copy')}</div>
                ${moratoireContent}
            </div>
        </div>
      </body>
      </html>
    `;
    (window as any).electronAPI.printBulletin(html);
  };

  const handlePrintReceipt = async (receiptData: any) => {
    if (!receiptData || !company) return;

    let sealBase64 = '';
    let logoBase64 = '';
    try {
        const resSeal = await (window as any).electronAPI.mediaGetBase64('sceau.png');
        if (resSeal && resSeal.success) sealBase64 = resSeal.base64;
        
        if (company.logo_path) {
            const resLogo = await (window as any).electronAPI.mediaGetBase64(company.logo_path);
            if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
        }
        if (!logoBase64) {
            const resLogo = await (window as any).electronAPI.mediaGetBase64('logo.png');
            if (resLogo && resLogo.success) logoBase64 = resLogo.base64;
        }
    } catch (err) { console.error(err); }

    const receiptContent = `
        <div class="text-center">
          <div class="header-official">${t('print.republic')}<br>${t('print.motto')}</div>
          ${sealBase64 ? `<img src="${sealBase64}" class="seal-img">` : ''}
          <div class="school-name">${company.company_name}</div>
          <div style="font-size: 11px; font-weight: bold;">${company.address} | Tél: ${company.phone}</div>
          <hr>
          <div class="receipt-title">${t('print.receipt_title')}</div>
          <table class="info-table">
            <tr><td class="label">${t('print.receipt_no')}</td><td><b style="font-size: 14px;">${receiptData.numero}</b></td></tr>
            <tr><td class="label">${t('print.date')}</td><td>${receiptData.date}</td></tr>
            <tr><td class="label">${t('print.student')}</td><td><b style="font-size: 14px;">${receiptData.student.toUpperCase()}</b></td></tr>
            <tr><td class="label">${t('print.class')}</td><td><b>${receiptData.classe}</b></td></tr>
            <tr><td class="label">${t('print.motif')}</td><td>${receiptData.motif}</td></tr>
            <tr><td class="label">${t('print.card_year', 'Année Scolaire')}</td><td><b>${anneeScolaire}</b></td></tr>
          </table>
          <div class="amount-box">${parseFloat(receiptData.montant).toLocaleString()} FCFA</div>
          <div style="text-align: left; font-size: 13px; margin-top: 5px;"><b>${t('print.remaining_to_pay')}</b> <span style="color: red;">${receiptData.reste.toLocaleString()} FCFA</span></div>
          <hr>
          <div class="footer">${t('print.receipt_footer')}</div>
        </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 5mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; width: 100%; max-width: 190mm; margin: 0 auto; padding: 0; color: #000; line-height: 1.2; }
          .text-center { text-align: center; }
          .header-official { font-size: 9px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
          .seal-img { max-height: 45px; margin: 2px 0; }
          .school-name { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 2px 0; color: #198754; }
          .receipt-title { font-size: 16px; font-weight: bold; border: 2px solid #000; display: inline-block; padding: 4px 20px; margin: 8px 0; background: #f0f0f0; }
          .info-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .info-table td { padding: 4px 0; vertical-align: top; font-size: 13px; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; width: 30%; color: #555; border-bottom: none !important; }
          .amount-box { border: 2px solid #000; padding: 8px; font-size: 22px; font-weight: bold; margin: 10px 0; background: #fff; display: inline-block; min-width: 200px; }
          .footer { margin-top: 10px; font-style: italic; font-size: 10px; font-weight: bold; }
          hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
          .copy-label { font-size: 10px; font-weight: bold; text-align: right; text-transform: uppercase; color: #666; }
          .scissors { border-top: 1px dashed #000; margin: 20px 0; position: relative; text-align: center; }
          .scissors::after { content: '${t('print.cut_here')}'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 10px; font-size: 10px; font-weight: bold; }
          .receipt-container { border: 1px solid #ccc; padding: 10px; margin-bottom: 5px; border-radius: 8px; position: relative; overflow: hidden; }
          .watermark-logo {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 240px;
            height: 240px;
            object-fit: contain;
            opacity: 0.06;
            pointer-events: none;
            z-index: 1;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="watermark-logo">` : ''}
            <div style="position: relative; z-index: 10;">
                <div class="copy-label">${t('print.parent_copy')}</div>
                ${receiptContent}
            </div>
        </div>
        
        <div class="scissors"></div>
        
        <div class="receipt-container">
            ${logoBase64 ? `<img src="${logoBase64}" class="watermark-logo">` : ''}
            <div style="position: relative; z-index: 10;">
                <div class="copy-label">${t('print.school_copy')}</div>
                ${receiptContent}
            </div>
        </div>
      </body>
      </html>
    `;
    (window as any).electronAPI.printBulletin(html);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !paymentForm.montant) return;

    if (editingId) {
        const res = await (window as any).electronAPI.dbQuery(
            'UPDATE paiements SET montant=?, mode_paiement=?, motif=?, annee_scolaire=? WHERE id=?',
            [parseFloat(paymentForm.montant), paymentForm.mode, paymentForm.motif, anneeScolaire, editingId]
        );
        if (res.success) {
            setEditingId(null);
            setPaymentForm({ montant: '', mode: 'espece', motif: 'Scolarité' });
            selectStudent(selectedStudent);
            fetchData();
            alert("Paiement mis à jour !");
        }
    } else {
        const resCount = await (window as any).electronAPI.dbQuery('SELECT COUNT(*) as total FROM paiements');
        const nextSeq = (resCount.success && resCount.data[0]?.total ? resCount.data[0].total + 1 : 1);
        const receiptNum = `REC-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;

        const res = await (window as any).electronAPI.dbQuery(
            'INSERT INTO paiements (id_etudiant, montant, mode_paiement, numero_recu, motif, annee_scolaire, date_paiement) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [selectedStudent.id, parseFloat(paymentForm.montant), paymentForm.mode, receiptNum, paymentForm.motif, anneeScolaire]
        );

        if (res.success) {
            // Enregistrement automatique dans la caisse par défaut
            try {
              let defCaisseId = 1;
              let defCaisseCode = 'CP';
              const resDef = await (window as any).electronAPI.dbQuery('SELECT id, code_caisse FROM points_caisse WHERE is_default = 1 LIMIT 1');
              if (resDef.success && resDef.data && resDef.data.length > 0) {
                defCaisseId = resDef.data[0].id;
                defCaisseCode = resDef.data[0].code_caisse;
              } else {
                const resFirst = await (window as any).electronAPI.dbQuery('SELECT id, code_caisse FROM points_caisse ORDER BY id ASC LIMIT 1');
                if (resFirst.success && resFirst.data && resFirst.data.length > 0) {
                  defCaisseId = resFirst.data[0].id;
                  defCaisseCode = resFirst.data[0].code_caisse;
                }
              }

              const studentFullName = `${selectedStudent.nom} ${selectedStudent.prenom || ''} (${selectedStudent.classe_nom || ''})`.trim();
              const modeLabel = paymentForm.mode === 'espece' ? 'Espèces' : (paymentForm.mode === 'mobile' ? 'Mobile Money' : paymentForm.mode);

              await (window as any).electronAPI.dbQuery(`
                INSERT INTO caisse (id_caisse, code_caisse, type_mouvement, montant, motif, beneficiaire, categorie, mode_reglement, reference_piece, annee_scolaire, date_operation, id_paiement, id_utilisateur)
                VALUES (?, ?, 'ENTREE', ?, ?, ?, 'Scolarité & Inscription', ?, ?, ?, NOW(), ?, 1)
              `, [
                defCaisseId,
                defCaisseCode,
                parseFloat(paymentForm.montant),
                paymentForm.motif || 'Règlement Scolarité / Inscription',
                studentFullName,
                modeLabel,
                receiptNum,
                anneeScolaire,
                res.insertId || null
              ]);
            } catch (errCaisse) {
              console.error('Erreur enregistrement caisse automatique:', errCaisse);
            }
        }

        if (res.success) {
            const rData = {
                numero: receiptNum,
                date: new Date().toLocaleString(),
                student: `${selectedStudent.nom} ${selectedStudent.prenom}`,
                classe: selectedStudent.classe_nom,
                montant: paymentForm.montant,
                motif: paymentForm.motif,
                reste: selectedStudent.total_du - (selectedStudent.total_paye + parseFloat(paymentForm.montant))
            };
            setLastReceipt(rData);
            setPaymentForm({ montant: '', mode: 'espece', motif: 'Scolarité' });
            selectStudent(selectedStudent);
            fetchData();
            handlePrintReceipt(rData);
        }
    }
  };

  const deletePayment = async (id: number) => {
    if (window.confirm('Voulez-vous vraiment annuler ce paiement ? Cette action est irréversible.')) {
        const res = await (window as any).electronAPI.dbQuery('DELETE FROM paiements WHERE id = ?', [id]);
        if (res.success) {
            try {
              await (window as any).electronAPI.dbQuery('DELETE FROM caisse WHERE id_paiement = ?', [id]);
            } catch (e) {}
            selectStudent(selectedStudent);
            fetchData();
        }
    }
  };

  const editPayment = (p: any) => {
    setEditingId(p.id);
    setPaymentForm({
        montant: p.montant.toString(),
        mode: p.mode_paiement,
        motif: p.motif
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [editingId, setEditingId] = useState<number | null>(null);

  const printInsolventList = async () => {
    if (!company) return;
    const insolventStudents = students.filter(s => {
      const isPending = s.total_paye < s.total_du;
      const matchesClass = !selectedClass || String(s.id_classe) === String(selectedClass);
      return isPending && matchesClass;
    });

    const className = selectedClass ? (classes.find(c => String(c.id) === String(selectedClass))?.nom || '') : 'Toutes les classes';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #dc3545; padding-bottom: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f8d7da; border: 1px solid #f5c6cb; padding: 8px; font-size: 12px; }
          td { border: 1px solid #eee; padding: 8px; font-size: 11px; }
          .text-end { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 18px; font-weight: bold;">${company.company_name}</div>
          <h2 style="color: #dc3545;">LISTE DES ÉLÈVES INSOLVABLES</h2>
          <div style="font-weight: bold; margin-bottom: 5px;">CLASSE : ${className.toUpperCase()}</div>
          <div style="font-size: 11px; color: #555; font-weight: bold; margin-bottom: 5px;">Année Scolaire : ${anneeScolaire}</div>
          <div>Date d'édition : ${new Date().toLocaleDateString()}</div>
        </div>
        <table>
          <thead>
            <tr><th>MATRICULE</th><th>NOM & PRÉNOM</th><th>CLASSE</th><th class="text-end">TOTAL DÛ</th><th class="text-end">DÉJÀ PAYÉ</th><th class="text-end">RESTE</th></tr>
          </thead>
          <tbody>
            ${insolventStudents.map(s => `
              <tr>
                <td>#${String(s.id).padStart(5, '0')}</td>
                <td><b>${s.nom} ${s.prenom}</b></td>
                <td>${s.classe_nom}</td>
                <td class="text-end">${s.total_du.toLocaleString()}</td>
                <td class="text-end">${s.total_paye.toLocaleString()}</td>
                <td class="text-end" style="color: red; font-weight: bold;">${(s.total_du - s.total_paye).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    (window as any).electronAPI.printBulletin(html);
  };

  const printSolventList = async () => {
    if (!company) return;
    const solventStudents = students.filter(s => {
      const isPaid = s.total_paye >= s.total_du;
      const matchesClass = !selectedClass || String(s.id_classe) === String(selectedClass);
      return isPaid && matchesClass;
    });

    const className = selectedClass ? (classes.find(c => String(c.id) === String(selectedClass))?.nom || '') : 'Toutes les classes';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #198754; padding-bottom: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #d1e7dd; border: 1px solid #badbcc; padding: 8px; font-size: 12px; }
          td { border: 1px solid #eee; padding: 8px; font-size: 11px; }
          .text-end { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 18px; font-weight: bold;">${company.company_name}</div>
          <h2 style="color: #198754;">LISTE DES ÉLÈVES SOLVABLES</h2>
          <div style="font-weight: bold; margin-bottom: 5px;">CLASSE : ${className.toUpperCase()}</div>
          <div style="font-size: 11px; color: #555; font-weight: bold; margin-bottom: 5px;">Année Scolaire : ${anneeScolaire}</div>
          <div>Date d'édition : ${new Date().toLocaleDateString()}</div>
        </div>
        <table>
          <thead>
            <tr><th>MATRICULE</th><th>NOM & PRÉNOM</th><th>CLASSE</th><th class="text-end">TOTAL DÛ</th><th class="text-end">DÉJÀ PAYÉ</th><th class="text-end">RÉGLÉ</th></tr>
          </thead>
          <tbody>
            ${solventStudents.map(s => `
              <tr>
                <td>#${String(s.id).padStart(5, '0')}</td>
                <td><b>${s.nom} ${s.prenom}</b></td>
                <td>${s.classe_nom}</td>
                <td class="text-end">${s.total_du.toLocaleString()}</td>
                <td class="text-end">${s.total_paye.toLocaleString()}</td>
                <td class="text-end" style="color: green; font-weight: bold;">SOLVABLE</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    (window as any).electronAPI.printBulletin(html);
  };

  const handleReprint = (p: any) => {
    // Calculer le reste à ce moment là
    const paymentsUntilThen = payments.filter(pay => new Date(pay.date_paiement) <= new Date(p.date_paiement));
    const totalPayeUntilThen = paymentsUntilThen.reduce((acc, curr) => acc + curr.montant, 0);
    
    const rData = {
        numero: p.numero_recu,
        date: new Date(p.date_paiement).toLocaleString(),
        student: `${selectedStudent.nom} ${selectedStudent.prenom}`,
        classe: selectedStudent.classe_nom,
        montant: p.montant,
        motif: p.motif,
        reste: selectedStudent.total_du - totalPayeUntilThen
    };
    handlePrintReceipt(rData);
  };

  const filteredStudents = students.filter(s => {
    const fullName = (s.nom + ' ' + s.prenom).toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase());
    const matchesClass = !selectedClass || String(s.id_classe) === String(selectedClass);
    return matchesSearch && matchesClass;
  });

  return (
    <div className="row g-4">
      <div className="col-md-5 d-print-none">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-header bg-white py-3">
            <div className="d-flex flex-column gap-2">
                <select 
                    className="form-select form-select-sm border-success shadow-none" 
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                >
                    <option value="">{t('students.all_classes')}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                <div className="d-flex gap-2">
                    <input type="text" className="form-control form-control-sm border-success shadow-none" placeholder={t('common.search')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <div className="btn-group">
                        <button type="button" className="btn btn-outline-success btn-sm fw-bold text-nowrap" onClick={printSolventList}>🖨️ Solvables</button>
                        <button type="button" className="btn btn-outline-danger btn-sm fw-bold text-nowrap" onClick={printInsolventList}>Insolvables</button>
                    </div>
                </div>
            </div>
          </div>
          <div className="card-body p-0 overflow-auto" style={{ maxHeight: '600px' }}>
            <div className="list-group list-group-flush">
                {filteredStudents.map(s => (
                    <button key={s.id} className={`list-group-item list-group-item-action p-3 ${selectedStudent?.id === s.id ? 'active' : ''}`} onClick={() => selectStudent(s)}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div><div className="fw-bold">{s.nom} {s.prenom}</div><small className={selectedStudent?.id === s.id ? 'text-white' : 'text-muted'}>{s.classe_nom}</small></div>
                            <div className="text-end">
                                <div className="fw-bold">{(s.total_du - s.total_paye).toLocaleString()}</div>
                                <div className={`small ${s.total_paye >= s.total_du ? 'text-success' : 'text-danger'}`}>{s.total_paye >= s.total_du ? '● ' + t('finances.status_up_to_date', 'À JOUR') : '● ' + t('finances.status_insolvent', 'INSOLVABLE')}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-7 d-print-none">
        {selectedStudent ? (
            <div className="card shadow-sm border-0">
                <div className="card-header bg-success text-white py-3"><h5 className="mb-0 fw-bold">💰 {t('finances.tab_collect')} : {selectedStudent.nom} {selectedStudent.prenom}</h5></div>
                <div className="card-body">
                    <div className="row g-3 mb-4 text-center">
                        <div className="col-4 border-end"><div className="small text-muted text-uppercase">{t('finances.details_total').replace(' :', '')}</div><h5 className="fw-bold">{selectedStudent.total_du.toLocaleString()}</h5></div>
                        <div className="col-4 border-end text-success"><div className="small text-muted text-uppercase">{t('finances.details_paid').replace(' :', '')}</div><h5 className="fw-bold">{selectedStudent.total_paye.toLocaleString()}</h5></div>
                        <div className="col-4 text-danger"><div className="small text-muted text-uppercase">{t('finances.details_rem').replace(' :', '')}</div><h5 className="fw-bold">{(selectedStudent.total_du - selectedStudent.total_paye).toLocaleString()}</h5></div>
                    </div>
                    <form onSubmit={handlePayment} className="p-3 bg-light rounded border mb-4">
                        <div className="row g-2">
                            <div className="col-md-4">
                                <label className="small fw-bold">{t('finances.form_amount').replace(' (FCFA)', '')}</label>
                                <input type="number" className="form-control" required value={paymentForm.montant} onChange={e => setPaymentForm({...paymentForm, montant: e.target.value})} />
                            </div>
                            <div className="col-md-4">
                                <label className="small fw-bold">Motif</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    list="motifs-list"
                                    required 
                                    value={paymentForm.motif} 
                                    onChange={e => setPaymentForm({...paymentForm, motif: e.target.value})}
                                    placeholder="Ex: Scolarité..."
                                />
                                <datalist id="motifs-list">
                                    <option value="Scolarité" />
                                    <option value="Inscription" />
                                    <option value="Frais d'Examen" />
                                    <option value="Transport Scolaire" />
                                    <option value="Cantine" />
                                    <option value="Uniforme / Tenue" />
                                </datalist>
                            </div>
                            <div className="col-md-4">
                                <label className="small fw-bold">{t('finances.form_payment_method')}</label>
                                <select className="form-select" value={paymentForm.mode} onChange={e => setPaymentForm({...paymentForm, mode: e.target.value})}>
                                    <option value="espece">{t('finances.form_method_cash')}</option>
                                    <option value="mobile">{t('finances.form_method_mobile')}</option>
                                </select>
                            </div>
                            <div className="col-12 mt-3">
                                <button type="submit" className={`btn ${editingId ? 'btn-primary' : 'btn-success'} w-100 fw-bold py-2`}>
                                    {editingId ? '💾 METTRE À JOUR LE PAIEMENT' : '✅ ' + t('finances.btn_submit')}
                                </button>
                                {editingId && (
                                    <button type="button" className="btn btn-link btn-sm w-100 mt-1 text-secondary" onClick={() => {
                                        setEditingId(null);
                                        setPaymentForm({ montant: '', mode: 'espece', motif: 'Scolarité' });
                                    }}>Annuler la modification</button>
                                )}
                            </div>
                        </div>
                    </form>
                    <h6 className="fw-bold mb-3 border-bottom pb-2">{t('finances.tab_history')}</h6>
                    <div className="table-responsive">
                        <table className="table table-sm table-hover">
                            <thead className="table-light"><tr><th>Date</th><th>Reçu</th><th>Motif</th><th className="text-end">Montant</th><th className="text-center">Action</th></tr></thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id}>
                                        <td>{new Date(p.date_paiement).toLocaleDateString()}</td>
                                        <td className="small">{p.numero_recu}</td>
                                        <td>{p.motif}</td>
                                        <td className="text-end fw-bold">{p.montant.toLocaleString()}</td>
                                        <td className="text-center">
                                            <div className="btn-group">
                                                <button className="btn btn-sm text-primary py-0" title="Réimprimer" onClick={() => handleReprint(p)}>🖨️</button>
                                                <button className="btn btn-sm text-warning py-0" title="Modifier" onClick={() => editPayment(p)}>✏️</button>
                                                <button className="btn btn-sm text-danger py-0" title="Annuler" onClick={() => deletePayment(p.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 pt-3 border-top">
                        <h6 className="fw-bold mb-3 d-flex justify-content-between align-items-center">
                            <span>📅 Engagements de paiement (Moratoires)</span>
                            <span className="badge bg-warning text-dark">{moratoires.length} engagement(s)</span>
                        </h6>
                        
                        <form onSubmit={handleMoratoire} className="p-3 bg-warning bg-opacity-10 rounded border border-warning mb-4">
                            <div className="row g-2">
                                <div className="col-md-4">
                                    <label className="small fw-bold text-dark">Montant promis</label>
                                    <input type="number" className="form-control form-control-sm border-warning" required value={moratoireForm.montant} onChange={e => setMoratoireForm({...moratoireForm, montant: e.target.value})} />
                                </div>
                                <div className="col-md-4">
                                    <label className="small fw-bold text-dark">Date prévue</label>
                                    <input type="date" className="form-control form-control-sm border-warning" required value={moratoireForm.date_echeance} onChange={e => setMoratoireForm({...moratoireForm, date_echeance: e.target.value})} />
                                </div>
                                <div className="col-md-4">
                                    <label className="small fw-bold text-dark">Motif / Commentaire</label>
                                    <input type="text" className="form-control form-control-sm border-warning" value={moratoireForm.motif} onChange={e => setMoratoireForm({...moratoireForm, motif: e.target.value})} />
                                </div>
                                <div className="col-12 mt-2">
                                    <button type="submit" className="btn btn-warning btn-sm w-100 fw-bold">➕ ENREGISTRER LE MORATOIRE</button>
                                </div>
                            </div>
                        </form>

                        <div className="table-responsive">
                            <table className="table table-sm table-hover border">
                                <thead className="table-light">
                                    <tr>
                                        <th>Échéance</th>
                                        <th>Motif</th>
                                        <th className="text-end">Montant</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {moratoires.map(m => (
                                        <tr key={m.id} className={new Date(m.date_echeance) < new Date() ? 'table-danger' : ''}>
                                            <td className="fw-bold">{new Date(m.date_echeance).toLocaleDateString()}</td>
                                            <td className="small">{m.motif}</td>
                                            <td className="text-end fw-bold">{m.montant.toLocaleString()} FCFA</td>
                                            <td className="text-center">
                                                <button className="btn btn-sm text-primary py-0" onClick={() => handlePrintMoratoire(m)}>🖨️</button>
                                                <button className="btn btn-sm text-danger py-0" onClick={() => deleteMoratoire(m.id)}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {moratoires.length === 0 && (
                                        <tr><td colSpan={4} className="text-center text-muted small py-3">Aucun engagement enregistré.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        ) : <div className="h-100 d-flex align-items-center justify-content-center border rounded bg-white p-5 text-muted">{t('finances.form_student_placeholder').replace('-- ', '').replace(' --', '')}</div>}
      </div>
    </div>
  );
};

export default Finances;
