// 抖音数据中转 Worker（推荐流 / 合集 / 剧集 / 预设片单 + 管理面板）
// 部署：Cloudflare Workers 新建 → 粘贴 → Deploy
// 绑定 D1（变量名 DB）持久化片单；也兼容 KV（变量名 PRESETS）或纯内存
// 必填环境变量 PANEL_KEY = 面板 Token（不设置则管理接口全部拒绝）
// 片单存储：绑定 D1 数据库到变量 DB（自动建表）；未绑定则退化为内存
const UA_APP = "com.ss.android.ugc.aweme/110101 (Linux; U; Android 11; zh_CN; Pixel 5; Build/RQ3A.211001.001; Cronet/TTNetVersion:b4d74d15 2021-12-10)";
const UA_M = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_TT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

let MEM_PRESETS = [];

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: CORS });
}

// ---------- 鉴权 ----------
const FAILS = Object.create(null);   // ip -> {n, until}
const MAX_FAIL = 5;
const LOCK_MS = 600000;

function safeEq(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function panelKey(env) {
  return String((env && env.PANEL_KEY) || "").trim();
}

function publicKey(env) {
  return String((env && env.PUBLIC_KEY) || "").trim();
}

// 返回 "admin" | "guest" | ""
function roleOf(env, request) {
  const key = readKey(request);
  if (!key) return "";
  const admin = panelKey(env);
  const pub = publicKey(env);
  if (admin && safeEq(key, admin)) return "admin";
  if (pub && safeEq(key, pub)) return "guest";
  return "";
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "local";
}

function isLocked(ip) {
  const f = FAILS[ip];
  if (!f) return false;
  if (f.until && Date.now() < f.until) return true;
  if (f.until && Date.now() >= f.until) { delete FAILS[ip]; return false; }
  return false;
}

function markFail(ip) {
  const f = FAILS[ip] || { n: 0, until: 0 };
  f.n++;
  if (f.n >= MAX_FAIL) { f.until = Date.now() + LOCK_MS; f.n = 0; }
  FAILS[ip] = f;
}

function markOk(ip) { delete FAILS[ip]; }

function readKey(request) {
  let k = request.headers.get("X-Panel-Key") || "";
  if (!k) {
    const auth = request.headers.get("Authorization") || "";
    if (auth.indexOf("Bearer ") === 0) k = auth.slice(7);
  }
  return k.trim();
}
function firstUrl(o) {
  return (o && o.url_list && o.url_list[0]) || "";
}
function streamUrl(vid) {
  if (!vid) return "";
  return "https://www.iesdouyin.com/aweme/v1/play/?video_id=" + encodeURIComponent(vid) + "&ratio=1080p&line=0";
}
function slim(a) {
  const v = a.video || {};
  const img = a.images || [];
  const vid = String(v.vid || (v.play_addr && v.play_addr.uri) || "");
  return {
    id: String(a.aweme_id || ""),
    desc: String(a.desc || a.caption || "").replace(/\s+/g, " ").trim(),
    author: (a.author && (a.author.nickname || a.author.unique_id)) || "",
    cover: firstUrl(v.cover) || firstUrl(a.Cover) || (img[0] ? firstUrl(img[0]) : ""),
    vid: vid,
    video: streamUrl(vid),
    duration: Math.round((v.duration || a.duration || 0) / 1000),
    stats: { digg: (a.statistics && a.statistics.digg_count) || 0 }
  };
}

// ---------- TikTok ----------
const UA_DESK = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function ttIsTiktok(u) {
  return /tiktok\.com/i.test(String(u || ""));
}

// 从任意 TikTok 链接/文案提取 视频ID 或 短链
function ttExtract(text) {
  const s = String(text || "");
  let m = s.match(/https?:\/\/(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9_-]+\/?/);
  if (m) return { kind: "short", url: m[0] };
  // /t/XXXX 形式的短链
  m = s.match(/https?:\/\/(?:www\.)?tiktok\.com\/t\/[A-Za-z0-9_-]+\/?/);
  if (m) return { kind: "short", url: m[0] };
  m = s.match(/tiktok\.com\/@([A-Za-z0-9._-]*)\/video\/(\d{10,})/);
  if (m) return { kind: "video", user: m[1], id: m[2], url: "https://www.tiktok.com/@" + m[1] + "/video/" + m[2] };
  // /video/123 或 ?item_id=123 等
  m = s.match(/tiktok\.com\/[^\s]*?\/video\/(\d{10,})/) || s.match(/[?&](?:item_id|share_item_id)=(\d{10,})/);
  if (m) return { kind: "id", id: m[1] };
  m = s.match(/^\s*(\d{15,})\s*$/);
  if (m) return { kind: "id", id: m[1] };
  return null;
}

// 取出响应里所有 Set-Cookie 的 name=value（视频 CDN 需要带上，否则 403）
function cookieFrom(r) {
  let arr = [];
  try { if (typeof r.headers.getSetCookie === "function") arr = r.headers.getSetCookie(); } catch (e) {}
  if (!arr.length) {
    const s = r.headers.get("set-cookie");
    if (s) arr = s.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  }
  return arr.map(function (c) { return c.split(";")[0].trim(); }).filter(Boolean).join("; ");
}

function ttScript(html, id) {
  const re = new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)<\\/script>');
  const m = html.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

// 从页面 HTML 解析 itemStruct（兼容三种页面结构）
function ttParseItem(html, id) {
  let d = ttScript(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__");
  if (d) {
    const scope = d.__DEFAULT_SCOPE__ || {};
    const vd = scope["webapp.video-detail"] || {};
    const it = vd.itemInfo && vd.itemInfo.itemStruct;
    if (it) return it;
  }
  d = ttScript(html, "api-data");
  if (d) {
    const it = d.videoDetail && d.videoDetail.itemInfo && d.videoDetail.itemInfo.itemStruct;
    if (it) return it;
  }
  d = ttScript(html, "SIGI_STATE");
  if (d && d.ItemModule) {
    return d.ItemModule[id] || d.ItemModule[Object.keys(d.ItemModule)[0]] || null;
  }
  return null;
}

function ttPickVideoUrl(v) {
  if (v.playAddr && typeof v.playAddr === "string") return v.playAddr;
  const bi = v.bitrateInfo || [];
  for (const b of bi) {
    const l = b && b.PlayAddr && b.PlayAddr.UrlList;
    if (l && l[0]) return l[0];
  }
  if (v.downloadAddr && typeof v.downloadAddr === "string") return v.downloadAddr;
  return "";
}

async function ttFromPage(id) {
  let html = "", cookie = "", status = 0;
  try {
    const r = await fetch("https://www.tiktok.com/@_/video/" + id, {
      headers: {
        "User-Agent": UA_DESK,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.tiktok.com/"
      },
      redirect: "follow"
    });
    status = r.status;
    html = await r.text();
    cookie = cookieFrom(r);
  } catch (e) {
    return { err: "fetch:" + String((e && e.message) || e) };
  }
  const item = ttParseItem(html, id);
  if (!item) return { err: "no-data status=" + status + " len=" + html.length, html: html };
  const v = item.video || {};
  const out = {
    id: String(item.id || id),
    desc: String(item.desc || "").replace(/\s+/g, " ").trim(),
    author: (item.author && (item.author.uniqueId || item.author.nickname)) || "",
    cover: v.cover || v.originCover || v.dynamicCover || "",
    video: ttPickVideoUrl(v),
    cookie: cookie,
    direct: false,
    duration: parseInt(v.duration, 10) || 0,
    stats: {
      digg: (item.stats && item.stats.diggCount) || 0,
      play: (item.stats && item.stats.playCount) || 0
    }
  };
  if (!out.video) return { err: "no-video-url", html: html };
  return { out: out };
}

// 兜底：第三方解析（返回的是可直接播放的地址，不需要代理）
async function ttFromTikwm(id) {
  try {
    const r = await fetch("https://www.tikwm.com/api/?hd=1&url=" + encodeURIComponent("https://www.tiktok.com/@_/video/" + id), {
      headers: { "User-Agent": UA_DESK, "Accept": "application/json" }
    });
    const j = await r.json();
    const d = j && j.code === 0 && j.data;
    if (!d) return null;
    let play = d.hdplay || d.play || "";
    if (!play) return null;
    if (play.indexOf("http") !== 0) play = "https://www.tikwm.com" + play;
    return {
      id: String(d.id || id),
      desc: String(d.title || "").replace(/\s+/g, " ").trim(),
      author: (d.author && (d.author.unique_id || d.author.nickname)) || "",
      cover: d.cover || d.origin_cover || "",
      video: play,
      cookie: "",
      direct: true,
      duration: parseInt(d.duration, 10) || 0,
      stats: { digg: d.digg_count || 0, play: d.play_count || 0 }
    };
  } catch (e) {
    return null;
  }
}

// 抓取单个视频详情：先走官方页面，失败再走兜底
async function ttVideo(id) {
  const ck = "tt:" + id;
  const hit = cacheGet(ck);
  if (hit) return hit;
  const a = await ttFromPage(id);
  let out = a && a.out;
  if (!out) out = await ttFromTikwm(id);
  if (!out) return null;
  cacheSet(ck, out);
  return out;
}

// 解析 TikTok 短链 → 视频ID
async function ttResolveShort(url) {
  try {
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA_DESK } });
    const loc = r.headers.get("location") || "";
    let m = loc.match(/\/video\/(\d{10,})/) || loc.match(/[?&](?:item_id|share_item_id)=(\d{10,})/);
    if (m) return m[1];
  } catch (e) {}
  try {
    const r2 = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA_DESK } });
    const m2 = String(r2.url || "").match(/\/video\/(\d{10,})/);
    if (m2) return m2[1];
  } catch (e) {}
  return "";
}

