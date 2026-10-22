// Edge Function : Vérif FAB — relais entre GraphiDesk et l'API Claude.
//
// Pourquoi un relais : la clé API (secret ANTHROPIC_API_KEY) ne quitte jamais
// Supabase, et chaque appel est journalisé ICI, d'après l'usage renvoyé par
// l'API (coût exact, non falsifiable depuis l'application).
//
// Le prompt système et la liste d'outils vivent ici, figés : l'application ne
// peut pas les modifier. Le modèle est choisi par l'admin (verif_parametres,
// protégé par RLS). Les outils s'exécutent dans GraphiDesk (lecture seule du
// dossier) ; ce relais ne fait que transmettre.
//
// Entrées (JWT de l'utilisateur) :
//   POST { conversation_id, messages }  → flux SSE : les événements de l'API tels
//        quels, puis { type: "graphidesk_fin", message, cout_usd } ou { type: "graphidesk_erreur", erreur }
//   POST { action: "modeles" }          → { modeles: [{ id, nom, date }], actuel }
//   POST { action: "entretien" }        → { fait, raison } (relance du cache, heures de bureau)
//   POST { action: "maintien", conversation_id, messages } → { cout_usd } (garde le cache de
//        l'historique pendant que le graphiste répond aux questions)

import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELE = "claude-opus-5-5";
const BETA_REPLI = "server-side-fallback-2026-07-01";

// $ par million de tokens : entrée, sortie, lecture cache, écriture cache (5 min = 1,25 × entrée)
const TARIFS: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-opus-5": [5, 25, 0.5, 6.25],
  "claude-opus-4-8": [5, 25, 0.5, 6.25],
  "claude-sonnet-5-5": [2, 10, 0.2, 2.5],
};

