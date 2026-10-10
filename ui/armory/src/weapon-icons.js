// Alpha bounds from public/art/armory/manifest.json. Keep the source WebPs and
// their full-armory calibration unchanged; only quick-picker silhouettes fit
// into a 44 × 28 CSS-pixel envelope. Regenerate these rows with armory art.
const ART_BOUNDS = Object.freeze({
  "carbine.webp": [
    640,
    360,
    164,
    105,
    479,
    249
  ],
  "smg.webp": [
    640,
    360,
    195,
    110,
    449,
    245
  ],
  "marksman.webp": [
    640,
    360,
    147,
    114,
    493,
    267
  ],
  "pistol.webp": [
    640,
    360,
    261,
    127,
    381,
    237
  ],
  "shotgun.webp": [
    640,
    360,
    150,
    113,
    491,
    246
  ],
  "burst.webp": [
    640,
    360,
    169,
    106,
    473,
    251
  ],
  "sniper.webp": [
    640,
    360,
    105,
    114,
    529,
    272
  ],
  "lmg.webp": [
    640,
    360,
    153,
    103,
    509,
    261
  ],
  "crossbow.webp": [
    640,
    360,
    152,
    120,
    464,
    245
  ],
  "revolver.webp": [
    640,
    360,
    245,
    124,
    396,
    240
  ],
  "pdw.webp": [
    640,
    360,
    188,
    118,
    455,
    251
  ],
  "autoshotgun.webp": [
    640,
    360,
    155,
    97,
    491,
    255
  ],
  "battlerifle.webp": [
    640,
    360,
    129,
    101,
    512,
    256
  ],
  "dualpistols.webp": [
    640,
    360,
    238,
    120,
    403,
    244
  ],
  "dualsmg.webp": [
    640,
    360,
    220,
    109,
    424,
    248
  ],
  "slugshotgun.webp": [
    640,
    360,
    130,
    110,
    511,
    246
  ],
  "classic.webp": [
    640,
    360,
    262,
    125,
    380,
    236
  ],
  "shorty.webp": [
    640,
    360,
    247,
    125,
    390,
    237
  ],
  "frenzy.webp": [
    640,
    360,
    255,
    110,
    388,
    252
  ],
  "ghost.webp": [
    640,
    360,
    217,
    117,
    423,
    245
  ],
  "sheriff.webp": [
    640,
    360,
    236,
    123,
    404,
    239
  ],
  "bandit.webp": [
    640,
    360,
    246,
    117,
    395,
    246
  ],
  "stinger.webp": [
    640,
    360,
    197,
    103,
    450,
    245
  ],
  "spectre.webp": [
    640,
    360,
    163,
    100,
    482,
    249
  ],
  "bucky.webp": [
    640,
    360,
    144,
    111,
    498,
    243
  ],
  "judge.webp": [
    640,
    360,
    157,
    95,
    489,
    256
  ],
  "bulldog.webp": [
    640,
    360,
    177,
    105,
    471,
    256
  ],
  "guardian.webp": [
    640,
    360,
    123,
    101,
    519,
    246
  ],
  "phantom.webp": [
    640,
    360,
    124,
    96,
    517,
    252
  ],
  "vandal.webp": [
    640,
    360,
    133,
    89,
    515,
    255
  ],
  "warden.webp": [
    640,
    360,
    112,
    106,
    528,
    270
  ],
  "marshal.webp": [
    640,
    360,
    104,
    120,
    534,
    268
  ],
  "outlaw.webp": [
    640,
    360,
    118,
    118,
    518,
    263
  ],
  "operator.webp": [
    640,
    360,
    63,
    109,
    573,
    275
  ],
  "ares.webp": [
    640,
    360,
    133,
    98,
    514,
    264
  ],
  "odin.webp": [
    640,
    360,
    101,
    84,
    558,
    274
  ],
  "melee_knife.webp": [
    640,
    360,
    232,
    158,
    409,
    210
  ],
  "melee_sword.webp": [
    640,
    360,
    133,
    140,
    509,
    250
  ],
  "melee_katana.webp": [
    640,
    360,
    95,
    122,
    550,
    237
  ],
  "melee_axe.webp": [
    640,
    360,
    132,
    88,
    496,
    230
  ],
  "melee_tonfas.webp": [
    640,
    360,
    172,
    86,
    469,
    260
  ]
});

/** CSS placement of the full image, centered on its occupied mesh pixels. */
export function weaponIconStyle(image) {
  const file = String(image || '').split('/').at(-1);
  if (!Object.hasOwn(ART_BOUNDS, file)) return undefined;
  const [width, height, left, top, right, bottom] = ART_BOUNDS[file];
  const meshWidth = right - left;
  const meshHeight = bottom - top;
  const scale = Math.min(44 / meshWidth, 28 / meshHeight);
  return {
    width: `${width * scale}px`,
    height: `${height * scale}px`,
    left: `calc(50% - ${(left + meshWidth / 2) * scale}px)`,
    top: `calc(50% - ${(top + meshHeight / 2) * scale}px)`,
  };
}