async function ttIdFrom(raw) {
  const info = ttExtract(raw);
  if (!info) return "";
  if (info.kind === "short") return await ttResolveShort(info.url);
  return info.id || "";
}

// 代理白名单：TikTok 各区域 CDN
const TT_HOSTS = ["tiktok.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "tiktokv.com", "tiktokv.us", "tiktokv.eu", "byteoversea.com", "ibytedtos.com", "muscdn.com", "tikwm.com"];
function ttHostOk(h) {
  h = String(h || "").toLowerCase();
  return TT_HOSTS.some(function (d) { return h === d || h.endsWith("." + d); });
}

// ---------- 推荐流 ----------
async function feed(count, page) {
  const want = Math.max(6, Math.min(40, parseInt(count, 10) || 20));
  const p = Math.max(1, parseInt(page, 10) || 1);
  const seen = {}, out = [];
  const rounds = [1, 2, 3, 4].map(function (x) { return x + (p - 1) * 4; });
  const results = await Promise.all(rounds.map(function (r) {
    const u = "https://api.amemv.com/aweme/v1/feed/?aid=1128&count=20&version_code=110101&refresh_index=" + r;
    return fetch(u, { headers: { "User-Agent": UA_APP } }).then(r => r.json()).catch(() => null);
  }));
  for (const j of results) {
    for (const a of ((j && j.aweme_list) || [])) {
      const id = String(a.aweme_id || "");
      if (!id || seen[id]) continue;
      seen[id] = 1;
      const s = slim(a);
      if (!s.video) continue;
      out.push(s);
      if (out.length >= want) break;
    }
    if (out.length >= want) break;
  }
  return out;
}

// ---------- 合集 ----------
// 从分享文案里提取抖音链接
// 例：「8- 4.69 09/24 P@X.mD GiC:/ 我正在看【蟲垩纪第一季合集】 长按复制此条消息，去抖音搜索，和我一起看合集~ https://v.douyin.com/5vNt30mnp5k/ 3@3.com :2pm」
function extractUrl(text) {
  const s = String(text || "");
  // 优先短链
  let m = s.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+\/?/);
  if (m) return m[0];
  // 再找完整域名（可能带 playlet 等路径）
  m = s.match(/https?:\/\/(?:www\.)?(?:ies)?douyin\.com\/[^\s"'<>，。、；！？【】]*/);
  if (m) return m[0].replace(/[，。、；！？）)】\]]+$/, "");
  // 裸域名（没写协议）
  m = s.match(/(?:v\.)?douyin\.com\/[A-Za-z0-9_\/\-?=&%.]+/);
  if (m) return "https://" + m[0];
  return "";
}

// 从分享文案里提取剧名
// 例：「我正在看【《校花爱豆倒追俺》】长按复制此条消息...」
function extractTitle(text) {
  const s = String(text || "");
  let m = s.match(/【([^】]{1,60})】/);
  let t = m ? m[1] : "";
  if (!t) {
    m = s.match(/我正在看[「“"]?([^\s，。、；！？【】「」“”"]{2,40})/);
    t = m ? m[1] : "";
  }
  if (!t) return "";
  t = t.replace(/[《》「」“”"]/g, "").trim();
  t = t.replace(/\s*(合集|全集|完整版)$/, "").trim();
  return t.slice(0, 60);
}

async function resolveMix(input) {
  let s = String(input || "").trim();
  if (!s) return "";
  if (/^\d{15,}$/.test(s)) return s;
  const pm = s.match(/playlet_id=(\d+)/);
  if (pm) return pm[1];

  // 从分享文案里抠出链接
  const url = extractUrl(s);
  if (url) s = url;
  if (s.indexOf("douyin.com") < 0) return "";
  let target = s;
  if (/v\.douyin\.com/.test(s)) {
    try {
      const r = await fetch(s, { redirect: "manual", headers: { "User-Agent": UA_M } });
      const loc = r.headers.get("location") || "";
      if (loc) target = loc;
    } catch (e) {}
  }
  const m = target.match(/playlet[\/-]detail\/(\d+)/) || target.match(/object_id=(\d+)/) || target.match(/(\d{15,})/);
  return m ? m[1] : "";
}

async function mixInfo(playletId) {
  const u = "https://www.iesdouyin.com/web/api/playlet/detail/?reflow_source=reflow_page" +
    "&web_id=7701563488277284387&device_id=7701563488277284387&aid=1128&user_cip=1.1.1.1&playlet_id=" + playletId;
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA_M, Referer: "https://www.iesdouyin.com/" } });
    const j = await r.json();
    const p = j.playlet_info || {};
    return {
      id: String(p.playlet_id || playletId),
      title: String(p.playlet_name || "").replace(/^合集\s*·\s*/, "").trim(),
      desc: String(p.desc || "").replace(/\s+/g, " ").trim(),
      total: p.total_episode || 0,
      cover: firstUrl(p.cover_url),
      author: (p.author && p.author.nickname) || ""
    };
  } catch (e) {
    return { id: String(playletId), title: "", desc: "", total: 0, cover: "", author: "" };
  }
}