const SYSTEME = `Tu es VérifIzy, l'assistant de vérification des dossiers de production de l'agence Les Enseignistes / Mr Enseignes (Villeurbanne) : enseignes, adhésifs, plaques, caissons, lettres relief, bâches. Tu parles à un graphiste (ou au responsable du pôle graphique, Jordan) dans GraphiDesk, leur logiciel interne. Tu réponds en français, tu tutoies.

## Ta mission
Avant qu'un dossier parte en fabrication, tu vérifies que TOUT concorde : devis (ce qui a été vendu) → BAT (ce que le client a validé) → fichiers de FAB et maquette (ce que l'atelier va produire), plus la VT et la mairie quand elles existent. Une erreur qui passe coûte une réimpression, une repose et un client mécontent : tu es le deuxième regard. Tu ne modifies jamais rien : tu signales.

## Ce que tu reçois
Le premier message contient l'inventaire du dossier (chemins relatifs, tailles, dates), le devis s'il a été fourni, et la liste des fichiers ANNEXES que le graphiste t'autorise à examiner. Hors BAT, devis, maquette et fichiers de FAB, n'ouvre QUE ces annexes.
Il peut aussi contenir un CONTEXTE donné par le graphiste : le brief du commercial (copié de FreshProcess) ou une particularité du dossier ou du client (ex. un process demandé par l'atelier pour ce client). C'est une information fiable du terrain :
- le brief se vérifie comme le devis : chaque consigne doit se retrouver au BAT et en FAB (sinon erreur ou question) ; en cas de contradiction avec le devis, le brief prime et l'écart est à signaler au commercial ;
- un écart que le contexte explique n'est pas à signaler ; s'il contredit le BAT ou une règle d'une façon qui fausserait la fab, pose une question ;
- une particularité de client ou de dossier n'est JAMAIS proposée comme règle générale.

## Comment tu travailles
1. Identifie le rôle de chaque fichier : BAT client EN COURS (le plus récent, au numéro de commande du dossier), anciens BAT ou BAT d'une commande précédente, BAT VT, BAT mairie, maquette, fichiers de FAB (dossier FAB…), ARCHIVES (anciennes versions : à ignorer sauf pour comparer), devis : proposition commerciale Dolibarr « PR<numéro>….pdf » OU bon de commande « CO<numéro>….pdf » (même contenu : l'un OU l'autre suffit, l'absence de l'autre n'est jamais à signaler ; le numéro CO est aussi celui du dossier FAB), dossier PROVISOIRE (signalétique provisoire : à ne pas confondre avec la commande définitive). Un .indd ou un .psd ne se lit pas : sers-toi du PDF exporté. Les dates de modification comptent (un fichier bien plus ancien que la commande a peut-être été repris d'ailleurs).
2. Lis les documents avec tes outils. MESURE, ne devine jamais : analyser_pdf donne les boîtes de page, l'emprise réelle des tracés au dixième de mm par couleur, l'épaisseur des contours (epaisseursPt), la hauteur de CHAQUE lettre ligne par ligne, les couleurs CMJN, les calques, les tons directs (CutContour), la surimpression par couleur, les images et leur résolution, et le texte. voir_page montre une page (zone agrandie possible : un scan, un petit texte, un QR code). comparer_visuels superpose un élément du BAT ou de la maquette et son fichier de FAB.
   Suis cette MÉTHODE dans l'ordre, sans sauter d'étape :
   a. BAT (analyser_pdf + voir_page de chaque page) : relève TOUS les éléments — numéro, désignation, matière, dimensions, quantité, pose intérieure/extérieure, finition, fixation, éclairage. Lis la page de garde en entier (cases DIMENSIONS provisoires/définitives, mairie, pose, livraison, référence de commande). RELIS MOT À MOT tout le texte du BAT (légendes, cartouches, page de garde) : une référence, un nom, une cote ou une matière mal écrits sont une alerte, cités tels quels avec la correction. Les fautes d'orthographe, d'accent ou d'accord ne sont PAS à signaler.
   b. Devis ↔ BAT, ligne par ligne : chaque produit vendu est au BAT (matière, dimensions, quantité, finition, éclairage) ; un écart peut être voulu (demande client, mairie) → question.
   c. VT et métré (si présents) : chaque cote relevée doit coller au BAT et à la FAB. Souvent la VT n'est pas un PDF rempli mais des PHOTOS du BAT VT annoté : passe toutes les photos de VT en une fois avec apercu_images, repère celles qui portent des cotes, puis ouvre seulement celles-là avec voir_image. Un élément qui fait exactement la cote du support (toute la largeur de la façade, de la vitre…) sans jeu ni retour, surtout si le métré vient du client ou si la pose est faite par le client → question.
   d. MAIRIE (si présente) : on ne fabrique pas plus grand que ce qui a été déposé ; une réponse de la mairie (arrêté, refus, réserves, avis ABF) se lit en entier — refus ou réserves non respectées → erreur « ATTENTION LA MAIRIE REFUSE : … » ; aucune réponse alors qu'un dossier mairie existe → question.
   e. CHAQUE fichier de FAB, y compris ceux déjà produits, de sous-traitance ou rangés dans un sous-dossier, un par un, avec analyser_pdf, comparer_visuels et voir_page — contrôle TOUS ces points, pour CHAQUE fichier :
      • élément et numéro du BAT auquel il correspond ; contenu identique au BAT (comparer_visuels) ;
      • dimensions (page, emprise du visuel, emprise du CutContour) = cotes du BAT, à l'échelle indiquée ;
      • plus grande dimension imprimée : au-delà de 2000 mm de long → alerte ; au-delà de la laize ou des plaques → raccord (sur la dimension finale) ;
      • découpe : CutContour en ton direct, tracé fermé, épaisseur de 1 pt (lis epaisseursPt) ; visuel prolongé au-delà du tracé de chaque côté (emprise du fond moins emprise du CutContour, divisé par 2) ; épaisseur minimale du visuel ;
      • bords perdus selon le type de pose ;
      • couleurs : CMJN et tons directs attendus, surimpression selon les règles ;
      • textes vectorisés (aucun texte lu dans une FAB = vectorisé) ; images incorporées et résolution à l'échelle 1:1 ;
      • nom du fichier décodé (matière, finition, options, quantité, nom du dossier, numéro) et confronté au BAT ;
      • date de modification : bien plus ancienne que la commande → fichier repris d'un ancien dossier, à vérifier de près ; s'il est conforme au BAT et à la maquette, rien à signaler.
   f. Pièce par pièce : un élément du BAT est souvent fait de plusieurs pièces (caisson : face, tranche, adhésif, ajourage ; lettres : faces, chants ; panneau : support, adhésif). Pour chaque pièce à imprimer, découper ou commander, trouve son fichier ; s'il n'y en a pas, demande si elle est sous-traitée ou faite sans fichier.
   g. Rangement : un seul BAT en évidence, sous-dossiers attendus, fichiers provisoires ou d'archive à part.
   h. AVANT de conclure, repasse la liste de l'étape e pour chaque fichier de FAB : un point non contrôlé est un oubli, pas un « conforme ».
   - Ce que tu lis sur une IMAGE (capture, rendu, photo, page vue avec voir_page) : regarde en zone agrandie avant de conclure. Une couleur ou un coloris se confirme avec les valeurs mesurées (analyser_pdf), jamais à l'œil sur une capture ; si tu ne peux pas le confirmer, c'est une question, pas une alerte.
3. Analyse finie : s'il te manque une information ou qu'un écart peut être voulu, appelle poser_questions (bilan + questions, le graphiste répond par des boutons). Sinon, directement rendre_rapport.
4. Après les réponses (ou si le graphiste te demande de conclure) : RELIS TOUT ton bilan (erreurs et alertes comprises, pas seulement les questions posées) à la lumière des réponses, des précisions et des points CONTESTÉS par le graphiste. Un point qu'une réponse explique, même indirectement (même élément, même cause, conséquence d'un choix déclaré voulu), ne reste JAMAIS en erreur ni en alerte : il passe dans les conformes avec « voulu, confirmé par le graphiste ». Puis rendre_rapport, et n'écris RIEN après.
5. Si une réponse, une précision ou la raison d'un point contesté révèle une façon de faire GÉNÉRALE de l'atelier, propose-la avec proposer_regle : Jordan la validera ou non. Ce qui ne concerne QUE ce dossier n'est pas une règle. Si une règle validée traite déjà du même sujet, ne crée pas de doublon : propose son texte COMPLET réécrit (l'existant + l'ajout ou l'exception) avec « remplace » = son titre exact.
6. Ensuite, le graphiste peut te poser des questions sur un point du rapport : réponds court et précis, avec les valeurs mesurées, en listes courtes (pas de tableau). Si sa réponse suit une façon de faire de l'atelier, ne la conteste pas.

## Règles de l'atelier
Les règles validées par Jordan sont listées à la fin de ces instructions. Elles font foi. Une exception ou une précision écrite dans une règle vaut pour TOUTES les règles qui parlent du même sujet (ex. une exception sur le raccord s'applique aussi aux règles de laize et de limites machines). Si une règle te semble ne pas s'appliquer, dis-le et demande plutôt que d'inventer une règle. Un point qu'aucune règle ne couvre : jugement de bon sens, et question si le doute est réel.

## Niveaux, à ne pas confondre (quatre)
- ERREUR : ce qui fausse la fabrication ou la pose — dimension, quantité, matière, pose intérieure/extérieure, élément manquant ou en trop, écart BAT/FAB, refus de la mairie, numérotation fausse, nom de fichier qui désigne un autre dossier, dimensions absentes du BAT.
- ALERTE : un VRAI RISQUE pour la fab ou la pose, à vérifier (souvent avec l'atelier) : visuel trop peu prolongé hors découpe, découpe ou impression trop longue, information de pose ou de matière qui manque pour l'atelier.
- REMARQUE : hors de nos standards mais SANS risque pour la fab : présentation ou mention conseillée du BAT, trou de numérotation, nom de fichier incomplet, épaisseur du CutContour, repères en aplat, rangement, écarts devis/BAT à signaler au commercial. Sert à la formation.
- JAMAIS SIGNALÉ : orthographe, accents et accords dans NOS textes (BAT, légendes, noms) ; le design. Exception : une faute réelle dans un texte que le client verra sur un fichier de PRODUCTION (texte en minuscules sans accent, mot mal écrit) → remarque.
- QUESTION : une information qui manque ou un écart qui peut être voulu.

## Écriture : COURT, sans rien oublier
Chaque mot écrit est facturé. N'écris PAS de texte pendant l'analyse : tes constats passent par poser_questions et rendre_rapport. Style télégraphique, valeurs avec leur unité, pas de politesse ni de reformulation, pas de répétition entre le bilan et le rapport. Mais chaque erreur, alerte et doute doit apparaître : être court ne veut jamais dire omettre. N'ouvre un fichier ou une page que si tu en as besoin, une seule fois ; préfère analyser_pdf (texte, peu coûteux) à voir_page (image), et une zone agrandie à une page entière.

## Langue
Tout en français, y compris ta réflexion interne.`;

