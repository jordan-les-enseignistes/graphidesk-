// Pictos SVG métier des outils FabRik — style trait (type lucide),
// colorés via currentColor (classe text-* du parent).

interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Adhésif : feuille au coin décollé + trait de découpe */
export function IconAdhesif({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 4h11l5 5v11H4z" />
      <path d="M15 4v5h5" />
      <path d="M8 16l6-6" strokeDasharray="2.4 1.8" />
    </Svg>
  );
}

/** Caisson : panneau extrudé en perspective */
export function IconCaisson({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 9h13v11H3z" />
      <path d="M3 9l4-4h14l-5 4" />
      <path d="M21 5v11l-5 4" />
    </Svg>
  );
}

/** Lettres boîtiers : boîte en perspective avec un A sur la face */
export function IconLettresBoitiers({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 8h12v12H4z" />
      <path d="M4 8l3-3h12l-3 3" />
      <path d="M19 5v12l-3 3" />
      <path d="M7.2 17.5L10 10.5l2.8 7" strokeWidth="1.5" />
      <path d="M8.2 15.2h3.6" strokeWidth="1.5" />
    </Svg>
  );
}

/** Lettres relief : A avec son ombre décalée (relief sur entretoises) */
export function IconLettresRelief({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 20L14 6l5 14" opacity="0.35" transform="translate(2.2 -2)" />
      <path d="M6 20L11 6l5 14" />
      <path d="M8 15.4h6" />
    </Svg>
  );
}

/** Bâche : toile avec œillets aux 4 coins */
export function IconBache({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="6.4" cy="8.4" r="1.15" />
      <circle cx="17.6" cy="8.4" r="1.15" />
      <circle cx="6.4" cy="15.6" r="1.15" />
      <circle cx="17.6" cy="15.6" r="1.15" />
    </Svg>
  );
}
