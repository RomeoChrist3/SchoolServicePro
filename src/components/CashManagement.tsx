import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dbQuery } from '../services/api';

interface CashManagementProps {
  anneeScolaire?: string;
  user?: any;
  userId?: number;
}

// Algorithme de conversion de montant en toutes lettres en français
const numberToWordsFR = (n: number): string => {
  if (isNaN(n) || n === 0) return 'Zéro Franc CFA';
  const units = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf'];
  const teens = ['Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-sept', 'Dix-huit', 'Dix-neuf'];
  const tens = ['', 'Dix', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-dix', 'Quatre-vingts', 'Quatre-vingt-dix'];

  const convertGroup = (num: number): string => {
    let res = '';
    const h = Math.floor(num / 100);
    const remainder = num % 100;
    if (h > 0) {
      if (h === 1) res += 'Cent ';
      else res += units[h] + ' Cent' + (remainder === 0 && h > 1 ? 's ' : ' ');
    }
    if (remainder > 0) {
      if (remainder < 10) {
        res += units[remainder] + ' ';
      } else if (remainder < 20) {
        res += teens[remainder - 10] + ' ';
      } else {
        const t = Math.floor(remainder / 10);
        const u = remainder % 10;
        if (t === 7) {
          res += 'Soixante-' + (u === 1 ? 'et-onze ' : teens[u] + ' ');
        } else if (t === 9) {
          res += 'Quatre-vingt-' + teens[u] + ' ';
        } else {
          res += tens[t] + (u === 1 && t !== 8 ? ' et Un ' : (u > 0 ? '-' + units[u] + ' ' : ' '));
        }
      }
    }
    return res.trim();
  };

  const integerPart = Math.floor(Math.abs(n));
  if (integerPart === 0) return 'Zéro Franc CFA';

  let result = '';
  const billions = Math.floor(integerPart / 1000000000);
  const millions = Math.floor((integerPart % 1000000000) / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const unitsGroup = integerPart % 1000;

  if (billions > 0) {
    result += (billions === 1 ? 'Un Milliard ' : convertGroup(billions) + ' Milliards ');
  }
  if (millions > 0) {
    result += (millions === 1 ? 'Un Million ' : convertGroup(millions) + ' Millions ');
  }
  if (thousands > 0) {
    result += (thousands === 1 ? 'Mille ' : convertGroup(thousands) + ' Mille ');
  }
  if (unitsGroup > 0) {
    result += convertGroup(unitsGroup) + ' ';
  }

  return (n < 0 ? 'Moins ' : '') + result.trim() + ' Francs CFA';
};

const CashManagement: React.FC<CashManagementProps> = ({ anneeScolaire, user, userId }) => {
  const { t } = useTranslation();
  const currentUserId = user?.id || userId || 1;

  // Onglet actif : 'operations' ou 'caisses'
  const [activeTab, setActiveTab] = useState<'operations' | 'caisses'>('operations');

  // Données principales
  const [caisses, setCaisses] = useState<any[]>([]);
  const [selectedCaisseId, setSelectedCaisseId] = useState<string>('ALL');
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Soldes et Totaux
  const [totalEntrees, setTotalEntrees] = useState(0);
  const [totalSorties, setTotalSorties] = useState(0);
  const [balance, setBalance] = useState(0);

  // Filtres
  const [dateStart, setDateStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Formulaire d'enregistrement d'une opération
  const [formData, setFormData] = useState({
    id_caisse: '',
    type: 'SORTIE',
    montant: '',
    motif: '',
    beneficiaire: '',
    categorie: 'Frais généraux',
    mode_reglement: 'Espèces',
    reference_piece: '',
    date_operation: new Date().toISOString().split('T')[0]
  });

  // Modal Création / Édition d'une Caisse
  const [showCaisseModal, setShowCaisseModal] = useState(false);
  const [caisseFormData, setCaisseFormData] = useState({
    id: null as number | null,
    code_caisse: '',
    nom_caisse: '',
    responsable: '',
    emplacement: '',
    telephone: '',
    solde_initial: '0',
    statut: 'ACTIVE',
    is_default: false,
    description: ''
  });

  // Modal Transfert inter-caisses
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    from_caisse_id: '',
    to_caisse_id: '',
    montant: '',
    motif: 'Transfert de fonds inter-caisses',
    date_operation: new Date().toISOString().split('T')[0]
  });

  // Modal d'édition d'une opération
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // Modal de gestion des catégories
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('SORTIE');

  // Mode d'impression
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'RECEIPT' | 'REPORT' | null>(null);

  // Initialisation des tables en base de données
  const initDbTables = async () => {
    try {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS points_caisse (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code_caisse VARCHAR(50) NOT NULL,
          nom_caisse VARCHAR(100) NOT NULL,
          responsable VARCHAR(100) NULL,
          emplacement VARCHAR(100) NULL,
          telephone VARCHAR(50) NULL,
          solde_initial DECIMAL(15,2) DEFAULT 0,
          statut VARCHAR(20) DEFAULT 'ACTIVE',
          is_default TINYINT(1) DEFAULT 0,
          description TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_code_caisse (code_caisse)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);

      await dbQuery(`
        CREATE TABLE IF NOT EXISTS caisse (
          id INT AUTO_INCREMENT PRIMARY KEY,
          id_caisse INT NULL,
          code_caisse VARCHAR(50) NULL,
          type_mouvement VARCHAR(20) NOT NULL,
          montant DECIMAL(15,2) NOT NULL,
          motif TEXT NOT NULL,
          beneficiaire VARCHAR(255) NULL,
          categorie VARCHAR(100) NULL,
          mode_reglement VARCHAR(50) DEFAULT 'Espèces',
          reference_piece VARCHAR(100) NULL,
          annee_scolaire VARCHAR(50) NULL,
          id_paiement INT NULL,
          date_operation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          id_utilisateur INT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);

      await dbQuery(`
        CREATE TABLE IF NOT EXISTS caisse_categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nom VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8
      `);

      try { await dbQuery("ALTER TABLE points_caisse ADD COLUMN is_default TINYINT(1) DEFAULT 0"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN id_caisse INT NULL"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN code_caisse VARCHAR(50) NULL"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN annee_scolaire VARCHAR(50) NULL"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN id_paiement INT NULL"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN categorie VARCHAR(100) NULL"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN mode_reglement VARCHAR(50) DEFAULT 'Espèces'"); } catch(e) {}
      try { await dbQuery("ALTER TABLE caisse ADD COLUMN reference_piece VARCHAR(100) NULL"); } catch(e) {}
    } catch (e) {
      console.error('Erreur initDbTables caisse:', e);
    }
  };

  const loadCaisses = async () => {
    try {
      const res = await dbQuery('SELECT * FROM points_caisse ORDER BY is_default DESC, nom_caisse ASC');
      if (res && res.success && res.data) {
        setCaisses(res.data);
        const defCaisse = res.data.find((c: any) => c.is_default === 1) || res.data[0];
        if (!formData.id_caisse && defCaisse) {
          setFormData(prev => ({ ...prev, id_caisse: String(defCaisse.id) }));
        }
      }
    } catch (e) {
      console.error('Erreur chargement points_caisse:', e);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await dbQuery('SELECT * FROM caisse_categories ORDER BY nom ASC');
      if (res && res.success && res.data && res.data.length > 0) {
        setCategories(res.data);
      } else {
        const defaultCats = [
          { nom: 'Scolarité & Inscription', type: 'ENTREE' },
          { nom: 'Frais d\'examen & Concours', type: 'ENTREE' },
          { nom: 'Cantine & Restauration', type: 'ENTREE' },
          { nom: 'Transport / Bus scolaire', type: 'ENTREE' },
          { nom: 'Tenues, Uniformes & Écussons', type: 'ENTREE' },
          { nom: 'Activités périscolaires & Sport', type: 'ENTREE' },
          { nom: 'Dons & Subventions', type: 'ENTREE' },
          { nom: 'Transfert Entrant', type: 'ENTREE' },
          { nom: 'Autres Recettes', type: 'ENTREE' },
          { nom: 'Salaires & Vacations Enseignants', type: 'SORTIE' },
          { nom: 'Fournitures de bureau & craie', type: 'SORTIE' },
          { nom: 'Électricité & Eau', type: 'SORTIE' },
          { nom: 'Internet & Communication', type: 'SORTIE' },
          { nom: 'Entretien & Réparations', type: 'SORTIE' },
          { nom: 'Carburant & Transport', type: 'SORTIE' },
          { nom: 'Frais pédagogiques & examens', type: 'SORTIE' },
          { nom: 'Transfert Sortant', type: 'SORTIE' },
          { nom: 'Autres Dépenses', type: 'SORTIE' }
        ];
        for (const cat of defaultCats) {
          try {
            await dbQuery('INSERT INTO caisse_categories (nom, type) VALUES (?, ?)', [cat.nom, cat.type]);
          } catch(e) {}
        }
        setCategories(defaultCats);
      }
    } catch (e) {
      console.error('Erreur chargement catégories:', e);
    }
  };

  // Synchronisation des paiements de scolarité existants dans la caisse par défaut
  const syncPaiementsWithDefaultCaisse = async (forceAlert = false) => {
    try {
      setSyncing(true);
      const resDef = await dbQuery('SELECT * FROM points_caisse WHERE is_default = 1 LIMIT 1');
      let defCaisse = resDef?.data?.[0];
      if (!defCaisse) {
        const resFirst = await dbQuery('SELECT * FROM points_caisse ORDER BY id ASC LIMIT 1');
        defCaisse = resFirst?.data?.[0];
      }

      if (!defCaisse) {
        if (forceAlert) alert('Veuillez créer une caisse avant de synchroniser.');
        return;
      }

      const resPaiements = await dbQuery(`
        SELECT p.*, e.nom as etudiant_nom, e.prenom as etudiant_prenom, c.nom as classe_nom
        FROM paiements p
        LEFT JOIN etudiants e ON p.id_etudiant = e.id
        LEFT JOIN classes c ON e.id_classe = c.id
      `);

      if (resPaiements.success && Array.isArray(resPaiements.data)) {
        let imported = 0;
        for (const p of resPaiements.data) {
          const resExist = await dbQuery('SELECT id FROM caisse WHERE reference_piece = ? OR id_paiement = ?', [p.numero_recu, p.id]);
          if (resExist.success && (!resExist.data || resExist.data.length === 0)) {
            const studentName = p.etudiant_nom ? `${p.etudiant_nom} ${p.etudiant_prenom || ''} (${p.classe_nom || ''})`.trim() : 'Élève';
            const dateOp = p.date_paiement ? new Date(p.date_paiement).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            await dbQuery(`
              INSERT INTO caisse (id_caisse, code_caisse, type_mouvement, montant, motif, beneficiaire, categorie, mode_reglement, reference_piece, annee_scolaire, date_operation, id_paiement, id_utilisateur)
              VALUES (?, ?, 'ENTREE', ?, ?, ?, 'Scolarité & Inscription', ?, ?, ?, ?, ?, 1)
            `, [
              defCaisse.id,
              defCaisse.code_caisse,
              p.montant,
              p.motif || 'Règlement Scolarité / Inscription',
              studentName,
              p.mode_paiement || 'Espèces',
              p.numero_recu || `REC-P-${p.id}`,
              p.annee_scolaire || '2025-2026',
              dateOp,
              p.id
            ]);
            imported++;
          }
        }
        if (forceAlert) {
          alert(`✅ Synchronisation terminée : ${imported} nouveau(x) paiement(s) de scolarité rattaché(s) à la caisse par défaut [${defCaisse.nom_caisse}] !`);
        }
      }
    } catch (e) {
      console.error('Erreur synchronisation paiements caisse:', e);
    } finally {
      setSyncing(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await initDbTables();
      await loadCaisses();
      await loadCategories();

      const start = `${dateStart} 00:00:00`;
      const end = `${dateEnd} 23:59:59`;

      let query = `
        SELECT c.*, u.username, p.nom_caisse, p.code_caisse as caisse_code
        FROM caisse c 
        LEFT JOIN users u ON c.id_utilisateur = u.id 
        LEFT JOIN points_caisse p ON c.id_caisse = p.id
        WHERE c.date_operation BETWEEN ? AND ?
      `;
      const params: any[] = [start, end];

      if (selectedCaisseId !== 'ALL') {
        query += ` AND c.id_caisse = ?`;
        params.push(selectedCaisseId);
      }

      if (anneeScolaire) {
        query += ` AND (c.annee_scolaire = ? OR c.annee_scolaire IS NULL OR c.annee_scolaire = '')`;
        params.push(anneeScolaire);
      }

      query += ` ORDER BY c.date_operation DESC, c.id DESC`;

      const resOps = await dbQuery(query, params);
      if (resOps && resOps.success) {
        setOperations(resOps.data || []);
      }

      // Calcul des totaux et solde
      let balQuery = `
        SELECT 
          SUM(CASE WHEN type_mouvement = 'ENTREE' THEN montant ELSE 0 END) as total_entrees,
          SUM(CASE WHEN type_mouvement = 'SORTIE' THEN montant ELSE 0 END) as total_sorties
        FROM caisse
        WHERE 1=1
      `;
      const balParams: any[] = [];
      if (selectedCaisseId !== 'ALL') {
        balQuery += ` AND id_caisse = ?`;
        balParams.push(selectedCaisseId);
      }
      if (anneeScolaire) {
        balQuery += ` AND (annee_scolaire = ? OR annee_scolaire IS NULL OR annee_scolaire = '')`;
        balParams.push(anneeScolaire);
      }

      const resBal = await dbQuery(balQuery, balParams);
      if (resBal && resBal.success && resBal.data.length > 0) {
        const ent = Number(resBal.data[0]?.total_entrees) || 0;
        const sor = Number(resBal.data[0]?.total_sorties) || 0;

        let initBal = 0;
        if (selectedCaisseId !== 'ALL') {
          const cObj = caisses.find(c => String(c.id) === String(selectedCaisseId));
          if (cObj) initBal = Number(cObj.solde_initial) || 0;
        } else {
          initBal = caisses.reduce((acc, c) => acc + (Number(c.solde_initial) || 0), 0);
        }

        setTotalEntrees(ent);
        setTotalSorties(sor);
        setBalance(initBal + ent - sor);
      }

      const resComp = await dbQuery('SELECT * FROM settings LIMIT 1');
      if (resComp && resComp.success && resComp.data.length > 0) {
        setCompany(resComp.data[0]);
      }
    } catch (e) {
      console.error('Erreur fetchData caisse:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateStart, dateEnd, selectedCaisseId, anneeScolaire]);

  // Filtrage des opérations
  const filteredOperations = operations.filter(op => {
    if (filterType !== 'ALL' && op.type_mouvement !== filterType) return false;
    if (filterCategory !== 'ALL' && op.categorie !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMotif = (op.motif || '').toLowerCase().includes(q);
      const matchBenef = (op.beneficiaire || '').toLowerCase().includes(q);
      const matchPiece = (op.reference_piece || '').toLowerCase().includes(q);
      const matchCat = (op.categorie || '').toLowerCase().includes(q);
      const matchCaisse = (op.nom_caisse || '').toLowerCase().includes(q);
      if (!matchMotif && !matchBenef && !matchPiece && !matchCat && !matchCaisse) return false;
    }
    return true;
  });

  const periodEntrees = filteredOperations.filter(op => op.type_mouvement === 'ENTREE').reduce((s, op) => s + Number(op.montant || 0), 0);
  const periodSorties = filteredOperations.filter(op => op.type_mouvement === 'SORTIE').reduce((s, op) => s + Number(op.montant || 0), 0);

  // Enregistrement d'une nouvelle opération de caisse
  const handleSubmitOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.montant || !formData.motif) {
      alert('Veuillez renseigner le montant et le motif.');
      return;
    }

    const m = parseFloat(formData.montant);
    if (isNaN(m) || m <= 0) {
      alert('Montant invalide.');
      return;
    }

    const targetCaisse = caisses.find(c => String(c.id) === String(formData.id_caisse)) || caisses[0];

    try {
      const dateOp = formData.date_operation ? `${formData.date_operation} ${new Date().toTimeString().split(' ')[0]}` : new Date().toISOString().slice(0, 19).replace('T', ' ');

      const res = await dbQuery(`
        INSERT INTO caisse (id_caisse, code_caisse, type_mouvement, montant, motif, beneficiaire, categorie, mode_reglement, reference_piece, annee_scolaire, date_operation, id_utilisateur) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        targetCaisse?.id || null,
        targetCaisse?.code_caisse || 'CP',
        formData.type,
        m,
        formData.motif,
        formData.beneficiaire || 'Divers',
        formData.categorie || 'Frais généraux',
        formData.mode_reglement || 'Espèces',
        formData.reference_piece || `REC-${Date.now().toString().slice(-6)}`,
        anneeScolaire || '',
        dateOp,
        currentUserId
      ]);

      if (res && res.success) {
        alert('✅ Opération de caisse enregistrée avec succès !');

        const newOp = {
          id: res.insertId || Date.now(),
          nom_caisse: targetCaisse?.nom_caisse || 'Caisse Principale',
          code_caisse: targetCaisse?.code_caisse || 'CP',
          type_mouvement: formData.type,
          montant: m,
          motif: formData.motif,
          beneficiaire: formData.beneficiaire || 'Divers',
          categorie: formData.categorie,
          mode_reglement: formData.mode_reglement,
          reference_piece: formData.reference_piece || `REC-${Date.now().toString().slice(-6)}`,
          date_operation: dateOp,
          username: user?.username || 'Caisse'
        };

        setFormData({
          id_caisse: targetCaisse?.id ? String(targetCaisse.id) : '',
          type: 'SORTIE',
          montant: '',
          motif: '',
          beneficiaire: '',
          categorie: 'Frais généraux',
          mode_reglement: 'Espèces',
          reference_piece: '',
          date_operation: new Date().toISOString().split('T')[0]
        });

        await fetchData();

        if (window.confirm('Voulez-vous imprimer le reçu / bon de caisse maintenant ?')) {
          handlePrintReceipt(newOp);
        }
      } else {
        alert('Erreur lors de l\'enregistrement : ' + (res?.error || 'Erreur'));
      }
    } catch (e) {
      console.error(e);
      alert('Erreur technique lors de l\'enregistrement.');
    }
  };

  // Définir une Caisse par Défaut
  const handleSetDefaultCaisse = async (caisseId: number) => {
    try {
      await dbQuery('UPDATE points_caisse SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END', [caisseId]);
      alert('⭐ Cette caisse a été définie comme la Caisse par Défaut de l\'établissement pour les encaissements de scolarité !');
      await loadCaisses();
      await syncPaiementsWithDefaultCaisse(false);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Enregistrement / Modification d'une Caisse
  const handleSaveCaisse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caisseFormData.code_caisse.trim() || !caisseFormData.nom_caisse.trim()) {
      alert('Le code et le nom de la caisse sont obligatoires.');
      return;
    }

    try {
      const code = caisseFormData.code_caisse.trim().toUpperCase();
      const nom = caisseFormData.nom_caisse.trim();
      const initBal = parseFloat(caisseFormData.solde_initial) || 0;
      const isDef = caisseFormData.is_default ? 1 : 0;

      if (caisseFormData.id) {
        // Modification
        if (isDef === 1) {
          await dbQuery('UPDATE points_caisse SET is_default = 0');
        }
        const res = await dbQuery(`
          UPDATE points_caisse 
          SET code_caisse = ?, nom_caisse = ?, responsable = ?, emplacement = ?, telephone = ?, solde_initial = ?, statut = ?, is_default = ?, description = ?
          WHERE id = ?
        `, [code, nom, caisseFormData.responsable, caisseFormData.emplacement, caisseFormData.telephone, initBal, caisseFormData.statut, isDef, caisseFormData.description, caisseFormData.id]);

        if (res && res.success) {
          alert('✅ Caisse modifiée avec succès !');
          setShowCaisseModal(false);
          await loadCaisses();
          await fetchData();
        } else {
          alert('Erreur : ' + (res?.error?.includes('Duplicate') ? 'Ce code de caisse existe déjà.' : res?.error));
        }
      } else {
        // Création
        if (isDef === 1) {
          await dbQuery('UPDATE points_caisse SET is_default = 0');
        }
        const res = await dbQuery(`
          INSERT INTO points_caisse (code_caisse, nom_caisse, responsable, emplacement, telephone, solde_initial, statut, is_default, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [code, nom, caisseFormData.responsable, caisseFormData.emplacement, caisseFormData.telephone, initBal, caisseFormData.statut, isDef, caisseFormData.description]);

        if (res && res.success) {
          alert('✅ Nouvelle caisse créée avec succès !');
          setShowCaisseModal(false);
          await loadCaisses();
          await fetchData();
        } else {
          alert('Erreur : ' + (res?.error?.includes('Duplicate') ? 'Ce code de caisse existe déjà.' : res?.error));
        }
      }
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'enregistrement de la caisse.');
    }
  };

  const handleEditCaisse = (c: any) => {
    setCaisseFormData({
      id: c.id,
      code_caisse: c.code_caisse || '',
      nom_caisse: c.nom_caisse || '',
      responsable: c.responsable || '',
      emplacement: c.emplacement || '',
      telephone: c.telephone || '',
      solde_initial: String(c.solde_initial || 0),
      statut: c.statut || 'ACTIVE',
      is_default: c.is_default === 1,
      description: c.description || ''
    });
    setShowCaisseModal(true);
  };

  const handleDeleteCaisse = async (caisseId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette caisse ?')) return;
    try {
      const resOps = await dbQuery('SELECT COUNT(*) as total FROM caisse WHERE id_caisse = ?', [caisseId]);
      if (resOps && resOps.success && resOps.data[0]?.total > 0) {
        alert(`Impossible de supprimer cette caisse car elle contient ${resOps.data[0].total} opération(s) enregistrée(s). Vous pouvez la désactiver (Statut: FERMÉE) à la place.`);
        return;
      }
      const res = await dbQuery('DELETE FROM points_caisse WHERE id = ?', [caisseId]);
      if (res && res.success) {
        alert('✅ Caisse supprimée.');
        await loadCaisses();
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Transfert de fonds entre Caisses
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.from_caisse_id || !transferData.to_caisse_id) {
      alert('Veuillez sélectionner la caisse source et la caisse de destination.');
      return;
    }
    if (transferData.from_caisse_id === transferData.to_caisse_id) {
      alert('La caisse source et la caisse destination doivent être différentes.');
      return;
    }
    const m = parseFloat(transferData.montant);
    if (isNaN(m) || m <= 0) {
      alert('Montant de transfert invalide.');
      return;
    }

    const cSource = caisses.find(c => String(c.id) === String(transferData.from_caisse_id));
    const cDest = caisses.find(c => String(c.id) === String(transferData.to_caisse_id));

    try {
      const dateOp = transferData.date_operation ? `${transferData.date_operation} ${new Date().toTimeString().split(' ')[0]}` : new Date().toISOString().slice(0, 19).replace('T', ' ');
      const refPiece = `TRANS-${Date.now().toString().slice(-6)}`;

      // 1. Sortie sur la caisse source
      await dbQuery(`
        INSERT INTO caisse (id_caisse, code_caisse, type_mouvement, montant, motif, beneficiaire, categorie, mode_reglement, reference_piece, annee_scolaire, date_operation, id_utilisateur)
        VALUES (?, ?, 'SORTIE', ?, ?, ?, 'Transfert Sortant', 'Espèces', ?, ?, ?, ?)
      `, [
        cSource?.id,
        cSource?.code_caisse,
        m,
        `Transfert vers [${cDest?.nom_caisse}] - ${transferData.motif}`,
        cDest?.nom_caisse,
        refPiece,
        anneeScolaire || '',
        dateOp,
        currentUserId
      ]);

      // 2. Entrée sur la caisse destination
      await dbQuery(`
        INSERT INTO caisse (id_caisse, code_caisse, type_mouvement, montant, motif, beneficiaire, categorie, mode_reglement, reference_piece, annee_scolaire, date_operation, id_utilisateur)
        VALUES (?, ?, 'ENTREE', ?, ?, ?, 'Transfert Entrant', 'Espèces', ?, ?, ?, ?)
      `, [
        cDest?.id,
        cDest?.code_caisse,
        m,
        `Transfert reçu de [${cSource?.nom_caisse}] - ${transferData.motif}`,
        cSource?.nom_caisse,
        refPiece,
        anneeScolaire || '',
        dateOp,
        currentUserId
      ]);

      alert(`✅ Transfert de ${m.toLocaleString()} FCFA effectué avec succès de [${cSource?.nom_caisse}] vers [${cDest?.nom_caisse}] !`);
      setShowTransferModal(false);
      setTransferData({
        from_caisse_id: '',
        to_caisse_id: '',
        montant: '',
        motif: 'Transfert de fonds inter-caisses',
        date_operation: new Date().toISOString().split('T')[0]
      });
      await fetchData();
    } catch (e) {
      console.error(e);
      alert('Erreur technique lors du transfert.');
    }
  };

  // Modification d'une opération
  const handleOpenEdit = (op: any) => {
    setEditData({
      ...op,
      date_only: op.date_operation ? op.date_operation.split(' ')[0].split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;

    try {
      const dateOp = editData.date_only ? `${editData.date_only} 12:00:00` : editData.date_operation;
      const cObj = caisses.find(c => String(c.id) === String(editData.id_caisse));

      const res = await dbQuery(`
        UPDATE caisse 
        SET id_caisse = ?, code_caisse = ?, type_mouvement = ?, montant = ?, motif = ?, beneficiaire = ?, categorie = ?, mode_reglement = ?, reference_piece = ?, date_operation = ?
        WHERE id = ?
      `, [
        editData.id_caisse || null,
        cObj?.code_caisse || editData.code_caisse,
        editData.type_mouvement,
        parseFloat(editData.montant),
        editData.motif,
        editData.beneficiaire,
        editData.categorie,
        editData.mode_reglement,
        editData.reference_piece,
        dateOp,
        editData.id
      ]);

      if (res && res.success) {
        alert('✅ Opération modifiée avec succès !');
        setShowEditModal(false);
        setEditData(null);
        await fetchData();
      } else {
        alert('Erreur lors de la modification.');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur technique lors de la modification.');
    }
  };

  // Suppression d'une opération
  const handleDeleteOperation = async (id: number) => {
    if (!window.confirm('Confirmer la suppression de cette opération de caisse ? Le solde sera recalculé automatiquement.')) return;
    try {
      const res = await dbQuery('DELETE FROM caisse WHERE id = ?', [id]);
      if (res && res.success) {
        alert('✅ Opération supprimée !');
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Gestion des catégories
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await dbQuery('INSERT INTO caisse_categories (nom, type) VALUES (?, ?)', [newCatName.trim(), newCatType]);
      setNewCatName('');
      await loadCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (!window.confirm('Supprimer cette catégorie ?')) return;
    try {
      await dbQuery('DELETE FROM caisse_categories WHERE id = ?', [catId]);
      await loadCategories();
    } catch (e) {
      console.error(e);
    }
  };

  // Impressions
  const handlePrintReceipt = (op: any) => {
    setSelectedReceipt(op);
    setPrintMode('RECEIPT');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintReport = () => {
    setPrintMode('REPORT');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const availableCategories = categories.filter(c => c.type === formData.type);
  const defaultCaisseObj = caisses.find(c => c.is_default === 1) || caisses[0];

  return (
    <div className="container-fluid p-0">
      {/* ========================================================================= */}
      {/* VUE ECRAN STANDARD                                                        */}
      {/* ========================================================================= */}
      <div className="d-print-none">
        {/* Barre Supérieure : Titre & Navigation Caisses */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div>
            <h3 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
              <span>💰</span> Gestion des Caisses & Trésorerie
            </h3>
            <small className="text-muted">
              Établissement Scolaire • Année : <b className="text-success">{anneeScolaire || '2025-2026'}</b> • Caisse par défaut : <span className="badge bg-success-subtle text-success border border-success fw-bold">⭐ {defaultCaisseObj ? `[${defaultCaisseObj.code_caisse}] ${defaultCaisseObj.nom_caisse}` : 'Non définie'}</span>
            </small>
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <button
              className={`btn fw-bold d-flex align-items-center gap-1 shadow-sm ${activeTab === 'operations' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setActiveTab('operations')}
            >
              <span>📜</span> Opérations & Journal
            </button>
            <button
              className={`btn fw-bold d-flex align-items-center gap-1 shadow-sm ${activeTab === 'caisses' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setActiveTab('caisses')}
            >
              <span>🏦</span> Caisses de l'Établissement ({caisses.length})
            </button>
            <button 
              className="btn btn-outline-info fw-bold d-flex align-items-center gap-1 shadow-sm" 
              onClick={() => syncPaiementsWithDefaultCaisse(true)}
              disabled={syncing}
              title="Importer tous les règlements de scolarité/inscriptions vers la caisse par défaut"
            >
              <span>🔄</span> {syncing ? 'Synchronisation...' : 'Synchroniser Scolarité'}
            </button>
            <button className="btn btn-outline-primary fw-bold d-flex align-items-center gap-1 shadow-sm" onClick={() => setShowTransferModal(true)}>
              <span>🔄</span> Transfert Inter-Caisses
            </button>
            <button className="btn btn-outline-secondary fw-bold d-flex align-items-center gap-1 shadow-sm" onClick={() => setShowCategoryModal(true)}>
              <span>⚙️</span> Catégories
            </button>
            <button className="btn btn-dark fw-bold d-flex align-items-center gap-1 shadow-sm" onClick={handlePrintReport}>
              <span>🖨️</span> Imprimer Journal A4
            </button>
          </div>
        </div>

        {/* ═══════════════ VUE 1 : OPERATIONS & SAISIE ═══════════════ */}
        {activeTab === 'operations' && (
          <>
            {/* Filtre Caisse Active & Indicateurs Financiers */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-light">
              <div className="card-body p-3">
                <div className="row g-3 align-items-center">
                  <div className="col-lg-4">
                    <label className="form-label small fw-bold text-success text-uppercase mb-1">
                      🏦 Caisse / Point d'Encaissement Actif
                    </label>
                    <select
                      className="form-select form-select-lg fw-bold border-success shadow-sm"
                      value={selectedCaisseId}
                      onChange={e => setSelectedCaisseId(e.target.value)}
                    >
                      <option value="ALL">🌐 Toutes les Caisses de l'Établissement</option>
                      {caisses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.is_default === 1 ? '⭐ ' : ''}[{c.code_caisse}] {c.nom_caisse} {c.is_default === 1 ? '(PAR DÉFAUT)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-lg-8">
                    <div className="row g-2">
                      <div className="col-md-4">
                        <div className="p-3 bg-white border rounded-3 shadow-sm text-center">
                          <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '11px' }}>Solde Disponible</small>
                          <span className="fs-4 fw-bold text-success">{balance.toLocaleString()} <small className="fs-6">FCFA</small></span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-3 bg-white border rounded-3 shadow-sm text-center">
                          <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '11px' }}>Total Recettes</small>
                          <span className="fs-4 fw-bold text-primary">+{totalEntrees.toLocaleString()} <small className="fs-6">FCFA</small></span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-3 bg-white border rounded-3 shadow-sm text-center">
                          <small className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '11px' }}>Total Dépenses</small>
                          <span className="fs-4 fw-bold text-danger">-{totalSorties.toLocaleString()} <small className="fs-6">FCFA</small></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Saisie d'Opération + Journal */}
            <div className="row g-4 mb-4">
              {/* Formulaire de Saisie */}
              <div className="col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 sticky-top" style={{ top: '20px' }}>
                  <div className="card-header bg-success text-white py-3 rounded-top-4">
                    <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                      <span>✏️</span> Enregistrer un Mouvement
                    </h5>
                  </div>
                  <div className="card-body p-3">
                    <form onSubmit={handleSubmitOperation}>
                      {/* Choix de la Caisse concernée */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold text-muted text-uppercase">Caisse à Mouvementer *</label>
                        <select
                          required
                          className="form-select form-select-sm fw-bold"
                          value={formData.id_caisse}
                          onChange={e => setFormData({ ...formData, id_caisse: e.target.value })}
                        >
                          {caisses.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.is_default === 1 ? '⭐ ' : ''}[{c.code_caisse}] {c.nom_caisse} {c.is_default === 1 ? '(Par défaut)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Type : Entrée vs Sortie */}
                      <div className="btn-group w-100 mb-3" role="group">
                        <button
                          type="button"
                          className={`btn fw-bold ${formData.type === 'ENTREE' ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => setFormData({ ...formData, type: 'ENTREE', categorie: 'Scolarité & Inscription' })}
                        >
                          ⬆️ RECETTE (Entrée)
                        </button>
                        <button
                          type="button"
                          className={`btn fw-bold ${formData.type === 'SORTIE' ? 'btn-danger' : 'btn-outline-danger'}`}
                          onClick={() => setFormData({ ...formData, type: 'SORTIE', categorie: 'Fournitures de bureau & craie' })}
                        >
                          ⬇️ DÉPENSE (Sortie)
                        </button>
                      </div>

                      {/* Montant */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold text-muted text-uppercase">Montant (FCFA) *</label>
                        <div className="input-group">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            required
                            className="form-control form-control-lg fw-bold text-success"
                            placeholder="Ex: 50000"
                            value={formData.montant}
                            onChange={e => setFormData({ ...formData, montant: e.target.value })}
                          />
                          <span className="input-group-text bg-light fw-bold">FCFA</span>
                        </div>
                        {formData.montant && Number(formData.montant) > 0 && (
                          <small className="text-muted fst-italic d-block mt-1">
                            🗣️ {numberToWordsFR(Number(formData.montant))}
                          </small>
                        )}
                      </div>

                      {/* Motif */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold text-muted text-uppercase">Motif / Justificatif *</label>
                        <textarea
                          required
                          rows={2}
                          className="form-control"
                          placeholder="Ex: Frais d'inscription élève Nguemo / Achat rames papier..."
                          value={formData.motif}
                          onChange={e => setFormData({ ...formData, motif: e.target.value })}
                        />
                      </div>

                      {/* Tiers (Payeur / Bénéficiaire) */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold text-muted text-uppercase">
                          {formData.type === 'ENTREE' ? 'Payeur / Parent / Élève' : 'Bénéficiaire / Fournisseur'}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ex: M. Dupont (Parent) / Librairie Centrale..."
                          value={formData.beneficiaire}
                          onChange={e => setFormData({ ...formData, beneficiaire: e.target.value })}
                        />
                      </div>

                      <div className="row g-2 mb-3">
                        {/* Catégorie */}
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-muted text-uppercase">Rubrique</label>
                          <select
                            className="form-select form-select-sm"
                            value={formData.categorie}
                            onChange={e => setFormData({ ...formData, categorie: e.target.value })}
                          >
                            {availableCategories.map((c, i) => (
                              <option key={i} value={c.nom}>{c.nom}</option>
                            ))}
                          </select>
                        </div>

                        {/* Mode de Règlement */}
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-muted text-uppercase">Règlement</label>
                          <select
                            className="form-select form-select-sm"
                            value={formData.mode_reglement}
                            onChange={e => setFormData({ ...formData, mode_reglement: e.target.value })}
                          >
                            <option value="Espèces">Espèces</option>
                            <option value="Chèque">Chèque</option>
                            <option value="Virement">Virement bancaire</option>
                            <option value="Mobile Money">Mobile Money (Orange/MTN)</option>
                          </select>
                        </div>
                      </div>

                      <div className="row g-2 mb-3">
                        {/* Réf Pièce */}
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-muted text-uppercase">N° Pièce / Réf.</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ex: REC-001..."
                            value={formData.reference_piece}
                            onChange={e => setFormData({ ...formData, reference_piece: e.target.value })}
                          />
                        </div>

                        {/* Date */}
                        <div className="col-md-6">
                          <label className="form-label small fw-bold text-muted text-uppercase">Date</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={formData.date_operation}
                            onChange={e => setFormData({ ...formData, date_operation: e.target.value })}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className={`btn btn-lg w-100 fw-bold shadow-sm ${formData.type === 'ENTREE' ? 'btn-primary' : 'btn-danger'}`}
                      >
                        {formData.type === 'ENTREE' ? '💵 Encaisser la Recette' : '💸 Enregistrer la Dépense'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Tableau du Journal de Caisse */}
              <div className="col-lg-8">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-header bg-white py-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                        <span>📜</span> Mouvements & Reçus
                        <span className="badge bg-success rounded-pill fs-6">{filteredOperations.length}</span>
                      </h5>
                      <button className="btn btn-sm btn-outline-success fw-bold" onClick={fetchData} disabled={loading}>
                        {loading ? '⏳ Chargement...' : '🔄 Actualiser'}
                      </button>
                    </div>
                  </div>

                  {/* Filtres de recherche */}
                  <div className="card-body p-3 bg-light border-bottom">
                    <div className="row g-2 align-items-end">
                      <div className="col-md-3">
                        <label className="form-label small fw-bold text-muted">Du</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={dateStart}
                          onChange={e => setDateStart(e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-bold text-muted">Au</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={dateEnd}
                          onChange={e => setDateEnd(e.target.value)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small fw-bold text-muted">Flux</label>
                        <select
                          className="form-select form-select-sm"
                          value={filterType}
                          onChange={e => setFilterType(e.target.value)}
                        >
                          <option value="ALL">Tous</option>
                          <option value="ENTREE">Recettes (⬆️)</option>
                          <option value="SORTIE">Dépenses (⬇️)</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-bold text-muted">Recherche</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Motif, tiers, réf, caisse..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tableau des mouvements */}
                  <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="table table-hover table-striped align-middle mb-0">
                      <thead className="table-success text-uppercase small text-nowrap sticky-top">
                        <tr>
                          <th>Date</th>
                          <th>Caisse</th>
                          <th>Type</th>
                          <th>Motif & Tiers</th>
                          <th className="text-end">Montant</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOperations.map((op) => (
                          <tr key={op.id}>
                            <td className="small text-nowrap">
                              {new Date(op.date_operation).toLocaleDateString()}<br/>
                              <small className="text-muted">{new Date(op.date_operation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </td>
                            <td>
                              <span className="badge bg-success-subtle text-success border border-success fw-bold">
                                {op.caisse_code || op.code_caisse || 'CAISSE'}
                              </span>
                              <div className="small text-muted text-truncate" style={{ maxWidth: '120px' }}>
                                {op.nom_caisse}
                              </div>
                            </td>
                            <td>
                              {op.type_mouvement === 'ENTREE' ? (
                                <span className="badge bg-primary text-white">⬆️ RECETTE</span>
                              ) : (
                                <span className="badge bg-danger text-white">⬇️ DÉPENSE</span>
                              )}
                            </td>
                            <td>
                              <div className="fw-bold text-dark">{op.motif}</div>
                              <div className="small text-muted">
                                <span>Tiers : <b>{op.beneficiaire || 'Non spécifié'}</b></span>
                                {op.categorie && <span className="ms-2 badge bg-light text-dark border">{op.categorie}</span>}
                                {op.reference_piece && <span className="ms-1 badge bg-light text-secondary border">{op.reference_piece}</span>}
                              </div>
                            </td>
                            <td className="text-end text-nowrap">
                              <span className={`fw-bold fs-6 ${op.type_mouvement === 'ENTREE' ? 'text-primary' : 'text-danger'}`}>
                                {op.type_mouvement === 'ENTREE' ? '+' : '-'}{Number(op.montant).toLocaleString()} FCFA
                              </span>
                            </td>
                            <td className="text-center text-nowrap">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-success"
                                  title="Imprimer le reçu"
                                  onClick={() => handlePrintReceipt(op)}
                                >
                                  🖨️ Reçu
                                </button>
                                <button
                                  className="btn btn-outline-primary"
                                  title="Modifier"
                                  onClick={() => handleOpenEdit(op)}
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  title="Supprimer"
                                  onClick={() => handleDeleteOperation(op.id)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {filteredOperations.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-5 text-muted">
                              <div className="fs-1 mb-2">📜</div>
                              <h6>Aucun mouvement de caisse trouvé pour cette sélection</h6>
                              <small>Enregistrez une recette ou une dépense via le formulaire de gauche.</small>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ VUE 2 : GESTION DES CAISSES (CREATION / EDITION) ═══════════════ */}
        {activeTab === 'caisses' && (
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <div>
                <h5 className="fw-bold text-dark mb-0">🏦 Caisses & Guichets de l'Établissement</h5>
                <small className="text-muted">Créez vos caisses, définissez la caisse principale par défaut pour les encaissements scolaires</small>
              </div>
              <button
                className="btn btn-success fw-bold d-flex align-items-center gap-1 shadow-sm"
                onClick={() => {
                  setCaisseFormData({
                    id: null,
                    code_caisse: '',
                    nom_caisse: '',
                    responsable: '',
                    emplacement: '',
                    telephone: '',
                    solde_initial: '0',
                    statut: 'ACTIVE',
                    is_default: false,
                    description: ''
                  });
                  setShowCaisseModal(true);
                }}
              >
                <span>➕</span> Nouvelle Caisse
              </button>
            </div>

            <div className="card-body p-4">
              <div className="row g-3">
                {caisses.map((c) => (
                  <div key={c.id} className="col-md-6 col-lg-4">
                    <div className={`card h-100 border rounded-4 shadow-sm hover-shadow transition-all ${c.is_default === 1 ? 'border-success border-2' : ''}`}>
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="badge bg-success-subtle text-success border border-success fw-bold px-2 py-1 fs-6">
                            {c.code_caisse}
                          </span>
                          <div className="d-flex gap-1">
                            {c.is_default === 1 ? (
                              <span className="badge bg-warning text-dark fw-bold">⭐ PAR DÉFAUT</span>
                            ) : (
                              <button 
                                className="btn btn-sm btn-outline-warning py-0 px-2 fw-bold text-dark"
                                style={{ fontSize: '11px' }}
                                onClick={() => handleSetDefaultCaisse(c.id)}
                                title="Définir comme caisse par défaut pour recevoir les paiements de scolarité"
                              >
                                Définir par défaut
                              </button>
                            )}
                            <span className={`badge ${c.statut === 'ACTIVE' ? 'bg-success' : 'bg-secondary'}`}>
                              {c.statut}
                            </span>
                          </div>
                        </div>

                        <h5 className="fw-bold text-dark mb-2">{c.nom_caisse}</h5>
                        <p className="text-muted small mb-3">{c.description || 'Caisse de l\'établissement'}</p>

                        <div className="bg-light p-3 rounded-3 mb-3 small">
                          <div className="mb-1"><b>👤 Responsable :</b> {c.responsable || 'Non assigné'}</div>
                          <div className="mb-1"><b>📍 Emplacement :</b> {c.emplacement || 'Non spécifié'}</div>
                          {c.telephone && <div className="mb-1"><b>📞 Téléphone :</b> {c.telephone}</div>}
                          <div><b>💵 Solde Initial :</b> {Number(c.solde_initial || 0).toLocaleString()} FCFA</div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                          <button className="btn btn-sm btn-outline-primary fw-bold" onClick={() => handleEditCaisse(c)}>
                            ✏️ Modifier
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCaisse(c.id)}>
                            🗑️ Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL : CREATION / EDITION D'UNE CAISSE                                    */}
      {/* ========================================================================= */}
      {showCaisseModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">
                  {caisseFormData.id ? '✏️ Modifier la Caisse' : '➕ Créer une Nouvelle Caisse'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCaisseModal(false)}></button>
              </div>
              <form onSubmit={handleSaveCaisse}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Code Caisse (Unique) *</label>
                      <input
                        type="text"
                        required
                        className="form-control fw-bold text-uppercase"
                        placeholder="Ex: CAISSE-SCOL, CAISSE-BUS..."
                        value={caisseFormData.code_caisse}
                        onChange={e => setCaisseFormData({ ...caisseFormData, code_caisse: e.target.value })}
                      />
                      <small className="text-muted">Ex: CP, CAISSE-SCOL, CAISSE-CANTINE</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Nom / Libellé de la Caisse *</label>
                      <input
                        type="text"
                        required
                        className="form-control fw-bold"
                        placeholder="Ex: Caisse Scolarité & Inscriptions"
                        value={caisseFormData.nom_caisse}
                        onChange={e => setCaisseFormData({ ...caisseFormData, nom_caisse: e.target.value })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Responsable / Caissier</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: M. Dupont (Intendant)"
                        value={caisseFormData.responsable}
                        onChange={e => setCaisseFormData({ ...caisseFormData, responsable: e.target.value })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Emplacement / Guichet</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: Guichet 1 - Bâtiment Administratif"
                        value={caisseFormData.emplacement}
                        onChange={e => setCaisseFormData({ ...caisseFormData, emplacement: e.target.value })}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Téléphone</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: +237 6..."
                        value={caisseFormData.telephone}
                        onChange={e => setCaisseFormData({ ...caisseFormData, telephone: e.target.value })}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Solde Initial (FCFA)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control fw-bold"
                        value={caisseFormData.solde_initial}
                        onChange={e => setCaisseFormData({ ...caisseFormData, solde_initial: e.target.value })}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Statut</label>
                      <select
                        className="form-select"
                        value={caisseFormData.statut}
                        onChange={e => setCaisseFormData({ ...caisseFormData, statut: e.target.value })}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="FERMÉE">FERMÉE</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch p-2 bg-light rounded border">
                        <input
                          className="form-check-input ms-0 me-2"
                          type="checkbox"
                          id="is_default_check"
                          checked={caisseFormData.is_default}
                          onChange={e => setCaisseFormData({ ...caisseFormData, is_default: e.target.checked })}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="is_default_check">
                          ⭐ Définir comme Caisse par Défaut (Reçoit automatiquement tous les paiements scolaires)
                        </label>
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Description / Observations</label>
                      <textarea
                        rows={2}
                        className="form-control"
                        placeholder="Notes sur l'usage de cette caisse..."
                        value={caisseFormData.description}
                        onChange={e => setCaisseFormData({ ...caisseFormData, description: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCaisseModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-success fw-bold">💾 Enregistrer la Caisse</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : TRANSFERT INTER-CAISSES                                           */}
      {/* ========================================================================= */}
      {showTransferModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">🔄 Transfert de Fonds Inter-Caisses</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowTransferModal(false)}></button>
              </div>
              <form onSubmit={handleExecuteTransfer}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Caisse Source (Débitée) *</label>
                    <select
                      required
                      className="form-select fw-bold border-danger"
                      value={transferData.from_caisse_id}
                      onChange={e => setTransferData({ ...transferData, from_caisse_id: e.target.value })}
                    >
                      <option value="">-- Sélectionner la caisse source --</option>
                      {caisses.map(c => (
                        <option key={c.id} value={c.id}>
                          [{c.code_caisse}] {c.nom_caisse}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Caisse Destination (Créditée) *</label>
                    <select
                      required
                      className="form-select fw-bold border-success"
                      value={transferData.to_caisse_id}
                      onChange={e => setTransferData({ ...transferData, to_caisse_id: e.target.value })}
                    >
                      <option value="">-- Sélectionner la caisse destination --</option>
                      {caisses.map(c => (
                        <option key={c.id} value={c.id}>
                          [{c.code_caisse}] {c.nom_caisse}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Montant à transférer (FCFA) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="form-control form-control-lg fw-bold text-primary"
                      placeholder="Ex: 100000"
                      value={transferData.montant}
                      onChange={e => setTransferData({ ...transferData, montant: e.target.value })}
                    />
                    {transferData.montant && Number(transferData.montant) > 0 && (
                      <small className="text-muted fst-italic d-block mt-1">
                        🗣️ {numberToWordsFR(Number(transferData.montant))}
                      </small>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Motif du transfert</label>
                    <input
                      type="text"
                      className="form-control"
                      value={transferData.motif}
                      onChange={e => setTransferData({ ...transferData, motif: e.target.value })}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">Date de l'opération</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={transferData.date_operation}
                      onChange={e => setTransferData({ ...transferData, date_operation: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold">🔄 Valider le Transfert</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : MODIFICATION D'UNE OPERATION                                      */}
      {/* ========================================================================= */}
      {showEditModal && editData && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">✏️ Modifier l'opération de caisse #{editData.id}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
              </div>
              <form onSubmit={handleSaveEdit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Caisse Concernée</label>
                    <select
                      className="form-select fw-bold"
                      value={editData.id_caisse || ''}
                      onChange={e => setEditData({ ...editData, id_caisse: e.target.value })}
                    >
                      {caisses.map(c => (
                        <option key={c.id} value={c.id}>
                          [{c.code_caisse}] {c.nom_caisse}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Type de Mouvement</label>
                    <select
                      className="form-select"
                      value={editData.type_mouvement}
                      onChange={e => setEditData({ ...editData, type_mouvement: e.target.value })}
                    >
                      <option value="ENTREE">⬆️ RECETTE (Entrée)</option>
                      <option value="SORTIE">⬇️ DÉPENSE (Sortie)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Montant (FCFA) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="form-control fw-bold fs-5 text-success"
                      value={editData.montant}
                      onChange={e => setEditData({ ...editData, montant: e.target.value })}
                    />
                    {editData.montant && Number(editData.montant) > 0 && (
                      <small className="text-muted fst-italic d-block mt-1">
                        🗣️ {numberToWordsFR(Number(editData.montant))}
                      </small>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Motif / Libellé *</label>
                    <textarea
                      required
                      rows={2}
                      className="form-control"
                      value={editData.motif}
                      onChange={e => setEditData({ ...editData, motif: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Tiers (Payeur / Bénéficiaire)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editData.beneficiaire || ''}
                      onChange={e => setEditData({ ...editData, beneficiaire: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-bold">Rubrique / Catégorie</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editData.categorie || ''}
                        onChange={e => setEditData({ ...editData, categorie: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold">Date de l'opération</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={editData.date_only || ''}
                        onChange={e => setEditData({ ...editData, date_only: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold">N° Référence / Pièce</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={editData.reference_piece || ''}
                      onChange={e => setEditData({ ...editData, reference_piece: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-success fw-bold">💾 Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : GESTION DES CATEGORIES                                            */}
      {/* ========================================================================= */}
      {showCategoryModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">⚙️ Gestion des Catégories de Caisse</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCategoryModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <form onSubmit={handleAddCategory} className="mb-4">
                  <div className="row g-2 align-items-end">
                    <div className="col-6">
                      <label className="form-label small fw-bold">Nouvelle Rubrique</label>
                      <input
                        type="text"
                        required
                        className="form-control form-control-sm"
                        placeholder="Ex: Frais de dossier..."
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-bold">Flux</label>
                      <select
                        className="form-select form-select-sm"
                        value={newCatType}
                        onChange={e => setNewCatType(e.target.value)}
                      >
                        <option value="ENTREE">Recette (Entrée)</option>
                        <option value="SORTIE">Dépense (Sortie)</option>
                      </select>
                    </div>
                    <div className="col-2">
                      <button type="submit" className="btn btn-sm btn-success w-100 fw-bold">➕</button>
                    </div>
                  </div>
                </form>

                <h6 className="fw-bold text-dark border-bottom pb-2">Catégories Enregistrées ({categories.length})</h6>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {categories.map((c, i) => (
                      <li key={i} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                        <div>
                          <span className="fw-medium">{c.nom}</span>
                          <span className={`badge ms-2 ${c.type === 'ENTREE' ? 'bg-primary' : 'bg-danger'}`}>
                            {c.type === 'ENTREE' ? 'Recette' : 'Dépense'}
                          </span>
                        </div>
                        {c.id && (
                          <button
                            className="btn btn-sm btn-outline-danger border-0"
                            onClick={() => handleDeleteCategory(c.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPRESSION : REÇU DE CAISSE (DOUBLE VOLET)                                */}
      {/* ========================================================================= */}
      {printMode === 'RECEIPT' && selectedReceipt && (
        <div className="d-none d-print-block p-4" style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}>
          {[1, 2].map((copyIndex) => (
            <div key={copyIndex} style={{ border: '2px solid #333', padding: '18px', borderRadius: '8px', marginBottom: copyIndex === 1 ? '40px' : '0' }}>
              {/* En-tête Reçu */}
              <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-3">
                <div style={{ maxWidth: '60%' }}>
                  {company?.entete_facture ? (
                    <div style={{ whiteSpace: 'pre-line', fontSize: '12px', lineHeight: '1.4' }}>
                      {company.entete_facture}
                    </div>
                  ) : (
                    <div>
                      <h4 className="fw-bold text-uppercase mb-0">{company?.company_name || 'ÉTABLISSEMENT SCOLAIRE'}</h4>
                      <p className="small mb-0 text-muted">{company?.activity || 'Enseignement Général & Technique'}</p>
                      <p className="small mb-0">{company?.address} • Tél: {company?.phone}</p>
                    </div>
                  )}
                </div>
                <div className="text-end">
                  <div className="badge bg-dark text-white fs-6 p-2 text-uppercase mb-1">
                    {selectedReceipt.type_mouvement === 'ENTREE' ? 'REÇU D\'ENCAISSEMENT' : 'BON DE DÉCAISSEMENT'}
                  </div>
                  <div className="fw-bold small">Caisse: <span className="text-uppercase">{selectedReceipt.code_caisse || selectedReceipt.caisse_code || selectedReceipt.nom_caisse || 'PRINCIPALE'}</span></div>
                  <div className="fw-bold small">Réf: {selectedReceipt.reference_piece || `OP-${selectedReceipt.id}`}</div>
                  <div className="small text-muted">{copyIndex === 1 ? '— VOLET 1 : SOUCHE ÉTABLISSEMENT —' : '— VOLET 2 : CLIENT / BÉNÉFICIAIRE —'}</div>
                </div>
              </div>

              {/* Corps du Reçu */}
              <div className="row g-2 mb-3" style={{ fontSize: '13px' }}>
                <div className="col-6">
                  <b>Date :</b> {new Date(selectedReceipt.date_operation).toLocaleDateString()} à {new Date(selectedReceipt.date_operation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="col-6 text-end">
                  <b>Année Académique :</b> {selectedReceipt.annee_scolaire || anneeScolaire || '2025-2026'}
                </div>
                <div className="col-12 mt-2">
                  <b>{selectedReceipt.type_mouvement === 'ENTREE' ? 'Reçu de (Payeur)' : 'Versé à (Bénéficiaire)'} :</b> <span className="fs-6 fw-bold">{selectedReceipt.beneficiaire || 'Divers'}</span>
                </div>
                <div className="col-12">
                  <b>Motif / Objet :</b> {selectedReceipt.motif}
                </div>
                <div className="col-6">
                  <b>Rubrique :</b> {selectedReceipt.categorie || 'Général'}
                </div>
                <div className="col-6 text-end">
                  <b>Règlement :</b> {selectedReceipt.mode_reglement || 'Espèces'}
                </div>
              </div>

              {/* Montant en Chiffres et en Lettres */}
              <div className="bg-light p-3 rounded border mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-bold text-uppercase">Montant Réglé :</span>
                  <span className="fs-4 fw-bold text-dark">{Number(selectedReceipt.montant).toLocaleString()} FCFA</span>
                </div>
                <div className="small">
                  <b>Montant en toutes lettres :</b> <span className="fst-italic fw-bold text-uppercase">{numberToWordsFR(Number(selectedReceipt.montant))}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="d-flex justify-content-between pt-3" style={{ fontSize: '12px' }}>
                <div className="text-center" style={{ width: '40%' }}>
                  <b>Le Bénéficiaire / Payeur</b><br/><br/><br/>
                  <span>Signature</span>
                </div>
                <div className="text-center" style={{ width: '40%' }}>
                  <b>Le Responsable de Caisse</b><br/><br/><br/>
                  <span>Cachet & Signature</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPRESSION : RAPPORT / JOURNAL DE CAISSE A4                               */}
      {/* ========================================================================= */}
      {printMode === 'REPORT' && (
        <div className="d-none d-print-block p-4" style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}>
          {/* En-tête Rapport */}
          <div className="text-center border-bottom pb-3 mb-4">
            {company?.entete_facture ? (
              <div style={{ whiteSpace: 'pre-line', fontSize: '13px', lineHeight: '1.4' }}>
                {company.entete_facture}
              </div>
            ) : (
              <div>
                <h3 className="fw-bold text-uppercase mb-1">{company?.company_name || 'ÉTABLISSEMENT SCOLAIRE'}</h3>
                <p className="small mb-1">{company?.address} • Tél: {company?.phone}</p>
              </div>
            )}
            <h4 className="fw-bold text-uppercase text-dark mt-3 mb-1">JOURNAL DE CAISSE & RAPPORT D'ARRÊTÉ</h4>
            <p className="small text-muted mb-0">
              Période du <b>{new Date(dateStart).toLocaleDateString()}</b> au <b>{new Date(dateEnd).toLocaleDateString()}</b> • Caisse : <b>{selectedCaisseId === 'ALL' ? 'Toutes les Caisses' : (caisses.find(c => String(c.id) === selectedCaisseId)?.nom_caisse || 'Caisse')}</b> • Année : <b>{anneeScolaire || 'Toutes'}</b>
            </p>
          </div>

          {/* Synthèse Financière */}
          <div className="row g-2 mb-4" style={{ fontSize: '13px' }}>
            <div className="col-4">
              <div className="p-2 border rounded text-center">
                <small className="text-muted d-block text-uppercase fw-bold">Total Recettes</small>
                <b className="fs-5 text-primary">+{periodEntrees.toLocaleString()} FCFA</b>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 border rounded text-center">
                <small className="text-muted d-block text-uppercase fw-bold">Total Dépenses</small>
                <b className="fs-5 text-danger">-{periodSorties.toLocaleString()} FCFA</b>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 border rounded text-center">
                <small className="text-muted d-block text-uppercase fw-bold">Solde Net Période</small>
                <b className="fs-5 text-success">{(periodEntrees - periodSorties).toLocaleString()} FCFA</b>
              </div>
            </div>
          </div>

          {/* Tableau Détaillé */}
          <table className="table table-bordered table-sm align-middle" style={{ fontSize: '11px' }}>
            <thead className="table-dark text-uppercase">
              <tr>
                <th>Date</th>
                <th>Caisse</th>
                <th>Réf.</th>
                <th>Type</th>
                <th>Motif & Tiers</th>
                <th>Rubrique</th>
                <th className="text-end">Recettes</th>
                <th className="text-end">Dépenses</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map((op, i) => (
                <tr key={i}>
                  <td>{new Date(op.date_operation).toLocaleDateString()}</td>
                  <td className="fw-bold">{op.caisse_code || op.code_caisse || 'CAISSE'}</td>
                  <td>{op.reference_piece || `OP-${op.id}`}</td>
                  <td>{op.type_mouvement === 'ENTREE' ? 'RECETTE' : 'DÉPENSE'}</td>
                  <td>
                    <b>{op.motif}</b>
                    {op.beneficiaire && <div className="text-muted">Tiers: {op.beneficiaire}</div>}
                  </td>
                  <td>{op.categorie || 'Général'}</td>
                  <td className="text-end text-primary fw-bold">
                    {op.type_mouvement === 'ENTREE' ? Number(op.montant).toLocaleString() : '—'}
                  </td>
                  <td className="text-end text-danger fw-bold">
                    {op.type_mouvement === 'SORTIE' ? Number(op.montant).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-bold">
              <tr>
                <td colSpan={6} className="text-end text-uppercase">TOTAUX PÉRIODE</td>
                <td className="text-end text-primary">+{periodEntrees.toLocaleString()} FCFA</td>
                <td className="text-end text-danger">-{periodSorties.toLocaleString()} FCFA</td>
              </tr>
              <tr>
                <td colSpan={6} className="text-end text-uppercase">SOLDE DISPONIBLE EN CAISSE</td>
                <td colSpan={2} className="text-end fs-6 text-success">
                  {balance.toLocaleString()} FCFA
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures Clôture */}
          <div className="d-flex justify-content-between pt-5 mt-4" style={{ fontSize: '12px' }}>
            <div className="text-center" style={{ width: '35%' }}>
              <b>Le Caissier / Économe</b><br/><br/><br/><br/>
              <span>Nom & Signature</span>
            </div>
            <div className="text-center" style={{ width: '35%' }}>
              <b>Le Chef d'Établissement / Principal</b><br/><br/><br/><br/>
              <span>Signature & Sceau</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashManagement;
