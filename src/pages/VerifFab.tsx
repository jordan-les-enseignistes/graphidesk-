/**
 * VérifIzy — vérification des dossiers de production (« un logiciel dans le
 * logiciel », identité validée par Jordan le 20/10/2026).
 *
 * Accueil (chemin du dossier) → Préparation (inventaire, devis, annexes : sans
 * API) → Analyse (progression, durée restante, questions) → Rapport (document
 * + discussion). Chacun ne voit que SES vérifications ; archiver ne supprime
 * rien ; les coûts ne sont visibles que de l'admin.
 *
 * Entrée possible depuis la liste des dossiers : /verif-fab?dossier=<id>&nom=<nom>
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { FolderOpen, LayoutDashboard, Moon, Plus, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CLE_NOTIFS_VERIFIZY, useVerifizyNotifs } from "@/hooks/useVerifizyNotifs";
import { useArchiveDossier } from "@/hooks/useDossiers";
import { verdictEffectif } from "@/components/verifizy/EcranAccueil";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";
import { blocDepuisFichier, inventaireTexte, listerDossier } from "@/lib/verifFab/outils";
import { classerInventaire, dureeEstimee, estDevis, type Inventaire } from "@/lib/verifFab/inventaire";
import {
  attenteDepuisHistorique, poursuivre, reponseAuCiblage, reponseAuxQuestions,
  type Attente, type Bloc, type EnCours, type MessageApi, type Rapport,
} from "@/lib/verifFab/conversation";
import { MARQUE_INVENTAIRE } from "@/components/verifFab/Elements";
import { EspaceAdmin } from "@/components/verifFab/EspaceAdmin";
import { useThemeVerifizy, LogoVerifizy, NomVerifizy, FIGTREE, MONO, SORA, BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE } from "@/components/verifizy/theme";
import { EcranAccueil, type DossierGD, type ConversationResume } from "@/components/verifizy/EcranAccueil";
import { EcranPreparation } from "@/components/verifizy/EcranPreparation";
import { EcranAnalyse, type Etape, type Progression } from "@/components/verifizy/EcranAnalyse";
import { EcranRapport, type BulleChat } from "@/components/verifizy/EcranRapport";

interface Conversation extends ConversationResume {
  user_id: string;
  dossier_id: string | null;
  modele: string | null;
}
const COLONNES = "id, user_id, titre, chemin_dossier, dossier_id, is_archived, rapport, a_voir, modele, updated_at";
const CONSIGNE = "Vérifie ce dossier avant le lancement en fabrication.";
const PREFIXE_CONTEXTE = "[À propos de : ";

interface Candidat { chemin: string; score: number }
interface OptsDossier { dossierId?: string; nom?: string }

/* ---------------------------------------------------- mémoire locale du poste */
const CLE_RACINE = "graphidesk_verif_racine_serveur";
const CLE_CHEMINS = "verifizy_chemins_dossiers";
const lire = <T,>(cle: string, defaut: T): T => { try { const v = localStorage.getItem(cle); return v ? (JSON.parse(v) as T) : defaut; } catch { return defaut; } };
const ecrire = (cle: string, v: unknown) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* sans stockage */ } };
function racineServeur(): string { try { return localStorage.getItem(CLE_RACINE) || "Z:\\"; } catch { return "Z:\\"; } }
function memoriserChemin(dossierId: string | undefined, chemin: string) {
  if (!dossierId) return;
  ecrire(CLE_CHEMINS, { ...lire<Record<string, string>>(CLE_CHEMINS, {}), [dossierId]: chemin });
}

/** Notification Windows (avec son) : l'analyse est finie ou attend des réponses */
async function notifierSysteme(title: string, body: string) {
  try {
    let ok = await isPermissionGranted();
    if (!ok) ok = (await requestPermission()) === "granted";
    if (ok) sendNotification({ title, body, sound: "default" });
  } catch { /* hors Tauri : rien */ }
}

/**
 * Fenêtre réduite ou cachée : WebView2 met la page en sommeil au bout de
 * quelques minutes (analyse et notification ne repartaient qu'au retour sur
 * GraphiDesk). Une page qui tient un verrou Web Lock n'est pas endormie :
 * on le garde le temps de l'analyse.
 */
function sansMiseEnSommeil<T>(travail: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return travail();
  return navigator.locks.request(`verifizy-analyse-${crypto.randomUUID()}`, travail) as Promise<T>;
}

/**
 * Client déduit du chemin serveur : Z:\T\TEMPORIS\MONT DE MARSAN → TEMPORIS
 * (le dossier qui suit le dossier « lettre »). Sinon, le dossier parent.
 */
function clientDuChemin(chemin: string): string | null {
  const parts = chemin.split(/[\\/]/).filter(Boolean);
  const i = parts.findIndex((p, k) => k > 0 && /^[A-Za-z0-9]$/.test(p));
  const nom = i >= 0 && parts[i + 1] ? parts[i + 1] : parts.length >= 2 ? parts[parts.length - 2] : null;
  return nom ? nom.toUpperCase() : null;
}

