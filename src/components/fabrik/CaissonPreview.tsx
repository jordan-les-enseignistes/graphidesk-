import { useMemo } from "react";
import type { PartData, Thickness } from "./types";
import { PLAQUE_MAX_WIDTH, PLAQUE_MAX_HEIGHT } from "./types";

interface CaissonPreviewProps {
  largeur: number;
  hauteur: number;
  profondeur: number;
  thickness?: Thickness;
  drillingHoles?: boolean;
  showDimensions?: boolean;
}

export function CaissonPreview({
  largeur,
  hauteur,
  profondeur,
  thickness,
  drillingHoles = true,
  showDimensions = true,
}: CaissonPreviewProps) {
  const preview = useMemo(() => {
    if (!largeur || !hauteur) return null;

    // Calcul des épaisseurs
    let epaisseurHaut = profondeur;
    let epaisseurBas = profondeur;
    let epaisseurGauche = profondeur;
    let epaisseurDroite = profondeur;

    if (thickness?.isMulti) {
      epaisseurHaut = thickness.haut || 0;
      epaisseurBas = thickness.bas || 0;
      epaisseurGauche = thickness.gauche || 0;
      epaisseurDroite = thickness.droite || 0;
    }

    const largeurFinale = largeur + epaisseurGauche + epaisseurDroite;
    const hauteurFinale = hauteur + epaisseurHaut + epaisseurBas;

    // Vérification format plaque
    const depasseFormat =
      (largeurFinale > PLAQUE_MAX_WIDTH && largeurFinale > PLAQUE_MAX_HEIGHT) ||
      (hauteurFinale > PLAQUE_MAX_HEIGHT && hauteurFinale > PLAQUE_MAX_WIDTH);

    // Calcul de l'échelle pour le SVG
    const maxWidth = 400;
    const maxHeight = 300;
    const scaleX = maxWidth / largeurFinale;
    const scaleY = maxHeight / hauteurFinale;
    const scale = Math.min(scaleX, scaleY, 0.3);

    const svgWidth = largeurFinale * scale + 100;
    const svgHeight = hauteurFinale * scale + 100;

    const offsetX = 50;
    const offsetY = 50;

    // Calcul des découpes (épaisseur - 1mm)
    const decoupeHaut = epaisseurHaut > 0 ? (epaisseurHaut - 1) * scale : 0;
    const decoupeBas = epaisseurBas > 0 ? (epaisseurBas - 1) * scale : 0;
    const decoupeGauche = epaisseurGauche > 0 ? (epaisseurGauche - 1) * scale : 0;
    const decoupeDroite = epaisseurDroite > 0 ? (epaisseurDroite - 1) * scale : 0;

    // Dimensions en pixels
    const w = largeurFinale * scale;
    const h = hauteurFinale * scale;
    const eH = epaisseurHaut * scale;
    const eB = epaisseurBas * scale;
    const eG = epaisseurGauche * scale;
    const eD = epaisseurDroite * scale;

    // Contour principal avec découpes
    const contourPath = `
      M ${offsetX + decoupeGauche} ${offsetY}
      L ${offsetX + w - decoupeDroite} ${offsetY}
      L ${offsetX + w - decoupeDroite} ${offsetY + decoupeHaut}
      L ${offsetX + w} ${offsetY + decoupeHaut}
      L ${offsetX + w} ${offsetY + h - decoupeBas}
      L ${offsetX + w - decoupeDroite} ${offsetY + h - decoupeBas}
      L ${offsetX + w - decoupeDroite} ${offsetY + h}
      L ${offsetX + decoupeGauche} ${offsetY + h}
      L ${offsetX + decoupeGauche} ${offsetY + h - decoupeBas}
      L ${offsetX} ${offsetY + h - decoupeBas}
      L ${offsetX} ${offsetY + decoupeHaut}
      L ${offsetX + decoupeGauche} ${offsetY + decoupeHaut}
      Z
    `;

    // Positions des trous de perçage
    const holes: { x: number; y: number }[] = [];
    if (drillingHoles) {
      const distanceAngle = 50 * scale;
      const distanceBord = 25 * scale;
      const espacementMax = 750 * scale;

      // Rabat haut
      if (epaisseurHaut > 0) {
        const startX = offsetX + decoupeGauche + distanceAngle;
        const endX = offsetX + w - decoupeDroite - distanceAngle;
        const y = offsetY + distanceBord;
        const length = endX - startX;
        if (length > 0) {
          const segments = Math.ceil(length / espacementMax);
          const spacing = length / segments;
          for (let i = 0; i <= segments; i++) {
            holes.push({ x: startX + i * spacing, y });
          }
        }
      }

      // Rabat bas
      if (epaisseurBas > 0) {
        const startX = offsetX + decoupeGauche + distanceAngle;
        const endX = offsetX + w - decoupeDroite - distanceAngle;
        const y = offsetY + h - distanceBord;
        const length = endX - startX;
        if (length > 0) {
          const segments = Math.ceil(length / espacementMax);
          const spacing = length / segments;
          for (let i = 0; i <= segments; i++) {
            holes.push({ x: startX + i * spacing, y });
          }
        }
      }

      // Rabat gauche
      if (epaisseurGauche > 0) {
        const startY = offsetY + decoupeHaut + distanceAngle;
        const endY = offsetY + h - decoupeBas - distanceAngle;
        const x = offsetX + distanceBord;
        const length = endY - startY;
        if (length > 0) {
          const segments = Math.ceil(length / espacementMax);
          const spacing = length / segments;
          for (let i = 0; i <= segments; i++) {
            holes.push({ x, y: startY + i * spacing });
          }
        }
      }

      // Rabat droite
      if (epaisseurDroite > 0) {
        const startY = offsetY + decoupeHaut + distanceAngle;
        const endY = offsetY + h - decoupeBas - distanceAngle;
        const x = offsetX + w - distanceBord;
        const length = endY - startY;
        if (length > 0) {
          const segments = Math.ceil(length / espacementMax);
          const spacing = length / segments;
          for (let i = 0; i <= segments; i++) {
            holes.push({ x, y: startY + i * spacing });
          }
        }
      }
    }

    return {
      svgWidth,
      svgHeight,
      contourPath,
      offsetX,
      offsetY,
      w,
      h,
      eH,
      eB,
      eG,
      eD,
      largeurFinale,
      hauteurFinale,
      depasseFormat,
      holes,
      decoupeHaut,
      decoupeBas,
      decoupeGauche,
      decoupeDroite,
    };
  }, [largeur, hauteur, profondeur, thickness, drillingHoles]);

  if (!preview) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-100 rounded-lg text-slate-500">
        Entrez les dimensions pour voir l'aperçu
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Alerte format */}
      {preview.depasseFormat && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Format fini ({preview.largeurFinale} × {preview.hauteurFinale} mm) dépasse la plaque max ({PLAQUE_MAX_WIDTH} × {PLAQUE_MAX_HEIGHT} mm)
          </span>
        </div>
      )}

      {/* SVG Preview */}
      <div className="bg-slate-100 rounded-lg p-4 flex justify-center overflow-auto">
        <svg
          width={preview.svgWidth}
          height={preview.svgHeight}
          viewBox={`0 0 ${preview.svgWidth} ${preview.svgHeight}`}
          className="max-w-full"
        >
          {/* Grille de fond */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Zone de la face visible (fond gris clair) */}
          <rect
            x={preview.offsetX + preview.eG}
            y={preview.offsetY + preview.eH}
            width={preview.w - preview.eG - preview.eD}
            height={preview.h - preview.eH - preview.eB}
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="4"
          />

          {/* Contour principal (rose) */}
          <path
            d={preview.contourPath}
            fill="none"
            stroke="#e91e63"
            strokeWidth="2"
            strokeDasharray="6,3"
          />

          {/* Rainures (bleu) - horizontales */}
          {preview.eH > 0 && (
            <line
              x1={preview.offsetX}
              y1={preview.offsetY + preview.eH}
              x2={preview.offsetX + preview.w}
              y2={preview.offsetY + preview.eH}
              stroke="#2196f3"
              strokeWidth="1.5"
            />
          )}
          {preview.eB > 0 && (
            <line
              x1={preview.offsetX}
              y1={preview.offsetY + preview.h - preview.eB}
              x2={preview.offsetX + preview.w}
              y2={preview.offsetY + preview.h - preview.eB}
              stroke="#2196f3"
              strokeWidth="1.5"
            />
          )}

          {/* Rainures (bleu) - verticales */}
          {preview.eG > 0 && (
            <line
              x1={preview.offsetX + preview.eG}
              y1={preview.offsetY}
              x2={preview.offsetX + preview.eG}
              y2={preview.offsetY + preview.h}
              stroke="#2196f3"
              strokeWidth="1.5"
            />
          )}
          {preview.eD > 0 && (
            <line
              x1={preview.offsetX + preview.w - preview.eD}
              y1={preview.offsetY}
              x2={preview.offsetX + preview.w - preview.eD}
              y2={preview.offsetY + preview.h}
              stroke="#2196f3"
              strokeWidth="1.5"
            />
          )}

          {/* Trous de perçage (vert) - rayon réel 1.5mm à l'échelle */}
          {preview.holes.map((hole, i) => (
            <circle
              key={i}
              cx={hole.x}
              cy={hole.y}
              r={Math.max(1.5 * (preview.w / preview.largeurFinale), 1)}
              fill="none"
              stroke="#4CAF50"
              strokeWidth="1"
            />
          ))}

          {/* Dimensions */}
          {showDimensions && (
            <>
              {/* Dimensions face visible (à l'intérieur) */}
              <text
                x={preview.offsetX + preview.eG + (preview.w - preview.eG - preview.eD) / 2}
                y={preview.offsetY + preview.eH + (preview.h - preview.eH - preview.eB) / 2 - 6}
                textAnchor="middle"
                className="text-[10px] fill-slate-500"
              >
                Face visible
              </text>
              <text
                x={preview.offsetX + preview.eG + (preview.w - preview.eG - preview.eD) / 2}
                y={preview.offsetY + preview.eH + (preview.h - preview.eH - preview.eB) / 2 + 8}
                textAnchor="middle"
                className="text-[11px] fill-slate-700 font-medium"
              >
                {largeur} × {hauteur} mm
              </text>

              {/* Largeur totale */}
              <text
                x={preview.offsetX + preview.w / 2}
                y={preview.offsetY + preview.h + 25}
                textAnchor="middle"
                className="text-xs fill-slate-600"
              >
                {preview.largeurFinale} mm
              </text>

              {/* Hauteur totale */}
              <text
                x={preview.offsetX + preview.w + 30}
                y={preview.offsetY + preview.h / 2}
                textAnchor="middle"
                className="text-xs fill-slate-600"
                transform={`rotate(90, ${preview.offsetX + preview.w + 30}, ${preview.offsetY + preview.h / 2})`}
              >
                {preview.hauteurFinale} mm
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-pink-500" style={{ backgroundImage: "repeating-linear-gradient(90deg, #e91e63 0, #e91e63 6px, transparent 6px, transparent 9px)" }}></div>
          <span>Découpe</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span>Rainures</span>
        </div>
        {drillingHoles && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-green-500"></div>
            <span>Perçage Ø3mm</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-slate-200 border border-slate-400 border-dashed"></div>
          <span>Face visible</span>
        </div>
      </div>
    </div>
  );
}

// Preview pour caisson double face
interface CaissonDoublePreviewProps {
  largeur: number;
  hauteur: number;
  epaisseur: number;
  drillingHoles?: boolean;
  entraxePotences?: number | null; // null = automatique aux extrémités
}

export function CaissonDoublePreview({
  largeur,
  hauteur,
  epaisseur,
  drillingHoles = true,
  entraxePotences = null,
}: CaissonDoublePreviewProps) {
  const preview = useMemo(() => {
    if (!largeur || !hauteur || !epaisseur) return null;

    const epaisseurParFace = epaisseur / 2;
    const largeurFinale = largeur + 2 * epaisseurParFace;
    const hauteurFinale = hauteur + 2 * epaisseurParFace;

    const maxWidth = 500;
    const maxHeight = 300;
    const scaleX = maxWidth / (largeurFinale * 2 + 30);
    const scaleY = maxHeight / hauteurFinale;
    const scale = Math.min(scaleX, scaleY, 0.25);

    const w = largeurFinale * scale;
    const h = hauteurFinale * scale;
    const espacement = 20 * scale;
    const svgWidth = w * 2 + espacement + 100;
    const svgHeight = h + 100;

    // Calcul des trous de perçage pour chaque face
    const holes: { x: number; y: number }[] = [];
    const distanceAngle = 50 * scale;
    const distanceBord = 25 * scale;
    const espacementMax = 750 * scale;
    const eP = epaisseurParFace * scale;
    const decoupe = (epaisseurParFace - 1) * scale;

    // Génère les trous pour une face
    const generateHoles = (offsetX: number, offsetY: number) => {
      const faceHoles: { x: number; y: number }[] = [];

      // Rabat haut
      const startXH = offsetX + decoupe + distanceAngle;
      const endXH = offsetX + w - decoupe - distanceAngle;
      const yH = offsetY + distanceBord;
      const lengthH = endXH - startXH;
      if (lengthH > 0) {
        const segments = Math.ceil(lengthH / espacementMax);
        const spacing = lengthH / segments;
        for (let i = 0; i <= segments; i++) {
          faceHoles.push({ x: startXH + i * spacing, y: yH });
        }
      }

      // Rabat bas
      const yB = offsetY + h - distanceBord;
      if (lengthH > 0) {
        const segments = Math.ceil(lengthH / espacementMax);
        const spacing = lengthH / segments;
        for (let i = 0; i <= segments; i++) {
          faceHoles.push({ x: startXH + i * spacing, y: yB });
        }
      }

      // Rabat gauche
      const startYG = offsetY + decoupe + distanceAngle;
      const endYG = offsetY + h - decoupe - distanceAngle;
      const xG = offsetX + distanceBord;
      const lengthG = endYG - startYG;
      if (lengthG > 0) {
        const segments = Math.ceil(lengthG / espacementMax);
        const spacing = lengthG / segments;
        for (let i = 0; i <= segments; i++) {
          faceHoles.push({ x: xG, y: startYG + i * spacing });
        }
      }

      // Rabat droite
      const xD = offsetX + w - distanceBord;
      if (lengthG > 0) {
        const segments = Math.ceil(lengthG / espacementMax);
        const spacing = lengthG / segments;
        for (let i = 0; i <= segments; i++) {
          faceHoles.push({ x: xD, y: startYG + i * spacing });
        }
      }

      return faceHoles;
    };

    // Calcul des positions des encoches potences
    // En mode auto : 10mm du bord de la face visible
    // En mode personnalisé : centrées avec l'entraxe spécifié
    const encocheHauteurMm = 34; // Hauteur de l'encoche en mm
    const margeEncocheMm = 10; // Marge standard entre encoche et bord face visible

    let encoche1Y: number; // Position Y de l'encoche haute (depuis le haut du SVG)
    let encoche2Y: number; // Position Y de l'encoche basse (depuis le haut du SVG)

    if (entraxePotences !== null && entraxePotences > 0) {
      // Mode personnalisé : centrer les encoches avec l'entraxe spécifié
      const centreY = h / 2;
      const demiEntraxe = (entraxePotences * scale) / 2;
      encoche1Y = centreY - demiEntraxe - (encocheHauteurMm * scale) / 2;
      encoche2Y = centreY + demiEntraxe - (encocheHauteurMm * scale) / 2;
    } else {
      // Mode auto : potences aux extrémités
      encoche1Y = eP + margeEncocheMm * scale;
      encoche2Y = h - eP - margeEncocheMm * scale - encocheHauteurMm * scale;
    }

    return {
      svgWidth,
      svgHeight,
      w,
      h,
      espacement,
      largeurFinale,
      hauteurFinale,
      epaisseurParFace,
      scale,
      eP,
      decoupe,
      generateHoles,
      encoche1Y,
      encoche2Y,
      encocheHauteur: encocheHauteurMm * scale,
    };
  }, [largeur, hauteur, epaisseur, entraxePotences]);

  if (!preview) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-100 rounded-lg text-slate-500">
        Entrez les dimensions pour voir l'aperçu
      </div>
    );
  }

  const { eP, decoupe, generateHoles, scale, encoche1Y, encoche2Y, encocheHauteur } = preview;

  // Encoches potences (16×34mm à l'échelle)
  const encocheLargeur = 16 * scale;

  const offsetX1 = 50;
  const offsetX2 = offsetX1 + preview.w + preview.espacement;
  const offsetY = 50;

  // Générer les trous pour les deux faces
  const holesRecto = drillingHoles ? generateHoles(offsetX1, offsetY) : [];
  const holesVerso = drillingHoles ? generateHoles(offsetX2, offsetY) : [];

  return (
    <div className="space-y-3">
      <div className="bg-slate-100 rounded-lg p-4 flex justify-center overflow-auto">
        <svg
          width={preview.svgWidth}
          height={preview.svgHeight}
          viewBox={`0 0 ${preview.svgWidth} ${preview.svgHeight}`}
          className="max-w-full"
        >
          {/* Grille */}
          <defs>
            <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid2)" />

          {/* Face Recto */}
          <g>
            <text x={offsetX1 + preview.w / 2} y={offsetY - 12} textAnchor="middle" className="text-[11px] fill-slate-600 font-medium">
              Face Recto
            </text>
            {/* Zone face visible */}
            <rect
              x={offsetX1 + eP}
              y={offsetY + eP}
              width={preview.w - 2 * eP}
              height={preview.h - 2 * eP}
              fill="#f1f5f9"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4"
            />
            {/* Dimensions face visible Recto */}
            <text
              x={offsetX1 + eP + (preview.w - 2 * eP) / 2}
              y={offsetY + eP + (preview.h - 2 * eP) / 2 - 4}
              textAnchor="middle"
              className="text-[9px] fill-slate-500"
            >
              Face visible
            </text>
            <text
              x={offsetX1 + eP + (preview.w - 2 * eP) / 2}
              y={offsetY + eP + (preview.h - 2 * eP) / 2 + 8}
              textAnchor="middle"
              className="text-[10px] fill-slate-700 font-medium"
            >
              {largeur} × {hauteur} mm
            </text>
            {/* Contour avec encoches potences (défonces) sur le côté droit - une en haut, une en bas */}
            <path
              d={`
                M ${offsetX1 + decoupe} ${offsetY}
                L ${offsetX1 + preview.w - decoupe} ${offsetY}
                L ${offsetX1 + preview.w - decoupe} ${offsetY + decoupe}
                L ${offsetX1 + preview.w} ${offsetY + decoupe}
                L ${offsetX1 + preview.w} ${offsetY + encoche1Y}
                L ${offsetX1 + preview.w - encocheLargeur} ${offsetY + encoche1Y}
                L ${offsetX1 + preview.w - encocheLargeur} ${offsetY + encoche1Y + encocheHauteur}
                L ${offsetX1 + preview.w} ${offsetY + encoche1Y + encocheHauteur}
                L ${offsetX1 + preview.w} ${offsetY + encoche2Y}
                L ${offsetX1 + preview.w - encocheLargeur} ${offsetY + encoche2Y}
                L ${offsetX1 + preview.w - encocheLargeur} ${offsetY + encoche2Y + encocheHauteur}
                L ${offsetX1 + preview.w} ${offsetY + encoche2Y + encocheHauteur}
                L ${offsetX1 + preview.w} ${offsetY + preview.h - decoupe}
                L ${offsetX1 + preview.w - decoupe} ${offsetY + preview.h - decoupe}
                L ${offsetX1 + preview.w - decoupe} ${offsetY + preview.h}
                L ${offsetX1 + decoupe} ${offsetY + preview.h}
                L ${offsetX1 + decoupe} ${offsetY + preview.h - decoupe}
                L ${offsetX1} ${offsetY + preview.h - decoupe}
                L ${offsetX1} ${offsetY + decoupe}
                L ${offsetX1 + decoupe} ${offsetY + decoupe}
                Z
              `}
              fill="none"
              stroke="#e91e63"
              strokeWidth="2"
              strokeDasharray="6,3"
            />
            {/* Rainures */}
            <line x1={offsetX1} y1={offsetY + eP} x2={offsetX1 + preview.w} y2={offsetY + eP} stroke="#2196f3" strokeWidth="1.5" />
            <line x1={offsetX1} y1={offsetY + preview.h - eP} x2={offsetX1 + preview.w} y2={offsetY + preview.h - eP} stroke="#2196f3" strokeWidth="1.5" />
            <line x1={offsetX1 + eP} y1={offsetY} x2={offsetX1 + eP} y2={offsetY + preview.h} stroke="#2196f3" strokeWidth="1.5" />
            <line x1={offsetX1 + preview.w - eP} y1={offsetY} x2={offsetX1 + preview.w - eP} y2={offsetY + preview.h} stroke="#2196f3" strokeWidth="1.5" />

            {/* Trous de perçage Recto */}
            {holesRecto.map((hole, i) => (
              <circle key={`recto-${i}`} cx={hole.x} cy={hole.y} r={Math.max(1.5 * preview.scale, 0.8)} fill="none" stroke="#4CAF50" strokeWidth="1" />
            ))}
          </g>

          {/* Face Verso (miroir) */}
          <g>
            <text x={offsetX2 + preview.w / 2} y={offsetY - 12} textAnchor="middle" className="text-[11px] fill-slate-600 font-medium">
              Face Verso
            </text>
            {/* Zone face visible */}
            <rect
              x={offsetX2 + eP}
              y={offsetY + eP}
              width={preview.w - 2 * eP}
              height={preview.h - 2 * eP}
              fill="#f1f5f9"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4"
            />
            {/* Dimensions face visible Verso */}
            <text
              x={offsetX2 + eP + (preview.w - 2 * eP) / 2}
              y={offsetY + eP + (preview.h - 2 * eP) / 2 - 4}
              textAnchor="middle"
              className="text-[9px] fill-slate-500"
            >
              Face visible
            </text>
            <text
              x={offsetX2 + eP + (preview.w - 2 * eP) / 2}
              y={offsetY + eP + (preview.h - 2 * eP) / 2 + 8}
              textAnchor="middle"
              className="text-[10px] fill-slate-700 font-medium"
            >
              {largeur} × {hauteur} mm
            </text>
            {/* Contour miroir avec encoches potences (défonces) sur le côté gauche - une en haut, une en bas */}
            <path
              d={`
                M ${offsetX2 + preview.w - decoupe} ${offsetY}
                L ${offsetX2 + decoupe} ${offsetY}
                L ${offsetX2 + decoupe} ${offsetY + decoupe}
                L ${offsetX2} ${offsetY + decoupe}
                L ${offsetX2} ${offsetY + encoche1Y}
                L ${offsetX2 + encocheLargeur} ${offsetY + encoche1Y}
                L ${offsetX2 + encocheLargeur} ${offsetY + encoche1Y + encocheHauteur}
                L ${offsetX2} ${offsetY + encoche1Y + encocheHauteur}
                L ${offsetX2} ${offsetY + encoche2Y}
                L ${offsetX2 + encocheLargeur} ${offsetY + encoche2Y}
                L ${offsetX2 + encocheLargeur} ${offsetY + encoche2Y + encocheHauteur}
                L ${offsetX2} ${offsetY + encoche2Y + encocheHauteur}
                L ${offsetX2} ${offsetY + preview.h - decoupe}
                L ${offsetX2 + decoupe} ${offsetY + preview.h - decoupe}
                L ${offsetX2 + decoupe} ${offsetY + preview.h}
                L ${offsetX2 + preview.w - decoupe} ${offsetY + preview.h}
                L ${offsetX2 + preview.w - decoupe} ${offsetY + preview.h - decoupe}
                L ${offsetX2 + preview.w} ${offsetY + preview.h - decoupe}
                L ${offsetX2 + preview.w} ${offsetY + decoupe}
                L ${offsetX2 + preview.w - decoupe} ${offsetY + decoupe}
                Z
              `}
              fill="none"
              stroke="#e91e63"
              strokeWidth="2"
              strokeDasharray="6,3"
            />
            {/* Rainures */}
            <line x1={offsetX2} y1={offsetY + eP} x2={offsetX2 + preview.w} y2={offsetY + eP} stroke="#2196f3" strokeWidth="1.5" />
            <line x1={offsetX2} y1={offsetY + preview.h - eP} x2={offsetX2 + preview.w} y2={offsetY + preview.h - eP} stroke="#2196f3" strokeWidth="1.5" />
            <line x1={offsetX2 + eP} y1={offsetY} x2={offsetX2 + eP} y2={offsetY + preview.h} stroke="#2196f3" strokeWidth="1.5" />
            <line x1={offsetX2 + preview.w - eP} y1={offsetY} x2={offsetX2 + preview.w - eP} y2={offsetY + preview.h} stroke="#2196f3" strokeWidth="1.5" />

            {/* Trous de perçage Verso */}
            {holesVerso.map((hole, i) => (
              <circle key={`verso-${i}`} cx={hole.x} cy={hole.y} r={Math.max(1.5 * preview.scale, 0.8)} fill="none" stroke="#4CAF50" strokeWidth="1" />
            ))}
          </g>

          {/* Dimensions */}
          <text
            x={offsetX1 + preview.w + preview.espacement / 2}
            y={offsetY + preview.h + 25}
            textAnchor="middle"
            className="text-xs fill-slate-600"
          >
            {preview.largeurFinale} × {preview.hauteurFinale} mm (×2)
          </text>
        </svg>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-pink-500" style={{ backgroundImage: "repeating-linear-gradient(90deg, #e91e63 0, #e91e63 6px, transparent 6px, transparent 9px)" }}></div>
          <span>Découpe</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span>Rainures</span>
        </div>
        {drillingHoles && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-green-500"></div>
            <span>Perçage Ø3mm</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-slate-200 border border-slate-400 border-dashed"></div>
          <span>Face visible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-4 border-2 border-pink-500" style={{ borderStyle: "dashed" }}></div>
          <span>Encoches potences 16×34mm</span>
        </div>
      </div>
    </div>
  );
}

// Preview pour caisson multi-parties (style simple face)
interface CaissonMultiPreviewProps {
  parts: PartData[];
  drillingHoles?: boolean;
  heightWarning?: boolean;
}

export function CaissonMultiPreview({ parts, drillingHoles = true, heightWarning = false }: CaissonMultiPreviewProps) {
  const preview = useMemo(() => {
    if (parts.length === 0) return null;

    // Vérifier si au moins une partie a des dimensions valides
    const hasValidDimensions = parts.some(p => p.largeur > 0 && p.hauteur > 0);
    if (!hasValidDimensions) return { noDimensions: true };

    // Calcul des dimensions de chaque partie
    const partsWithDims = parts.map((part) => {
      let eH = part.profondeur;
      let eB = part.profondeur;
      let eG = part.type === "left" ? part.profondeur : 0;
      let eD = part.type === "right" ? part.profondeur : 0;

      if (part.isMultiThickness && part.thickness) {
        eH = part.thickness.haut || 0;
        eB = part.thickness.bas || 0;
        eG = part.thickness.gauche || 0;
        eD = part.thickness.droite || 0;
      }

      const largeurFinale = part.largeur + eG + eD;
      const hauteurFinale = part.hauteur + eH + eB;

      return {
        ...part,
        largeurFinale,
        hauteurFinale,
        eH, eB, eG, eD,
      };
    });

    const totalWidth = partsWithDims.reduce((sum, p) => sum + p.largeurFinale, 0) + (parts.length - 1) * 20;
    const maxHeight = Math.max(...partsWithDims.map((p) => p.hauteurFinale), 1);

    const maxSvgWidth = 600;
    const maxSvgHeight = 300;
    const scaleX = maxSvgWidth / totalWidth;
    const scaleY = maxSvgHeight / maxHeight;
    const scale = Math.min(scaleX, scaleY, 0.25);

    const svgWidth = totalWidth * scale + 100;
    const svgHeight = maxHeight * scale + 100;

    return { partsWithDims, scale, svgWidth, svgHeight, maxHeight };
  }, [parts]);

  if (!preview || parts.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-100 rounded-lg text-slate-500">
        Ajoutez des parties pour voir l'aperçu global
      </div>
    );
  }

  if ('noDimensions' in preview) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-100 rounded-lg text-slate-500">
        Entrez les dimensions pour voir l'aperçu
      </div>
    );
  }

  const { partsWithDims, scale, svgWidth, svgHeight, maxHeight } = preview;
  let currentX = 50;

  return (
    <div className="space-y-3">
      {/* Avertissement hauteurs différentes */}
      {heightWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
          <span className="text-amber-600 flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-900">Hauteurs différentes détectées</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Les parties n'ont pas la même hauteur. Vérifiez que c'est intentionnel.
            </p>
          </div>
        </div>
      )}
      <div className="bg-slate-100 rounded-lg p-4 flex justify-center overflow-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="max-w-full"
        >
          {/* Grille de fond */}
          <defs>
            <pattern id="gridMulti" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridMulti)" />

          {partsWithDims.map((part, index) => {
            const w = part.largeurFinale * scale;
            const h = part.hauteurFinale * scale;
            const x = currentX;
            const y = 50 + (maxHeight * scale - h) / 2;

            const eH = part.eH * scale;
            const eB = part.eB * scale;
            const eG = part.eG * scale;
            const eD = part.eD * scale;

            // Découpes (épaisseur - 1mm)
            const decoupeH = part.eH > 0 ? (part.eH - 1) * scale : 0;
            const decoupeB = part.eB > 0 ? (part.eB - 1) * scale : 0;
            const decoupeG = part.eG > 0 ? (part.eG - 1) * scale : 0;
            const decoupeD = part.eD > 0 ? (part.eD - 1) * scale : 0;

            // Contour avec découpes
            const contourPath = `
              M ${x + decoupeG} ${y}
              L ${x + w - decoupeD} ${y}
              L ${x + w - decoupeD} ${y + decoupeH}
              L ${x + w} ${y + decoupeH}
              L ${x + w} ${y + h - decoupeB}
              L ${x + w - decoupeD} ${y + h - decoupeB}
              L ${x + w - decoupeD} ${y + h}
              L ${x + decoupeG} ${y + h}
              L ${x + decoupeG} ${y + h - decoupeB}
              L ${x} ${y + h - decoupeB}
              L ${x} ${y + decoupeH}
              L ${x + decoupeG} ${y + decoupeH}
              Z
            `;

            // Trous de perçage
            const holes: { hx: number; hy: number }[] = [];
            if (drillingHoles && part.drillingHoles) {
              const distanceAngle = 50 * scale;
              const distanceBord = 25 * scale;
              const espacementMax = 750 * scale;

              // Rabat haut
              if (part.eH > 0) {
                const startX = x + decoupeG + distanceAngle;
                const endX = x + w - decoupeD - distanceAngle;
                const hy = y + distanceBord;
                const length = endX - startX;
                if (length > 0) {
                  const segments = Math.ceil(length / espacementMax);
                  const spacing = length / segments;
                  for (let i = 0; i <= segments; i++) {
                    holes.push({ hx: startX + i * spacing, hy });
                  }
                }
              }

              // Rabat bas
              if (part.eB > 0) {
                const startX = x + decoupeG + distanceAngle;
                const endX = x + w - decoupeD - distanceAngle;
                const hy = y + h - distanceBord;
                const length = endX - startX;
                if (length > 0) {
                  const segments = Math.ceil(length / espacementMax);
                  const spacing = length / segments;
                  for (let i = 0; i <= segments; i++) {
                    holes.push({ hx: startX + i * spacing, hy });
                  }
                }
              }

              // Rabat gauche
              if (part.eG > 0) {
                const startY = y + decoupeH + distanceAngle;
                const endY = y + h - decoupeB - distanceAngle;
                const hx = x + distanceBord;
                const length = endY - startY;
                if (length > 0) {
                  const segments = Math.ceil(length / espacementMax);
                  const spacing = length / segments;
                  for (let i = 0; i <= segments; i++) {
                    holes.push({ hx, hy: startY + i * spacing });
                  }
                }
              }

              // Rabat droite
              if (part.eD > 0) {
                const startY = y + decoupeH + distanceAngle;
                const endY = y + h - decoupeB - distanceAngle;
                const hx = x + w - distanceBord;
                const length = endY - startY;
                if (length > 0) {
                  const segments = Math.ceil(length / espacementMax);
                  const spacing = length / segments;
                  for (let i = 0; i <= segments; i++) {
                    holes.push({ hx, hy: startY + i * spacing });
                  }
                }
              }
            }

            currentX += w + 20 * scale;

            const partLabel = part.type === "left" ? "Gauche" : part.type === "right" ? "Droite" : "Centre";

            return (
              <g key={index}>
                {/* Zone face visible */}
                <rect
                  x={x + eG}
                  y={y + eH}
                  width={w - eG - eD}
                  height={h - eH - eB}
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="4"
                />
                {/* Dimensions face visible */}
                <text
                  x={x + eG + (w - eG - eD) / 2}
                  y={y + eH + (h - eH - eB) / 2 - 4}
                  textAnchor="middle"
                  className="text-[8px] fill-slate-500"
                >
                  Face visible
                </text>
                <text
                  x={x + eG + (w - eG - eD) / 2}
                  y={y + eH + (h - eH - eB) / 2 + 6}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-700 font-medium"
                >
                  {part.largeur} × {part.hauteur} mm
                </text>

                {/* Contour principal (rose) */}
                <path
                  d={contourPath}
                  fill="none"
                  stroke="#e91e63"
                  strokeWidth="2"
                  strokeDasharray="6,3"
                />

                {/* Rainures horizontales */}
                {eH > 0 && (
                  <line x1={x} y1={y + eH} x2={x + w} y2={y + eH} stroke="#2196f3" strokeWidth="1.5" />
                )}
                {eB > 0 && (
                  <line x1={x} y1={y + h - eB} x2={x + w} y2={y + h - eB} stroke="#2196f3" strokeWidth="1.5" />
                )}

                {/* Rainures verticales */}
                {eG > 0 && (
                  <line x1={x + eG} y1={y} x2={x + eG} y2={y + h} stroke="#2196f3" strokeWidth="1.5" />
                )}
                {eD > 0 && (
                  <line x1={x + w - eD} y1={y} x2={x + w - eD} y2={y + h} stroke="#2196f3" strokeWidth="1.5" />
                )}

                {/* Trous de perçage */}
                {holes.map((hole, i) => (
                  <circle key={i} cx={hole.hx} cy={hole.hy} r={Math.max(1.5 * scale, 0.8)} fill="none" stroke="#4CAF50" strokeWidth="1" />
                ))}

                {/* Label et dimensions */}
                <text x={x + w / 2} y={y - 8} textAnchor="middle" className="text-[10px] fill-slate-600 font-medium">
                  {partLabel}
                </text>
                <text x={x + w / 2} y={y + h + 18} textAnchor="middle" className="text-[10px] fill-slate-500">
                  {part.largeurFinale} × {part.hauteurFinale} mm
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-pink-500" style={{ backgroundImage: "repeating-linear-gradient(90deg, #e91e63 0, #e91e63 6px, transparent 6px, transparent 9px)" }}></div>
          <span>Découpe</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span>Rainures</span>
        </div>
        {drillingHoles && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-green-500"></div>
            <span>Perçage</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-slate-200 border border-slate-400 border-dashed"></div>
          <span>Face visible</span>
        </div>
      </div>
    </div>
  );
}
