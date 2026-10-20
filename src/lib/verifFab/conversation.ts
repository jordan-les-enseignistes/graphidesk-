/**
 * Vérif FAB — une conversation avec Claude : appel en flux via l'Edge
 * Function `verif-fab`, puis boucle d'outils exécutés sur le poste.
 *
 * L'historique ne fait que s'ALLONGER (jamais réécrit) : c'est la condition
 * pour que le cache de l'API serve, et pour que la réflexion de Claude reste
 * valide d'un tour à l'autre.
 */
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { executerOutil } from "./outils";

// deno-style : les blocs sont transmis tels quels à l'API, sans les retyper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Bloc = Record<string, any>;
export interface MessageApi {
  role: "user" | "assistant";
  content: Bloc[];
}

export interface RapportPoint {
  statut: "ok" | "alerte" | "erreur" | "question";
  categorie: string;
  constat: string;
  fichier: string;
}
/** Un constat du rapport VérifIzy : toutes ses informations, pour l'atelier comme pour le graphiste */
export interface Constat {
  niveau: "erreur" | "alerte" | "question";
  categorie: string;
  titre: string;
  detail: string;
  constate: string;
  attendu: string;
  regle: string;
  fichiers: string;
  /** marqué corrigé par le graphiste (sans relancer d'analyse) */
  corrige?: boolean;
  corrige_le?: string;
}
export interface Rapport {
  verdict: "conforme" | "a_corriger" | "questions_en_suspens";
  resume: string;
  constats?: Constat[];
  conformes?: string[];
  /** ancien format (avant VérifIzy) */
  points?: RapportPoint[];
}

/** Ce que la page affiche pendant que Claude écrit */
export interface EnCours {
  reflexion: string;
  texte: string;
  outils: string[];
}

interface FinTour {
  message: { content: Bloc[]; stop_reason: string; model: string };
  cout: number;
}

async function appeler(conversationId: string, messages: MessageApi[], suivi: (e: EnCours) => void): Promise<FinTour> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error("Session expirée : reconnecte-toi.");

  const rep = await fetch(`${supabaseUrl}/functions/v1/verif-fab`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, apikey: supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, messages }),
  });
  if (!rep.ok || !rep.body) {
    let detail = `${rep.status}`;
    try { detail = (await rep.json()).erreur ?? detail; } catch { /* corps non JSON */ }
    throw new Error(`Vérif FAB indisponible : ${detail}`);
  }

  const etat: EnCours = { reflexion: "", texte: "", outils: [] };
  const lecteur = rep.body.getReader();
  const dec = new TextDecoder();
  let tampon = "";
  let fin: FinTour | null = null;
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    tampon += dec.decode(value, { stream: true });
    let i;
    while ((i = tampon.indexOf("\n\n")) >= 0) {
      const brut = tampon.slice(0, i);
      tampon = tampon.slice(i + 2);
      if (!brut.startsWith("data: ")) continue;
      const ev = JSON.parse(brut.slice(6));
      if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use") {
        etat.outils = [...etat.outils, ev.content_block.name];
      } else if (ev.type === "content_block_delta") {
        if (ev.delta?.type === "text_delta") etat.texte += ev.delta.text;
        else if (ev.delta?.type === "thinking_delta") etat.reflexion += ev.delta.thinking;
      } else if (ev.type === "graphidesk_fin") {
        fin = { message: ev.message, cout: ev.cout_usd };
      } else if (ev.type === "graphidesk_erreur") {
        throw new Error(ev.erreur);
      }
      suivi({ ...etat });
    }
  }
  if (!fin) throw new Error("Réponse interrompue (délai dépassé ?). Relance ton dernier message.");
  return fin;
}

/** Enregistre un message (l'ordre garantit la relecture fidèle) */
async function enregistrer(conversationId: string, ordre: number, m: MessageApi) {
  const { error } = await supabase
    .from("verif_messages")
    .insert({ conversation_id: conversationId, ordre, role: m.role, contenu: m.content });
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
}

export interface Question {
  question: string;
  choix: string[];
}
export interface FichierCible { chemin: string; pourquoi: string; conseille: boolean }
export interface GroupeCiblage { titre: string; fichiers: FichierCible[] }
/** Claude a posé des questions (ou propose des fichiers à examiner) : la conversation attend */
export interface Attente {
  toolUseId: string;
  questions: Question[];
  /** présent quand Claude demande quels fichiers examiner (cibler_fichiers) */
  ciblage?: GroupeCiblage[];
  /** résultats des autres outils du même tour (null : à recalculer) */
  resultats: Bloc[] | null;
}

