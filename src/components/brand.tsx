/**
 * Elementos da identidade visual do RETENZA: logotipo (símbolo Rede + nome)
 * e o grafismo de rede de nós. Os arquivos oficiais ficam em /brand.
 */

function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Símbolo Rede: um R montado com nós e elos; a perna verde termina no nó do cliente. */
export function BrandSymbol({ light = false, size = 30 }: { light?: boolean; size?: number }) {
  const blue = light ? "#6AA6F5" : "#1B66D6";
  const green = light ? "#3CCB8B" : "#17A36B";
  return (
    <svg
      width={(size * 44) / 54}
      height={size}
      viewBox="10 6 44 54"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M34 34l11 17" fill="none" stroke={green} strokeWidth="5" strokeLinecap="round" />
      <path
        d="M18 50V14h18l8 10-8 10H18"
        fill="none"
        stroke={blue}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill={blue}>
        <circle cx="18" cy="14" r="6" />
        <circle cx="18" cy="50" r="6" />
        <circle cx="36" cy="14" r="5" />
        <circle cx="44" cy="24" r="5" />
        <circle cx="34" cy="34" r="5" />
      </g>
      <circle cx="45" cy="51" r="7" fill={green} />
    </svg>
  );
}

/** Logotipo horizontal. `light` é a versão negativa, para fundo grafite. */
export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandSymbol light={light} />
      <span
        className={cn(
          "font-display text-[19px] leading-none font-bold tracking-[0.06em]",
          light ? "text-white" : "text-ink",
        )}
      >
        RETENZA
      </span>
    </span>
  );
}

// Rede de nós: [x, y, raio, destaque]
const NODES: [number, number, number, "n" | "v" | "a"][] = [
  [70, 62, 30, "n"],
  [168, 118, 22, "n"],
  [62, 164, 18, "n"],
  [254, 58, 18, "n"],
  [278, 150, 28, "v"],
  [356, 82, 16, "n"],
  [384, 168, 14, "a"],
  [150, 30, 12, "n"],
  [418, 52, 20, "n"],
];
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [0, 7], [7, 3], [1, 4], [3, 4], [3, 5], [4, 6], [5, 8], [4, 5],
];
const NODE_COLOR = { n: "#C8955A", v: "#17A36B", a: "#F2B33D" };

/**
 * Grafismo de rede de nós (madeira sobre grafite): clientes ligados por elos.
 * Um nó em verde é o cliente retido; um em âmbar pede atenção. Decorativo.
 */
export function NetworkGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 208" aria-hidden="true" className={className}>
      <g stroke={NODE_COLOR.n} strokeWidth="5" strokeLinecap="round">
        {LINKS.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
        ))}
      </g>
      {NODES.map(([x, y, r, kind], i) => (
        <g key={i}>
          <clipPath id={`rede-no-${i}`}>
            <circle cx={x} cy={y} r={r * 0.78} />
          </clipPath>
          <circle cx={x} cy={y} r={r} fill="#141B26" stroke={NODE_COLOR[kind]} strokeWidth="5" />
          <g fill={NODE_COLOR[kind]} clipPath={`url(#rede-no-${i})`}>
            <circle cx={x} cy={y - r * 0.2} r={r * 0.26} />
            <ellipse cx={x} cy={y + r * 0.72} rx={r * 0.5} ry={r * 0.42} />
          </g>
        </g>
      ))}
    </svg>
  );
}
