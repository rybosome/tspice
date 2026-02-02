/**
 * Extra NAIF-ish metadata not covered by baseline NAIF kernels.
 *
 * Today this is primarily used for comets, where we generate a custom SPK
 * (see `scripts/generate-comet-kernels.py`).
 */

export const COMET_EXTRAS = [
  { id: "COMET_1P_HALLEY", label: "1P/Halley", horizonsDesignation: "1P", body: 90000030 },
  { id: "COMET_2P_ENCKE", label: "2P/Encke", horizonsDesignation: "2P", body: 90000091 },
  { id: "COMET_9P_TEMPEL_1", label: "9P/Tempel 1", horizonsDesignation: "9P", body: 90000192 },
  { id: "COMET_10P_TEMPEL_2", label: "10P/Tempel 2", horizonsDesignation: "10P", body: 90000214 },
  { id: "COMET_12P_PONS_BROOKS", label: "12P/Pons-Brooks", horizonsDesignation: "12P", body: 90000224 },
  { id: "COMET_17P_HOLMES", label: "17P/Holmes", horizonsDesignation: "17P", body: 90000286 },
  { id: "COMET_19P_BORRELLY", label: "19P/Borrelly", horizonsDesignation: "19P", body: 90000305 },
  { id: "COMET_21P_GIACOBINI_ZINNER", label: "21P/Giacobini-Zinner", horizonsDesignation: "21P", body: 90000323 },
  {
    id: "COMET_45P_HONDA_MRKOS_PAJDUSAKOVA",
    label: "45P/Honda–Mrkos–Pajdušáková",
    horizonsDesignation: "45P",
    body: 90000535,
  },
  { id: "COMET_46P_WIRTANEN", label: "46P/Wirtanen", horizonsDesignation: "46P", body: 90000547 },
  { id: "COMET_55P_TEMPEL_TUTTLE", label: "55P/Tempel-Tuttle", horizonsDesignation: "55P", body: 90000625 },
  {
    id: "COMET_67P_CHURYUMOV_GERASIMENKO",
    label: "67P/Churyumov–Gerasimenko",
    horizonsDesignation: "67P",
    body: 90000702,
  },
  {
    id: "COMET_73P_SCHWASSMANN_WACHMANN_3",
    label: "73P/Schwassmann–Wachmann 3",
    horizonsDesignation: "73P",
    body: 90000739,
  },
  { id: "COMET_81P_WILD_2", label: "81P/Wild 2", horizonsDesignation: "81P", body: 90000861 },
  { id: "COMET_96P_MACHHOLZ_1", label: "96P/Machholz 1", horizonsDesignation: "96P", body: 90000928 },
  { id: "COMET_103P_HARTLEY_2", label: "103P/Hartley 2", horizonsDesignation: "103P", body: 90000956 },
  {
    id: "COMET_C_1995_O1_HALE_BOPP",
    label: "C/1995 O1 (Hale–Bopp)",
    horizonsDesignation: "C/1995 O1",
    body: 90002244,
  },
  {
    id: "COMET_C_1996_B2_HYAKUTAKE",
    label: "C/1996 B2 (Hyakutake)",
    horizonsDesignation: "C/1996 B2",
    body: 90002250,
  },
  {
    id: "COMET_C_2006_P1_MCNAUGHT",
    label: "C/2006 P1 (McNaught)",
    horizonsDesignation: "C/2006 P1",
    body: 90003677,
  },
  {
    id: "COMET_C_2020_F3_NEOWISE",
    label: "C/2020 F3 (NEOWISE)",
    horizonsDesignation: "C/2020 F3",
    body: 90004589,
  },
] as const;

export type CometBodyId = (typeof COMET_EXTRAS)[number]["id"];