/** Devis récupéré dans Dolibarr (quand il n'est pas dans le dossier serveur) */
export interface DevisDolibarr {
  etat: "recherche" | "trouve" | "absent";
  fichier?: File;
  ref?: string;
  raison?: string;
  notes?: { publique: string; privee: string };
}

/** Numéro de commande du dossier : dossier FAB (FAB_CO2609-5738), sinon nom GraphiDesk, sinon chemin */
function numeroCommande(entrees: { chemin: string }[], nom?: string, chemin?: string): string | null {
  const re = /CO\d{4}-\d{3,6}/i;
  const fab = entrees.find((e) => /(^|[\\/])FAB[^\\/]*CO\d{4}-\d{3,6}/i.test(e.chemin));
  const m = (fab && fab.chemin.match(re)) || (nom ?? "").match(re) || (chemin ?? "").match(re);
  return m ? m[0].toUpperCase() : null;
}

/* ---------------------------------------------------- progression */
const nomFichier = (c: string) => c.split(/[\\/]/).pop() ?? c;
function cheminsDe(nom: string, e: Bloc): string[] {
  if (nom === "comparer_visuels") return [e.reference?.chemin, e.fab?.chemin].filter(Boolean);
  if (nom === "apercu_images") return Array.isArray(e.chemins) ? e.chemins : [];
  return e.chemin ? [e.chemin] : [];
}
function phrase(nom: string, e: Bloc): string {
  if (nom === "analyser_pdf") return `Je mesure ${nomFichier(e.chemin ?? "")} : cotes, couleurs, lettres, découpe…`;
  if (nom === "voir_page") return `Je regarde ${nomFichier(e.chemin ?? "")}${e.page ? `, page ${e.page}` : ""}${e.zone ? " (zone agrandie)" : ""}.`;
  if (nom === "comparer_visuels") return `Je compare ${nomFichier(e.fab?.chemin ?? "")} au ${nomFichier(e.reference?.chemin ?? "BAT")}.`;
  if (nom === "apercu_images") return `Je survole ${Array.isArray(e.chemins) ? e.chemins.length : ""} photos pour repérer celles qui portent des cotes.`;
  if (nom === "voir_image") return `Je regarde l'image ${nomFichier(e.chemin ?? "")}.`;
  if (nom === "lister_dossier") return "Je relis l'inventaire du dossier.";
  return "J'analyse…";
}
type Categorie = "bat" | "fab" | "annexe";
const categorie = (c: string): Categorie =>
  c.split("/").slice(0, -1).some((d) => /^FAB/i.test(d)) ? "fab" : /^BAT/i.test(nomFichier(c)) && !/MAIRIE|VT/i.test(c) ? "bat" : "annexe";

