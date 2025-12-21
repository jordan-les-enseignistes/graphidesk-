// Edge Function: Envoi email récapitulatif heures supplémentaires
// Envoie un récap HTML + détail CSV en pièce jointe

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Destinataire {
  email: string;
  type: "to" | "cc" | "bcc";
  label?: string;
}

interface HeureJournaliere {
  date: string;
  jour_semaine: string;
  matin_debut: string | null;
  matin_fin: string | null;
  aprem_debut: string | null;
  aprem_fin: string | null;
  type_absence: string | null;
}

interface CongeInfo {
  jours: number;
  demiJours: number;
  dates: string[];
}

interface FeuilleData {
  user_name: string;
  heures: HeureJournaliere[];
  total_minutes: number;
  heures_sup_minutes: number;
  conges: CongeInfo;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "+";
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

function calculateDayTotal(h: HeureJournaliere): number {
  let total = 0;
  if (h.matin_debut && h.matin_fin) {
    const [mh, mm] = h.matin_debut.split(":").map(Number);
    const [fh, fm] = h.matin_fin.split(":").map(Number);
    total += (fh * 60 + fm) - (mh * 60 + mm);
  }
  if (h.aprem_debut && h.aprem_fin) {
    const [mh, mm] = h.aprem_debut.split(":").map(Number);
    const [fh, fm] = h.aprem_fin.split(":").map(Number);
    total += (fh * 60 + fm) - (mh * 60 + mm);
  }
  return Math.max(0, total);
}

function formatConges(conges: CongeInfo): string {
  if (conges.jours === 0 && conges.demiJours === 0) return "-";
  const parts: string[] = [];
  if (conges.jours > 0) parts.push(`${conges.jours}j`);
  if (conges.demiJours > 0) parts.push(`${conges.demiJours * 0.5}j`);
  return parts.join(" + ");
}

function formatCongeDates(dates: string[]): string {
  if (dates.length === 0) return "";
  // Formatter les dates en "24, 26, 27 dec"
  const formatted = dates.map(d => {
    const date = new Date(d);
    return date.getDate().toString();
  });
  return `(${formatted.join(", ")})`;
}

// Email léger avec juste le récap
function generateRecapEmailHtml(data: FeuilleData[], semaines: number[], mois: string, annee: number): string {
  const recapRows = data.map(d => {
    const congesText = formatConges(d.conges);
    const congesDates = d.conges.dates.length > 0 ? `<br><span style="font-size:10px;color:#6b7280">${formatCongeDates(d.conges.dates)}</span>` : "";
    const hsColor = d.heures_sup_minutes >= 0 ? '#059669' : '#dc2626';
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:500">${d.user_name}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${formatMinutes(d.total_minutes).replace('+', '')}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;color:${hsColor}">${formatMinutes(d.heures_sup_minutes)}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#059669">${congesText}${congesDates}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f3f4f6"><div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden"><div style="background:#2563eb;color:white;padding:20px"><h1 style="margin:0;font-size:18px">Recapitulatif Heures Sup</h1><p style="margin:5px 0 0;font-size:13px">Pole Graphique - S${semaines.join(',')} - ${mois} ${annee}</p></div><div style="padding:20px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280">Graphiste</th><th style="text-align:right;padding:10px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280">Heures</th><th style="text-align:right;padding:10px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280">HS</th><th style="text-align:center;padding:10px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280">Conges</th></tr></thead><tbody>${recapRows}</tbody></table><p style="margin:20px 0 0;padding:12px;background:#f0f9ff;border-radius:6px;font-size:11px;color:#0369a1;text-align:center">Le detail jour par jour est en piece jointe (fichier CSV ouvrable avec Excel)</p></div><div style="background:#f9fafb;padding:12px;text-align:center;font-size:11px;color:#6b7280">Les Enseignistes - GraphiDesk</div></div></body></html>`;
}

// CSV léger pour le détail jour par jour (ouvrable dans Excel)
function generateDetailCsv(data: FeuilleData[], mois: string, annee: number): string {
  const lines: string[] = [];
  // BOM UTF-8 pour Excel + header
  lines.push("Graphiste;Date;Jour;Matin Debut;Matin Fin;Aprem Debut;Aprem Fin;Total;Statut");

  for (const user of data) {
    for (const h of user.heures) {
      const total = calculateDayTotal(h);
      const totalStr = total > 0 ? formatMinutes(total).replace('+', '') : "";
      let statut = "";
      if (h.type_absence === "conge") statut = "Conge";
      else if (h.type_absence === "conge_matin") statut = "Conge matin";
      else if (h.type_absence === "conge_aprem") statut = "Conge aprem";
      else if (h.type_absence === "ferie") statut = "Ferie";
      else if (["samedi", "dimanche"].includes(h.jour_semaine)) statut = "Weekend";

      lines.push([
        user.user_name,
        h.date,
        h.jour_semaine,
        h.matin_debut || "",
        h.matin_fin || "",
        h.aprem_debut || "",
        h.aprem_fin || "",
        totalStr,
        statut
      ].join(";"));
    }
    // Ligne de total pour ce graphiste
    lines.push([
      user.user_name,
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      formatMinutes(user.total_minutes).replace('+', ''),
      `HS: ${formatMinutes(user.heures_sup_minutes)}`
    ].join(";"));
    lines.push(""); // Ligne vide entre les graphistes
  }

  return lines.join("\n");
}

function generateDetailHtml(data: FeuilleData[], semaines: number[], mois: string, annee: number): string {
  const jourLabels: Record<string, string> = {
    lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu", vendredi: "Ven", samedi: "Sam", dimanche: "Dim"
  };

  let userSections = "";
  for (const user of data) {
    const rows = user.heures.map(h => {
      const total = calculateDayTotal(h);
      const isWeekend = h.jour_semaine === "samedi" || h.jour_semaine === "dimanche";
      const isCongeComplet = h.type_absence === "conge";
      const isCongeMatin = h.type_absence === "conge_matin";
      const isCongeAprem = h.type_absence === "conge_aprem";
      const isFerie = h.type_absence === "ferie";
      const day = h.date.split('-')[2];

      if (isWeekend) {
        return `<tr style="background:#f9fafb;color:#9ca3af"><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${jourLabels[h.jour_semaine] || h.jour_semaine}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${day}</td><td colspan="5" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-style:italic">Weekend</td></tr>`;
      }
      if (isCongeComplet) {
        return `<tr style="background:#d1fae5"><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${jourLabels[h.jour_semaine] || h.jour_semaine}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${day}</td><td colspan="5" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:500;color:#059669">Conge</td></tr>`;
      }
      if (isFerie) {
        return `<tr style="background:#fef3c7"><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${jourLabels[h.jour_semaine] || h.jour_semaine}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${day}</td><td colspan="5" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:500;color:#d97706">Ferie</td></tr>`;
      }
      if (isCongeMatin) {
        // Congé le matin, travail l'après-midi
        return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${jourLabels[h.jour_semaine] || h.jour_semaine}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${day}</td><td colspan="2" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;background:#d1fae5;color:#059669;font-weight:500">Conge matin</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.aprem_debut || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.aprem_fin || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500">${total > 0 ? formatMinutes(total).replace('+','') : '-'}</td></tr>`;
      }
      if (isCongeAprem) {
        // Travail le matin, congé l'après-midi
        return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${jourLabels[h.jour_semaine] || h.jour_semaine}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${day}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.matin_debut || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.matin_fin || '-'}</td><td colspan="2" style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;background:#d1fae5;color:#059669;font-weight:500">Conge apres-midi</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500">${total > 0 ? formatMinutes(total).replace('+','') : '-'}</td></tr>`;
      }
      return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${jourLabels[h.jour_semaine] || h.jour_semaine}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${day}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.matin_debut || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.matin_fin || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.aprem_debut || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${h.aprem_fin || '-'}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500">${total > 0 ? formatMinutes(total).replace('+','') : '-'}</td></tr>`;
    }).join("");

    // Ajouter infos congés dans le header
    const congesInfo = user.conges.jours > 0 || user.conges.demiJours > 0
      ? ` | Conges: ${formatConges(user.conges)}`
      : "";

    userSections += `<div style="margin-bottom:30px"><h2 style="margin:0 0 10px;padding:10px 15px;background:#2563eb;color:white;border-radius:8px;font-size:16px">${user.user_name}<span style="float:right;font-weight:normal">HS: <strong>${formatMinutes(user.heures_sup_minutes)}</strong>${congesInfo}</span></h2><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left">Jour</th><th style="padding:8px 10px;text-align:left;width:40px">#</th><th style="padding:8px 10px;text-align:center" colspan="2">Matin</th><th style="padding:8px 10px;text-align:center" colspan="2">Apres-midi</th><th style="padding:8px 10px;text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const totalHS = data.reduce((acc, d) => acc + d.heures_sup_minutes, 0);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Detail Heures Sup - ${mois} ${annee}</title></head><body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f3f4f6"><div style="max-width:800px;margin:0 auto"><h1 style="margin:0 0 5px;font-size:22px;color:#1f2937">Detail Heures Supplementaires</h1><p style="margin:0 0 20px;color:#6b7280">Pole Graphique - Semaine${semaines.length > 1 ? 's' : ''} ${semaines.join(', ')} - ${mois} ${annee}</p>${userSections}<div style="margin-top:30px;padding-top:15px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">Document genere le ${new Date().toLocaleDateString('fr-FR')} - Les Enseignistes - GraphiDesk</div></div></body></html>`;
}

interface Attachment {
  filename: string;
  content: string;
  contentType: string;
}

async function sendSMTPEmail(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<void> {
  const { host, port, username, password, from, to, cc, subject, html, attachments } = config;

  console.log(`Connecting to ${host}:${port}...`);
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function read(timeoutMs = 10000): Promise<string> {
    const buf = new Uint8Array(4096);
    const readPromise = conn.read(buf);
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Read timeout")), timeoutMs)
    );
    try {
      const n = await Promise.race([readPromise, timeoutPromise]);
      const response = n ? decoder.decode(buf.subarray(0, n as number)) : "";
      console.log("< " + response.trim());
      return response;
    } catch (_) {
      console.log("< (timeout)");
      return "";
    }
  }

  async function send(cmd: string): Promise<string> {
    console.log("> " + (cmd.includes(btoa(password)) ? "***" : cmd));
    await conn.write(encoder.encode(cmd + "\r\n"));
    return await read();
  }

  try {
    await read();
    await send("EHLO graphidesk");
    await send("AUTH LOGIN");
    await send(btoa(username));
    const authResp = await send(btoa(password));
    if (!authResp.includes("235")) throw new Error("Auth failed");

    await send(`MAIL FROM:<${from}>`);
    for (const r of to) await send(`RCPT TO:<${r}>`);
    if (cc) for (const r of cc) await send(`RCPT TO:<${r}>`);
    await send("DATA");

    const boundary = `----GraphiDesk${Date.now()}`;
    let message = "";
    message += `From: GraphiDesk <${from}>\r\n`;
    message += `To: ${to.join(", ")}\r\n`;
    if (cc && cc.length > 0) message += `Cc: ${cc.join(", ")}\r\n`;
    message += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
    message += `MIME-Version: 1.0\r\n`;

    if (attachments && attachments.length > 0) {
      // Email multipart avec pièces jointes
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
      message += `\r\n`;

      // Partie HTML du corps
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=UTF-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `\r\n`;
      message += btoa(unescape(encodeURIComponent(html))) + `\r\n`;

      // Pièces jointes
      for (const att of attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
        message += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n`;
        message += `\r\n`;
        message += btoa(unescape(encodeURIComponent(att.content))) + `\r\n`;
      }

      message += `--${boundary}--\r\n`;
    } else {
      // Email simple sans pièce jointe
      message += `Content-Type: text/html; charset=UTF-8\r\n`;
      message += `\r\n`;
      message += html;
    }

    message += `\r\n.\r\n`;

    console.log(`Sending message (${message.length} bytes)...`);
    await conn.write(encoder.encode(message));
    await read(30000);

    try { await conn.write(encoder.encode("QUIT\r\n")); } catch (_) {}
    console.log("Email sent!");
  } finally {
    conn.close();
  }
}

serve(async (req) => {
  console.log("=== FUNCTION CALLED ===");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpPassword) throw new Error("SMTP_PASSWORD non configure");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { annee, mois, semaines, userId } = await req.json();

    if (!annee || !mois) throw new Error("Parametres annee et mois requis");

    // Config email
    const { data: config, error: configError } = await supabase
      .from("email_config_heures_sup")
      .select("*")
      .single();

    if (configError || !config) throw new Error("Configuration email non trouvee");

    const destinataires = config.destinataires as Destinataire[];
    if (!destinataires || destinataires.length === 0) throw new Error("Aucun destinataire configure");

    // Feuilles de temps
    const { data: feuilles, error: feuillesError } = await supabase
      .from("feuilles_temps")
      .select(`*, heures:heures_journalieres(*), user:profiles!feuilles_temps_user_id_fkey(id, full_name)`)
      .eq("annee", annee)
      .eq("mois", mois);

    if (feuillesError) throw new Error(`Erreur feuilles: ${feuillesError.message}`);

    const HEURES_BASE = 7 * 60;
    const moisLabels = ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"];
    const moisLabel = moisLabels[mois - 1];

    let semainesIncluses = semaines || [];
    if (!semainesIncluses.length && feuilles?.length) {
      const weeks = new Set<number>();
      feuilles.forEach(f => f.heures?.forEach((h: HeureJournaliere) => {
        const d = new Date(h.date);
        weeks.add(Math.ceil((((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7));
      }));
      semainesIncluses = [...weeks].sort((a, b) => a - b);
    }

    // Préparer données
    const feuillesData: FeuilleData[] = (feuilles || []).map(f => {
      const heures = ((f.heures || []) as HeureJournaliere[]).sort((a, b) => a.date.localeCompare(b.date));
      let totalMinutes = 0, joursOuvres = 0;
      const conges: CongeInfo = { jours: 0, demiJours: 0, dates: [] };

      heures.forEach(h => {
        const isWeekend = ["samedi", "dimanche"].includes(h.jour_semaine);

        // Comptabiliser les congés
        if (h.type_absence === "conge") {
          conges.jours++;
          conges.dates.push(h.date);
          return; // Pas de travail ce jour
        }
        if (h.type_absence === "conge_matin" || h.type_absence === "conge_aprem") {
          conges.demiJours++;
          if (!conges.dates.includes(h.date)) conges.dates.push(h.date);
          // Le travail de la demi-journée est comptabilisé ci-dessous
        }
        if (h.type_absence === "ferie") return;

        totalMinutes += calculateDayTotal(h);
        if (!isWeekend && h.type_absence !== "conge_matin" && h.type_absence !== "conge_aprem") {
          joursOuvres++;
        } else if (!isWeekend && (h.type_absence === "conge_matin" || h.type_absence === "conge_aprem")) {
          // Demi-journée travaillée = 0.5 jour ouvré
          joursOuvres += 0.5;
        }
      });

      return {
        user_name: f.user?.full_name || "Inconnu",
        heures,
        total_minutes: totalMinutes,
        heures_sup_minutes: totalMinutes - (joursOuvres * HEURES_BASE),
        conges,
      };
    }).sort((a, b) => a.user_name.localeCompare(b.user_name));

    // Générer le HTML détaillé
    const detailHtml = generateDetailHtml(feuillesData, semainesIncluses, moisLabel, annee);

    // Créer d'abord le log pour obtenir l'ID
    const { data: logData, error: logError } = await supabase
      .from("email_heures_sup_log")
      .insert({
        annee,
        mois,
        semaines: semainesIncluses,
        destinataires,
        status: "pending",
        sent_by: userId,
        rapport_html: detailHtml,
      })
      .select("id")
      .single();

    if (logError || !logData) {
      console.error("Log insert error:", logError);
      throw new Error(`Erreur creation log: ${logError?.message}`);
    }

    // Générer l'email léger (juste le récap) + CSV en pièce jointe
    const recapHtml = generateRecapEmailHtml(feuillesData, semainesIncluses, moisLabel, annee);
    const detailCsv = generateDetailCsv(feuillesData, moisLabel, annee);

    const toEmails = destinataires.filter(d => d.type === "to").map(d => d.email);
    const ccEmails = destinataires.filter(d => d.type === "cc").map(d => d.email);
    const sujet = `Recapitulatif heures sup - S${semainesIncluses.join(',')} ${moisLabel} ${annee}`;
    const csvFilename = `detail-heures-sup-${moisLabel.toLowerCase()}-${annee}.csv`;

    console.log(`CSV size: ${detailCsv.length} bytes`);

    // Envoyer l'email avec le CSV en pièce jointe
    await sendSMTPEmail({
      host: config.smtp_host,
      port: config.smtp_port,
      username: config.smtp_user,
      password: smtpPassword,
      from: config.smtp_user,
      to: toEmails,
      cc: ccEmails.length ? ccEmails : undefined,
      subject: sujet,
      html: recapHtml,
      attachments: [{
        filename: csvFilename,
        content: detailCsv,
        contentType: "text/csv",
      }],
    });

    // Mettre à jour le statut du log
    await supabase
      .from("email_heures_sup_log")
      .update({ status: "sent" })
      .eq("id", logData.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Erreur:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
