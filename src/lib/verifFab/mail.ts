/**
 * Vérif FAB — lecture d'un mail enregistré (.eml, format MIME standard
 * d'Outlook, Thunderbird, Gmail) : en-têtes, texte, pièces jointes. Sans
 * dépendance ni accès disque : reçoit les octets, rend du texte et les pièces
 * jointes décodées (testable hors de l'app).
 */

export interface PieceJointe {
  nom: string;
  type: string;
  octets: Uint8Array;
}

export interface Mail {
  de: string;
  a: string;
  cc: string;
  date: string;
  objet: string;
  texte: string;
  pieces: PieceJointe[];
}

type EnTetes = Map<string, string>;

/** octets → chaîne « binaire » (1 caractère = 1 octet) : le MIME se découpe sans rien décoder */
function binaire(o: Uint8Array): string {
  let s = "";
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return s;
}

function octetsDe(b: string): Uint8Array {
  const o = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i) & 0xff;
  return o;
}

function decoderCharset(b: string, charset: string): string {
  const o = octetsDe(b);
  try {
    return new TextDecoder(charset || "utf-8").decode(o);
  } catch {
    // charset inconnu du navigateur : l'UTF-8 reste le plus probable
    return new TextDecoder("utf-8").decode(o);
  }
}

function quotedPrintable(s: string): string {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function base64(s: string): string {
  try {
    return atob(s.replace(/[^A-Za-z0-9+/=]/g, ""));
  } catch {
    return "";
  }
}

/** « =?UTF-8?Q?R=C3=A9ponse?= » → « Réponse » (RFC 2047) */
function motsEncodes(s: string): string {
  return s
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, cs: string, enc: string, t: string) =>
      decoderCharset(enc.toUpperCase() === "B" ? base64(t) : quotedPrintable(t.replace(/_/g, " ")), cs)
    );
}

function lireEnTetes(bloc: string): EnTetes {
  const h: EnTetes = new Map();
  for (const ligne of bloc.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = ligne.indexOf(":");
    if (i > 0) h.set(ligne.slice(0, i).trim().toLowerCase(), ligne.slice(i + 1).trim());
  }
  return h;
}

/** valeur principale + paramètres d'un en-tête (« text/plain; charset=utf-8 ») */
function parametres(v: string): { valeur: string; p: Map<string, string> } {
  const morceaux = v.match(/(?:[^;"]|"[^"]*")+/g) ?? [""];
  const p = new Map<string, string>();
  for (const m of morceaux.slice(1)) {
    const i = m.indexOf("=");
    if (i < 0) continue;
    const cle = m.slice(0, i).trim().toLowerCase();
    let val = m.slice(i + 1).trim().replace(/^"|"$/g, "");
    // filename*=utf-8''nom%20encod%C3%A9 (RFC 2231)
    if (cle.endsWith("*")) {
      const r = val.match(/^([^']*)'[^']*'(.*)$/);
      val = r ? decoderCharset(r[2].replace(/%([0-9A-Fa-f]{2})/g, (_, x) => String.fromCharCode(parseInt(x, 16))), r[1]) : val;
      p.set(cle.slice(0, -1), val);
    } else if (!p.has(cle)) p.set(cle, motsEncodes(val));
  }
  return { valeur: morceaux[0].trim().toLowerCase(), p };
}

function htmlEnTexte(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

interface Parties {
  texte: string[];
  html: string[];
  pieces: PieceJointe[];
}

function parcourir(brut: string, r: Parties): void {
  const sep = brut.search(/\r?\n\r?\n/);
  const h = lireEnTetes(sep < 0 ? brut : brut.slice(0, sep));
  const corps = sep < 0 ? "" : brut.slice(sep).replace(/^\r?\n\r?\n/, "");
  const ct = parametres(h.get("content-type") ?? "text/plain");
  const cd = parametres(h.get("content-disposition") ?? "");

  if (ct.valeur.startsWith("multipart/")) {
    const limite = ct.p.get("boundary");
    if (!limite) return;
    const morceaux = corps.split(new RegExp(`\\r?\\n?--${limite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?[ \\t]*(?:\\r?\\n|$)`));
    // avant la première limite : préambule ; après la dernière : épilogue
    for (const m of morceaux.slice(1)) if (m.trim()) parcourir(m, r);
    return;
  }
  if (ct.valeur === "message/rfc822") {
    // mail transféré en pièce jointe : son texte suit, à la suite
    const interne: Parties = { texte: [], html: [], pieces: [] };
    parcourir(corps, interne);
    const t = interne.texte.length ? interne.texte : interne.html.map(htmlEnTexte);
    if (t.length) r.texte.push(`--- Mail joint ---\n${t.join("\n")}`);
    r.pieces.push(...interne.pieces);
    return;
  }

  const enc = (h.get("content-transfer-encoding") ?? "").toLowerCase();
  const donnees = enc === "base64" ? base64(corps) : enc === "quoted-printable" ? quotedPrintable(corps) : corps;
  const nom = cd.p.get("filename") ?? ct.p.get("name") ?? "";
  if (cd.valeur !== "attachment" && !nom && ct.valeur === "text/plain") r.texte.push(decoderCharset(donnees, ct.p.get("charset") ?? ""));
  else if (cd.valeur !== "attachment" && !nom && ct.valeur === "text/html") r.html.push(decoderCharset(donnees, ct.p.get("charset") ?? ""));
  else r.pieces.push({ nom: nom || "(sans nom)", type: ct.valeur, octets: octetsDe(donnees) });
}

export function lireMail(octets: Uint8Array): Mail {
  const brut = binaire(octets);
  const sep = brut.search(/\r?\n\r?\n/);
  const h = lireEnTetes(sep < 0 ? brut : brut.slice(0, sep));
  const r: Parties = { texte: [], html: [], pieces: [] };
  parcourir(brut, r);
  // texte brut s'il existe (multipart/alternative), sinon le HTML débarrassé de ses balises
  const texte = (r.texte.length ? r.texte.join("\n") : r.html.map(htmlEnTexte).join("\n"))
    .replace(/\r\n/g, "\n")
    // liens des signatures (suivi, réseaux) et images intégrées : du bruit facturé au token
    .replace(/<(https?:|mailto:|tel:)[^>]*>/g, "").replace(/\[cid:[^\]]*\]/g, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  // en-tête en 8 bits (UTF-8 brut) d'abord, puis les mots encodés =?…?= (en ASCII, intacts)
  const en = (cle: string) => motsEncodes(decoderCharset(h.get(cle) ?? "", "utf-8"));
  return { de: en("from"), a: en("to"), cc: en("cc"), date: h.get("date") ?? "", objet: en("subject"), texte, pieces: r.pieces };
}