// 从第一条分集拿封面 + 描述（detail 没给封面/名字时兜底）
async function mixFirst(playletId) {
  try {
    const u = "https://www.iesdouyin.com/web/api/playlet/item/list/?reflow_source=reflow_page" +
      "&web_id=7701563488277284387&device_id=7701563488277284387&aid=1128&user_cip=1.1.1.1" +
      "&playlet_id=" + playletId + "&count=1&cursor=0";
    const r = await fetch(u, { headers: { "User-Agent": UA_M, Referer: "https://www.iesdouyin.com/" } });
    const j = await r.json();
    const a = (j.aweme_list || [])[0];
    if (!a) return null;
    const v = a.video || {};
    return {
      cover: firstUrl(v.cover) || firstUrl(a.Cover) || "",
      desc: String(a.desc || "").replace(/\s+/g, " ").trim(),
      author: (a.author && (a.author.nickname || a.author.unique_id)) || "",
      vid: String(v.vid || (v.play_addr && v.play_addr.uri) || "")
    };
  } catch (e) {
    return null;
  }
}

// 从描述里猜剧名：《书名号》优先，其次【】，再退回首段
function guessTitle(desc) {
  const s = String(desc || "");
  let m = s.match(/《([^》]{2,30})》/);
  if (m) return m[1].trim();
  m = s.match(/【([^】]{2,30})】/);
  if (m) return m[1].trim();
  m = s.match(/^([^#\s，。！？]{2,20})/);
  if (!m) return "";
  return m[1].replace(/第\s*[0-9一二三四五六七八九十]+\s*[集期话]/g, "").trim();
}

async function mixEpisodes(playletId, count) {
  const want = Math.max(10, Math.min(120, parseInt(count, 10) || 120));
  const out = [], seen = {};
  let cursor = 0;
  for (let i = 0; i < 8; i++) {
    const u = "https://www.iesdouyin.com/web/api/playlet/item/list/?reflow_source=reflow_page" +
      "&web_id=7701563488277284387&device_id=7701563488277284387&aid=1128&user_cip=1.1.1.1" +
      "&playlet_id=" + playletId + "&count=20&cursor=" + cursor;
    let j = null;
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA_M, Referer: "https://www.iesdouyin.com/" } });
      j = await r.json();
    } catch (e) { break; }
    const list = (j && j.aweme_list) || [];
    if (!list.length) break;
    for (const a of list) {
      const id = String(a.aweme_id || "");
      if (!id || seen[id]) continue;
      seen[id] = 1;
      out.push(slim(a));
    }
    if (out.length >= want) break;
    if (j.has_more === false) break;
    cursor = j.cursor || (cursor + list.length);
  }
  return out;
}

// ---------- 缓存 ----------
const CACHE = Object.create(null);
const TTL = 600000;
function cacheGet(k) {
  const h = CACHE[k];
  return h && Date.now() - h.ts < TTL ? h.data : null;
}
function cacheSet(k, d) { CACHE[k] = { ts: Date.now(), data: d }; }

async function mixSeries(playletId, count) {
  const ck = "s:" + playletId;
  const hit = cacheGet(ck);
  if (hit) return hit;
  const res = await Promise.all([mixEpisodes(playletId, count), mixInfo(playletId)]);
  const eps = res[0], info = res[1];
  const series = {
    playletId: playletId,
    title: info.title || "抖音合集",
    desc: info.desc || "",
    cover: info.cover || (eps[0] && eps[0].cover) || "",
    author: info.author || (eps[0] && eps[0].author) || "",
    total: info.total || eps.length,
    firstVid: (eps[0] && eps[0].vid) || "",
    episodes: eps.map(function (v, i) {
      return { ep: i + 1, awemeId: v.id, title: v.desc || "", cover: v.cover || info.cover || "", author: v.author || "", duration: v.duration || 0, digg: (v.stats && v.stats.digg) || 0, vid: v.vid || "", videoUrl: v.video || "" };
    })
  };
  cacheSet(ck, series);
  return series;
}

// ---------- 片单存储（D1 优先，KV/内存兜底） ----------
let DB_READY = false;

async function dbInit(env) {
  if (DB_READY || !env || !env.DB) return;
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS presets (playlet_id TEXT PRIMARY KEY, url TEXT, sort INTEGER DEFAULT 0, added_at INTEGER DEFAULT 0, custom_title TEXT DEFAULT '', share_title TEXT DEFAULT '', meta TEXT DEFAULT '')"
    ).run();
    // 老库补列
    try { await env.DB.prepare("ALTER TABLE presets ADD COLUMN custom_title TEXT DEFAULT ''").run(); } catch (e) {}
    try { await env.DB.prepare("ALTER TABLE presets ADD COLUMN share_title TEXT DEFAULT ''").run(); } catch (e) {}
    try { await env.DB.prepare("ALTER TABLE presets ADD COLUMN meta TEXT DEFAULT ''").run(); } catch (e) {}
    DB_READY = true;
  } catch (e) {}
}

async function loadPresets(env) {
  if (env && env.DB) {
    await dbInit(env);
    try {
      const r = await env.DB.prepare("SELECT playlet_id, url, sort, added_at, custom_title, share_title, meta FROM presets ORDER BY sort ASC, added_at ASC").all();
      const rows = (r && r.results) || [];
      return rows.map(function (x) {
        return { playletId: String(x.playlet_id), url: x.url || "", addedAt: x.added_at || 0, customTitle: x.custom_title || "", shareTitle: x.share_title || "", meta: x.meta || "" };
      });
    } catch (e) {}
  }
  if (env && env.PRESETS) {
    try {
      const s = await env.PRESETS.get("list");
      if (s) return JSON.parse(s);
    } catch (e) {}
  }
  return MEM_PRESETS.slice();
}