export default function VerifFab({ actif = true }: { actif?: boolean }) {
  const profil = useAuthStore((s) => s.profile);
  const monId = profil?.id;
  const prenom = (profil?.full_name ?? "").split(" ")[0] || "toi";
  const estAdmin = useHasPermission("manage:users");
  const [params, setParams] = useSearchParams();
  const { theme, variables, basculer } = useThemeVerifizy();
  // VérifIzy reste monté quand on va ailleurs dans GraphiDesk (MainLayout)
  const actifRef = useRef(actif);
  actifRef.current = actif;
  const queryClient = useQueryClient();
  const { data: notifs } = useVerifizyNotifs(estAdmin);
  const majNotifs = useCallback(() => queryClient.invalidateQueries({ queryKey: CLE_NOTIFS_VERIFIZY }), [queryClient]);

  const [ecran, setEcran] = useState<"accueil" | "preparation" | "session">("accueil");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dossiers, setDossiers] = useState<DossierGD[]>([]);
  const candidatsParDossier = useRef<Record<string, Candidat[]>>({});
  const [racine, setRacine] = useState(racineServeur());
  const [prep, setPrep] = useState<{ chemin: string; opts: OptsDossier; entrees: Awaited<ReturnType<typeof listerDossier>>; inventaire: Inventaire; client: string | null; noteClient: string; dolibarr: DevisDolibarr | null } | null>(null);
  const [choixServeur, setChoixServeur] = useState<{ opts: OptsDossier; candidats: Candidat[] } | null>(null);
  const [admin, setAdmin] = useState(false);

  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageApi[]>([]);
  const [enCours, setEnCours] = useState<EnCours | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [attente, setAttente] = useState<Attente | null>(null);

  // progression de l'analyse
  const prevus = useRef<Set<string>>(new Set());
  const lus = useRef<Set<string>>(new Set());
  const debut = useRef<number>(0);
  const [action, setAction] = useState("Je lis l'inventaire et le BAT…");
  const [tic, setTic] = useState(0);
  useEffect(() => {
    if (!occupe) return;
    const t = setInterval(() => setTic((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [occupe]);

  /* ------------------------------------------------ chargements */
  const charger = useCallback(async () => {
    if (!monId) return;
    const { data } = await supabase.from("verif_conversations").select(COLONNES).eq("user_id", monId).order("updated_at", { ascending: false });
    setConversations((data ?? []) as Conversation[]);
  }, [monId]);
  useEffect(() => { charger(); }, [charger]);

  // dossiers GraphiDesk avec leur chemin serveur (mémorisé, sinon cherché sur le serveur)
  const avecChemins = useCallback(async (
    lignes: { id: string; nom: string; statut: string }[],
    afficher: (maj: (l: DossierGD[]) => DossierGD[]) => void,
    annule: () => boolean,
  ) => {
    const memo = lire<Record<string, string>>(CLE_CHEMINS, {});
    const liste: DossierGD[] = lignes.map((d) => ({
      id: d.id, nom: d.nom, statut: d.statut, chemin: memo[d.id] ?? null, origine: memo[d.id] ? "memorise" : "recherche",
    }));
    afficher(() => liste);
    for (const d of liste.filter((x) => x.origine === "recherche")) {
      let c: Candidat[] = [];
      try { c = await invoke<Candidat[]>("verif_chercher_dossier", { racine, nom: d.nom }); } catch { /* racine absente */ }
      if (annule()) return;
      candidatsParDossier.current[d.id] = c;
      afficher((l) => l.map((x) => x.id === d.id ? { ...x, chemin: c[0]?.chemin ?? null, origine: c.length ? "auto" : "introuvable" } : x));
    }
  }, [racine]);

  // mes dossiers en cours
  useEffect(() => {
    if (!monId) return;
    let annule = false;
    (async () => {
      const { data } = await supabase.from("dossiers").select("id, nom, statut")
        .eq("graphiste_id", monId).eq("is_archived", false).order("updated_at", { ascending: false }).limit(6);
      if (!annule) await avecChemins(data ?? [], setDossiers, () => annule);
    })();
    return () => { annule = true; };
  }, [monId, avecChemins]);

  // recherche dans « Mes dossiers » seulement (mêmes filtres que la page : les miens, non archivés)
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<DossierGD[] | null>(null);
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) { setTrouves(null); return; }
    let annule = false;
    const t = setTimeout(async () => {
      const motif = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const { data } = await supabase.from("dossiers").select("id, nom, statut")
        .eq("graphiste_id", monId!).eq("is_archived", false)
        .ilike("nom", motif).order("updated_at", { ascending: false }).limit(8);
      if (!annule) await avecChemins(data ?? [], (maj) => setTrouves((l) => maj(l ?? [])), () => annule);
    }, 300);
    return () => { annule = true; clearTimeout(t); };
  }, [recherche, avecChemins, monId]);

  // devis absent du dossier : recherche dans Dolibarr (API officielle, clé côté serveur)
  const chercherDevisDolibarr = useCallback(async (chemin: string, co: string) => {
    setPrep((p) => (p && p.chemin === chemin ? { ...p, dolibarr: { etat: "recherche", ref: co } } : p));
    let dolibarr: DevisDolibarr = { etat: "absent", ref: co, raison: "Dolibarr injoignable" };
    try {
      const { data } = await supabase.functions.invoke("dolibarr-devis", { body: { ref: co } });
      if (data?.trouve && data.contenu) {
        const bin = atob(data.contenu);
        const octets = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
        dolibarr = { etat: "trouve", ref: data.ref, notes: data.notes, fichier: new File([octets], data.fichier ?? `${data.ref}.pdf`, { type: "application/pdf" }) };
      } else dolibarr = { etat: "absent", ref: co, raison: data?.raison ?? "Devis introuvable", notes: data?.notes };
    } catch { /* reste « absent » : le graphiste peut toujours déposer le devis */ }
    setPrep((p) => (p && p.chemin === chemin ? { ...p, dolibarr } : p));
  }, []);

  /* ------------------------------------------------ préparation (sans API) */
  const preparer = useCallback(async (chemin: string, opts: OptsDossier = {}) => {
    let entrees;
    try { entrees = await listerDossier(chemin); }
    catch (e) { toast.error(String(e)); return; }
    memoriserChemin(opts.dossierId, chemin);
    const client = clientDuChemin(chemin);
    let noteClient = "";
    if (client) {
      const { data } = await supabase.from("verif_notes_client").select("note").eq("client", client).maybeSingle();
      noteClient = data?.note ?? "";
    }
    const inventaire = classerInventaire(entrees);
    // pas de devis dans le dossier : on le cherche dans Dolibarr, sans bloquer l'écran
    const co = inventaire.aDevis ? null : numeroCommande(entrees, opts.nom, chemin);
    setPrep({ chemin, opts, entrees, inventaire, client, noteClient, dolibarr: co ? { etat: "recherche", ref: co } : null });
    if (co) void chercherDevisDolibarr(chemin, co);
    setChoixServeur(null);
    setEcran("preparation");
  }, [chercherDevisDolibarr]);

  const parcourir = async (titre?: string): Promise<string | null> => {
    const choix = await open({ directory: true, defaultPath: racine, title: titre ? `Dossier serveur de « ${titre} »` : "Dossier de production à vérifier" });
    return !choix || Array.isArray(choix) ? null : choix;
  };

  const verifierDossierGD = async (d: DossierGD) => {
    const opts = { dossierId: d.id, nom: d.nom };
    if (d.origine === "memorise" && d.chemin) return preparer(d.chemin, opts);
    const c = candidatsParDossier.current[d.id] ?? [];
    if (c.length) return setChoixServeur({ opts, candidats: c });
    const choix = await parcourir(d.nom);
    if (choix) preparer(choix, opts);
  };

  /* ------------------------------------------------ session (API) */
  const ouvrir = useCallback(async (id: string) => {
    const { data: c } = await supabase.from("verif_conversations").select(COLONNES).eq("id", id).single();
    if (!c) return;
    const { data } = await supabase.from("verif_messages").select("role, contenu").eq("conversation_id", id).order("ordre");
    const msgs = ((data ?? []) as { role: "user" | "assistant"; contenu: Bloc[] }[]).map((m) => ({ role: m.role, content: m.contenu }));
    setActive(c as Conversation);
    setMessages(msgs);
    setAttente(attenteDepuisHistorique(msgs));
    setEnCours(null);
    setEcran("session");
  }, []);

  const lancer = async (conv: Conversation, historique: MessageApi[], nouveau: MessageApi) => {
    if (!conv.chemin_dossier) return;
    setOccupe(true);
    setAttente(null);
    let rapportRendu = false;
    try {
      const r = await sansMiseEnSommeil(() => poursuivre({
        conversationId: conv.id,
        dossier: conv.chemin_dossier,
        historique,
        nouveau,
        suivi: setEnCours,
        surMessages: setMessages,
        surOutil: (nom, e) => {
          setAction(phrase(nom, e));
          for (const c of cheminsDe(nom, e)) lus.current.add(c);
        },
        surRapport: async (rapport) => {
          rapportRendu = true;
          setActive((a) => (a ? { ...a, rapport } : a));
          // le modèle réellement utilisé (écrit par la fonction serveur à chaque appel)
          supabase.from("verif_conversations").select("modele").eq("id", conv.id).single()
            .then(({ data }) => data && setActive((a) => (a ? { ...a, modele: data.modele } : a)));
          await supabase.from("verif_conversations").update({ rapport, statut: "terminee", updated_at: new Date().toISOString() }).eq("id", conv.id);
        },
      }));
      setAttente(r.attente);
      // seulement à la fin d'une analyse (pas après une simple réponse dans la discussion)
      if (r.attente || rapportRendu) {
        notifierSysteme("VérifIzy", r.attente
          ? `J'ai besoin de toi pour « ${conv.titre} » : ${r.attente.ciblage ? "fichiers à choisir" : "questions avant le rapport"}.`
          : `Rapport prêt pour « ${conv.titre} ».`);
      }
      if (!actifRef.current) {
        // fini pendant que le graphiste était ailleurs : badge sur le menu jusqu'à ce qu'il revienne
        await supabase.from("verif_conversations").update({ a_voir: true }).eq("id", conv.id);
        majNotifs();
        if (r.attente) toast.info(`VérifIzy a besoin de toi pour « ${conv.titre} »`, { duration: 15000 });
        else toast.success(`VérifIzy : rapport prêt pour « ${conv.titre} »`, { duration: 15000 });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(false);
      setEnCours(null);
      charger();
    }
  };

  const lancerAnalyse = async (choix: { devis: File | null; sansDevis: boolean; annexes: string[]; contexte: string; memoriser: boolean }) => {
    if (!prep || !monId) return;
    // note client : enregistrée, mise à jour ou retirée selon la case « Mémoriser »
    if (prep.client) {
      if (choix.memoriser && choix.contexte)
        await supabase.from("verif_notes_client").upsert({ client: prep.client, note: choix.contexte, modifie_par: monId, updated_at: new Date().toISOString() });
      else if (!choix.memoriser && prep.noteClient)
        await supabase.from("verif_notes_client").delete().eq("client", prep.client);
    }
    const titre = prep.opts.nom ?? prep.chemin.split(/[\\/]/).filter(Boolean).pop() ?? "Vérification";
    const { data, error } = await supabase.from("verif_conversations")
      .insert({ user_id: monId, titre, chemin_dossier: prep.chemin, dossier_id: prep.opts.dossierId ?? null })
      .select(COLONNES).single();
    if (error || !data) { toast.error(`Création impossible : ${error?.message ?? "?"}`); return; }
    const conv = data as Conversation;

    const blocs: Bloc[] = [{ type: "text", text: MARQUE_INVENTAIRE + inventaireTexte(prep.chemin, prep.entrees) }];
    if (choix.devis) {
      const b = await blocDepuisFichier(choix.devis);
      if (b) blocs.push(b);
    }
    blocs.push({
      type: "text",
      text: [
        choix.annexes.length ? `Annexes autorisées (tu ne peux ouvrir que celles-ci en plus du BAT, du devis, de la maquette et des fichiers de FAB) :\n${choix.annexes.map((a) => `• ${a}`).join("\n")}` : "Aucune annexe autorisée : BAT, devis, maquette et fichiers de FAB seulement.",
        choix.devis ? `Devis fourni par le graphiste : ${choix.devis.name}.` : choix.sansDevis ? "Pas de devis : le graphiste a choisi de continuer sans." : "",
        prep.dolibarr?.notes && (prep.dolibarr.notes.publique || prep.dolibarr.notes.privee)
          ? `Notes de la commande ${prep.dolibarr.ref} dans Dolibarr :${prep.dolibarr.notes.publique ? `\n- publique : ${prep.dolibarr.notes.publique.replace(/<[^>]+>/g, " ").trim()}` : ""}${prep.dolibarr.notes.privee ? `\n- privée : ${prep.dolibarr.notes.privee.replace(/<[^>]+>/g, " ").trim()}` : ""}`
          : "",
        choix.contexte ? `Contexte donné par le graphiste (brief, particularités du dossier ou du client${prep.client ? ` ${prep.client}` : ""}) :\n"""\n${choix.contexte}\n"""` : "",
        CONSIGNE,
      ].filter(Boolean).join("\n\n"),
    });

    prevus.current = new Set([...prep.inventaire.lusDOffice.filter((c) => !estDevis(c)), ...choix.annexes]);
    lus.current = new Set();
    debut.current = Date.now();
    setAction("Je lis l'inventaire et le BAT…");
    setActive(conv);
    setMessages([]);
    setEcran("session");
    lancer(conv, [], { role: "user", content: blocs });
  };

  const ctx = () => ({ conversationId: active!.id, dossier: active!.chemin_dossier!, suivi: setEnCours, surRapport: () => {} });
  const repondre = async (reponses: string[], precision: string) => {
    if (!active?.chemin_dossier || !attente) return;
    lancer(active, messages, await reponseAuxQuestions(attente, reponses, precision, messages, ctx()));
  };
  const cibler = async (choisis: string[]) => {
    if (!active?.chemin_dossier || !attente) return;
    lancer(active, messages, await reponseAuCiblage(attente, choisis, messages, ctx()));
  };
  const discuter = (texte: string, contexte: string | null) => {
    if (!active) return;
    const t = contexte ? `${PREFIXE_CONTEXTE}${contexte}]\n${texte}` : texte;
    lancer(active, messages, { role: "user", content: [{ type: "text", text: t }] });
  };

  // un constat corrigé à la main : pas de nouvelle analyse (donc aucun coût)
  const corriger = async (indices: number[], valeur: boolean) => {
    if (!active?.rapport?.constats || !indices.length) return;
    const choisis = new Set(indices);
    const constats = active.rapport.constats.map((c, i) =>
      choisis.has(i) ? { ...c, corrige: valeur, corrige_le: valeur ? new Date().toISOString() : undefined } : c);
    const rapport = { ...active.rapport, constats };
    setActive({ ...active, rapport });
    const { error } = await supabase.from("verif_conversations").update({ rapport }).eq("id", active.id);
    if (error) toast.error(`Enregistrement impossible : ${error.message}`);
    charger();
  };

  // archiver une vérification terminée (conforme ou corrigée) propose d'archiver aussi le dossier GraphiDesk
  const archiverDossier = useArchiveDossier();
  const [archiverAussi, setArchiverAussi] = useState<{ dossierId: string; nom: string } | null>(null);
  const archiver = async (id: string, valeur: boolean) => {
    await supabase.from("verif_conversations").update({ is_archived: valeur }).eq("id", id);
    charger();
    const c = conversations.find((x) => x.id === id);
    if (!valeur || !c?.dossier_id || !c.rapport) return;
    const etat = verdictEffectif(c.rapport);
    if (etat !== "conforme" && etat !== "corrige") return;
    const { data: d } = await supabase.from("dossiers").select("nom, is_archived").eq("id", c.dossier_id).maybeSingle();
    if (d && !d.is_archived) setArchiverAussi({ dossierId: c.dossier_id, nom: d.nom });
  };

  /* ------------------------------------------------ entrée depuis la liste des dossiers */
  const dossierTraite = useRef<string | null>(null);
  useEffect(() => {
    const dossierId = params.get("dossier");
    if (!actif || !dossierId || !monId || dossierTraite.current === dossierId) return;
    dossierTraite.current = dossierId;
    const nom = params.get("nom") ?? undefined;
    setParams({}, { replace: true });
    (async () => {
      const { data } = await supabase.from("verif_conversations").select("id").eq("user_id", monId).eq("dossier_id", dossierId)
        .order("updated_at", { ascending: false }).limit(1);
      if (data?.[0]) return ouvrir(data[0].id);
      const memo = lire<Record<string, string>>(CLE_CHEMINS, {})[dossierId];
      if (memo) return preparer(memo, { dossierId, nom });
      let c: Candidat[] = [];
      try { c = await invoke<Candidat[]>("verif_chercher_dossier", { racine: racineServeur(), nom: nom ?? "" }); } catch { /* */ }
      if (c.length) return setChoixServeur({ opts: { dossierId, nom }, candidats: c });
      const choix = await parcourir(nom);
      if (choix) preparer(choix, { dossierId, nom });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, monId, actif]);

  // la vérification affichée est vue : on retire son badge
  useEffect(() => {
    if (!actif || ecran !== "session" || !active?.id || occupe) return;
    supabase.from("verif_conversations").update({ a_voir: false }).eq("id", active.id).eq("a_voir", true)
      .then(() => { majNotifs(); charger(); });
  }, [actif, ecran, active?.id, occupe, majNotifs, charger]);

  // Analyse en attente de réponses : on garde l'historique en cache (relu toutes les 4 min,
  // 30 min maximum) au lieu de le réécrire au retour du graphiste. La page ne doit pas
  // s'endormir pendant ce temps (verrou Web Lock).
  useEffect(() => {
    if (!attente || occupe || !active?.id) return;
    // jusqu'au dernier message du graphiste : le tour de l'IA qui pose les questions est court
    let fin = messages.length;
    while (fin > 0 && messages[fin - 1].role !== "user") fin--;
    if (fin === 0) return;
    const historique = messages.slice(0, fin);
    // Les 5 min du cache partent du DÉBUT de l'appel qui a posé les questions (déjà ~1 min
    // de rédaction) : première relance à 2 min 30, puis toutes les 4 min (30 min au plus).
    let relances = 0;
    let t: ReturnType<typeof setTimeout>;
    const relancer = () => {
      supabase.functions.invoke("verif-fab", { body: { action: "maintien", conversation_id: active.id, messages: historique } })
        .catch(() => { /* sans réseau : la réécriture se fera au retour */ });
      if (++relances < 8) t = setTimeout(relancer, 4 * 60_000);
    };
    t = setTimeout(relancer, 150_000);
    let liberer: () => void = () => {};
    navigator.locks?.request(`verifizy-attente-${active.id}`, () => new Promise<void>((r) => { liberer = r; }));
    return () => { clearTimeout(t); liberer(); };
  }, [attente, occupe, active?.id, messages]);

  /* ------------------------------------------------ dérivés */
  const bilan = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const q = messages[i].content.find((b) => b.type === "tool_use" && b.name === "poser_questions");
      if (q) return { erreurs: q.input?.erreurs ?? [], alertes: q.input?.alertes ?? [], conforme: q.input?.conforme ?? "" };
    }
    return null;
  }, [messages]);

  const indexRapport = useMemo(() => messages.findIndex((m) => m.content.some((b) => b.type === "tool_use" && b.name === "rendre_rapport")), [messages]);
  const bulles: BulleChat[] = useMemo(() => {
    if (indexRapport < 0) return [];
    const out: BulleChat[] = [];
    for (const m of messages.slice(indexRapport + 1)) {
      const textes = m.content.filter((b) => b.type === "text" && b.text?.trim()).map((b) => b.text as string);
      if (!textes.length) continue;
      const t = textes.join("\n");
      if (m.role === "user" && t.startsWith(PREFIXE_CONTEXTE)) {
        const fin = t.indexOf("]\n");
        out.push({ role: "user", contexte: t.slice(PREFIXE_CONTEXTE.length, fin), texte: t.slice(fin + 2) });
      } else out.push({ role: m.role, texte: t });
    }
    return out;
  }, [messages, indexRapport]);

  const progression: Progression = useMemo(() => {
    void tic;
    const prevuesListe = [...prevus.current];
    const parCat = (c: Categorie) => prevuesListe.filter((x) => categorie(x) === c);
    const fait = (liste: string[]) => liste.filter((x) => lus.current.has(x)).length;
    const bat = parCat("bat"), fab = parCat("fab"), ann = parCat("annexe");
    const fini = !!active?.rapport;
    const etape = (nom: string, liste: string[], avant: boolean): Etape => {
      const k = fait(liste);
      return { nom, etat: fini || (liste.length && k >= liste.length) ? "fait" : avant || k > 0 ? "encours" : "avenir", compte: liste.length > 1 ? `${k}/${liste.length}` : undefined };
    };
    const etapes: Etape[] = [
      etape("BAT et devis", bat, true),
      etape("Fichiers de FAB", fab, fait(bat) >= bat.length),
      ...(ann.length ? [etape("Annexes", ann, false)] : []),
      { nom: "Rapport", etat: fini ? "fait" : attente ? "encours" : "avenir" },
    ];
    const total = Math.max(1, prevuesListe.length);
    const k = prevuesListe.filter((x) => lus.current.has(x)).length;
    const ecoule = (Date.now() - debut.current) / 1000;
    const pourcent = fini ? 100 : Math.min(95, 5 + (k / total) * 85 + (attente ? 5 : 0));
    let resteSec: number | null = null;
    if (debut.current && !fini) {
      resteSec = k > 0 ? Math.max(10, (total - k) * (ecoule / k) + 20) : Math.max(15, dureeEstimee(total, 0) - ecoule);
    }
    return { etapes, pourcent, resteSec, action };
  }, [tic, active?.rapport, attente, action, messages.length]);

  /* ------------------------------------------------ rendu */
  const dansSession = ecran === "session" && active;
  const afficherRapport = dansSession && active.rapport && !attente && (indexRapport >= 0 || !occupe);

  return (
    // la zone de contenu de GraphiDesk a une marge de 1,5 rem : VérifIzy la reprend et prend tout l'espace
    <div className="-m-6 min-h-[calc(100%+3rem)] flex flex-col bg-[var(--vz-bg)] text-[var(--vz-text)]" style={{ ...variables, ...FIGTREE }}>
      <header className="flex flex-wrap items-center justify-between gap-4 px-10 py-3.5 border-b border-[var(--vz-border)] bg-[var(--vz-surface)] sticky -top-6 z-20">
        <button type="button" onClick={() => { if (!occupe) setEcran("accueil"); }} className="flex items-center gap-3" aria-label="VérifIzy, accueil">
          <LogoVerifizy />
          <span className="flex flex-col items-start leading-tight">
            <NomVerifizy />
            <span className="text-[12px] text-[var(--vz-muted)]">par Les Enseignistes</span>
          </span>
        </button>
        <div className="flex items-center gap-2.5 flex-wrap">
          {ecran !== "accueil" && (() => {
            const chemin = ecran === "preparation" ? prep?.chemin : active?.chemin_dossier;
            const titre = ecran === "preparation" && prep ? (prep.opts.nom ?? nomFichier(prep.chemin)) : active?.titre;
            return chemin ? (
              <button type="button" onClick={() => invoke("verif_ouvrir_dossier", { chemin }).catch((e) => toast.error(String(e)))}
                title={`Ouvrir ${chemin} dans l'Explorateur`}
                className="inline-flex items-center gap-1.5 text-[14px] text-[var(--vz-accent-hi)] hover:underline underline-offset-2 mr-1 max-w-[420px] min-w-0">
                <FolderOpen className="w-4 h-4 shrink-0" /><span className="truncate">{titre}</span>
              </button>
            ) : <span className="text-[14px] text-[var(--vz-muted)] mr-1">{titre}</span>;
          })()}
          {ecran !== "accueil" && !occupe && (
            <button type="button" onClick={() => setEcran("accueil")} className={BOUTON_SECONDAIRE + " min-h-[40px] text-[14px]"}>
              <Plus className="w-4 h-4" /> Vérifier un autre dossier
            </button>
          )}
          {estAdmin && (
            <button type="button" onClick={() => setAdmin(true)} className={BOUTON_SECONDAIRE + " min-h-[40px] text-[14px]"}>
              <LayoutDashboard className="w-4 h-4" /> Coûts, statistiques, règles
              {!!notifs?.regles && (
                <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold inline-flex items-center justify-center"
                  title={`${notifs.regles} règle${notifs.regles > 1 ? "s" : ""} à valider`}>{notifs.regles}</span>
              )}
            </button>
          )}
          <button type="button" onClick={basculer} className={BOUTON_SECONDAIRE + " min-h-[40px] text-[14px]"} aria-label={`Passer au thème ${theme === "sombre" ? "clair" : "sombre"}`}>
            {theme === "sombre" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Thème {theme === "sombre" ? "clair" : "sombre"}
          </button>
        </div>
      </header>

      {ecran === "accueil" && (
        <EcranAccueil
          prenom={prenom}
          racine={racine}
          onRacine={(r) => { try { localStorage.setItem(CLE_RACINE, r); } catch { /* */ } setRacine(r); }}
          onVerifierChemin={(c) => preparer(c)}
          onParcourir={async () => { const c = await parcourir(); if (c) preparer(c); }}
          dossiers={dossiers}
          recherche={recherche}
          onRecherche={setRecherche}
          trouves={trouves}
          onVerifierDossier={verifierDossierGD}
          conversations={conversations}
          onOuvrir={ouvrir}
          onArchiver={archiver}
        />
      )}

      {ecran === "preparation" && prep && (
        <EcranPreparation key={prep.chemin} chemin={prep.chemin} inventaire={prep.inventaire} client={prep.client} noteClient={prep.noteClient} dolibarr={prep.dolibarr}
          onLancer={lancerAnalyse} onAnnuler={() => setEcran("accueil")}
          onActualiser={async () => {
            try {
              const entrees = await listerDossier(prep.chemin);
              const inventaire = classerInventaire(entrees);
              setPrep((p) => (p ? { ...p, entrees, inventaire } : p));
              // devis toujours absent et pas encore trouvé dans Dolibarr : on relance la recherche
              const co = inventaire.aDevis || prep.dolibarr?.etat === "trouve" ? null : numeroCommande(entrees, prep.opts.nom, prep.chemin);
              if (co) void chercherDevisDolibarr(prep.chemin, co);
              toast.success(`Dossier relu : ${entrees.length} éléments`);
            } catch (e) { toast.error(String(e)); }
          }} />
      )}

      {dansSession && !afficherRapport && (
        <EcranAnalyse
          titre={attente ? "J'ai besoin de toi" : "J'analyse le dossier"}
          progression={progression}
          occupe={occupe}
          attente={attente}
          bilan={bilan}
          onRepondre={repondre}
          onCibler={cibler}
          onRelancer={!occupe && !attente && active.chemin_dossier
            ? () => preparer(active.chemin_dossier!, { dossierId: active.dossier_id ?? undefined, nom: active.titre })
            : undefined}
        />
      )}

      {afficherRapport && active.rapport && (
        <EcranRapport
          titre={active.titre}
          chemin={active.chemin_dossier ?? ""}
          date={new Date(active.updated_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
          rapport={active.rapport as Rapport}
          modele={active.modele}
          bulles={bulles}
          enCoursTexte={enCours?.texte ?? ""}
          occupe={occupe}
          onEnvoyer={discuter}
          onCorriger={corriger}
          onRelancer={() => active.chemin_dossier && preparer(active.chemin_dossier, { dossierId: active.dossier_id ?? undefined, nom: active.titre })}
        />
      )}

      {choixServeur && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setChoixServeur(null)}>
          <div className={`${CARTE} w-full max-w-xl p-5 flex flex-col gap-3`} onClick={(e) => e.stopPropagation()} style={{ ...variables, ...FIGTREE }}>
            <div className="flex items-center justify-between gap-2">
              <span style={SORA} className="font-semibold text-[17px] flex items-center gap-2"><FolderOpen className="w-5 h-5 text-[var(--vz-accent-hi)]" /> Dossier serveur de « {choixServeur.opts.nom} »</span>
              <button type="button" onClick={() => setChoixServeur(null)} aria-label="Fermer" className="text-[var(--vz-muted)] p-1"><X className="w-5 h-5" /></button>
            </div>
            <p className="m-0 text-[13px] text-[var(--vz-muted)]">Trouvé sur le serveur d'après le nom du dossier. Choisis le bon : il sera mémorisé.</p>
            {choixServeur.candidats.map((c, i) => (
              <button key={c.chemin} type="button" onClick={() => preparer(c.chemin, choixServeur.opts)} style={MONO}
                className={`text-left px-3 py-2.5 rounded-xl border text-[14px] break-all ${i === 0 ? "border-[var(--vz-accent-hi)] bg-[var(--vz-surface2)]" : "border-[var(--vz-border)] hover:border-[var(--vz-accent-hi)]"}`}>
                {c.chemin}
              </button>
            ))}
            <div className="flex justify-end">
              <button type="button" className={BOUTON_SECONDAIRE + " min-h-[40px] text-[14px]"}
                onClick={async () => { const o = choixServeur.opts; setChoixServeur(null); const c = await parcourir(o.nom); if (c) preparer(c, o); }}>
                Autre dossier…
              </button>
            </div>
          </div>
        </div>
      )}

      {archiverAussi && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setArchiverAussi(null)}>
          <div className={`${CARTE} w-full max-w-md p-5 flex flex-col gap-4`} onClick={(e) => e.stopPropagation()} style={{ ...variables, ...FIGTREE }}>
            <span style={SORA} className="font-semibold text-[17px]">Archiver aussi le dossier ?</span>
            <p className="m-0 text-[14px] text-[var(--vz-muted)]">
              La vérification de « {archiverAussi.nom} » est archivée. Veux-tu aussi archiver ce dossier dans « Mes dossiers » ?
            </p>
            <div className="flex justify-end gap-2 flex-wrap">
              <button type="button" onClick={() => setArchiverAussi(null)} className={BOUTON_SECONDAIRE + " min-h-[42px] text-[14px]"}>Non, garder le dossier</button>
              <button type="button" disabled={archiverDossier.isPending}
                onClick={async () => { await archiverDossier.mutateAsync(archiverAussi.dossierId); setArchiverAussi(null); }}
                className={BOUTON_PRINCIPAL + " min-h-[42px] text-[14px]"}>Oui, archiver le dossier</button>
            </div>
          </div>
        </div>
      )}

      {admin && <EspaceAdmin onFermer={() => setAdmin(false)} />}
    </div>
  );
}
