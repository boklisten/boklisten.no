import { Avatar, Style } from "@dicebear/core";
import type { StyleOptions } from "@dicebear/core";
import avataaars from "@dicebear/styles/avataaars.json";

type AvataaarsOptions = StyleOptions<typeof avataaars>;

/** Clothes in the page's blues, so the avatars sit quietly on the figures. */
const CLOTHES = {
  deep: "1b5a7a",
  light: "6fa3cf",
  slate: "3c4f5c",
  navy: "25557c",
  chalk: "e6e6e6",
} as const;

/**
 * The fictional students on the sales page as DiceBear "Avataaars" (free for commercial use).
 * Every feature is chosen by hand so each face matches its name and nobody has a beard or
 * sunglasses: these are pupils, not their teachers.
 */
const LOOKS = {
  Peer: {
    topVariant: "shortFlat",
    hairColor: "2c1b18",
    skinColor: "edb98a",
    clothesVariant: "hoodie",
    clothesColor: CLOTHES.deep,
    eyesVariant: "default",
    eyebrowsVariant: "defaultNatural",
    mouthVariant: "smile",
  },
  Ronja: {
    topVariant: "curly",
    hairColor: "2c1b18",
    skinColor: "d08b5b",
    clothesVariant: "shirtCrewNeck",
    clothesColor: CLOTHES.light,
    eyesVariant: "happy",
    eyebrowsVariant: "raisedExcitedNatural",
    mouthVariant: "twinkle",
  },
  Espen: {
    topVariant: "shortWaved",
    hairColor: "b58143",
    skinColor: "ffdbb4",
    clothesVariant: "hoodie",
    clothesColor: CLOTHES.slate,
    eyesVariant: "default",
    eyebrowsVariant: "default",
    mouthVariant: "twinkle",
  },
  Pippi: {
    topVariant: "curvy",
    hairColor: "c93305",
    skinColor: "ffdbb4",
    clothesVariant: "overall",
    clothesColor: CLOTHES.navy,
    eyesVariant: "happy",
    eyebrowsVariant: "raisedExcited",
    mouthVariant: "smile",
  },
  Lillekort: {
    topVariant: "shortRound",
    hairColor: "d6b370",
    skinColor: "ffdbb4",
    clothesVariant: "shirtVNeck",
    clothesColor: CLOTHES.light,
    eyesVariant: "default",
    eyebrowsVariant: "defaultNatural",
    mouthVariant: "default",
  },
  Tyrihans: {
    topVariant: "shortCurly",
    hairColor: "4a312c",
    skinColor: "ae5d29",
    clothesVariant: "collarAndSweater",
    clothesColor: CLOTHES.deep,
    eyesVariant: "default",
    eyebrowsVariant: "default",
    mouthVariant: "smile",
  },
  Solveig: {
    topVariant: "longButNotTooLong",
    hairColor: "ecdcbf",
    skinColor: "ffdbb4",
    clothesVariant: "shirtScoopNeck",
    clothesColor: CLOTHES.navy,
    eyesVariant: "default",
    eyebrowsVariant: "defaultNatural",
    mouthVariant: "smile",
  },
  Kari: {
    topVariant: "bob",
    hairColor: "724133",
    skinColor: "614335",
    clothesVariant: "hoodie",
    clothesColor: CLOTHES.chalk,
    eyesVariant: "happy",
    eyebrowsVariant: "raisedExcitedNatural",
    mouthVariant: "twinkle",
  },
} satisfies Record<string, AvataaarsOptions>;

export type Persona = keyof typeof LOOKS;

// Parsing the definition is the expensive part; the page only needs it once.
const style = new Style(avataaars);
const cache = new Map<Persona, string>();

/** The persona's face as a data URI, ready for an <img> or an SVG <image>. */
export function personaAvatar(persona: Persona): string {
  const cached = cache.get(persona);
  if (cached !== undefined) {
    return cached;
  }
  const uri = new Avatar(style, {
    seed: persona,
    facialHairProbability: 0,
    accessoriesProbability: 0,
    ...LOOKS[persona],
  }).toDataUri();
  cache.set(persona, uri);
  return uri;
}
