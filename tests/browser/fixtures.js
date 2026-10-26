// Données fictives des tests navigateur : aucune donnée personnelle ni de course réelle.

const TRACK_POINT_COUNT = 60;

/** Trace GPX fictive d’environ 39 km, plein nord. */
export function createGpx() {
  const points = Array.from({ length: TRACK_POINT_COUNT }, (_, index) => {
    const latitude = (45 + index * 0.006).toFixed(4);
    const elevation = Math.round(800 + 600 * Math.sin(index / 9) + index * 12);
    return `<trkpt lat="${latitude}" lon="6.0"><ele>${elevation}</ele></trkpt>`;
  }).join("");
  return `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${points}</trkseg></trk></gpx>`;
}

/** Fiche de course complète : chaque bloc facultatif est rempli. */
export function createRaceSheet(date) {
  return {
    id: "fiche-test",
    name: "Ultra de test",
    organizer: "Orga",
    date,
    startTime: "06:00",
    route: "Boucle fictive",
    distanceKm: 40,
    ascentMeters: 2000,
    distanceNote: "Distance indicative.",
    cutoff: "12:00",
    calendarDetails: "40 km · 2 000 m D+",
    profile: { gpx: "test.gpx", gpxData: createGpx(), caption: "Trace fictive" },
    checkpoints: [
      { id: "r1", name: "Col A", km: 12, description: "Eau" },
      { id: "r2", name: "Refuge B", km: 25, label: "Passé" },
      { id: "finish", name: "Arrivée", km: 40 }
    ],
    checkpointNote: "Note des ravitos.",
    practicalInfo: { items: [{ title: "Retrait", text: "La veille." }] },
    gear: {
      title: "Matériel",
      hint: "Coche.",
      note: "Note matériel.",
      groups: [
        {
          title: "Obligatoire",
          required: true,
          items: [
            { id: "g1", text: "Frontale" },
            { id: "g2", text: "Couverture" }
          ]
        },
        { title: "Conseillé", required: false, items: [{ id: "g3", text: "Bâtons" }] }
      ]
    },
    sources: [{ label: "Site fictif", url: "https://example.org" }],
    verifiedAt: "2026-10-01",
    footer: "Pied de fiche."
  };
}

/** Plan personnel de la fiche : scénarios, horaires, nutrition et rappels. */
export function createRacePlan() {
  return {
    id: "fiche-test",
    scenarios: [
      { id: "s1", name: "Prudent", duration: "8:00" },
      { id: "s2", name: "Objectif", duration: "7:00" }
    ],
    defaultScenario: 1,
    checkpoints: [
      {
        id: "r1",
        elapsed: ["2:30", "2:10"],
        clocks: ["08:30", "08:10"],
        plan: [{ label: "Boire", text: "500 ml" }]
      },
      { id: "r2", elapsed: ["5:00", "4:30"], clocks: ["11:00", "10:30"] },
      { id: "finish", elapsed: ["8:00", "7:00"], clocks: ["14:00", "13:00"] }
    ],
    nutrition: {
      title: "Nutrition",
      headline: "60 g/h",
      details: ["Gels", { lead: "Avant", text: "Petit-déjeuner" }]
    },
    reminders: { title: "Rappels", items: [{ title: "Départ", text: "Partir doucement." }] }
  };
}

/** Sauvegarde au format 2, avec les anciens noms de collections. */
export function createFormatTwoBackup(date) {
  return {
    formatVersion: 2,
    plannedSessions: [
      {
        id: "seance-v2",
        date,
        type: "trail",
        title: "Sortie importée",
        status: "completed",
        time: "07:00",
        distanceKm: 12,
        durationMinutes: 80,
        createdAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    activities: [],
    raceEvents: [{ id: "course-v2", name: "Course importée", date, eventType: "personalRace" }],
    raceCatalog: [],
    racePlans: [],
    nutritionProducts: [],
    equipment: [],
    settings: { browserStorage: { "alterra-test-etat": "[]" } }
  };
}