interface Contexte {
  conversationId: string;
  dossier: string;
  suivi: (e: EnCours | null) => void;
  /** attendu : la liste des vérifications ne se recharge qu'une fois le rapport enregistré */
  surRapport: (r: Rapport) => void | Promise<void>;
  /** un outil va lire un fichier : sert à la progression et à la durée restante */
  surOutil?: (nom: string, entree: Bloc) => void;
}

/** Exécute les outils d'un tour, sauf poser_questions qui attend l'humain */
async function traiterOutils(message: { content: Bloc[] }, ctx: Contexte): Promise<{ resultats: Bloc[]; attente: Attente | null; rapportRendu: boolean }> {
  const resultats: Bloc[] = [];
  let attente: Attente | null = null;
  let rapportRendu = false;
  for (const b of message.content) {
    if (b.type !== "tool_use") continue;
    if (b.name === "poser_questions" || b.name === "cibler_fichiers") {
      if (attente) {
        // une seule attente à la fois : l'autre demande est renvoyée à plus tard
        resultats.push({ type: "tool_result", tool_use_id: b.id, content: "Une demande à la fois : refais-la après la réponse du graphiste.", is_error: true });
        continue;
      }
      attente = attenteDuBloc(b);
      continue;
    }
    if (b.name === "rendre_rapport") {
      // pas de tool_result tout de suite : sinon Claude répond par un résumé
      // du rapport (un appel payé pour rien). Il est joint au message suivant.
      await ctx.surRapport(b.input as Rapport);
      rapportRendu = true;
      continue;
    }
    if (b.name === "proposer_regle") {
      const { data: u } = await supabase.auth.getUser();
      // fusion : la règle validée que ce texte complet remplacerait
      let remplaceId: string | null = null;
      if (b.input?.remplace?.trim()) {
        const { data: cible } = await supabase.from("verif_regles").select("id")
          .eq("statut", "validee").eq("titre", b.input.remplace.trim()).limit(1);
        remplaceId = cible?.[0]?.id ?? null;
      }
      const { error } = await supabase.from("verif_regles").insert({
        remplace_id: remplaceId,
        categorie: b.input?.categorie ?? "general",
        titre: b.input?.titre ?? "",
        texte: b.input?.texte ?? "",
        raison: b.input?.raison ?? null,
        statut: "proposee",
        propose_par: u.user?.id,
        conversation_id: ctx.conversationId,
      });
      resultats.push({
        type: "tool_result",
        tool_use_id: b.id,
        content: error ? `Proposition non enregistrée : ${error.message}` : "Proposition enregistrée : elle s'appliquera une fois validée par Jordan.",
        is_error: error ? true : undefined,
      });
      continue;
    }
    ctx.suivi({ reflexion: "", texte: "", outils: [`${b.name} ${b.input?.chemin ?? ""}`.trim()] });
    ctx.surOutil?.(b.name, b.input ?? {});
    const r = await executerOutil(ctx.dossier, b.name, b.input ?? {});
    resultats.push({ type: "tool_result", tool_use_id: b.id, content: r.contenu, is_error: r.erreur || undefined });
  }
  if (attente) attente.resultats = resultats;
  return { resultats, attente, rapportRendu };
}

function attenteDuBloc(b: Bloc): Attente {
  return b.name === "cibler_fichiers"
    ? { toolUseId: b.id, questions: [], ciblage: (b.input?.groupes ?? []) as GroupeCiblage[], resultats: null }
    : { toolUseId: b.id, questions: (b.input?.questions ?? []) as Question[], resultats: null };
}

/** Demande laissée sans réponse à la fin d'un historique (conversation rouverte) */
export function attenteDepuisHistorique(msgs: MessageApi[]): Attente | null {
  const dernier = msgs[msgs.length - 1];
  if (!dernier || dernier.role !== "assistant") return null;
  const q = dernier.content.find((b) => b.type === "tool_use" && (b.name === "poser_questions" || b.name === "cibler_fichiers"));
  return q ? attenteDuBloc(q) : null;
}

