export type Lang = "en" | "da";

export const COPY = {
  en: {
    appName: "Zonecheck",
    tagline: "Which Copenhagen fare zone am I in?",
    findMyZone: "Find my zone",
    locating: "Locating…",
    youAreIn: "You are in",
    zone: "zone",
    zoneRing: "Zone ring",
    /** The disclaimer. Never behind a tap, never truncated. */
    disclaimerShort:
      "Estimate from open data. Not an official DOT source. Not valid as proof of travel.",
    disclaimerLong:
      "This zone is an estimate derived from open data using an approximate model. It is not an official DOT, Rejsekort or DSB source, and it must not be relied on as proof of valid travel. Always buy the ticket your operator requires.",
    journey: "Journey",
    from: "From",
    to: "To",
    searchStops: "Search a stop…",
    zonesCrossed: "Zones crossed",
    zoneCount: "Zones to pay for",
    validFor: "Valid for:",
    minutes: "minutes",
    clear: "Clear",
    dataAsOf: "Zone data as of",
    feedUpdated: "Feed updated",
    outsideArea: "You are outside the area this app covers.",
    outsideAreaHelp:
      "Zonecheck only models the Greater Copenhagen ring system. Move closer to Copenhagen, or check the official DOT zone map.",
    denied: "Location permission was denied.",
    deniedHelp:
      "Allow location in your browser settings, or tap the map to check a zone by hand.",
    unavailable: "Could not get your location.",
    unavailableHelp: "No signal, or your device refused. Tap the map to check a zone by hand.",
    retry: "Try again",
    tapMapHint: "Tap anywhere on the map to inspect that zone.",
    inspecting: "Tapped location",
    howItWorks: "How this works",
    langToggle: "Dansk",
    minFareNote: "DOT's minimum fare is 2 zones.",
    orCheckPlace: "Or look up a place",
    placeZone: "Estimated zone",
    tryExamples: "Try:",
    sourceOfficial: "Official zone · Rejseplanen",
    sourceEstimate: "Estimated · not official",
    zoneWord: "Zone",
    disclaimerOfficial:
      "This zone comes from Rejseplanen's own tariff service. It is accurate at the time of lookup, but still buy the ticket your operator requires.",
    zonesWord: "zones",
    ticketRule:
      "Tickets for 1-8 zones are valid for an unlimited number of trips by bus, train, and metro within the time and zone validity.",
  },
  da: {
    appName: "Zonecheck",
    tagline: "Hvilken takstzone er jeg i?",
    findMyZone: "Find min zone",
    locating: "Finder position…",
    youAreIn: "Du er i",
    zone: "zone",
    zoneRing: "Zonering",
    disclaimerShort:
      "Estimat fra åbne data. Ikke en officiel DOT-kilde. Ikke gyldig som rejsehjemmel.",
    disclaimerLong:
      "Denne zone er et estimat udledt af åbne data med en tilnærmet model. Det er ikke en officiel kilde fra DOT, Rejsekort eller DSB, og det må ikke bruges som bevis for gyldig rejse. Køb altid den billet, dit selskab kræver.",
    journey: "Rejse",
    from: "Fra",
    to: "Til",
    searchStops: "Søg et stoppested…",
    zonesCrossed: "Zoner krydset",
    zoneCount: "Zoner der skal betales for",
    validFor: "Gyldig i:",
    minutes: "minutter",
    clear: "Ryd",
    dataAsOf: "Zonedata pr.",
    feedUpdated: "Feed opdateret",
    outsideArea: "Du er uden for det område, appen dækker.",
    outsideAreaHelp:
      "Zonecheck modellerer kun ringsystemet omkring Storkøbenhavn. Kom tættere på København, eller se det officielle DOT-zonekort.",
    denied: "Adgang til lokation blev afvist.",
    deniedHelp:
      "Tillad lokation i browserens indstillinger, eller tryk på kortet for at tjekke en zone manuelt.",
    unavailable: "Kunne ikke finde din position.",
    unavailableHelp:
      "Intet signal, eller enheden afviste. Tryk på kortet for at tjekke en zone manuelt.",
    retry: "Prøv igen",
    tapMapHint: "Tryk et vilkårligt sted på kortet for at se den zone.",
    inspecting: "Valgt position",
    howItWorks: "Sådan virker det",
    langToggle: "English",
    minFareNote: "DOT's minimumstakst er 2 zoner.",
    orCheckPlace: "Eller slå et sted op",
    placeZone: "Anslået zone",
    tryExamples: "Prøv:",
    sourceOfficial: "Officiel zone · Rejseplanen",
    sourceEstimate: "Anslået · ikke officiel",
    zoneWord: "Zone",
    disclaimerOfficial:
      "Denne zone kommer fra Rejseplanens egen takstservice. Den er korrekt på opslagstidspunktet, men køb stadig den billet, dit selskab kræver.",
    zonesWord: "zoner",
    ticketRule:
      "Billetter til 1-8 zoner gælder til et ubegrænset antal rejser med bus, tog og metro inden for tids- og zonegyldigheden.",
  },
} as const;

export type Copy = (typeof COPY)["en"];

export function t(lang: Lang): Copy {
  return COPY[lang] as Copy;
}
