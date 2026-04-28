export type RankCode =
  | "CADET"
  | "SECOND_OFFICER"
  | "JUNIOR_FIRST_OFFICER"
  | "FIRST_OFFICER"
  | "SENIOR_FIRST_OFFICER"
  | "JUNIOR_CAPTAIN"
  | "CAPTAIN"
  | "SENIOR_CAPTAIN"
  | "INTERNATIONAL_COMMANDER"
  | "LINE_CHECK_CAPTAIN";

export const rankInsignias = {
  CADET: {
    name: "Cadete Escuela",
    shortName: "Cadete",
    asset: "/rank/cadet-school.png",
  },
  SECOND_OFFICER: {
    name: "Segundo Oficial",
    shortName: "2O",
    asset: "/rank/second-officer.png",
  },
  JUNIOR_FIRST_OFFICER: {
    name: "Primer Oficial Junior",
    shortName: "FO Jr",
    asset: "/rank/junior-first-officer.png",
  },
  FIRST_OFFICER: {
    name: "Primer Oficial",
    shortName: "FO",
    asset: "/rank/first-officer.png",
  },
  SENIOR_FIRST_OFFICER: {
    name: "Primer Oficial Senior",
    shortName: "FO Sr",
    asset: "/rank/senior-first-officer.png",
  },
  JUNIOR_CAPTAIN: {
    name: "Capitán Junior",
    shortName: "CPT Jr",
    asset: "/rank/junior-captain.png",
  },
  CAPTAIN: {
    name: "Capitán",
    shortName: "CPT",
    asset: "/rank/captain.png",
  },
  SENIOR_CAPTAIN: {
    name: "Capitán Senior",
    shortName: "CPT Sr",
    asset: "/rank/senior-captain.png",
  },
  INTERNATIONAL_COMMANDER: {
    name: "Comandante Internacional",
    shortName: "CMD Intl",
    asset: "/rank/international-commander.png",
  },
  LINE_CHECK_CAPTAIN: {
    name: "Instructor / Line Check Captain",
    shortName: "LCC",
    asset: "/rank/line-check-captain.png",
  },
} as const;

export function getRankInsignia(rankCode?: string | null) {
  if (!rankCode) return rankInsignias.CADET;
  return rankInsignias[rankCode as RankCode] ?? rankInsignias.CADET;
}
