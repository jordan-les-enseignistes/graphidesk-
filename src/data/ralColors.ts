// Données RAL Classic avec valeurs CMYK, RGB et HEX
// Source: https://gist.github.com/lunohodov/1995178 (MIT License)

export interface RalColor {
  code: string;
  name: string;
  nameFr: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  cmyk: { c: number; m: number; y: number; k: number };
}

export const ralColors: RalColor[] = [
  // Jaunes (RAL 1xxx)
  { code: "RAL 1000", name: "Green beige", nameFr: "Beige vert", hex: "#CDBA88", rgb: { r: 205, g: 186, b: 136 }, cmyk: { c: 0, m: 9, y: 34, k: 20 } },
  { code: "RAL 1001", name: "Beige", nameFr: "Beige", hex: "#D0B084", rgb: { r: 208, g: 176, b: 132 }, cmyk: { c: 0, m: 15, y: 37, k: 18 } },
  { code: "RAL 1002", name: "Sand yellow", nameFr: "Jaune sable", hex: "#D2AA6D", rgb: { r: 210, g: 170, b: 109 }, cmyk: { c: 0, m: 19, y: 48, k: 18 } },
  { code: "RAL 1003", name: "Signal yellow", nameFr: "Jaune de sécurité", hex: "#F9A800", rgb: { r: 249, g: 168, b: 0 }, cmyk: { c: 0, m: 33, y: 100, k: 2 } },
  { code: "RAL 1004", name: "Golden yellow", nameFr: "Jaune or", hex: "#E49E00", rgb: { r: 228, g: 158, b: 0 }, cmyk: { c: 0, m: 31, y: 100, k: 11 } },
  { code: "RAL 1005", name: "Honey yellow", nameFr: "Jaune miel", hex: "#CB8E00", rgb: { r: 203, g: 142, b: 0 }, cmyk: { c: 0, m: 30, y: 100, k: 20 } },
  { code: "RAL 1006", name: "Maize yellow", nameFr: "Jaune maïs", hex: "#E29000", rgb: { r: 226, g: 144, b: 0 }, cmyk: { c: 0, m: 36, y: 100, k: 11 } },
  { code: "RAL 1007", name: "Daffodil yellow", nameFr: "Jaune narcisse", hex: "#E88C00", rgb: { r: 232, g: 140, b: 0 }, cmyk: { c: 0, m: 40, y: 100, k: 9 } },
  { code: "RAL 1011", name: "Brown beige", nameFr: "Beige brun", hex: "#AF804F", rgb: { r: 175, g: 128, b: 79 }, cmyk: { c: 0, m: 27, y: 55, k: 31 } },
  { code: "RAL 1012", name: "Lemon yellow", nameFr: "Jaune citron", hex: "#DDAF27", rgb: { r: 221, g: 175, b: 39 }, cmyk: { c: 0, m: 21, y: 82, k: 13 } },
  { code: "RAL 1013", name: "Oyster white", nameFr: "Blanc perlé", hex: "#E3D9C6", rgb: { r: 227, g: 217, b: 198 }, cmyk: { c: 0, m: 4, y: 13, k: 11 } },
  { code: "RAL 1014", name: "Ivory", nameFr: "Ivoire", hex: "#DDC49A", rgb: { r: 221, g: 196, b: 154 }, cmyk: { c: 0, m: 11, y: 30, k: 13 } },
  { code: "RAL 1015", name: "Light ivory", nameFr: "Ivoire clair", hex: "#E6D2B5", rgb: { r: 230, g: 210, b: 181 }, cmyk: { c: 0, m: 9, y: 21, k: 10 } },
  { code: "RAL 1016", name: "Sulfur yellow", nameFr: "Jaune soufre", hex: "#F1DD38", rgb: { r: 241, g: 221, b: 56 }, cmyk: { c: 0, m: 8, y: 77, k: 5 } },
  { code: "RAL 1017", name: "Saffron yellow", nameFr: "Jaune safran", hex: "#F6A950", rgb: { r: 246, g: 169, b: 80 }, cmyk: { c: 0, m: 31, y: 67, k: 4 } },
  { code: "RAL 1018", name: "Zinc yellow", nameFr: "Jaune zinc", hex: "#FACA30", rgb: { r: 250, g: 202, b: 48 }, cmyk: { c: 0, m: 19, y: 81, k: 2 } },
  { code: "RAL 1019", name: "Grey beige", nameFr: "Beige gris", hex: "#A48F7A", rgb: { r: 164, g: 143, b: 122 }, cmyk: { c: 0, m: 13, y: 26, k: 36 } },
  { code: "RAL 1020", name: "Olive yellow", nameFr: "Jaune olive", hex: "#A08F65", rgb: { r: 160, g: 143, b: 101 }, cmyk: { c: 0, m: 11, y: 37, k: 37 } },
  { code: "RAL 1021", name: "Rape yellow", nameFr: "Jaune colza", hex: "#F6B600", rgb: { r: 246, g: 182, b: 0 }, cmyk: { c: 0, m: 26, y: 100, k: 4 } },
  { code: "RAL 1023", name: "Traffic yellow", nameFr: "Jaune signalisation", hex: "#F7B500", rgb: { r: 247, g: 181, b: 0 }, cmyk: { c: 0, m: 27, y: 100, k: 3 } },
  { code: "RAL 1024", name: "Ochre yellow", nameFr: "Jaune ocre", hex: "#BA8F4C", rgb: { r: 186, g: 143, b: 76 }, cmyk: { c: 0, m: 23, y: 59, k: 27 } },
  { code: "RAL 1026", name: "Luminous yellow", nameFr: "Jaune brillant", hex: "#FFFF00", rgb: { r: 255, g: 255, b: 0 }, cmyk: { c: 0, m: 0, y: 100, k: 0 } },
  { code: "RAL 1027", name: "Curry", nameFr: "Jaune curry", hex: "#A77F0E", rgb: { r: 167, g: 127, b: 14 }, cmyk: { c: 0, m: 24, y: 92, k: 35 } },
  { code: "RAL 1028", name: "Melon yellow", nameFr: "Jaune melon", hex: "#FF9B00", rgb: { r: 255, g: 155, b: 0 }, cmyk: { c: 0, m: 39, y: 100, k: 0 } },
  { code: "RAL 1032", name: "Broom yellow", nameFr: "Jaune genêt", hex: "#DDB20F", rgb: { r: 221, g: 178, b: 15 }, cmyk: { c: 0, m: 19, y: 93, k: 13 } },
  { code: "RAL 1033", name: "Dahlia yellow", nameFr: "Jaune dahlia", hex: "#FAAB21", rgb: { r: 250, g: 171, b: 33 }, cmyk: { c: 0, m: 32, y: 87, k: 2 } },
  { code: "RAL 1034", name: "Pastel yellow", nameFr: "Jaune pastel", hex: "#EDAB56", rgb: { r: 237, g: 171, b: 86 }, cmyk: { c: 0, m: 28, y: 64, k: 7 } },
  { code: "RAL 1035", name: "Pearl beige", nameFr: "Beige nacré", hex: "#908370", rgb: { r: 144, g: 131, b: 112 }, cmyk: { c: 0, m: 9, y: 22, k: 44 } },
  { code: "RAL 1036", name: "Pearl gold", nameFr: "Or nacré", hex: "#80643F", rgb: { r: 128, g: 100, b: 63 }, cmyk: { c: 0, m: 22, y: 51, k: 50 } },
  { code: "RAL 1037", name: "Sun yellow", nameFr: "Jaune soleil", hex: "#F09200", rgb: { r: 240, g: 146, b: 0 }, cmyk: { c: 0, m: 39, y: 100, k: 6 } },

  // Oranges (RAL 2xxx)
  { code: "RAL 2000", name: "Yellow orange", nameFr: "Orangé jaune", hex: "#DD7907", rgb: { r: 221, g: 121, b: 7 }, cmyk: { c: 0, m: 45, y: 97, k: 13 } },
  { code: "RAL 2001", name: "Red orange", nameFr: "Orangé rouge", hex: "#BE4E20", rgb: { r: 190, g: 78, b: 32 }, cmyk: { c: 0, m: 59, y: 83, k: 25 } },
  { code: "RAL 2002", name: "Vermilion", nameFr: "Orangé sang", hex: "#C63927", rgb: { r: 198, g: 57, b: 39 }, cmyk: { c: 0, m: 71, y: 80, k: 22 } },
  { code: "RAL 2003", name: "Pastel orange", nameFr: "Orangé pastel", hex: "#FA842B", rgb: { r: 250, g: 132, b: 43 }, cmyk: { c: 0, m: 47, y: 83, k: 2 } },
  { code: "RAL 2004", name: "Pure orange", nameFr: "Orangé pur", hex: "#E75B12", rgb: { r: 231, g: 91, b: 18 }, cmyk: { c: 0, m: 61, y: 92, k: 9 } },
  { code: "RAL 2005", name: "Luminous orange", nameFr: "Orangé brillant", hex: "#FF2300", rgb: { r: 255, g: 35, b: 0 }, cmyk: { c: 0, m: 86, y: 100, k: 0 } },
  { code: "RAL 2007", name: "Luminous bright orange", nameFr: "Orangé clair brillant", hex: "#FFA421", rgb: { r: 255, g: 164, b: 33 }, cmyk: { c: 0, m: 36, y: 87, k: 0 } },
  { code: "RAL 2008", name: "Bright red orange", nameFr: "Orangé rouge clair", hex: "#F3752C", rgb: { r: 243, g: 117, b: 44 }, cmyk: { c: 0, m: 52, y: 82, k: 5 } },
  { code: "RAL 2009", name: "Traffic orange", nameFr: "Orangé signalisation", hex: "#E15501", rgb: { r: 225, g: 85, b: 1 }, cmyk: { c: 0, m: 62, y: 100, k: 12 } },
  { code: "RAL 2010", name: "Signal orange", nameFr: "Orangé de sécurité", hex: "#D4652F", rgb: { r: 212, g: 101, b: 47 }, cmyk: { c: 0, m: 52, y: 78, k: 17 } },
  { code: "RAL 2011", name: "Deep orange", nameFr: "Orangé foncé", hex: "#EC7C25", rgb: { r: 236, g: 124, b: 37 }, cmyk: { c: 0, m: 47, y: 84, k: 7 } },
  { code: "RAL 2012", name: "Salmon orange", nameFr: "Orangé saumon", hex: "#DB6A50", rgb: { r: 219, g: 106, b: 80 }, cmyk: { c: 0, m: 52, y: 63, k: 14 } },
  { code: "RAL 2013", name: "Pearl orange", nameFr: "Orangé nacré", hex: "#954527", rgb: { r: 149, g: 69, b: 39 }, cmyk: { c: 0, m: 54, y: 74, k: 42 } },

  // Rouges (RAL 3xxx)
  { code: "RAL 3000", name: "Flame red", nameFr: "Rouge feu", hex: "#AB2524", rgb: { r: 171, g: 37, b: 36 }, cmyk: { c: 0, m: 78, y: 79, k: 33 } },
  { code: "RAL 3001", name: "Signal red", nameFr: "Rouge de sécurité", hex: "#A02128", rgb: { r: 160, g: 33, b: 40 }, cmyk: { c: 0, m: 79, y: 75, k: 37 } },
  { code: "RAL 3002", name: "Carmine red", nameFr: "Rouge carmin", hex: "#A1232B", rgb: { r: 161, g: 35, b: 43 }, cmyk: { c: 0, m: 78, y: 73, k: 37 } },
  { code: "RAL 3003", name: "Ruby red", nameFr: "Rouge rubis", hex: "#8D1D2C", rgb: { r: 141, g: 29, b: 44 }, cmyk: { c: 0, m: 79, y: 69, k: 45 } },
  { code: "RAL 3004", name: "Purple red", nameFr: "Rouge pourpre", hex: "#701F29", rgb: { r: 112, g: 31, b: 41 }, cmyk: { c: 0, m: 72, y: 63, k: 56 } },
  { code: "RAL 3005", name: "Wine red", nameFr: "Rouge vin", hex: "#5E2028", rgb: { r: 94, g: 32, b: 40 }, cmyk: { c: 0, m: 66, y: 57, k: 63 } },
  { code: "RAL 3007", name: "Black red", nameFr: "Rouge noir", hex: "#402225", rgb: { r: 64, g: 34, b: 37 }, cmyk: { c: 0, m: 47, y: 42, k: 75 } },
  { code: "RAL 3009", name: "Oxide red", nameFr: "Rouge oxyde", hex: "#6D342D", rgb: { r: 109, g: 52, b: 45 }, cmyk: { c: 0, m: 52, y: 59, k: 57 } },
  { code: "RAL 3011", name: "Brown red", nameFr: "Rouge brun", hex: "#7E292C", rgb: { r: 126, g: 41, b: 44 }, cmyk: { c: 0, m: 67, y: 65, k: 51 } },
  { code: "RAL 3012", name: "Beige red", nameFr: "Rouge beige", hex: "#CB8D73", rgb: { r: 203, g: 141, b: 115 }, cmyk: { c: 0, m: 31, y: 43, k: 20 } },
  { code: "RAL 3013", name: "Tomato red", nameFr: "Rouge tomate", hex: "#9C322E", rgb: { r: 156, g: 50, b: 46 }, cmyk: { c: 0, m: 68, y: 71, k: 39 } },
  { code: "RAL 3014", name: "Antique pink", nameFr: "Vieux rose", hex: "#D47479", rgb: { r: 212, g: 116, b: 121 }, cmyk: { c: 0, m: 45, y: 43, k: 17 } },
  { code: "RAL 3015", name: "Light pink", nameFr: "Rose clair", hex: "#E1A6AD", rgb: { r: 225, g: 166, b: 173 }, cmyk: { c: 0, m: 26, y: 23, k: 12 } },
  { code: "RAL 3016", name: "Coral red", nameFr: "Rouge corail", hex: "#AC4034", rgb: { r: 172, g: 64, b: 52 }, cmyk: { c: 0, m: 63, y: 70, k: 33 } },
  { code: "RAL 3017", name: "Rose", nameFr: "Rosé", hex: "#D3545F", rgb: { r: 211, g: 84, b: 95 }, cmyk: { c: 0, m: 60, y: 55, k: 17 } },
  { code: "RAL 3018", name: "Strawberry red", nameFr: "Rouge fraise", hex: "#D14152", rgb: { r: 209, g: 65, b: 82 }, cmyk: { c: 0, m: 69, y: 61, k: 18 } },
  { code: "RAL 3020", name: "Traffic red", nameFr: "Rouge signalisation", hex: "#C1121C", rgb: { r: 193, g: 18, b: 28 }, cmyk: { c: 0, m: 91, y: 86, k: 24 } },
  { code: "RAL 3022", name: "Salmon pink", nameFr: "Rose saumon", hex: "#D56D56", rgb: { r: 213, g: 109, b: 86 }, cmyk: { c: 0, m: 49, y: 60, k: 16 } },
  { code: "RAL 3024", name: "Luminous red", nameFr: "Rouge brillant", hex: "#F70000", rgb: { r: 247, g: 0, b: 0 }, cmyk: { c: 0, m: 100, y: 100, k: 3 } },
  { code: "RAL 3026", name: "Luminous bright red", nameFr: "Rouge clair brillant", hex: "#FF0000", rgb: { r: 255, g: 0, b: 0 }, cmyk: { c: 0, m: 100, y: 100, k: 0 } },
  { code: "RAL 3027", name: "Raspberry red", nameFr: "Rouge framboise", hex: "#B42041", rgb: { r: 180, g: 32, b: 65 }, cmyk: { c: 0, m: 82, y: 64, k: 29 } },
  { code: "RAL 3028", name: "Pure red", nameFr: "Rouge pur", hex: "#CC2C24", rgb: { r: 204, g: 44, b: 36 }, cmyk: { c: 0, m: 78, y: 82, k: 20 } },
  { code: "RAL 3031", name: "Orient red", nameFr: "Rouge oriental", hex: "#B32821", rgb: { r: 179, g: 40, b: 33 }, cmyk: { c: 0, m: 78, y: 82, k: 30 } },
  { code: "RAL 3032", name: "Pearl ruby red", nameFr: "Rouge rubis nacré", hex: "#711521", rgb: { r: 113, g: 21, b: 33 }, cmyk: { c: 0, m: 81, y: 71, k: 56 } },
  { code: "RAL 3033", name: "Pearl pink", nameFr: "Rose nacré", hex: "#B24C43", rgb: { r: 178, g: 76, b: 67 }, cmyk: { c: 0, m: 57, y: 62, k: 30 } },

  // Violets (RAL 4xxx)
  { code: "RAL 4001", name: "Red lilac", nameFr: "Lilas rouge", hex: "#8A5A83", rgb: { r: 138, g: 90, b: 131 }, cmyk: { c: 0, m: 35, y: 5, k: 46 } },
  { code: "RAL 4002", name: "Red violet", nameFr: "Violet rouge", hex: "#933D50", rgb: { r: 147, g: 61, b: 80 }, cmyk: { c: 0, m: 59, y: 46, k: 42 } },
  { code: "RAL 4003", name: "Heather violet", nameFr: "Violet bruyère", hex: "#D15B8F", rgb: { r: 209, g: 91, b: 143 }, cmyk: { c: 0, m: 56, y: 32, k: 18 } },
  { code: "RAL 4004", name: "Claret violet", nameFr: "Violet bordeaux", hex: "#691639", rgb: { r: 105, g: 22, b: 57 }, cmyk: { c: 0, m: 79, y: 46, k: 59 } },
  { code: "RAL 4005", name: "Blue lilac", nameFr: "Lilas bleu", hex: "#83639D", rgb: { r: 131, g: 99, b: 157 }, cmyk: { c: 17, m: 37, y: 0, k: 38 } },
  { code: "RAL 4006", name: "Traffic purple", nameFr: "Pourpre signalisation", hex: "#992572", rgb: { r: 153, g: 37, b: 114 }, cmyk: { c: 0, m: 76, y: 25, k: 40 } },
  { code: "RAL 4007", name: "Purple violet", nameFr: "Violet pourpre", hex: "#4A203B", rgb: { r: 74, g: 32, b: 59 }, cmyk: { c: 0, m: 57, y: 20, k: 71 } },
  { code: "RAL 4008", name: "Signal violet", nameFr: "Violet de sécurité", hex: "#904684", rgb: { r: 144, g: 70, b: 132 }, cmyk: { c: 0, m: 51, y: 8, k: 44 } },
  { code: "RAL 4009", name: "Pastel violet", nameFr: "Violet pastel", hex: "#A38995", rgb: { r: 163, g: 137, b: 149 }, cmyk: { c: 0, m: 16, y: 9, k: 36 } },
  { code: "RAL 4010", name: "Telemagenta", nameFr: "Télémagenta", hex: "#C63678", rgb: { r: 198, g: 54, b: 120 }, cmyk: { c: 0, m: 73, y: 39, k: 22 } },
  { code: "RAL 4011", name: "Pearl violet", nameFr: "Violet nacré", hex: "#8773A1", rgb: { r: 135, g: 115, b: 161 }, cmyk: { c: 16, m: 29, y: 0, k: 37 } },
  { code: "RAL 4012", name: "Pearl blackberry", nameFr: "Mûre nacré", hex: "#6B6880", rgb: { r: 107, g: 104, b: 128 }, cmyk: { c: 16, m: 19, y: 0, k: 50 } },

  // Bleus (RAL 5xxx)
  { code: "RAL 5000", name: "Violet blue", nameFr: "Bleu violet", hex: "#384C70", rgb: { r: 56, g: 76, b: 112 }, cmyk: { c: 50, m: 32, y: 0, k: 56 } },
  { code: "RAL 5001", name: "Green blue", nameFr: "Bleu vert", hex: "#1F4764", rgb: { r: 31, g: 71, b: 100 }, cmyk: { c: 69, m: 29, y: 0, k: 61 } },
  { code: "RAL 5002", name: "Ultramarine blue", nameFr: "Bleu outremer", hex: "#2B2C7C", rgb: { r: 43, g: 44, b: 124 }, cmyk: { c: 65, m: 65, y: 0, k: 51 } },
  { code: "RAL 5003", name: "Sapphire blue", nameFr: "Bleu saphir", hex: "#2A3756", rgb: { r: 42, g: 55, b: 86 }, cmyk: { c: 51, m: 36, y: 0, k: 66 } },
  { code: "RAL 5004", name: "Black blue", nameFr: "Bleu noir", hex: "#1D1F2A", rgb: { r: 29, g: 31, b: 42 }, cmyk: { c: 31, m: 26, y: 0, k: 84 } },
  { code: "RAL 5005", name: "Signal blue", nameFr: "Bleu de sécurité", hex: "#154889", rgb: { r: 21, g: 72, b: 137 }, cmyk: { c: 85, m: 47, y: 0, k: 46 } },
  { code: "RAL 5007", name: "Brilliant blue", nameFr: "Bleu brillant", hex: "#41678D", rgb: { r: 65, g: 103, b: 141 }, cmyk: { c: 54, m: 27, y: 0, k: 45 } },
  { code: "RAL 5008", name: "Grey blue", nameFr: "Bleu gris", hex: "#313C48", rgb: { r: 49, g: 60, b: 72 }, cmyk: { c: 32, m: 17, y: 0, k: 72 } },
  { code: "RAL 5009", name: "Azure blue", nameFr: "Bleu azur", hex: "#2E5978", rgb: { r: 46, g: 89, b: 120 }, cmyk: { c: 62, m: 26, y: 0, k: 53 } },
  { code: "RAL 5010", name: "Gentian blue", nameFr: "Bleu gentiane", hex: "#13447C", rgb: { r: 19, g: 68, b: 124 }, cmyk: { c: 85, m: 45, y: 0, k: 51 } },
  { code: "RAL 5011", name: "Steel blue", nameFr: "Bleu acier", hex: "#232C3F", rgb: { r: 35, g: 44, b: 63 }, cmyk: { c: 44, m: 30, y: 0, k: 75 } },
  { code: "RAL 5012", name: "Light blue", nameFr: "Bleu clair", hex: "#3481B8", rgb: { r: 52, g: 129, b: 184 }, cmyk: { c: 72, m: 30, y: 0, k: 28 } },
  { code: "RAL 5013", name: "Cobalt blue", nameFr: "Bleu cobalt", hex: "#232D53", rgb: { r: 35, g: 45, b: 83 }, cmyk: { c: 58, m: 46, y: 0, k: 67 } },
  { code: "RAL 5014", name: "Pigeon blue", nameFr: "Bleu pigeon", hex: "#6C7C98", rgb: { r: 108, g: 124, b: 152 }, cmyk: { c: 29, m: 18, y: 0, k: 40 } },
  { code: "RAL 5015", name: "Sky blue", nameFr: "Bleu ciel", hex: "#2874B2", rgb: { r: 40, g: 116, b: 178 }, cmyk: { c: 78, m: 35, y: 0, k: 30 } },
  { code: "RAL 5017", name: "Traffic blue", nameFr: "Bleu signalisation", hex: "#0E518D", rgb: { r: 14, g: 81, b: 141 }, cmyk: { c: 90, m: 43, y: 0, k: 45 } },
  { code: "RAL 5018", name: "Turquoise blue", nameFr: "Bleu turquoise", hex: "#21888F", rgb: { r: 33, g: 136, b: 143 }, cmyk: { c: 77, m: 5, y: 0, k: 44 } },
  { code: "RAL 5019", name: "Capri blue", nameFr: "Bleu capri", hex: "#1A5784", rgb: { r: 26, g: 87, b: 132 }, cmyk: { c: 80, m: 34, y: 0, k: 48 } },
  { code: "RAL 5020", name: "Ocean blue", nameFr: "Bleu océan", hex: "#0B4151", rgb: { r: 11, g: 65, b: 81 }, cmyk: { c: 86, m: 20, y: 0, k: 68 } },
  { code: "RAL 5021", name: "Water blue", nameFr: "Bleu d'eau", hex: "#07737A", rgb: { r: 7, g: 115, b: 122 }, cmyk: { c: 94, m: 6, y: 0, k: 52 } },
  { code: "RAL 5022", name: "Night blue", nameFr: "Bleu nocturne", hex: "#2F2A5A", rgb: { r: 47, g: 42, b: 90 }, cmyk: { c: 48, m: 53, y: 0, k: 65 } },
  { code: "RAL 5023", name: "Distant blue", nameFr: "Bleu distant", hex: "#4D668E", rgb: { r: 77, g: 102, b: 142 }, cmyk: { c: 46, m: 28, y: 0, k: 44 } },
  { code: "RAL 5024", name: "Pastel blue", nameFr: "Bleu pastel", hex: "#6A93B0", rgb: { r: 106, g: 147, b: 176 }, cmyk: { c: 40, m: 16, y: 0, k: 31 } },
  { code: "RAL 5025", name: "Pearl gentian blue", nameFr: "Bleu gentiane nacré", hex: "#21697C", rgb: { r: 33, g: 105, b: 124 }, cmyk: { c: 73, m: 15, y: 0, k: 51 } },
  { code: "RAL 5026", name: "Pearl night blue", nameFr: "Bleu nuit nacré", hex: "#102C54", rgb: { r: 16, g: 44, b: 84 }, cmyk: { c: 81, m: 48, y: 0, k: 67 } },

  // Verts (RAL 6xxx)
  { code: "RAL 6000", name: "Patina green", nameFr: "Vert patine", hex: "#327662", rgb: { r: 50, g: 118, b: 98 }, cmyk: { c: 58, m: 0, y: 17, k: 54 } },
  { code: "RAL 6001", name: "Emerald green", nameFr: "Vert émeraude", hex: "#28713E", rgb: { r: 40, g: 113, b: 62 }, cmyk: { c: 65, m: 0, y: 45, k: 56 } },
  { code: "RAL 6002", name: "Leaf green", nameFr: "Vert feuillage", hex: "#276235", rgb: { r: 39, g: 98, b: 53 }, cmyk: { c: 60, m: 0, y: 46, k: 62 } },
  { code: "RAL 6003", name: "Olive green", nameFr: "Vert olive", hex: "#4B573E", rgb: { r: 75, g: 87, b: 62 }, cmyk: { c: 14, m: 0, y: 29, k: 66 } },
  { code: "RAL 6004", name: "Blue green", nameFr: "Vert bleu", hex: "#0E4243", rgb: { r: 14, g: 66, b: 67 }, cmyk: { c: 79, m: 1, y: 0, k: 74 } },
  { code: "RAL 6005", name: "Moss green", nameFr: "Vert mousse", hex: "#0F4336", rgb: { r: 15, g: 67, b: 54 }, cmyk: { c: 78, m: 0, y: 19, k: 74 } },
  { code: "RAL 6006", name: "Grey olive", nameFr: "Olive gris", hex: "#40433B", rgb: { r: 64, g: 67, b: 59 }, cmyk: { c: 4, m: 0, y: 12, k: 74 } },
  { code: "RAL 6007", name: "Bottle green", nameFr: "Vert bouteille", hex: "#283424", rgb: { r: 40, g: 52, b: 36 }, cmyk: { c: 23, m: 0, y: 31, k: 80 } },
  { code: "RAL 6008", name: "Brown green", nameFr: "Vert brun", hex: "#35382E", rgb: { r: 53, g: 56, b: 46 }, cmyk: { c: 5, m: 0, y: 18, k: 78 } },
  { code: "RAL 6009", name: "Fir green", nameFr: "Vert sapin", hex: "#26392F", rgb: { r: 38, g: 57, b: 47 }, cmyk: { c: 33, m: 0, y: 18, k: 78 } },
  { code: "RAL 6010", name: "Grass green", nameFr: "Vert herbe", hex: "#3E753B", rgb: { r: 62, g: 117, b: 59 }, cmyk: { c: 47, m: 0, y: 50, k: 54 } },
  { code: "RAL 6011", name: "Reseda green", nameFr: "Vert réséda", hex: "#68825B", rgb: { r: 104, g: 130, b: 91 }, cmyk: { c: 20, m: 0, y: 30, k: 49 } },
  { code: "RAL 6012", name: "Black green", nameFr: "Vert noir", hex: "#31403D", rgb: { r: 49, g: 64, b: 61 }, cmyk: { c: 23, m: 0, y: 5, k: 75 } },
  { code: "RAL 6013", name: "Reed green", nameFr: "Vert jonc", hex: "#7E8B64", rgb: { r: 126, g: 139, b: 100 }, cmyk: { c: 9, m: 0, y: 28, k: 45 } },
  { code: "RAL 6014", name: "Yellow olive", nameFr: "Olive jaune", hex: "#47402E", rgb: { r: 71, g: 64, b: 46 }, cmyk: { c: 0, m: 10, y: 35, k: 72 } },
  { code: "RAL 6015", name: "Black olive", nameFr: "Olive noir", hex: "#3D403A", rgb: { r: 61, g: 64, b: 58 }, cmyk: { c: 5, m: 0, y: 9, k: 75 } },
  { code: "RAL 6016", name: "Turquoise green", nameFr: "Vert turquoise", hex: "#026A52", rgb: { r: 2, g: 106, b: 82 }, cmyk: { c: 98, m: 0, y: 23, k: 58 } },
  { code: "RAL 6017", name: "May green", nameFr: "Vert mai", hex: "#587F40", rgb: { r: 88, g: 127, b: 64 }, cmyk: { c: 31, m: 0, y: 50, k: 50 } },
  { code: "RAL 6018", name: "Yellow green", nameFr: "Vert jaune", hex: "#61993B", rgb: { r: 97, g: 153, b: 59 }, cmyk: { c: 37, m: 0, y: 61, k: 40 } },
  { code: "RAL 6019", name: "Pastel green", nameFr: "Vert pastel", hex: "#B7D9B1", rgb: { r: 183, g: 217, b: 177 }, cmyk: { c: 16, m: 0, y: 18, k: 15 } },
  { code: "RAL 6020", name: "Chrome green", nameFr: "Vert oxyde chromique", hex: "#35382E", rgb: { r: 53, g: 56, b: 46 }, cmyk: { c: 5, m: 0, y: 18, k: 78 } },
  { code: "RAL 6021", name: "Pale green", nameFr: "Vert pâle", hex: "#86A47C", rgb: { r: 134, g: 164, b: 124 }, cmyk: { c: 18, m: 0, y: 24, k: 36 } },
  { code: "RAL 6022", name: "Olive drab", nameFr: "Olive brun", hex: "#3E3C32", rgb: { r: 62, g: 60, b: 50 }, cmyk: { c: 0, m: 3, y: 19, k: 76 } },
  { code: "RAL 6024", name: "Traffic green", nameFr: "Vert signalisation", hex: "#008754", rgb: { r: 0, g: 135, b: 84 }, cmyk: { c: 100, m: 0, y: 38, k: 47 } },
  { code: "RAL 6025", name: "Fern green", nameFr: "Vert fougère", hex: "#53753C", rgb: { r: 83, g: 117, b: 60 }, cmyk: { c: 29, m: 0, y: 49, k: 54 } },
  { code: "RAL 6026", name: "Opal green", nameFr: "Vert opale", hex: "#005F4E", rgb: { r: 0, g: 95, b: 78 }, cmyk: { c: 100, m: 0, y: 18, k: 63 } },
  { code: "RAL 6027", name: "Light green", nameFr: "Vert clair", hex: "#7EBAB5", rgb: { r: 126, g: 186, b: 181 }, cmyk: { c: 32, m: 0, y: 3, k: 27 } },
  { code: "RAL 6028", name: "Pine green", nameFr: "Vert pin", hex: "#2D5546", rgb: { r: 45, g: 85, b: 70 }, cmyk: { c: 47, m: 0, y: 18, k: 67 } },
  { code: "RAL 6029", name: "Mint green", nameFr: "Vert menthe", hex: "#007243", rgb: { r: 0, g: 114, b: 67 }, cmyk: { c: 100, m: 0, y: 41, k: 55 } },
  { code: "RAL 6032", name: "Signal green", nameFr: "Vert de sécurité", hex: "#0F8558", rgb: { r: 15, g: 133, b: 88 }, cmyk: { c: 89, m: 0, y: 34, k: 48 } },
  { code: "RAL 6033", name: "Mint turquoise", nameFr: "Turquoise menthe", hex: "#478A84", rgb: { r: 71, g: 138, b: 132 }, cmyk: { c: 49, m: 0, y: 4, k: 46 } },
  { code: "RAL 6034", name: "Pastel turquoise", nameFr: "Turquoise pastel", hex: "#7FB0B2", rgb: { r: 127, g: 176, b: 178 }, cmyk: { c: 29, m: 1, y: 0, k: 30 } },
  { code: "RAL 6035", name: "Pearl green", nameFr: "Vert nacré", hex: "#194D25", rgb: { r: 25, g: 77, b: 37 }, cmyk: { c: 68, m: 0, y: 52, k: 70 } },
  { code: "RAL 6036", name: "Pearl opal green", nameFr: "Vert opal nacré", hex: "#04574B", rgb: { r: 4, g: 87, b: 75 }, cmyk: { c: 95, m: 0, y: 14, k: 66 } },
  { code: "RAL 6037", name: "Pure green", nameFr: "Vert pur", hex: "#008B29", rgb: { r: 0, g: 139, b: 41 }, cmyk: { c: 100, m: 0, y: 70, k: 45 } },
  { code: "RAL 6038", name: "Luminous green", nameFr: "Vert brillant", hex: "#00B51A", rgb: { r: 0, g: 181, b: 26 }, cmyk: { c: 100, m: 0, y: 86, k: 29 } },

  // Gris (RAL 7xxx)
  { code: "RAL 7000", name: "Squirrel grey", nameFr: "Gris petit-gris", hex: "#7A888E", rgb: { r: 122, g: 136, b: 142 }, cmyk: { c: 14, m: 4, y: 0, k: 44 } },
  { code: "RAL 7001", name: "Silver grey", nameFr: "Gris argent", hex: "#8F999F", rgb: { r: 143, g: 153, b: 159 }, cmyk: { c: 10, m: 4, y: 0, k: 38 } },
  { code: "RAL 7002", name: "Olive grey", nameFr: "Gris olive", hex: "#817F68", rgb: { r: 129, g: 127, b: 104 }, cmyk: { c: 0, m: 2, y: 19, k: 49 } },
  { code: "RAL 7003", name: "Moss grey", nameFr: "Gris mousse", hex: "#7A7B6D", rgb: { r: 122, g: 123, b: 109 }, cmyk: { c: 1, m: 0, y: 11, k: 52 } },
  { code: "RAL 7004", name: "Signal grey", nameFr: "Gris de sécurité", hex: "#9EA0A1", rgb: { r: 158, g: 160, b: 161 }, cmyk: { c: 2, m: 1, y: 0, k: 37 } },
  { code: "RAL 7005", name: "Mouse grey", nameFr: "Gris souris", hex: "#6B716F", rgb: { r: 107, g: 113, b: 111 }, cmyk: { c: 5, m: 0, y: 2, k: 56 } },
  { code: "RAL 7006", name: "Beige grey", nameFr: "Gris beige", hex: "#756F61", rgb: { r: 117, g: 111, b: 97 }, cmyk: { c: 0, m: 5, y: 17, k: 54 } },
  { code: "RAL 7008", name: "Khaki grey", nameFr: "Gris kaki", hex: "#746643", rgb: { r: 116, g: 102, b: 67 }, cmyk: { c: 0, m: 12, y: 42, k: 55 } },
  { code: "RAL 7009", name: "Green grey", nameFr: "Gris vert", hex: "#5B6259", rgb: { r: 91, g: 98, b: 89 }, cmyk: { c: 7, m: 0, y: 9, k: 62 } },
  { code: "RAL 7010", name: "Tarpaulin grey", nameFr: "Gris tente", hex: "#575D57", rgb: { r: 87, g: 93, b: 87 }, cmyk: { c: 6, m: 0, y: 6, k: 64 } },
  { code: "RAL 7011", name: "Iron grey", nameFr: "Gris fer", hex: "#555D61", rgb: { r: 85, g: 93, b: 97 }, cmyk: { c: 12, m: 4, y: 0, k: 62 } },
  { code: "RAL 7012", name: "Basalt grey", nameFr: "Gris basalte", hex: "#596163", rgb: { r: 89, g: 97, b: 99 }, cmyk: { c: 10, m: 2, y: 0, k: 61 } },
  { code: "RAL 7013", name: "Brown grey", nameFr: "Gris brun", hex: "#575044", rgb: { r: 87, g: 80, b: 68 }, cmyk: { c: 0, m: 8, y: 22, k: 66 } },
  { code: "RAL 7015", name: "Slate grey", nameFr: "Gris ardoise", hex: "#51565C", rgb: { r: 81, g: 86, b: 92 }, cmyk: { c: 12, m: 7, y: 0, k: 64 } },
  { code: "RAL 7016", name: "Anthracite grey", nameFr: "Gris anthracite", hex: "#373F43", rgb: { r: 55, g: 63, b: 67 }, cmyk: { c: 18, m: 6, y: 0, k: 74 } },
  { code: "RAL 7021", name: "Black grey", nameFr: "Gris noir", hex: "#2E3234", rgb: { r: 46, g: 50, b: 52 }, cmyk: { c: 12, m: 4, y: 0, k: 80 } },
  { code: "RAL 7022", name: "Umbra grey", nameFr: "Gris terre d'ombre", hex: "#4B4D46", rgb: { r: 75, g: 77, b: 70 }, cmyk: { c: 3, m: 0, y: 9, k: 70 } },
  { code: "RAL 7023", name: "Concrete grey", nameFr: "Gris béton", hex: "#818479", rgb: { r: 129, g: 132, b: 121 }, cmyk: { c: 2, m: 0, y: 8, k: 48 } },
  { code: "RAL 7024", name: "Graphite grey", nameFr: "Gris graphite", hex: "#474A50", rgb: { r: 71, g: 74, b: 80 }, cmyk: { c: 11, m: 8, y: 0, k: 69 } },
  { code: "RAL 7026", name: "Granite grey", nameFr: "Gris granit", hex: "#374447", rgb: { r: 55, g: 68, b: 71 }, cmyk: { c: 23, m: 4, y: 0, k: 72 } },
  { code: "RAL 7030", name: "Stone grey", nameFr: "Gris pierre", hex: "#939388", rgb: { r: 147, g: 147, b: 136 }, cmyk: { c: 0, m: 0, y: 7, k: 42 } },
  { code: "RAL 7031", name: "Blue grey", nameFr: "Gris bleu", hex: "#5D6970", rgb: { r: 93, g: 105, b: 112 }, cmyk: { c: 17, m: 6, y: 0, k: 56 } },
  { code: "RAL 7032", name: "Pebble grey", nameFr: "Gris silex", hex: "#B9B9A8", rgb: { r: 185, g: 185, b: 168 }, cmyk: { c: 0, m: 0, y: 9, k: 27 } },
  { code: "RAL 7033", name: "Cement grey", nameFr: "Gris ciment", hex: "#818979", rgb: { r: 129, g: 137, b: 121 }, cmyk: { c: 6, m: 0, y: 12, k: 46 } },
  { code: "RAL 7034", name: "Yellow grey", nameFr: "Gris jaune", hex: "#939176", rgb: { r: 147, g: 145, b: 118 }, cmyk: { c: 0, m: 1, y: 20, k: 42 } },
  { code: "RAL 7035", name: "Light grey", nameFr: "Gris clair", hex: "#CBD0CC", rgb: { r: 203, g: 208, b: 204 }, cmyk: { c: 2, m: 0, y: 2, k: 18 } },
  { code: "RAL 7036", name: "Platinum grey", nameFr: "Gris platine", hex: "#9A9697", rgb: { r: 154, g: 150, b: 151 }, cmyk: { c: 0, m: 3, y: 2, k: 40 } },
  { code: "RAL 7037", name: "Dusty grey", nameFr: "Gris poussière", hex: "#7A7B7A", rgb: { r: 122, g: 123, b: 122 }, cmyk: { c: 1, m: 0, y: 1, k: 52 } },
  { code: "RAL 7038", name: "Agate grey", nameFr: "Gris agate", hex: "#B4B8B0", rgb: { r: 180, g: 184, b: 176 }, cmyk: { c: 2, m: 0, y: 4, k: 28 } },
  { code: "RAL 7039", name: "Quartz grey", nameFr: "Gris quartz", hex: "#6B685E", rgb: { r: 107, g: 104, b: 94 }, cmyk: { c: 0, m: 3, y: 12, k: 58 } },
  { code: "RAL 7040", name: "Window grey", nameFr: "Gris fenêtre", hex: "#9DA3A6", rgb: { r: 157, g: 163, b: 166 }, cmyk: { c: 5, m: 2, y: 0, k: 35 } },
  { code: "RAL 7042", name: "Traffic grey A", nameFr: "Gris signalisation A", hex: "#8F9695", rgb: { r: 143, g: 150, b: 149 }, cmyk: { c: 5, m: 0, y: 1, k: 41 } },
  { code: "RAL 7043", name: "Traffic grey B", nameFr: "Gris signalisation B", hex: "#4E5451", rgb: { r: 78, g: 84, b: 81 }, cmyk: { c: 7, m: 0, y: 4, k: 67 } },
  { code: "RAL 7044", name: "Silk grey", nameFr: "Gris soie", hex: "#BDBDB2", rgb: { r: 189, g: 189, b: 178 }, cmyk: { c: 0, m: 0, y: 6, k: 26 } },
  { code: "RAL 7045", name: "Telegrey 1", nameFr: "Télégris 1", hex: "#91969A", rgb: { r: 145, g: 150, b: 154 }, cmyk: { c: 6, m: 3, y: 0, k: 40 } },
  { code: "RAL 7046", name: "Telegrey 2", nameFr: "Télégris 2", hex: "#82898E", rgb: { r: 130, g: 137, b: 142 }, cmyk: { c: 8, m: 4, y: 0, k: 44 } },
  { code: "RAL 7047", name: "Telegrey 4", nameFr: "Télégris 4", hex: "#CFD0CF", rgb: { r: 207, g: 208, b: 207 }, cmyk: { c: 0, m: 0, y: 0, k: 18 } },
  { code: "RAL 7048", name: "Pearl mouse grey", nameFr: "Gris souris nacré", hex: "#888175", rgb: { r: 136, g: 129, b: 117 }, cmyk: { c: 0, m: 5, y: 14, k: 47 } },

  // Bruns (RAL 8xxx)
  { code: "RAL 8000", name: "Green brown", nameFr: "Brun vert", hex: "#887142", rgb: { r: 136, g: 113, b: 66 }, cmyk: { c: 0, m: 17, y: 51, k: 47 } },
  { code: "RAL 8001", name: "Ochre brown", nameFr: "Brun ocre", hex: "#9C6B30", rgb: { r: 156, g: 107, b: 48 }, cmyk: { c: 0, m: 31, y: 69, k: 39 } },
  { code: "RAL 8002", name: "Signal brown", nameFr: "Brun de sécurité", hex: "#7B5141", rgb: { r: 123, g: 81, b: 65 }, cmyk: { c: 0, m: 34, y: 47, k: 52 } },
  { code: "RAL 8003", name: "Clay brown", nameFr: "Brun argile", hex: "#80542F", rgb: { r: 128, g: 84, b: 47 }, cmyk: { c: 0, m: 34, y: 63, k: 50 } },
  { code: "RAL 8004", name: "Copper brown", nameFr: "Brun cuivré", hex: "#8F4E35", rgb: { r: 143, g: 78, b: 53 }, cmyk: { c: 0, m: 45, y: 63, k: 44 } },
  { code: "RAL 8007", name: "Fawn brown", nameFr: "Brun fauve", hex: "#6F4A2F", rgb: { r: 111, g: 74, b: 47 }, cmyk: { c: 0, m: 33, y: 58, k: 56 } },
  { code: "RAL 8008", name: "Olive brown", nameFr: "Brun olive", hex: "#6F4F28", rgb: { r: 111, g: 79, b: 40 }, cmyk: { c: 0, m: 29, y: 64, k: 56 } },
  { code: "RAL 8011", name: "Nut brown", nameFr: "Brun noisette", hex: "#5A3A29", rgb: { r: 90, g: 58, b: 41 }, cmyk: { c: 0, m: 36, y: 54, k: 65 } },
  { code: "RAL 8012", name: "Red brown", nameFr: "Brun rouge", hex: "#673831", rgb: { r: 103, g: 56, b: 49 }, cmyk: { c: 0, m: 46, y: 52, k: 60 } },
  { code: "RAL 8014", name: "Sepia brown", nameFr: "Brun sépia", hex: "#49392D", rgb: { r: 73, g: 57, b: 45 }, cmyk: { c: 0, m: 22, y: 38, k: 71 } },
  { code: "RAL 8015", name: "Chestnut brown", nameFr: "Marron", hex: "#633A34", rgb: { r: 99, g: 58, b: 52 }, cmyk: { c: 0, m: 41, y: 47, k: 61 } },
  { code: "RAL 8016", name: "Mahogany brown", nameFr: "Brun acajou", hex: "#4C2F26", rgb: { r: 76, g: 47, b: 38 }, cmyk: { c: 0, m: 38, y: 50, k: 70 } },
  { code: "RAL 8017", name: "Chocolate brown", nameFr: "Brun chocolat", hex: "#44322D", rgb: { r: 68, g: 50, b: 45 }, cmyk: { c: 0, m: 26, y: 34, k: 73 } },
  { code: "RAL 8019", name: "Grey brown", nameFr: "Brun gris", hex: "#3D3635", rgb: { r: 61, g: 54, b: 53 }, cmyk: { c: 0, m: 11, y: 13, k: 76 } },
  { code: "RAL 8022", name: "Black brown", nameFr: "Brun noir", hex: "#211F20", rgb: { r: 33, g: 31, b: 32 }, cmyk: { c: 0, m: 6, y: 3, k: 87 } },
  { code: "RAL 8023", name: "Orange brown", nameFr: "Brun orangé", hex: "#A45729", rgb: { r: 164, g: 87, b: 41 }, cmyk: { c: 0, m: 47, y: 75, k: 36 } },
  { code: "RAL 8024", name: "Beige brown", nameFr: "Brun beige", hex: "#795038", rgb: { r: 121, g: 80, b: 56 }, cmyk: { c: 0, m: 34, y: 54, k: 53 } },
  { code: "RAL 8025", name: "Pale brown", nameFr: "Brun pâle", hex: "#755847", rgb: { r: 117, g: 88, b: 71 }, cmyk: { c: 0, m: 25, y: 39, k: 54 } },
  { code: "RAL 8028", name: "Terra brown", nameFr: "Brun terre", hex: "#4E3B2D", rgb: { r: 78, g: 59, b: 45 }, cmyk: { c: 0, m: 24, y: 42, k: 69 } },
  { code: "RAL 8029", name: "Pearl copper", nameFr: "Cuivre nacré", hex: "#763C28", rgb: { r: 118, g: 60, b: 40 }, cmyk: { c: 0, m: 49, y: 66, k: 54 } },

  // Blancs et Noirs (RAL 9xxx)
  { code: "RAL 9001", name: "Cream", nameFr: "Blanc crème", hex: "#FDF4E3", rgb: { r: 253, g: 244, b: 227 }, cmyk: { c: 0, m: 4, y: 10, k: 1 } },
  { code: "RAL 9002", name: "Grey white", nameFr: "Blanc gris", hex: "#E7EBDA", rgb: { r: 231, g: 235, b: 218 }, cmyk: { c: 2, m: 0, y: 7, k: 8 } },
  { code: "RAL 9003", name: "Signal white", nameFr: "Blanc de sécurité", hex: "#F4F4F4", rgb: { r: 244, g: 244, b: 244 }, cmyk: { c: 0, m: 0, y: 0, k: 4 } },
  { code: "RAL 9004", name: "Signal black", nameFr: "Noir de sécurité", hex: "#2E3032", rgb: { r: 46, g: 48, b: 50 }, cmyk: { c: 8, m: 4, y: 0, k: 80 } },
  { code: "RAL 9005", name: "Jet black", nameFr: "Noir foncé", hex: "#0E0E10", rgb: { r: 14, g: 14, b: 16 }, cmyk: { c: 13, m: 13, y: 0, k: 94 } },
  { code: "RAL 9006", name: "White aluminium", nameFr: "Aluminium blanc", hex: "#A5A8A6", rgb: { r: 165, g: 168, b: 166 }, cmyk: { c: 2, m: 0, y: 1, k: 34 } },
  { code: "RAL 9007", name: "Grey aluminium", nameFr: "Aluminium gris", hex: "#8F8F8C", rgb: { r: 143, g: 143, b: 140 }, cmyk: { c: 0, m: 0, y: 2, k: 44 } },
  { code: "RAL 9010", name: "Pure white", nameFr: "Blanc pur", hex: "#F7F5E6", rgb: { r: 247, g: 245, b: 230 }, cmyk: { c: 0, m: 1, y: 7, k: 3 } },
  { code: "RAL 9011", name: "Graphite black", nameFr: "Noir graphite", hex: "#27292B", rgb: { r: 39, g: 41, b: 43 }, cmyk: { c: 9, m: 5, y: 0, k: 83 } },
  { code: "RAL 9012", name: "Clean room white", nameFr: "Blanc salle blanche", hex: "#FFFFFE", rgb: { r: 255, g: 255, b: 254 }, cmyk: { c: 0, m: 0, y: 0, k: 0 } },
  { code: "RAL 9016", name: "Traffic white", nameFr: "Blanc signalisation", hex: "#F7FBF5", rgb: { r: 247, g: 251, b: 245 }, cmyk: { c: 2, m: 0, y: 2, k: 2 } },
  { code: "RAL 9017", name: "Traffic black", nameFr: "Noir signalisation", hex: "#2A2D2F", rgb: { r: 42, g: 45, b: 47 }, cmyk: { c: 11, m: 4, y: 0, k: 82 } },
  { code: "RAL 9018", name: "Papyrus white", nameFr: "Blanc papyrus", hex: "#CFD3CD", rgb: { r: 207, g: 211, b: 205 }, cmyk: { c: 2, m: 0, y: 3, k: 17 } },
  { code: "RAL 9022", name: "Pearl light grey", nameFr: "Gris clair nacré", hex: "#9C9C9C", rgb: { r: 156, g: 156, b: 156 }, cmyk: { c: 0, m: 0, y: 0, k: 39 } },
  { code: "RAL 9023", name: "Pearl dark grey", nameFr: "Gris foncé nacré", hex: "#7E8182", rgb: { r: 126, g: 129, b: 130 }, cmyk: { c: 3, m: 1, y: 0, k: 49 } },
];