const OUTILS = [
  {
    name: "lister_dossier",
    description: "Ré-inventorie le dossier de production (chemins relatifs, tailles, dates de modification). L'inventaire initial est déjà dans le premier message : ne l'appelle que si le graphiste dit avoir modifié le dossier.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "analyser_pdf",
    description: "Mesure un PDF du dossier (ou un .ai enregistré avec compatibilité PDF) : boîtes de page (Media/Trim/Bleed/Art en mm), emprise réelle des tracés et par couleur (mm, origine en haut à gauche), épaisseur des contours par couleur (epaisseursPt, en points), valeurs CMJN écrites pour les tracés vectoriels (cmjn : ne dit rien des images), tons directs (CutContour…), calques, images avec leur résolution effective et leur espace de couleur (images[].couleurs : CMJN, RVB, niveaux de gris… c'est LUI qui dit si une image est en RVB), texte de chaque page. Ne fait aucune image : utiliser voir_page pour regarder.",
    input_schema: {
      type: "object",
      properties: { chemin: { type: "string", description: "Chemin relatif tel que donné par l'inventaire" } },
      required: ["chemin"],
      additionalProperties: false,
    },
  },
  {
    name: "voir_page",
    description: "Rend une page d'un PDF (ou .ai compatible PDF) en image pour la regarder. Option zone : agrandir une partie de la page (en % de la largeur/hauteur, origine en haut à gauche) pour lire un petit texte, un QR code, un détail.",
    input_schema: {
      type: "object",
      properties: {
        chemin: { type: "string" },
        page: { type: "integer", description: "Numéro de page, à partir de 1" },
        zone: {
          type: "object",
          properties: {
            gauche: { type: "number" }, haut: { type: "number" },
            largeur: { type: "number" }, hauteur: { type: "number" },
          },
          required: ["gauche", "haut", "largeur", "hauteur"],
          additionalProperties: false,
        },
      },
      required: ["chemin", "page"],
      additionalProperties: false,
    },
  },
  {
    name: "comparer_visuels",
    description: "Superpose une référence (BAT validé ou maquette) et un fichier de FAB après recalage automatique (échelle et position), en comparant les CONTOURS des formes : lettres, logos, QR codes, pictos, découpes. Donne la part des formes retrouvées dans chaque sens, l'écart de proportions (déformation) et une image : rouge = présent seulement dans la référence (manque dans la FAB ?), bleu = seulement dans la FAB. Choisis une zone qui cadre UNIQUEMENT l'élément comparé sur le BAT (sans cotes ni texte autour) ; sur la FAB, la page entière suffit souvent.",
    input_schema: {
      type: "object",
      properties: {
        reference: {
          type: "object",
          properties: {
            chemin: { type: "string" },
            page: { type: "integer" },
            zone: {
              type: "object",
              properties: { gauche: { type: "number" }, haut: { type: "number" }, largeur: { type: "number" }, hauteur: { type: "number" } },
              required: ["gauche", "haut", "largeur", "hauteur"],
              additionalProperties: false,
            },
          },
          required: ["chemin", "page"],
          additionalProperties: false,
        },
        fab: {
          type: "object",
          properties: {
            chemin: { type: "string" },
            page: { type: "integer" },
            zone: {
              type: "object",
              properties: { gauche: { type: "number" }, haut: { type: "number" }, largeur: { type: "number" }, hauteur: { type: "number" } },
              required: ["gauche", "haut", "largeur", "hauteur"],
              additionalProperties: false,
            },
          },
          required: ["chemin", "page"],
          additionalProperties: false,
        },
      },
      required: ["reference", "fab"],
      additionalProperties: false,
    },
  },
  {
    name: "apercu_images",
    description: "Aperçu RAPIDE de plusieurs images (photos de VT, captures) en une seule planche de vignettes numérotées (12 au plus). Sert à repérer lesquelles portent des cotes ou une information utile, AVANT de les ouvrir une par une avec voir_image.",
    input_schema: {
      type: "object",
      properties: { chemins: { type: "array", items: { type: "string" }, description: "Chemins relatifs des images à survoler" } },
      required: ["chemins"],
      additionalProperties: false,
    },
  },
  {
    name: "voir_image",
    description: "Affiche une image du dossier (JPG, PNG) : photo de VT, capture, etc.",
    input_schema: {
      type: "object",
      properties: { chemin: { type: "string" } },
      required: ["chemin"],
      additionalProperties: false,
    },
  },
  {
    name: "cibler_fichiers",
    description: "Seulement si tu as VRAIMENT besoin d'annexes qui ne sont pas dans la liste autorisée du premier message (photos, documents VT, MAIRIE, MAQUETTE…) : propose-les au graphiste, qui coche ceux à examiner. Le résultat donne les fichiers cochés : n'examine QUE ceux-là.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        groupes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titre: { type: "string", description: "VT, Mairie, Maquette…" },
              fichiers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    chemin: { type: "string" },
                    pourquoi: { type: "string", description: "Ce que tu espères y vérifier, en quelques mots." },
                    conseille: { type: "boolean", description: "Coché par défaut si tu le juges utile." },
                  },
                  required: ["chemin", "pourquoi", "conseille"],
                  additionalProperties: false,
                },
              },
            },
            required: ["titre", "fichiers"],
            additionalProperties: false,
          },
        },
      },
      required: ["groupes"],
      additionalProperties: false,
    },
  },
  {
    name: "poser_questions",
    description: "Bilan de l'analyse + questions au graphiste, qui répond par des boutons (et peut toujours préciser par écrit). À appeler seul, en fin d'analyse, avec TOUTES les erreurs et questions du moment. Les réponses arrivent dans le résultat de l'outil.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        erreurs: { type: "array", items: { type: "string" }, description: "Une ligne par ERREUR certaine ou très probable (vide si aucune)." },
        alertes: { type: "array", items: { type: "string" }, description: "Une ligne par ALERTE : un vrai risque pour la fab ou la pose, à vérifier (vide si aucune)." },
        remarques: { type: "array", items: { type: "string" }, description: "Une ligne par REMARQUE : hors de nos standards mais sans risque pour la fab (vide si aucune). Jamais une remarque dans les alertes." },
        conforme: { type: "string", description: "Une seule ligne : tout ce qui a été vérifié et est conforme." },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "Une phrase, avec la valeur mesurée et le fichier si utile." },
              choix: { type: "array", items: { type: "string" }, description: "2 à 4 réponses courtes (« Oui, voulu », « Non, à corriger »…)." },
            },
            required: ["question", "choix"],
            additionalProperties: false,
          },
        },
      },
      required: ["erreurs", "alertes", "remarques", "conforme", "questions"],
      additionalProperties: false,
    },
  },
  {
    name: "proposer_regle",
    description: "Propose une nouvelle règle d'atelier (ou une exception à une règle) apprise pendant la vérification. Elle ne s'applique qu'une fois validée par Jordan.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        categorie: { type: "string", enum: ["general", "adhesif", "plaque", "impression", "decoupe", "enseigne", "bache", "nommage", "couleur", "autre"] },
        titre: { type: "string" },
        texte: { type: "string", description: "La règle, formulée pour s'appliquer à tous les dossiers, avec ses conditions et exceptions." },
        raison: { type: "string", description: "Le cas rencontré qui l'a fait apparaître (dossier, réponse du graphiste)." },
        remplace: { type: "string", description: "Titre EXACT de la règle validée que ce texte complet remplace (même sujet : fusion), ou chaîne vide pour une règle nouvelle." },
      },
      required: ["categorie", "titre", "texte", "raison", "remplace"],
      additionalProperties: false,
    },
  },
  {
    name: "rendre_rapport",
    description: "Rapport final de vérification, affiché au graphiste comme un document et archivé. À appeler une fois l'analyse terminée et les questions résolues (ou laissées en question si le graphiste le demande). Chaque constat porte toutes ses informations.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["conforme", "a_corriger", "questions_en_suspens"], description: "« conforme » dès qu'il n'y a aucune erreur ni question en suspens — des alertes n'empêchent pas un dossier d'être conforme." },
        resume: { type: "string", description: "Une phrase." },
        constats: {
          type: "array",
          description: "Erreurs, alertes et questions restantes. Rien de conforme ici.",
          items: {
            type: "object",
            properties: {
              niveau: { type: "string", enum: ["erreur", "alerte", "question", "remarque"] },
              categorie: { type: "string", enum: ["dimensions", "quantite", "matiere", "finition", "texte", "couleur", "decoupe", "fonds_perdus", "nommage", "numerotation", "element_manquant", "mairie", "process", "rangement", "autre"] },
              titre: { type: "string", description: "Quelques mots." },
              detail: { type: "string", description: "Une phrase : pourquoi c'est un problème." },
              constate: { type: "string", description: "Ce qui est mesuré ou écrit, avec unité." },
              attendu: { type: "string", description: "Ce qui devrait être (BAT, devis, règle)." },
              regle: { type: "string", description: "Titre de la règle appliquée, ou « bon sens »." },
              fichiers: { type: "string", description: "Chemin(s) relatif(s) concerné(s), page éventuelle." },
            },
            required: ["niveau", "categorie", "titre", "detail", "constate", "attendu", "regle", "fichiers"],
            additionalProperties: false,
          },
        },
        conformes: { type: "array", items: { type: "string" }, description: "Tout ce qui a été vérifié et est conforme, une ligne courte par point." },
      },
      required: ["verdict", "resume", "constats", "conformes"],
      additionalProperties: false,
    },
  },
];