async function savePresets(env, list) {
  MEM_PRESETS = list.slice();
  if (env && env.DB) {
    await dbInit(env);
    try {
      await env.DB.prepare("DELETE FROM presets").run();
      for (let i = 0; i < list.length; i++) {
        const x = list[i];
        await env.DB.prepare(
          "INSERT INTO presets (playlet_id, url, sort, added_at, custom_title, share_title, meta) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(String(x.playletId), String(x.url || ""), i, x.addedAt || Date.now(), String(x.customTitle || ""), String(x.shareTitle || ""), typeof x.meta === "string" ? x.meta : JSON.stringify(x.meta || {})).run();
      }
    } catch (e) {}
  }
  if (env && env.PRESETS) {
    try { await env.PRESETS.put("list", JSON.stringify(list)); } catch (e) {}
  }
  return list;
}

// 片单条目：只存 pid，展示信息实时解析
function metaOf(entry) {
  const m = entry && entry.meta;
  if (!m) return null;
  if (typeof m === "object") return m;
  try { return JSON.parse(m); } catch (e) { return null; }
}

function badTitle(t) {
  t = String(t || "").trim();
  return !t || t === "抖音合集" || t.indexOf("抖音合集 ") === 0;
}

function buildPresetView(entry) {
  const pid = String(entry.playletId);
  const cache = metaOf(entry) || {};
  const custom = String(entry.customTitle || "").trim();
  const share = String(entry.shareTitle || "").trim();
  const apiTitle = String(cache.title || "").trim();
  const apiMeaningful = apiTitle && apiTitle !== "抖音合集" && apiTitle.indexOf("抖音合集 ") !== 0;
  const title = custom || (apiMeaningful ? apiTitle : (share || apiTitle)) || "抖音合集";
  return {
    playletId: pid,
    url: entry.url || "",
    addedAt: entry.addedAt || 0,
    title: title,
    originalTitle: apiTitle,
    customTitle: custom,
    shareTitle: share,
    desc: String(cache.desc || ""),
    cover: String(cache.cover || ""),
    author: String(cache.author || ""),
    total: parseInt(cache.total, 10) || 0,
    firstVid: String(cache.firstVid || "")
  };
}

// 拉一次真实信息并写回库（只在添加/改名/刷新时调用）
async function refreshPreset(env, entry) {
  try {
    const s = await mixSeries(String(entry.playletId), 120);
    const meta = { title: s.title || "", desc: s.desc || "", cover: s.cover || "", author: s.author || "", total: s.total || 0, firstVid: s.firstVid || "", ts: Date.now() };
    return meta;
  } catch (e) {
    return null;
  }
}

// 轻量取信息：只调 detail 接口（1 个请求），拿标题/封面/作者/集数
async function mixBrief(playletId) {
  const ck = "b:" + playletId;
  const hit = cacheGet(ck);
  if (hit) return hit;
  const info = await mixInfo(playletId);
  if (!info) return null;
  const badTitle = !info.title || info.title === "抖音合集" || info.title.indexOf("抖音合集 ") === 0;
  if (!info.cover || badTitle) {
    const f = await mixFirst(playletId);
    if (f) {
      if (!info.cover && f.cover) info.cover = f.cover;
      if (badTitle && f.desc) {
        const g = guessTitle(f.desc);
        if (g) info.title = g;
      }
      if (!info.author && f.author) info.author = f.author;
    }
  }
  if (!info.title && !info.cover) return null;
  cacheSet(ck, info);
  return info;
}

async function presetDetail(entry) {
  const cache = metaOf(entry);
  // 有缓存且名字有效、封面也在 → 直接用
  if (cache && !badTitle(cache.title) && cache.cover) return buildPresetView(entry);
  try {
    const info = await mixBrief(String(entry.playletId));
    if (info) {
      const meta = {
        title: badTitle(info.title) ? ((cache && cache.title) || "") : info.title,
        desc: info.desc || (cache && cache.desc) || "",
        cover: info.cover || (cache && cache.cover) || "",
        author: info.author || (cache && cache.author) || "",
        total: info.total || (cache && cache.total) || 0,
        firstVid: (cache && cache.firstVid) || ""
      };
      return buildPresetView(Object.assign({}, entry, { meta: meta }));
    }
  } catch (e) {}
  return buildPresetView(entry);
}

// 把补抓到的信息写回库
async function healPresets(env, list) {
  const dirty = [];
  for (const e of list) {
    const c = metaOf(e);
    if (!c || !c.title || !c.cover) dirty.push(e);
  }
  if (!dirty.length) return false;
  for (let i = 0; i < dirty.length; i += 6) {
    const batch = dirty.slice(i, i + 6);
    const infos = await Promise.all(batch.map(e => mixBrief(String(e.playletId)).catch(() => null)));
    batch.forEach(function (e, k) {
      const info = infos[k];
      if (!info) return;
      const old = metaOf(e) || {};
      e.meta = JSON.stringify({
        title: info.title || old.title || "",
        desc: info.desc || old.desc || "",
        cover: info.cover || old.cover || "",
        author: info.author || old.author || "",
        total: info.total || old.total || 0,
        firstVid: old.firstVid || ""
      });
    });
  }
  await savePresets(env, list);
  return true;
}


// ---------- 收藏批量导入 ----------
// 深度扫描 JSON，找出所有"合集"形态的对象
function coverOf(o) {
  const c = o.coverUrl || o.cover_url || o.cover || o.mix_cover || o.dynamicCover;
  if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
  return firstUrl(c) || firstUrl(o.share_info && o.share_info.cover_url) || "";
}

function deepCollect(o, out, seen) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const v of o) deepCollect(v, out, seen); return; }

  // 合集特征：有 id 类字段 + 标题 + 封面（抖音 playlet/mix，TikTok playlist）
  const pid = o.playlet_id || o.playletId || o.mix_id || o.mixId || o.series_id || o.seriesId ||
              o.playlist_id || o.playlistId || o.mixCode;
  const title = o.playlet_name || o.mix_name || o.mixName || o.series_name || o.title || o.name;
  const cover = coverOf(o);

  if (pid && title && String(pid).length >= 6 && !seen[String(pid)]) {
    seen[String(pid)] = 1;
    out.push({ playletId: String(pid), title: String(title).replace(/^合集\s*·\s*/, "").trim(), cover: cover });
  }
  for (const k in o) deepCollect(o[k], out, seen);
}

// 从任意 JSON 里提取合集
function extractPresets(data) {
  const out = [];
  deepCollect(data, out, Object.create(null));
  return out;
}

