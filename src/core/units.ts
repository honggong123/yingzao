// 形制单位系统 —— 《营造法式》"材分制"
// 出自《营造法式·大木作制度》（卷四、卷五）：
//   "凡构屋之制，皆以材为祖。材有八等，度屋之大小，因而用之。"
//   材广十五分、厚十分；栔广六分、厚四分；足材 = 材 + 栔 = 二十一分。
//   华栱（昂）每跳出跳三十
// 本作中 1 分 = 1 世界单位，所有构件尺寸一律以"分"书写。

/** 材分八等（广×厚，单位：寸），一等用于殿身 9–11 间，八等用于亭榭小殿 */
export const CAI_GRADES = [
  { grade: 1, cai: 9.0, hou: 6.0, use: '殿身 9–11 间' },
  { grade: 2, cai: 8.25, hou: 5.5, use: '殿身 5–7 间' },
  { grade: 3, cai: 7.5, hou: 5.0, use: '殿身 3–5 间 · 堂 7 间' },
  { grade: 4, cai: 7.2, hou: 4.8, use: '殿身 3 间 · 厅堂 5 间' },
  { grade: 5, cai: 6.6, hou: 4.4, use: '殿身 3 间 · 厅堂 3 间' },
  { grade: 6, cai: 6.0, hou: 4.0, use: '亭榭 · 小殿' },
  { grade: 7, cai: 5.25, hou: 3.5, use: '小殿 · 亭榭' },
  { grade: 8, cai: 4.5, hou: 3.0, use: '亭榭 · 藻井' }
] as const

/** 单材广 15 分（高） */
export const FEN_CAI_G = 15
/** 单材厚 10 分 */
export const FEN_CAI_H = 10
/** 栔广 6 分 */
export const FEN_QI = 6
/** 足材 = 材 + 栔 = 21 分（华栱用足材） */
export const FEN_ZUCAI = FEN_CAI_G + FEN_QI
/** 每跳 30 分 */
export const FEN_TIAO = 30

/** 各类横栱定长（分）。构建期以《营造法式》原文再核验，此处为常用引值 */
export const GONG_LEN = {
  /** 泥道栱 63 分 */
  nidao: 63,
  /** 瓜子栱 62 分 */
  guazi: 62,
  /** 令栱 72 分 */
  ling: 72,
  /** 慢栱 92 分 */
  man: 92
} as const

/** 栱端卷杀（《营造法式》卷四"造栱之制"）：瓣数与每瓣长度均为原文数值 */
export const JUANSHA = {
  /** 华栱：两卷头者每头四瓣、每瓣长四分 */
  hua: { banes: 4, banLen: 4 },
  /** 泥道栱/瓜子栱：每头四瓣、每瓣长四分 */
  heng: { banes: 4, banLen: 4 },
  /** 令栱：每头五瓣、每瓣长四分 */
  ling: { banes: 5, banLen: 4 },
  /** 慢栱：每头四瓣、每瓣长三分 */
  man: { banes: 4, banLen: 3 }
} as const

/** 分 → 世界单位（本作 1 分 = 1 单位；如需缩放场景只改这里） */
export const FEN = 1