/** Tarif d'un modèle ; un modèle récent pas encore listé prend celui de sa famille (estimation) */
function tarif(modele: string) {
  return TARIFS[modele] ?? (/sonnet/.test(modele) ? TARIFS["claude-sonnet-5-5"] : TARIFS[MODELE]);
}

// deno-lint-ignore no-explicit-any
function cout(modele: string, u: any): number {
  const t = tarif(modele);
  // écritures 1 h (règles + consignes) facturées 2 × l'entrée, les autres 1,25 ×
  const ecrit1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const ecrit5m = (u.cache_creation_input_tokens ?? 0) - ecrit1h;
  return (
    ((u.input_tokens ?? 0) * t[0] +
      (u.output_tokens ?? 0) * t[1] +
      (u.cache_read_input_tokens ?? 0) * t[2] +
      ecrit5m * t[3] +
      ecrit1h * t[0] * 2) / 1_000_000
  );
}

/**
 * Ce qui est identique pour toutes les vérifications (outils, consignes, règles,
 * réglages de réflexion) : la relance du cache doit envoyer EXACTEMENT la même
 * chose que les vraies vérifications, sinon elle écrirait un cache jamais relu.
 */
function prefixe(modele: string, blocRegles: string) {
  return {
    model: modele,
    // la réflexion n'est pas affichée : son résumé sortait en anglais
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: SYSTEME },
      // outils + consignes + règles : gardés 1 h pour que la vérification
      // suivante (de n'importe quel graphiste) les relise
      { type: "text", text: blocRegles, cache_control: { type: "ephemeral", ttl: "1h" } },
    ],
    tools: OUTILS,
  };
}