// Fonction pour trouver les couleurs RAL les plus proches d'une valeur CMYK
export function findClosestRalByCmyk(c: number, m: number, y: number, k: number, limit = 5): RalColor[] {
  const colorDistance = (color: RalColor) => {
    return Math.sqrt(
      Math.pow(color.cmyk.c - c, 2) +
      Math.pow(color.cmyk.m - m, 2) +
      Math.pow(color.cmyk.y - y, 2) +
      Math.pow(color.cmyk.k - k, 2)
    );
  };

  return [...ralColors]
    .sort((a, b) => colorDistance(a) - colorDistance(b))
    .slice(0, limit);
}

// Fonction pour chercher une couleur RAL par code
export function findRalByCode(code: string): RalColor | undefined {
  const normalizedCode = code.toUpperCase().replace(/\s+/g, " ").trim();
  return ralColors.find(color => color.code.toUpperCase() === normalizedCode);
}

// Fonction pour chercher des couleurs RAL par nom
export function searchRalByName(query: string): RalColor[] {
  const normalizedQuery = query.toLowerCase().trim();
  return ralColors.filter(
    color =>
      color.name.toLowerCase().includes(normalizedQuery) ||
      color.nameFr.toLowerCase().includes(normalizedQuery) ||
      color.code.toLowerCase().includes(normalizedQuery)
  );
}
