/*
SQLyog Enterprise - MySQL GUI v5.19
Host - 4.1.10-nt : Database - etshnova
*********************************************************************
Server version : 4.1.10-nt
*/

SET NAMES utf8;

SET SQL_MODE='';

create database if not exists `etshnova`;

USE `etshnova`;

SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

/*Table structure for table `achats` */

DROP TABLE IF EXISTS `achats`;

CREATE TABLE `achats` (
  `id` int(11) NOT NULL auto_increment,
  `numero_achat` varchar(50) default NULL,
  `id_fournisseur` int(11) default NULL,
  `date_achat` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `montant_total` decimal(15,2) default NULL,
  `statut_paiement` enum('NON_PAYE','PARTIEL','PAYE') default 'NON_PAYE',
  `montant_regle` decimal(15,2) default '0.00',
  `id_magasin` int(11) default NULL,
  `id_agence` int(11) default NULL,
  `reference` varchar(255) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `numero_achat` (`numero_achat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `achats` */

/*Table structure for table `agences` */

DROP TABLE IF EXISTS `agences`;

CREATE TABLE `agences` (
  `id` int(11) NOT NULL default '0',
  `nom` varchar(100) NOT NULL default '',
  `adresse` varchar(255) default NULL,
  `ville` varchar(255) NOT NULL default '',
  `telephone` varchar(100) default NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `agences` */

/*Table structure for table `audits` */

DROP TABLE IF EXISTS `audits`;

CREATE TABLE `audits` (
  `id` int(11) NOT NULL auto_increment,
  `numero_audit` varchar(50) default NULL,
  `id_magasin` int(11) default NULL,
  `date_audit` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `notes` text,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `numero_audit` (`numero_audit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `audits` */

/*Table structure for table `caisse` */

DROP TABLE IF EXISTS `caisse`;

CREATE TABLE `caisse` (
  `id` int(11) NOT NULL auto_increment,
  `type_mouvement` enum('ENTREE','SORTIE') NOT NULL default 'ENTREE',
  `montant` decimal(15,2) NOT NULL default '0.00',
  `motif` varchar(255) NOT NULL default '',
  `beneficiaire` varchar(100) default NULL,
  `date_operation` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `id_utilisateur` int(11) default NULL,
  `id_facture_client` int(11) default NULL,
  `id_facture_fournisseur` int(11) default NULL,
  `id_magasin` int(11) default NULL,
  `id_agence` int(11) default NULL,
  `id_session` int(11) default NULL,
  `id_expense_category` int(11) default NULL,
  PRIMARY KEY  (`id`),
  KEY `id_utilisateur` (`id_utilisateur`),
  CONSTRAINT `caisse_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `caisse` */

insert into `caisse` (`id`,`type_mouvement`,`montant`,`motif`,`beneficiaire`,`date_operation`,`id_utilisateur`,`id_facture_client`,`id_facture_fournisseur`,`id_magasin`,`id_agence`,`id_session`,`id_expense_category`) values (1,'SORTIE',1000.00,'TAXI LIVRAISON','MR NKOU','2026-05-17 03:45:48',1,NULL,NULL,1,NULL,1,1);

/*Table structure for table `cash_sessions` */

DROP TABLE IF EXISTS `cash_sessions`;

CREATE TABLE `cash_sessions` (
  `id` int(11) NOT NULL auto_increment,
  `id_utilisateur` int(11) default NULL,
  `id_magasin` int(11) default NULL,
  `date_ouverture` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `date_fermeture` timestamp NULL default NULL,
  `montant_ouverture` decimal(15,2) default '0.00',
  `montant_fermeture` decimal(15,2) default '0.00',
  `statut` enum('OUVERT','FERME') default 'OUVERT',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `cash_sessions` */

insert into `cash_sessions` (`id`,`id_utilisateur`,`id_magasin`,`date_ouverture`,`date_fermeture`,`montant_ouverture`,`montant_fermeture`,`statut`) values (1,1,1,'2026-05-17 03:43:11',NULL,0.00,0.00,'OUVERT');

/*Table structure for table `categories` */

DROP TABLE IF EXISTS `categories`;

CREATE TABLE `categories` (
  `id` int(11) NOT NULL auto_increment,
  `nom` varchar(100) NOT NULL default '',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `categories` */

/*Table structure for table `clients` */

DROP TABLE IF EXISTS `clients`;

CREATE TABLE `clients` (
  `id` int(11) NOT NULL auto_increment,
  `nom` varchar(255) NOT NULL default '',
  `telephone` varchar(50) default NULL,
  `email` varchar(100) default NULL,
  `adresse` text,
  `id_magasin` int(11) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `clients` */

insert into `clients` (`id`,`nom`,`telephone`,`email`,`adresse`,`id_magasin`) values (1,'CLIENT DIVERS','65452123','','YDE-ONGOLA',1);

/*Table structure for table `commande_items` */

DROP TABLE IF EXISTS `commande_items`;

CREATE TABLE `commande_items` (
  `id` int(11) NOT NULL auto_increment,
  `id_commande` int(11) default NULL,
  `id_product` int(11) default NULL,
  `quantite_commandee` decimal(15,2) default NULL,
  `quantite_recue` decimal(15,2) default '0.00',
  `prix_achat_prevu` decimal(15,2) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `commande_items` */

/*Table structure for table `commandes_fournisseurs` */

DROP TABLE IF EXISTS `commandes_fournisseurs`;

CREATE TABLE `commandes_fournisseurs` (
  `id` int(11) NOT NULL auto_increment,
  `numero_commande` varchar(50) default NULL,
  `id_fournisseur` int(11) default NULL,
  `date_commande` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `statut` varchar(20) default 'EN_ATTENTE',
  `total_estime` decimal(15,2) default NULL,
  `id_magasin_prevu` int(11) default NULL,
  `reference` varchar(255) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `numero_commande` (`numero_commande`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `commandes_fournisseurs` */

/*Table structure for table `expense_categories` */

DROP TABLE IF EXISTS `expense_categories`;

CREATE TABLE `expense_categories` (
  `id` int(11) NOT NULL auto_increment,
  `nom` varchar(100) NOT NULL default '',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `expense_categories` */

insert into `expense_categories` (`id`,`nom`) values (1,'TAXI');

/*Table structure for table `facture_items` */

DROP TABLE IF EXISTS `facture_items`;

CREATE TABLE `facture_items` (
  `id` int(11) NOT NULL auto_increment,
  `id_facture` int(11) default NULL,
  `id_product` int(11) default NULL,
  `quantite` decimal(15,2) default NULL,
  `prix_unitaire` decimal(15,2) default NULL,
  `total_ligne` decimal(15,2) default NULL,
  `packaging` varchar(50) default NULL,
  `pack_qty` decimal(15,2) default '1.00',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `facture_items` */

/*Table structure for table `factures` */

DROP TABLE IF EXISTS `factures`;

CREATE TABLE `factures` (
  `id` int(11) NOT NULL auto_increment,
  `numero_facture` varchar(50) default NULL,
  `id_client` int(11) default NULL,
  `date_facture` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `total_ht` decimal(15,2) default NULL,
  `tva` decimal(15,2) default NULL,
  `total_ttc` decimal(15,2) default NULL,
  `type_paiement` varchar(50) default 'comptant',
  `mode_reglement` varchar(50) default 'espece',
  `id_magasin` int(11) default NULL,
  `id_facture_origine` int(11) default NULL,
  `statut` varchar(20) default 'VALIDE',
  `id_agence` int(11) default NULL,
  `reference` varchar(255) default NULL,
  `id_session` int(11) default NULL,
  `precompte` decimal(15,2) default '0.00',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `numero_facture` (`numero_facture`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `factures` */

/*Table structure for table `fournisseurs` */

DROP TABLE IF EXISTS `fournisseurs`;

CREATE TABLE `fournisseurs` (
  `id` int(11) NOT NULL auto_increment,
  `nom` varchar(255) NOT NULL default '',
  `telephone` varchar(50) default NULL,
  `email` varchar(100) default NULL,
  `id_magasin` int(11) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `fournisseurs` */

insert into `fournisseurs` (`id`,`nom`,`telephone`,`email`,`id_magasin`) values (1,'ARRIVAGE','645212354','',NULL);

/*Table structure for table `license` */

DROP TABLE IF EXISTS `license`;

CREATE TABLE `license` (
  `id` int(11) NOT NULL default '0',
  `machine_id` varchar(255) default NULL,
  `activation_key` varchar(255) default NULL,
  `status` varchar(20) default 'INACTIVE',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `license` */

/*Table structure for table `magasins` */

DROP TABLE IF EXISTS `magasins`;

CREATE TABLE `magasins` (
  `id` int(11) NOT NULL auto_increment,
  `nom` varchar(100) NOT NULL default '',
  `lieu` varchar(255) default NULL,
  `code` varchar(20) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `magasins` */

insert into `magasins` (`id`,`nom`,`lieu`,`code`) values (1,'RAYON VENTE','YDE-MARCHE ONGOLA B12','RV1');

/*Table structure for table `messages` */

DROP TABLE IF EXISTS `messages`;

CREATE TABLE `messages` (
  `id` int(11) NOT NULL auto_increment,
  `id_expediteur` int(11) NOT NULL default '0',
  `id_destinataire` int(11) default NULL,
  `contenu` text NOT NULL,
  `date_envoi` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `lu` int(11) default '0',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `messages` */

insert into `messages` (`id`,`id_expediteur`,`id_destinataire`,`contenu`,`date_envoi`,`lu`) values (1,1,NULL,'OKKKK','2026-05-17 03:42:13',0);

/*Table structure for table `products` */

DROP TABLE IF EXISTS `products`;

CREATE TABLE `products` (
  `id` int(11) NOT NULL auto_increment,
  `code_barre` varchar(50) default NULL,
  `designation` varchar(255) NOT NULL default '',
  `id_categorie` int(11) default NULL,
  `prix_achat` decimal(15,2) default NULL,
  `prix_revient` decimal(15,2) default NULL,
  `prix_vente` decimal(15,2) default NULL,
  `unite` varchar(20) default NULL,
  `tva_taux` decimal(5,2) default '0.00',
  `precompte_taux` decimal(5,2) default '0.00',
  `stock_alerte` decimal(15,2) default '5.00',
  `image_path` text,
  `conditionnement` varchar(100) default NULL,
  `date_dlv` date default NULL,
  `p1_name` varchar(50) default 'Pièce',
  `p1_qty` decimal(15,2) default '1.00',
  `p1_price` decimal(15,2) default NULL,
  `p2_name` varchar(50) default NULL,
  `p2_qty` decimal(15,2) default NULL,
  `p2_price` decimal(15,2) default NULL,
  `p3_name` varchar(50) default NULL,
  `p3_qty` decimal(15,2) default NULL,
  `p3_price` decimal(15,2) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `code_barre` (`code_barre`),
  KEY `idx_prod_designation` (`designation`),
  KEY `idx_prod_code` (`code_barre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `products` */

/*Table structure for table `settings` */

DROP TABLE IF EXISTS `settings`;

CREATE TABLE `settings` (
  `id` int(11) NOT NULL auto_increment,
  `company_name` varchar(255) default NULL,
  `activity` varchar(255) default NULL,
  `address` text,
  `phone` varchar(50) default NULL,
  `email` varchar(100) default NULL,
  `niu` varchar(100) default NULL,
  `rccm` varchar(100) default NULL,
  `logo_path` text,
  `currency` varchar(10) default 'FCFA',
  `invoice_footer` text,
  `primary_color` varchar(20) default '#0d6efd',
  `smtp_host` varchar(255) default NULL,
  `smtp_port` int(11) default '587',
  `smtp_user` varchar(255) default NULL,
  `smtp_pass` varchar(255) default NULL,
  `owner_email` varchar(255) default NULL,
  `auto_email_enabled` tinyint(1) default '0',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `settings` */

insert into `settings` (`id`,`company_name`,`activity`,`address`,`phone`,`email`,`niu`,`rccm`,`logo_path`,`currency`,`invoice_footer`,`primary_color`,`smtp_host`,`smtp_port`,`smtp_user`,`smtp_pass`,`owner_email`,`auto_email_enabled`) values (1,'ETS H NOVA','SHOOPING DE MARQUE SUPERIEURE','','692421812/697566486','','','','','FCFA','VENTE EN GROS ET DETAILS','#0d6efd','',587,'','','',0);

/*Table structure for table `stock` */

DROP TABLE IF EXISTS `stock`;

CREATE TABLE `stock` (
  `id_product` int(11) NOT NULL default '0',
  `id_magasin` int(11) NOT NULL default '0',
  `quantite` decimal(15,2) default '0.00',
  PRIMARY KEY  (`id_product`,`id_magasin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `stock` */

/*Table structure for table `stock_movements` */

DROP TABLE IF EXISTS `stock_movements`;

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL auto_increment,
  `id_product` int(11) default NULL,
  `id_magasin` int(11) default NULL,
  `id_fournisseur` int(11) default NULL,
  `type_mouvement` varchar(20) default NULL,
  `quantite` decimal(15,2) default NULL,
  `date_mouvement` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `prix_unitaire` decimal(15,2) default '0.00',
  `total_ligne` decimal(15,2) default '0.00',
  `id_achat` int(11) default NULL,
  `id_audit` int(11) default NULL,
  `motif` varchar(255) default NULL,
  `reference` varchar(255) default NULL,
  `packaging` varchar(50) default NULL,
  `pack_qty` decimal(15,2) default '1.00',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `stock_movements` */

/*Table structure for table `stock_transfer_items` */

DROP TABLE IF EXISTS `stock_transfer_items`;

CREATE TABLE `stock_transfer_items` (
  `id` int(11) NOT NULL auto_increment,
  `id_transfert` int(11) default NULL,
  `id_product` int(11) default NULL,
  `quantite` decimal(15,2) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `stock_transfer_items` */

/*Table structure for table `stock_transfers` */

DROP TABLE IF EXISTS `stock_transfers`;

CREATE TABLE `stock_transfers` (
  `id` int(11) NOT NULL auto_increment,
  `numero_transfert` varchar(50) default NULL,
  `id_magasin_depart` int(11) default NULL,
  `id_magasin_arrivee` int(11) default NULL,
  `date_transfert` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `statut` varchar(20) default 'VALIDE',
  `notes` text,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `numero_transfert` (`numero_transfert`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `stock_transfers` */

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) NOT NULL auto_increment,
  `username` varchar(50) NOT NULL default '',
  `password` text NOT NULL,
  `role` varchar(50) default 'vendeur',
  `created_at` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `id_magasin` int(11) default NULL,
  `id_agence` int(11) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/*Data for the table `users` */

insert into `users` (`id`,`username`,`password`,`role`,`created_at`,`id_magasin`,`id_agence`) values (1,'admin','admin','admin','2026-05-17 03:41:09',NULL,NULL);

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