/** Message utilisateur : les fichiers cochés pour examen */
export async function reponseAuCiblage(attente: Attente, choisis: string[], historique: MessageApi[], ctx: Contexte): Promise<MessageApi> {
  let autres = attente.resultats;
  if (!autres) autres = (await traiterOutils(historique[historique.length - 1], ctx)).resultats;
  const texte = choisis.length
    ? `Fichiers cochés par le graphiste — examine uniquement ceux-ci :\n${choisis.map((c) => `• ${c}`).join("\n")}`
    : "Le graphiste n'a coché aucun fichier : n'en examine aucun, poursuis avec ce que tu as.";
  return { role: "user", content: [...autres, { type: "tool_result", tool_use_id: attente.toolUseId, content: texte }] };
}

/** Message utilisateur qui répond aux questions (et rend les autres outils du tour) */
export async function reponseAuxQuestions(
  attente: Attente,
  reponses: string[],
  precision: string,
  historique: MessageApi[],
  ctx: Contexte
): Promise<MessageApi> {
  let autres = attente.resultats;
  if (!autres) autres = (await traiterOutils(historique[historique.length - 1], ctx)).resultats;
  const texte =
    attente.questions.map((q, i) => `${i + 1}. ${q.question}\n→ ${reponses[i] || "(pas de réponse)"}`).join("\n") +
    (precision.trim() ? `\n\nPrécision du graphiste : ${precision.trim()}` : "");
  return { role: "user", content: [...autres, { type: "tool_result", tool_use_id: attente.toolUseId, content: texte }] };
}

/**
 * L'API exige un tool_result pour chaque tool_use du message précédent : ceux
 * laissés en suspens (rapport rendu, fin de boucle) sont joints en tête.
 */
function avecResultatsEnSuspens(historique: MessageApi[], nouveau: MessageApi): MessageApi {
  const dernier = historique[historique.length - 1];
  if (!dernier || dernier.role !== "assistant") return nouveau;
  const rendus = new Set(nouveau.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id));
  const manquants: Bloc[] = dernier.content
    .filter((b) => b.type === "tool_use" && !rendus.has(b.id))
    .map((b) => ({
      type: "tool_result",
      tool_use_id: b.id,
      content: b.name === "rendre_rapport" ? "Rapport affiché au graphiste et archivé." : "Non exécuté.",
    }));
  return manquants.length ? { ...nouveau, content: [...manquants, ...nouveau.content] } : nouveau;
}

/**
 * Envoie `nouveau` (message utilisateur) puis laisse Claude travailler jusqu'à
 * ce qu'il rende la main — ou qu'il pose des questions (renvoyées dans `attente`).
 */
export async function poursuivre(opts: {
  conversationId: string;
  dossier: string;
  historique: MessageApi[];
  nouveau: MessageApi;
  suivi: (e: EnCours | null) => void;
  surMessages: (m: MessageApi[]) => void;
  surRapport: (r: Rapport) => void | Promise<void>;
  surOutil?: (nom: string, entree: Bloc) => void;
}): Promise<{ messages: MessageApi[]; attente: Attente | null }> {
  const ctx: Contexte = { conversationId: opts.conversationId, dossier: opts.dossier, suivi: opts.suivi, surRapport: opts.surRapport, surOutil: opts.surOutil };
  const nouveau = avecResultatsEnSuspens(opts.historique, opts.nouveau);
  let msgs = [...opts.historique, nouveau];
  await enregistrer(opts.conversationId, msgs.length - 1, nouveau);
  opts.surMessages(msgs);

  for (let tours = 0; tours < 40; tours++) {
    const { message } = await appeler(opts.conversationId, msgs, opts.suivi);
    const reponse: MessageApi = { role: "assistant", content: message.content };
    msgs = [...msgs, reponse];
    await enregistrer(opts.conversationId, msgs.length - 1, reponse);
    opts.suivi(null);
    opts.surMessages(msgs);

    if (message.stop_reason !== "tool_use") break;

    const { resultats, attente, rapportRendu } = await traiterOutils(message, ctx);
    if (attente) {
      opts.suivi(null);
      return { messages: msgs, attente };
    }
    if (rapportRendu) break;
    const retour: MessageApi = { role: "user", content: resultats };
    msgs = [...msgs, retour];
    await enregistrer(opts.conversationId, msgs.length - 1, retour);
    opts.surMessages(msgs);
  }
  opts.suivi(null);
  return { messages: msgs, attente: null };
}