// ---------- 面板 HTML ----------
function panelHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>抖音片单</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;padding:14px;font:15px/1.5 -apple-system,system-ui,"PingFang SC",sans-serif;background:#131418;color:#e8e8ea;overscroll-behavior-y:contain}
h1{font-size:17px;margin:0 0 3px;display:flex;align-items:center;gap:8px}
.badge{font-size:11px;padding:2px 8px;border-radius:10px;background:#243;color:#8f8}
.badge.g{background:#332;color:#fc6}
.sub{color:#7c7c88;font-size:12px;margin-bottom:16px}
.card{background:#1c1e25;border:1px solid #2a2d37;border-radius:12px;padding:13px;margin-bottom:12px;contain:layout style}
label{display:block;font-size:12px;color:#94949f;margin-bottom:6px}
input,textarea{width:100%;padding:10px 12px;border-radius:9px;border:1px solid #323643;background:#14151a;color:#e8e8ea;font-size:15px;outline:none;font-family:inherit}
input:focus,textarea:focus{border-color:#5a6cff}
button{padding:10px 15px;border-radius:9px;border:none;font-size:14px;font-weight:600;cursor:pointer;background:#5a6cff;color:#fff;white-space:nowrap}
button:disabled{opacity:.5}
button.ghost{background:#282b35;color:#c2c2cc}
button.danger{background:#38222a;color:#ff7b8a}
button.mini{padding:7px 10px;font-size:13px;background:#282b35;color:#c2c2cc}
.row{display:flex;gap:8px;margin-top:9px}
.row input{flex:1}
.item{display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid #24262e}
.item:last-child{border-bottom:none}
.item img{width:44px;height:60px;object-fit:cover;border-radius:6px;background:#2a2d37;flex:none}
.item .ph{width:44px;height:60px;border-radius:6px;background:#2a2d37;flex:none}
.item .meta{flex:1;min-width:0}
.item .t{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .d{font-size:11.5px;color:#7c7c88;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ops{display:flex;gap:5px;flex:none}
.ops button{padding:6px 9px;font-size:12.5px;background:#282b35;color:#c2c2cc;border-radius:7px}
.empty{color:#666672;text-align:center;padding:22px 0;font-size:14px}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#2b2e39;padding:9px 17px;border-radius:18px;font-size:13.5px;opacity:0;transition:opacity .18s;pointer-events:none;z-index:9;max-width:90vw;text-align:center}
.toast.on{opacity:1}
.tabs{display:flex;gap:6px;margin-bottom:12px}
.tabs button{flex:1;background:#20232c;color:#9a9aa6;font-size:13px;padding:9px}
.tabs button.on{background:#5a6cff;color:#fff}
</style></head><body>
<h1>抖音片单 <span id="role"></span></h1>
<div class="sub" id="sub">每天 08:00 自动同步集数更新</div>

<div class="card" id="loginCard">
  <label>密码</label>
  <div class="row"><input type="password" id="key" placeholder="管理密码 或 公开密码" autocomplete="current-password"><button id="btnLogin" onclick="login()">进入</button></div>
</div>

<div id="main" style="display:none">
  <div class="card">
    <label>添加合集</label>
    <div class="row">
      <input id="url" placeholder="粘贴分享文案或链接" enterkeyhint="done">
      <button id="btnPaste" class="ghost" onclick="pasteClip()">粘贴</button>
      <button id="btnAdd" onclick="add()">添加</button>
    </div>
    <div id="addMsg" style="font-size:12.5px;color:#7c7c88;margin-top:8px"></div>
  </div>

  <div class="card" id="adminTools" style="display:none">
    <div class="tabs"><button id="tabList" class="on" onclick="switchTab('list')">片单</button><button id="tabImport" onclick="switchTab('import')">批量导入</button></div>

    <div id="paneImport" style="display:none">
      <div style="font-size:12px;color:#7c7c88;line-height:1.6;margin-bottom:8px">
        电脑登录抖音 → 我的 → 收藏 → 合集 → F12 → 找 <code style="color:#8fa4ff">mix/collection/list</code>
      </div>
      <div style="font-size:12px;color:#94949f;margin:8px 0 4px">① 粘贴响应 JSON</div>
      <textarea id="jbody" placeholder='{"status_code":0,"mix_infos":[...]}' style="height:86px;font-size:12.5px;font-family:ui-monospace,monospace"></textarea>
      <div class="row"><button onclick="importJson()">解析导入</button></div>
      <div style="font-size:12px;color:#94949f;margin:12px 0 4px">② 或 请求 URL + Cookie</div>
      <textarea id="rurl" placeholder="完整请求 URL（带 a_bogus）" style="height:52px;font-size:12.5px;font-family:ui-monospace,monospace"></textarea>
      <div class="row"><input id="rcookie" placeholder="Cookie"><button onclick="importUrl()">重放导入</button></div>
      <div id="imp" style="font-size:12.5px;color:#7c7c88;margin-top:9px"></div>
    </div>

    <div id="paneList">
      <label style="margin-bottom:0">片单 <span id="cnt" style="color:#666672"></span></label>
      <div id="list"><div class="empty">加载中…</div></div>
    </div>
  </div>

  <div class="card" id="guestListCard" style="display:none">
    <label>片单 <span id="cnt2" style="color:#666672"></span></label>
    <div id="list2"><div class="empty">加载中…</div></div>
  </div>

  <div class="row">
    <button class="ghost" onclick="load(true)">刷新</button>
    <button class="ghost" id="btnRefreshAll" style="display:none" onclick="refreshAll()">更新信息</button>
    <button class="ghost" onclick="logout()">退出</button>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
var K='', ROLE='';
var ITEMS=[];
function $(id){return document.getElementById(id)}
function tip(t){var e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove('on')},1900)}
function api(path, body){
  var o={headers:{'Content-Type':'application/json','X-Panel-Key':K}};
  if(body){o.method='POST';o.body=JSON.stringify(body)}
  return fetch(path,o).then(function(r){return r.json()});
}
function savedKey(){try{return localStorage.getItem('dykey')||''}catch(e){return ''}}
function saveKey(v){try{if(v)localStorage.setItem('dykey',v);else localStorage.removeItem('dykey')}catch(e){}}

function login(){
  var v=$('key').value.trim();
  if(!v){tip('请输入密码');return}
  K=v;
  $('btnLogin').disabled=true;
  api('/api/presets').then(function(j){
    $('btnLogin').disabled=false;
    if(j.error){K='';tip(j.error);return}
    saveKey(K);
    enter(j);
    runPending();
  }).catch(function(){$('btnLogin').disabled=false;K='';tip('连接失败')});
}
function enter(j){
  ROLE=j.role||'guest';
  $('loginCard').style.display='none';
  $('main').style.display='block';
  $('role').textContent = ROLE==='admin'?'管理':'公开';
  $('role').className='badge'+(ROLE==='admin'?'':' g');
  $('adminTools').style.display = ROLE==='admin'?'block':'none';
  $('guestListCard').style.display = ROLE==='admin'?'none':'block';
  $('btnRefreshAll').style.display = ROLE==='admin'?'inline-block':'none';
  render(j.items||[]);
}
function logout(){saveKey('');K='';location.reload()}

function load(showTip){
  return api('/api/presets').then(function(j){
    if(j.error){tip(j.error);if(showTip)logout();return}
    render(j.items||[]);
    if(showTip)tip('已刷新');
  }).catch(function(){if(showTip)tip('连接失败')});
}

function itemHTML(it,i,admin){
  var cover = it.cover ? '<img src="'+it.cover+'" loading="lazy" decoding="async">' : '<div class="ph"></div>';
  var d=[];
  if(it.total) d.push('全'+it.total+'集');
  if(it.author) d.push(it.author);
  if(it.customTitle&&it.originalTitle&&it.customTitle!==it.originalTitle&&ROLE==='admin') d.push('原名:'+it.originalTitle);
  var ops = admin ? '<div class="ops">'+
      '<button onclick="rename(\\\''+it.playletId+'\\\')">改名</button>'+
      '<button onclick="move('+i+',-1)">↑</button>'+
      '<button onclick="move('+i+',1)">↓</button>'+
      '<button onclick="del(\\\''+it.playletId+'\\\')">删</button></div>' : '';
  return '<div class="item">'+cover+
    '<div class="meta"><div class="t">'+esc(it.title||it.playletId)+'</div>'+
    '<div class="d">'+esc(d.join(' · '))+'</div></div>'+ops+'</div>';
}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

function render(items){
  ITEMS=items||[];
  var admin = ROLE==='admin';
  var html = ITEMS.length ? ITEMS.map(function(it,i){return itemHTML(it,i,admin)}).join('') : '<div class="empty">还没有合集</div>';
  if(admin){ $('list').innerHTML=html; $('cnt').textContent=ITEMS.length?'（'+ITEMS.length+' 部）':''; }
  else { $('list2').innerHTML=html; $('cnt2').textContent=ITEMS.length?'（'+ITEMS.length+' 部）':''; }
}

function pasteClip(){
  var el=$('url');
  function manual(msg){
    tip(msg);
    if(el){ el.focus(); try{ el.select(); }catch(e){} }
  }
  if(!navigator.clipboard || !navigator.clipboard.readText){
    manual('此浏览器不支持读取剪贴板，请长按输入框粘贴');
    return;
  }
  navigator.clipboard.readText().then(function(t){
    t = String(t||'').trim();
    if(!t){ manual('剪贴板是空的，请先复制抖音分享文案'); return; }
    el.value=t;
    tip('已粘贴');
  }).catch(function(){
    manual('请长按输入框手动粘贴（系统限制了自动读取）');
  });
}

function add(){
  var u=$('url').value.trim();
  if(!u){tip('请填写链接');return}
  $('btnAdd').disabled=true;
  $('addMsg').textContent='解析中…';
  api('/api/presets',{action:'add',url:u}).then(function(j){
    $('btnAdd').disabled=false;
    if(j.error){
      var e=String(j.error);
      if(e.indexOf('无法解析')>=0) e='没识别到合集链接，请确认复制的是「合集」分享内容';
      $('addMsg').textContent=e;tip(e);return;
    }
    $('url').value='';
    $('addMsg').textContent='已添加 ✓';
    render(j.items||[]);
    setTimeout(function(){ if($('addMsg').textContent==='已添加 ✓') $('addMsg').textContent=''; },2500);
  }).catch(function(){$('btnAdd').disabled=false;$('addMsg').textContent='网络错误';tip('网络错误')});
}

function rename(pid){
  var cur='';
  for(var i=0;i<ITEMS.length;i++) if(ITEMS[i].playletId===pid) cur=ITEMS[i].customTitle||'';
  var name=prompt('新名字（留空恢复原名）',cur);
  if(name===null)return;
  api('/api/presets',{action:'rename',playletId:pid,title:name.trim()}).then(function(j){
    if(j.error){tip(j.error);return}
    render(j.items||[]);tip('已改名');
  });
}
function del(pid){
  if(!confirm('确定删除这部剧？'))return;
  api('/api/presets',{action:'del',playletId:pid}).then(function(j){
    if(j.error){tip(j.error);return}
    render(j.items||[]);tip('已删除');
  });
}
function move(i,d){
  api('/api/presets',{action:'move',index:i,delta:d}).then(function(j){
    if(j.error){tip(j.error);return}
    render(j.items||[]);
  });
}
function refreshAll(){
  tip('更新中…');
  api('/api/presets',{action:'refresh'}).then(function(j){
    if(j.error){tip(j.error);return}
    render(j.items||[]);tip('已更新');
  });
}
function switchTab(t){
  var isList = t==='list';
  $('tabList').className = isList?'on':'';
  $('tabImport').className = isList?'':'on';
  $('paneList').style.display = isList?'block':'none';
  $('paneImport').style.display = isList?'none':'block';
}
function impResult(j){
  if(j.error){$('imp').textContent='失败：'+j.error;return}
  $('imp').textContent='新增 '+(j.added||0)+' 部，跳过 '+(j.skipped||0)+' 部';
  render(j.items||[]);
}
function importJson(){
  var t=$('jbody').value.trim();
  if(!t){tip('请粘贴 JSON');return}
  tip('解析中…');
  api('/api/import',{action:'json',body:t}).then(impResult).catch(function(e){$('imp').textContent='失败：'+e});
}
function importUrl(){
  var u=$('rurl').value.trim();
  if(!u){tip('请粘贴 URL');return}
  tip('请求中…');
  api('/api/import',{action:'url',url:u,cookie:$('rcookie').value.trim()}).then(impResult).catch(function(e){$('imp').textContent='失败：'+e});
}

// ===== 快捷指令支持：?add=<分享文案> =====
var PENDING_ADD='';
(function(){
  try{
    var sp=new URLSearchParams(location.search);
    var a=sp.get('add')||sp.get('text')||'';
    // 有些客户端会把参数再编码一次，这里解回来
    for(var i=0;i<2;i++){
      try{ var d=decodeURIComponent(a); if(d===a)break; a=d; }catch(e){ break; }
    }
    if(a){
      PENDING_ADD=a;
      var u=new URL(location.href);
      u.searchParams.delete('add');
      u.searchParams.delete('text');
      history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():''));
    }
  }catch(e){}
})();

function runPending(){
  if(!PENDING_ADD)return;
  var t=PENDING_ADD; PENDING_ADD='';
  $('url').value=t;
  // 已登录且能拿到按钮 → 自动添加
  if($('btnAdd') && $('main').style.display!=='none'){
    add();
  } else {
    $('addMsg').textContent='已填入，点「添加」即可';
  }
}

// 自动登录（用上次保存的密码）
(function(){
  var k=savedKey();
  if(!k){ runPending(); return; }
  K=k;
  api('/api/presets').then(function(j){
    if(j.error){saveKey('');K='';runPending();return}
    enter(j);
    runPending();
  }).catch(function(){K='';runPending()});
})();
</script></body></html>
`;
}

// ---------- 路由 ----------
// 批量刷新所有条目的真实信息（定时任务用）
async function refreshAllPresets(env) {
  const list = await loadPresets(env);
  if (!list.length) return { total: 0, updated: 0 };
  let updated = 0;
  for (let i = 0; i < list.length; i += 6) {
    const batch = list.slice(i, i + 6);
    const infos = await Promise.all(batch.map(e => mixBrief(String(e.playletId)).catch(() => null)));
    batch.forEach(function (e, k) {
      const info = infos[k];
      if (!info) return;
      const old = metaOf(e) || {};
      const nt = badTitle(info.title) ? (old.title || "") : info.title;
      const nc = info.cover || old.cover || "";
      const ntot = info.total || old.total || 0;
      if (nt !== old.title || nc !== old.cover || ntot !== old.total) updated++;
      e.meta = JSON.stringify({
        title: nt,
        desc: info.desc || old.desc || "",
        cover: nc,
        author: info.author || old.author || "",
        total: ntot,
        firstVid: old.firstVid || ""
      });
    });
  }
  await savePresets(env, list);
  return { total: list.length, updated: updated };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const u = new URL(request.url);
    const path = u.pathname.replace(/\/+$/, "") || "/";

    try {
      // 管理面板
      if (path === "/" && request.method === "GET") {
        return new Response(panelHTML(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      // 片单 API
      if (path === "/api/presets") {
        const PK = panelKey(env);
        if (!PK) return json({ error: "服务端未配置 PANEL_KEY，请在 Worker 设置里添加该环境变量" }, 503);

        const ip = clientIp(request);
        if (isLocked(ip)) return json({ error: "尝试次数过多，请 10 分钟后再试" }, 429);

        const role = roleOf(env, request);
        if (!role) {
          markFail(ip);
          return json({ error: "密码错误" }, 401);
        }
        markOk(ip);

        if (request.method === "GET") {
          const list = await loadPresets(env);
          const items = await Promise.all(list.map(async function (e) {
            try { return await presetDetail(e); } catch (err) { return { playletId: e.playletId, title: e.playletId, total: 0 }; }
          }));
          return json({ ok: true, role: role, count: items.length, items: items });
        }

        if (request.method === "POST") {
          let body = {};
          try { body = await request.json(); } catch (e) {}
          let list = await loadPresets(env);

          // 公开用户只能添加
          if (role !== "admin" && body.action !== "add") {
            return json({ error: "公开密码只能添加合集，不能修改或删除" }, 403);
          }

          if (body.action === "add") {
            const pid = await resolveMix(body.url);
            if (!pid) return json({ error: "无法解析合集链接" }, 400);
            if (list.some(function (x) { return String(x.playletId) === String(pid); })) {
              return json({ error: "该合集已在片单中" }, 400);
            }
            const entry = {
              playletId: pid,
              url: String(body.url || ""),
              addedAt: Date.now(),
              customTitle: "",
              shareTitle: extractTitle(body.url),
              meta: ""
            };
            const fresh = await refreshPreset(env, entry);
            if (fresh) entry.meta = JSON.stringify(fresh);
            list.push(entry);
            await savePresets(env, list);
          } else if (body.action === "rename") {
            const pid = String(body.playletId || "");
            const name = String(body.title || "").trim().slice(0, 60);
            list = list.map(function (x) {
              return x.playletId === pid ? Object.assign({}, x, { customTitle: name }) : x;
            });
            await savePresets(env, list);
          } else if (body.action === "del") {
            list = list.filter(function (x) { return x.playletId !== String(body.playletId || ""); });
            await savePresets(env, list);
          } else if (body.action === "move") {
            const i = parseInt(body.index, 10);
            const d = parseInt(body.delta, 10) || 0;
            const j = i + d;
            if (i >= 0 && i < list.length && j >= 0 && j < list.length) {
              const t = list[i]; list[i] = list[j]; list[j] = t;
              await savePresets(env, list);
            }
          } else if (body.action === "refresh") {
            // 强制刷新所有条目的真实信息
            for (let i = 0; i < list.length; i += 6) {
              const batch = list.slice(i, i + 6);
              const metas = await Promise.all(batch.map(e => refreshPreset(env, e).catch(() => null)));
              batch.forEach((e, k) => { if (metas[k]) e.meta = JSON.stringify(metas[k]); });
            }
            await savePresets(env, list);
          } else if (body.action === "clear") {
            list = [];
            await savePresets(env, list);
          }

          const items = await Promise.all(list.map(async function (e) {
            try { return await presetDetail(e); } catch (err) { return { playletId: e.playletId, title: e.playletId, total: 0 }; }
          }));
          return json({ ok: true, count: items.length, items: items });
        }
      }

      // 收藏批量导入
      if (path === "/api/import") {
        const PK = panelKey(env);
        if (!PK) return json({ error: "服务端未配置 PANEL_KEY" }, 503);
        const ip = clientIp(request);
        if (isLocked(ip)) return json({ error: "尝试次数过多，请 10 分钟后再试" }, 429);
        const key = readKey(request);
        if (!key || !safeEq(key, PK)) { markFail(ip); return json({ error: "Token 错误" }, 401); }
        markOk(ip);

        let body = {};
        try { body = await request.json(); } catch (e) {}

        let found = [];
        if (body.action === "json") {
          let data = null;
          try { data = JSON.parse(String(body.body || "")); }
          catch (e) { return json({ error: "JSON 解析失败，请确认粘贴的是完整响应" }, 400); }
          found = extractPresets(data);
        } else if (body.action === "url") {
          const target = String(body.url || "").trim();
          if (!/^https:\/\/www\.douyin\.com\//.test(target)) return json({ error: "URL 必须是 douyin.com 的请求地址" }, 400);
          let resp = null;
          try {
            resp = await fetch(target, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Referer": "https://www.douyin.com/user/self",
                "Accept": "application/json, text/plain, */*",
                "Cookie": String(body.cookie || "")
              }
            });
          } catch (e) {
            return json({ error: "请求失败：" + String((e && e.message) || e) }, 502);
          }
          let data = null;
          try { data = await resp.json(); } catch (e) { return json({ error: "响应不是 JSON（状态 " + resp.status + "）" }, 502); }
          if (data && data.status_code && data.status_code !== 0) {
            return json({ error: "抖音拒绝：" + (data.status_msg || data.message || data.status_code) }, 502);
          }
          found = extractPresets(data);
        } else {
          return json({ error: "action 必须是 json 或 url" }, 400);
        }

        if (!found.length) return json({ error: "没有识别到合集，确认粘贴的是收藏合集列表的响应" }, 400);

        let list = await loadPresets(env);
        const has = Object.create(null);
        for (const x of list) has[x.playletId] = 1;
        let added = 0, skipped = 0;
        const fresh = [];
        for (const f of found) {
          if (has[f.playletId]) { skipped++; continue; }
          has[f.playletId] = 1;
          const entry = { playletId: f.playletId, url: "", addedAt: Date.now(), customTitle: "", shareTitle: f.title || "", meta: "" };
          list.push(entry);
          fresh.push(entry);
          added++;
        }
        // 并发抓真实信息（每组 6 个）
        for (let i = 0; i < fresh.length; i += 6) {
          const batch = fresh.slice(i, i + 6);
          const metas = await Promise.all(batch.map(e => refreshPreset(env, e).catch(() => null)));
          batch.forEach((e, k) => { if (metas[k]) e.meta = JSON.stringify(metas[k]); });
        }
        await savePresets(env, list);

        const items = [];
        for (const e of list) {
          try { items.push(await presetDetail(e)); } catch (err) { items.push({ playletId: e.playletId, title: e.playletId, total: 0 }); }
        }
        return json({ ok: true, found: found.length, added: added, skipped: skipped, count: items.length, items: items });
      }

      // 模块用的片单接口（无需密码）
      if (path === "/presets") {
        const list = await loadPresets(env);
        const missing = [];
        const items = list.map(function (e) {
          const c = metaOf(e);
          if (c && !badTitle(c.title) && c.cover) return buildPresetView(e);
          missing.push(e);
          return null;
        });
        // 缺失的并发补抓（最多 12 个），并写回库
        if (missing.length) {
          const batch = missing.slice(0, 12);
          const infos = await Promise.all(batch.map(e => mixBrief(String(e.playletId)).catch(() => null)));
          const byPid = Object.create(null);
          batch.forEach(function (e, k) {
            const info = infos[k];
            if (!info) return;
            const old = metaOf(e) || {};
            const meta = {
              title: badTitle(info.title) ? (old.title || "") : info.title,
              desc: info.desc || old.desc || "",
              cover: info.cover || old.cover || "",
              author: info.author || old.author || "",
              total: info.total || old.total || 0,
              firstVid: old.firstVid || ""
            };
            byPid[e.playletId] = meta;
            e.meta = JSON.stringify(meta);
          });
          // 写回库（不阻塞响应以外的逻辑）
          if (Object.keys(byPid).length) {
            try { await savePresets(env, list); } catch (err) {}
          }
          for (let i = 0; i < items.length; i++) {
            if (items[i] === null) {
              const e = list[i];
              items[i] = buildPresetView(e);
            }
          }
        }
        return json({ ok: true, count: items.length, items: items });
      }

      // TikTok 单视频
      if (path === "/tt/video") {
        const raw = u.searchParams.get("url") || u.searchParams.get("id") || "";
        const vid = await ttIdFrom(raw);
        if (!vid) return json({ ok: false, error: "无法识别 TikTok 视频链接" }, 400);
        const item = await ttVideo(vid);
        if (!item) return json({ ok: false, error: "抓取失败，可能被风控（可访问 /tt/debug?url= 查看原因）" }, 502);
        return json({ ok: true, item: item });
      }

      // TikTok 诊断：看 Worker 到底拿到了什么
      if (path === "/tt/debug") {
        const raw = u.searchParams.get("url") || u.searchParams.get("id") || "";
        const vid = await ttIdFrom(raw);
        if (!vid) return json({ ok: false, step: "extract", error: "无法识别视频ID" }, 400);
        const a = await ttFromPage(vid);
        const html = (a && a.html) || "";
        const tw = (a && a.out) ? null : await ttFromTikwm(vid);
        return json({
          ok: !!((a && a.out) || tw),
          id: vid,
          page: a && a.out ? "ok" : (a && a.err),
          hasCookie: !!(a && a.out && a.out.cookie),
          videoHost: a && a.out ? (function () { try { return new URL(a.out.video).host; } catch (e) { return ""; } })() : "",
          markers: {
            universal: html.indexOf("__UNIVERSAL_DATA_FOR_REHYDRATION__") >= 0,
            apiData: html.indexOf('id="api-data"') >= 0,
            sigi: html.indexOf("SIGI_STATE") >= 0,
            captcha: /captcha|verify/i.test(html)
          },
          title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "",
          fallbackTikwm: tw ? "ok" : "fail"
        });
      }

      // TikTok 批量（多个链接）
      if (path === "/tt/batch") {
        const raw = u.searchParams.get("urls") || "";
        const lines = raw.split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
        const out = [];
        for (const line of lines.slice(0, 30)) {
          const vid = await ttIdFrom(line);
          if (!vid) continue;
          const item = await ttVideo(vid);
          if (item) out.push(item);
        }
        return json({ ok: true, count: out.length, items: out });
      }

      // TikTok 推荐流
      if (path === "/tt/feed") {
        const region = u.searchParams.get("region") || "TW";
        const ckKey = "ttfeed:" + region;
        const hit = cacheGet(ckKey);
        if (hit) return json({ ok: true, count: hit.length, items: hit, cached: true });
        const lang = region === "TW" ? "zh-Hant-TW" : "en";
        let html = "";
        try {
          const r = await fetch("https://www.tiktok.com/foryou?lang=" + lang, {
            headers: { "User-Agent": UA_DESK, "Accept-Language": region === "TW" ? "zh-TW,zh;q=0.9" : "en;q=0.9", "Referer": "https://www.tiktok.com/" }
          });
          html = await r.text();
        } catch (e) {
          return json({ ok: false, error: "抓取失败：" + String((e && e.message) || e) }, 502);
        }
        let cookie = "";
        const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
        if (!m) return json({ ok: false, error: "页面结构变化，未找到数据块", len: html.length }, 502);
        let list = [];
        try {
          const d = JSON.parse(m[1]);
          const sc = d.__DEFAULT_SCOPE__ || {};
          const fy = sc["webapp.foryou.video"] || {};
          list = fy.itemList || [];
        } catch (e) {
          return json({ ok: false, error: "JSON 解析失败" }, 502);
        }
        const items = [];
        for (const it of list) {
          const v = it.video || {};
          if (!v.playAddr) continue;
          items.push({
            id: String(it.id),
            desc: String(it.desc || "").replace(/\s+/g, " ").trim(),
            author: (it.author && (it.author.uniqueId || it.author.nickname)) || "",
            cover: v.cover || v.originCover || v.dynamicCover || "",
            video: v.playAddr,
            duration: parseInt(v.duration, 10) || 0,
            stats: { digg: (it.stats && it.stats.diggCount) || 0, play: (it.stats && it.stats.playCount) || 0 }
          });
        }
        if (items.length) cacheSet(ckKey, items);
        return json({ ok: true, count: items.length, items: items, region: region });
      }

      // TikTok 视频代理（TikTok CDN 按地区封 IP / 需要 cookie，由 Worker 中转）
      if (path === "/tt/proxy") {
        const target = u.searchParams.get("url") || "";
        let tu = null;
        try { tu = new URL(target); } catch (e) {}
        if (!tu || tu.protocol !== "https:" || !ttHostOk(tu.hostname)) {
          return new Response("bad target", { status: 400, headers: CORS });
        }
        const rq = request.headers.get("Range");
        const h = {
          "User-Agent": UA_DESK,
          "Referer": "https://www.tiktok.com/",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9"
        };
        const ck = u.searchParams.get("ck") || "";
        if (ck) h["Cookie"] = ck;
        if (rq) h["Range"] = rq;
        let r;
        try {
          r = await fetch(tu.toString(), { method: request.method === "HEAD" ? "HEAD" : "GET", headers: h });
        } catch (e) {
          return new Response("upstream error", { status: 502, headers: CORS });
        }
        const out = new Headers();
        out.set("Access-Control-Allow-Origin", "*");
        out.set("Content-Type", r.headers.get("content-type") || "video/mp4");
        const cl = r.headers.get("content-length");
        if (cl) out.set("Content-Length", cl);
        const cr = r.headers.get("content-range");
        if (cr) out.set("Content-Range", cr);
        out.set("Accept-Ranges", "bytes");
        if (r.status < 400) out.set("Cache-Control", "public, max-age=600");
        return new Response(r.body, { status: r.status, headers: out });
      }

      // 片单搜索（只搜自己添加的合集）
      if (path === "/search") {
        const kw = String(u.searchParams.get("q") || "").trim().toLowerCase();
        if (!kw) return json({ ok: true, count: 0, items: [] });
        const list = await loadPresets(env);
        // 有名字缺失的条目先补一遍（最多 8 个），否则搜不到
        const need = list.filter(function (e) {
          const c = metaOf(e);
          return !c || badTitle(c.title);
        }).slice(0, 8);
        if (need.length) {
          const infos = await Promise.all(need.map(e => mixBrief(String(e.playletId)).catch(() => null)));
          need.forEach(function (e, k) {
            const info = infos[k];
            if (!info) return;
            const old = metaOf(e) || {};
            e.meta = JSON.stringify({
              title: badTitle(info.title) ? (old.title || "") : info.title,
              desc: info.desc || old.desc || "",
              cover: info.cover || old.cover || "",
              author: info.author || old.author || "",
              total: info.total || old.total || 0,
              firstVid: old.firstVid || ""
            });
          });
          try { await savePresets(env, list); } catch (err) {}
        }
        const items = [];
        for (const e of list) {
          const v = buildPresetView(e);
          const hay = (v.title + " " + v.originalTitle + " " + v.shareTitle + " " + v.author + " " + v.desc).toLowerCase();
          if (hay.indexOf(kw) >= 0) items.push(v);
        }
        return json({ ok: true, count: items.length, items: items, keyword: kw });
      }

      if (path === "/feed") {
        const items = await feed(u.searchParams.get("count"), u.searchParams.get("page"));
        return json({ ok: true, count: items.length, items: items });
      }

      if (path === "/series") {
        const pid = await resolveMix(u.searchParams.get("url") || u.searchParams.get("id") || "");
        if (!pid) return json({ ok: false, error: "无法解析合集链接" }, 400);
        const series = await mixSeries(pid, u.searchParams.get("count"));
        return json({ ok: true, series: series, count: series.episodes.length });
      }

      if (path === "/mix") {
        const pid = await resolveMix(u.searchParams.get("url") || u.searchParams.get("id") || "");
        if (!pid) return json({ ok: false, error: "无法解析合集链接" }, 400);
        const series = await mixSeries(pid, u.searchParams.get("count"));
        const items = series.episodes.map(function (e) {
          return { id: e.awemeId, desc: e.title, author: e.author, cover: e.cover, vid: e.vid, video: e.videoUrl, duration: e.duration, stats: { digg: e.digg } };
        });
        return json({
          ok: true, playletId: pid,
          info: { title: series.title, desc: series.desc, cover: series.cover, total: series.total, author: series.author },
          count: items.length, items: items
        });
      }

      return json({ ok: true, hint: "面板 / | 片单 /presets | 推荐流 /feed | 合集 /mix?url= | 剧集 /series?url= | TikTok 推荐 /tt/feed | TikTok 视频 /tt/video?url=" });
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
  },

  // 定时刷新（Cloudflare Cron Triggers）
  async scheduled(event, env, ctx) {
    const task = refreshAllPresets(env);
    if (ctx && ctx.waitUntil) ctx.waitUntil(task);
    else await task;
  }
};
