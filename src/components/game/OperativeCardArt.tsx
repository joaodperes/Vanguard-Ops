"use client";
import type { PlayerSkinDef } from "@/lib/game-data";
import { operativeSignature } from "@/lib/operative-appearance";

/** Inexpensive 2D catalog thumbnail. The selectable 3D preview and battlefield
 * use the same signature set via addOperativeSkinDetails; 16 WebGL canvases
 * would exhaust browser contexts and severely impact the Armory on mobile. */
export function OperativeCardArt({skin}: {skin: PlayerSkinDef}) {
  const signature = operativeSignature(skin);
  const rare = skin.rarity !== "common";
  const epic = skin.rarity === "epic" || skin.rarity === "legendary";
  const legendary = skin.rarity === "legendary";
  const accent = skin.accent;
  const glow = skin.emissive ?? accent;

  return <svg viewBox="0 0 220 150" aria-hidden="true" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="110" cy="145" rx="73" ry="8" fill={glow} opacity=".16"/>
    {legendary && <circle cx="110" cy="75" r="65" fill="none" stroke={glow} strokeOpacity=".24" strokeWidth="1.5" strokeDasharray="12 6" />}
    {/* Torso, arms and neck: all variants preserve the same readable team hit silhouette. */}
    <path d="M74 78 L60 91 L63 144 L157 144 L160 91 L146 78 Z" fill={skin.color} stroke={accent} strokeOpacity=".5" strokeWidth="1.5"/>
    <path d="M83 86 L137 86 L143 144 L77 144 Z" fill={skin.color} stroke="#111827" strokeWidth="2"/>
    <path d="M85 87 L135 87 L130 111 L90 111 Z" fill="#111827" opacity=".55"/>
    <path d="M94 75 L126 75 L122 91 L98 91 Z" fill="#252a33"/>
    <path d="M93 26 L127 26 L134 36 L130 69 L122 78 L98 78 L90 69 L86 36 Z" fill={skin.color} stroke={accent} strokeWidth="1.5" strokeOpacity=".55"/>
    <path d="M92 45 L128 45 L125 56 L95 56 Z" fill={accent}/>
    <path d="M98 62 L122 62 L119 68 L101 68 Z" fill="#0e1117"/>
    {/* The rarity ladder adds construction, not another recolor. */}
    {rare && <>
      <path d="M75 86 L94 81 L91 100 L74 106 Z M145 86 L126 81 L129 100 L146 106 Z" fill="#18212a" stroke={accent} strokeOpacity=".8"/>
      <path d="M95 115 L104 115 L104 131 L95 131 Z M116 115 L125 115 L125 131 L116 131 Z" fill="#172027" stroke={accent} strokeOpacity=".55"/>
      <path d="M99 28 L121 28 L126 35 L94 35 Z" fill={accent} opacity=".6"/>
    </>}
    {epic && <>
      <path d="M77 80 L89 73 L97 82 L89 109 L70 103 Z M143 80 L131 73 L123 82 L131 109 L150 103 Z" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M90 88 L130 88 L135 110 L110 120 L85 110 Z" fill="#171b25" stroke={accent} strokeWidth="1.5"/>
      <path d="M95 91 L125 91 L121 105 L99 105 Z" fill={skin.color} stroke={accent} strokeOpacity=".75"/>
      <path d="M90 34 L95 23 L125 23 L130 34 L127 42 L93 42 Z" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M102 109 L118 109 L113 116 L107 116 Z" fill={accent}/>
    </>}
    {legendary && <>
      <path d="M73 81 L54 72 L49 91 L65 101 L82 95 Z M147 81 L166 72 L171 91 L155 101 L138 95 Z" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M110 95 L119 109 L110 120 L101 109 Z" fill={glow} stroke="#fff" strokeOpacity=".4" strokeWidth="1"/>
      <path d="M87 118 L83 138 M133 118 L137 138" stroke={glow} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M102 22 L110 10 L118 22 Z" fill={accent}/>
    </>}

    {/* Individual headgear, equipment and heraldry distinguish even skins of
        the same rarity. These motifs reflect their 3D counterparts. */}
    {signature === "jungle" && <>
      <path d="M89 30 L80 19 L92 23 L98 14 L104 28 M131 30 L140 19 L128 23 L122 14 L116 28" fill={accent} opacity=".75"/>
      <path d="M76 91 L63 82 L75 78 M144 91 L157 82 L145 78" fill="none" stroke={accent} strokeWidth="4"/>
    </>}
    {signature === "ember" && <>
      <rect x="88" y="106" width="44" height="7" rx="2" fill={accent}/>
      <rect x="62" y="106" width="7" height="32" rx="3" fill="#333a43" stroke={accent}/>
      <rect x="151" y="106" width="7" height="32" rx="3" fill="#333a43" stroke={accent}/>
    </>}
    {signature === "spectre" && <>
      <rect x="136" y="13" width="4" height="27" fill={accent}/>
      <path d="M96 51 L108 47 M112 47 L124 51" stroke="#0d1420" strokeWidth="4"/>
      <path d="M105 123 L112 130 L119 123" fill="none" stroke={accent} strokeWidth="2"/>
    </>}
    {signature === "wraith" && <>
      <path d="M100 56 L120 56 L126 72 L94 72 Z" fill="#161a1d" stroke={accent}/>
      <rect x="84" y="59" width="12" height="13" rx="3" fill="#27313c" stroke={accent}/>
      <rect x="124" y="59" width="12" height="13" rx="3" fill="#27313c" stroke={accent}/>
      <path d="M88 27 Q110 7 132 27" fill="none" stroke={accent} strokeWidth="5"/>
    </>}
    {signature === "urban" && <>
      <rect x="135" y="12" width="5" height="30" rx="2" fill={accent}/>
      <circle cx="137.5" cy="12" r="4" fill={accent}/>
      <rect x="96" y="48" width="28" height="7" rx="2" fill="#0f172a" stroke={accent}/>
      <path d="M92 113 L91 137" stroke={accent} strokeWidth="4"/>
    </>}
    {signature === "sandstorm" && <>
      <path d="M86 31 Q110 16 134 31 L140 65 L127 79 L94 73 Z" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M92 58 L131 58 L127 72 L95 72 Z" fill="#232323" stroke={accent}/>
      <path d="M70 77 L84 70 L99 135 L65 135 Z" fill={skin.color} stroke={accent} strokeOpacity=".7"/>
    </>}
    {signature === "tidebreaker" && <>
      <rect x="59" y="87" width="14" height="35" rx="6" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <rect x="147" y="87" width="14" height="35" rx="6" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M96 61 L110 72 L124 61" fill="none" stroke={accent} strokeWidth="4"/>
      <path d="M110 97 L110 111" stroke={glow} strokeWidth="4"/>
    </>}
    {signature === "phantom" && <>
      <path d="M92 41 L110 30 L128 41 L125 46 L95 46 Z" fill="#080d12" stroke={glow}/>
      <rect x="95" y="49" width="11" height="4" rx="1" fill={glow}/>
      <rect x="114" y="49" width="11" height="4" rx="1" fill={glow}/>
      <path d="M110 119 L110 143" stroke={glow} strokeWidth="3"/>
    </>}
    {signature === "crimson" && <>
      <path d="M93 27 L85 6 L104 23 M127 27 L135 6 L116 23" fill={accent} stroke="#1a0707" strokeWidth="2"/>
      <path d="M65 86 L50 101 L65 134 M155 86 L170 101 L155 134" fill="none" stroke={accent} strokeWidth="6"/>
      <path d="M110 97 L110 117" stroke={glow} strokeWidth="5"/>
    </>}
    {signature === "starlight" && <>
      <path d="M62 88 L38 67 L51 101 L67 106 M158 88 L182 67 L169 101 L153 106" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M110 5 L114 17 L126 21 L114 25 L110 36 L106 25 L94 21 L106 17 Z" fill={glow}/>
      <path d="M104 106 L110 97 L116 106 L110 117 Z" fill={glow}/>
    </>}
    {signature === "solar" && <>
      <path d="M84 26 L77 5 L98 21 M136 26 L143 5 L122 21" fill={accent}/>
      <circle cx="110" cy="106" r="10" fill={glow} stroke={accent} strokeWidth="3"/>
      <path d="M110 90 V84 M110 122 V128 M94 106 H88 M126 106 H132" stroke={accent} strokeWidth="3"/>
    </>}
    {signature === "ion" && <>
      <path d="M66 91 L66 26 L74 26 L74 83 M146 91 L146 26 L154 26 L154 83" fill="none" stroke={glow} strokeWidth="4"/>
      <circle cx="70" cy="24" r="5" fill={glow}/>
      <circle cx="150" cy="24" r="5" fill={glow}/>
      <path d="M92 104 L100 113 L107 99 L115 115 L128 104" fill="none" stroke={glow} strokeWidth="3"/>
    </>}
    {signature === "verdant" && <>
      <path d="M90 29 L77 7 L95 18 L101 5 L105 27 M130 29 L143 7 L125 18 L119 5 L115 27" fill={accent}/>
      <path d="M70 83 L48 73 L61 97 L81 103 M150 83 L172 73 L159 97 L139 103" fill={skin.color} stroke={accent} strokeWidth="2"/>
      <path d="M110 93 L118 105 L110 119 L102 105 Z" fill={glow}/>
    </>}
  </svg>;
}