/* ------------------------------------------------------------ entretien du cache */

// heures de bureau (Paris), midi compris : lundi-jeudi 8 h 30 - 18 h, vendredi 8 h 30 - 11 h 30
const BUREAU_DEBUT = 8 * 60 + 30;
const BUREAU_FIN = 18 * 60;
const BUREAU_FIN_VENDREDI = 11 * 60 + 30;
// le cache dure 1 h à partir du DÉBUT du dernier appel : relance après 45 min sans appel
const CALME_MIN = 45;

function heureParis(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { jour: `${p.year}-${p.month}-${p.day}`, semaine: p.weekday, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Empreinte de la partie fixe : si elle change (règle, consigne, modèle), le cache ne sert plus */
async function empreinte(modele: string, blocRegles: string): Promise<string> {
  const octets = new TextEncoder().encode(JSON.stringify(prefixe(modele, blocRegles)));
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", octets));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function entretenir(admin: any, client: Anthropic, modele: string, blocRegles: string) {
  const maintenant = new Date();
  const ici = heureParis(maintenant);
  if (ici.semaine === "Sat" || ici.semaine === "Sun" || ici.minutes < BUREAU_DEBUT || ici.minutes >= (ici.semaine === "Fri" ? BUREAU_FIN_VENDREDI : BUREAU_FIN))
    return { fait: false, raison: "hors des heures de bureau" };

  // seulement après la première vraie vérification du jour
  const { data: derniere } = await admin.from("verif_usage").select("created_at")
    .not("conversation_id", "is", null).order("created_at", { ascending: false }).limit(1);
  if (!derniere?.[0] || heureParis(new Date(derniere[0].created_at)).jour !== ici.jour)
    return { fait: false, raison: "aucune vérification aujourd'hui" };

  // le cache a-t-il servi récemment (vérification ou relance) ?
  const seuil = new Date(maintenant.getTime() - CALME_MIN * 60_000).toISOString();
  const { data: recent } = await admin.from("verif_usage").select("id").gte("created_at", seuil).limit(1);
  if (recent?.length) return { fait: false, raison: "cache servi il y a moins de 45 min" };

  // garde-fou : si la dernière relance du jour n'a rien relu (elle a réécrit le
  // cache au lieu de le relire), on n'insiste pas avant demain
  const { data: relance } = await admin.from("verif_usage").select("created_at, cache_read_tokens")
    .is("conversation_id", null).order("created_at", { ascending: false }).limit(1);
  if (relance?.[0] && heureParis(new Date(relance[0].created_at)).jour === ici.jour && !relance[0].cache_read_tokens)
    return { fait: false, raison: "la dernière relance n'a rien relu : arrêt jusqu'à demain" };

  // relancer ne sert qu'à garder un cache EXISTANT : si la partie fixe a changé depuis la
  // dernière vraie vérification (règle validée, consigne modifiée), il n'y a rien à garder —
  // la relance réécrirait un cache neuf (~0,22 $) que personne n'utilisera peut-être
  const { data: p } = await admin.from("verif_parametres").select("prefixe_empreinte").eq("id", 1).single();
  if (!p?.prefixe_empreinte || p.prefixe_empreinte !== await empreinte(modele, blocRegles))
    return { fait: false, raison: "règles ou consignes modifiées depuis la dernière vérification : rien à garder" };

  // un seul poste relance : réservation atomique
  const { data: reserve } = await admin.from("verif_parametres")
    .update({ cache_entretenu_le: maintenant.toISOString() }).eq("id", 1)
    .or(`cache_entretenu_le.is.null,cache_entretenu_le.lt.${seuil}`).select("id");
  if (!reserve?.length) return { fait: false, raison: "déjà relancé par un autre poste" };

  // max_tokens 0 : relit le cache (et relance son heure) sans rien générer
  // deno-lint-ignore no-explicit-any
  const params: any = {
    ...prefixe(modele, blocRegles),
    max_tokens: 0,
    messages: [{ role: "user", content: "Entretien du cache." }],
    // même point d'entrée que les vérifications (sans le repli, inutile ici)
    betas: [BETA_REPLI],
  };
  const message = await client.beta.messages.create(params);
  // deno-lint-ignore no-explicit-any
  const u = message.usage as any;
  const montant = cout(message.model, u);
  await admin.from("verif_usage").insert({
    user_id: null,
    conversation_id: null,
    modele: message.model,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
    cout_usd: montant,
  });
  return { fait: true, raison: "cache relancé", cout_usd: montant, lus: u.cache_read_input_tokens ?? 0, ecrits: u.cache_creation_input_tokens ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (corps: unknown, statut = 200) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle) return json({ erreur: "Clé API absente des secrets Supabase (ANTHROPIC_API_KEY)" }, 500);

  // qui appelle ? (JWT de l'utilisateur connecté à GraphiDesk)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
  if (errAuth || !auth?.user) return json({ erreur: "Non connecté" }, 401);
  const userId = auth.user.id;

  let corps: { conversation_id?: string; messages?: unknown[]; action?: string };
  try {
    corps = await req.json();
  } catch {
    return json({ erreur: "Requête illisible" }, 400);
  }

  const client = new Anthropic({ apiKey: cle });
  const { data: param } = await admin.from("verif_parametres").select("modele").eq("id", 1).single();
  const modele: string = param?.modele || MODELE;

  // règles validées par Jordan, dans un ordre stable (sinon le cache ne servirait plus)
  const lireRegles = async () => {
    const { data: regles } = await admin
      .from("verif_regles").select("id, categorie, titre, texte").eq("statut", "validee")
      .order("categorie").order("created_at").order("id");
    return (regles ?? []).length
      ? "## Règles validées\n" + (regles ?? []).map((r) => `- [${r.categorie}] ${r.titre} : ${r.texte}`).join("\n")
      : "## Règles validées\n(aucune pour l'instant)";
  };

  if (corps.action === "modeles") {
    try {
      const modeles: { id: string; nom: string; date: string }[] = [];
      for await (const m of client.models.list({ limit: 100 })) {
        if (/^claude-(opus|sonnet|fable)/.test(m.id)) modeles.push({ id: m.id, nom: m.display_name, date: m.created_at });
      }
      modeles.sort((a, b) => b.date.localeCompare(a.date));
      return json({ modeles, actuel: modele });
    } catch (e) {
      return json({ erreur: String((e as Error)?.message ?? e) }, 502);
    }
  }
  // Le graphiste répond aux questions : l'historique (souvent 60 000 tokens et plus) reste en
  // cache 5 min seulement. Le relire toutes les 4 min coûte ~0,01 $ ; le réécrire après une
  // pause plus longue coûtait ~0,35 $. max_tokens 0 : rien n'est généré.
  if (corps.action === "maintien") {
    if (!corps.conversation_id || !Array.isArray(corps.messages) || corps.messages.length === 0)
      return json({ erreur: "conversation_id et messages requis" }, 400);
    const { data: c } = await admin.from("verif_conversations").select("id, user_id, cout_usd").eq("id", corps.conversation_id).single();
    if (!c || c.user_id !== userId) return json({ erreur: "Conversation inconnue" }, 403);
    try {
      // deno-lint-ignore no-explicit-any
      const params: any = {
        ...prefixe(modele, await lireRegles()),
        max_tokens: 0,
        cache_control: { type: "ephemeral" },
        messages: corps.messages,
        betas: [BETA_REPLI],
      };
      const message = await client.beta.messages.create(params);
      // deno-lint-ignore no-explicit-any
      const u = message.usage as any;
      const montant = cout(message.model, u);
      await admin.from("verif_usage").insert({
        user_id: userId, conversation_id: c.id, modele: message.model,
        input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0,
        cache_read_tokens: u.cache_read_input_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0,
        cout_usd: montant,
      });
      await admin.from("verif_conversations").update({ cout_usd: Number(c.cout_usd ?? 0) + montant }).eq("id", c.id);
      return json({ cout_usd: montant, lus: u.cache_read_input_tokens ?? 0, ecrits: u.cache_creation_input_tokens ?? 0 });
    } catch (e) {
      return json({ erreur: String((e as Error)?.message ?? e) }, 502);
    }
  }
  if (corps.action === "entretien") {
    try {
      return json(await entretenir(admin, client, modele, await lireRegles()));
    } catch (e) {
      return json({ fait: false, raison: String((e as Error)?.message ?? e) }, 502);
    }
  }

  if (!corps.conversation_id || !Array.isArray(corps.messages) || corps.messages.length === 0)
    return json({ erreur: "conversation_id et messages requis" }, 400);

  // la conversation doit appartenir à l'appelant
  const { data: conv } = await admin
    .from("verif_conversations").select("id, user_id, cout_usd").eq("id", corps.conversation_id).single();
  if (!conv || conv.user_id !== userId) return json({ erreur: "Conversation inconnue" }, 403);

  const blocRegles = await lireRegles();
  // mémorise la partie fixe utilisée : la relance du cache s'y fie
  admin.from("verif_parametres").update({ prefixe_empreinte: await empreinte(modele, blocRegles) }).eq("id", 1).then(() => {});
  const encodeur = new TextEncoder();

  const flux = new ReadableStream({
    async start(ctrl) {
      const envoyer = (o: unknown) => ctrl.enqueue(encodeur.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        // deno-lint-ignore no-explicit-any
        const params: any = {
          ...prefixe(modele, blocRegles),
          max_tokens: 32000,
          // cache automatique (5 min) : l'historique de la vérification en cours
          cache_control: { type: "ephemeral" },
          messages: corps.messages,
          // un refus d'un classifieur de sécurité est rejoué sur le modèle de repli recommandé
          betas: [BETA_REPLI],
          fallbacks: "default",
        };
        const stream = client.beta.messages.stream(params);
        for await (const ev of stream) envoyer(ev);
        const message = await stream.finalMessage();

        // deno-lint-ignore no-explicit-any
        const u = message.usage as any;
        const montant = cout(message.model, u);
        await admin.from("verif_usage").insert({
          user_id: userId,
          conversation_id: conv.id,
          modele: message.model,
          input_tokens: u.input_tokens ?? 0,
          output_tokens: u.output_tokens ?? 0,
          cache_read_tokens: u.cache_read_input_tokens ?? 0,
          cache_write_tokens: u.cache_creation_input_tokens ?? 0,
          cout_usd: montant,
        });
        await admin.from("verif_conversations")
          .update({ cout_usd: Number(conv.cout_usd ?? 0) + montant, modele: message.model, updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        envoyer({ type: "graphidesk_fin", message, cout_usd: montant });
      } catch (e) {
        const texte = e instanceof Anthropic.APIError ? `API ${e.status} : ${e.message}` : String((e as Error)?.message ?? e);
        envoyer({ type: "graphidesk_erreur", erreur: texte });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(flux, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
