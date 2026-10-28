var WidgetMetadata = {
  id: "douyin.video.feed",
  title: "抖音",
  version: "2.8.0",
  requiredVersion: "0.0.1",
  description: "抖音片单 + 推荐流 + 合集 + TikTok，支持搜索已添加的片单",
  author: "Minis",
  globalParams: [
    { name: "base", title: "API 地址", type: "input", default: "", description: "填你部署的 douyin-worker 地址；留空使用内置地址" }
  ],
  modules: [
    {
      id: "dyRank",
      title: "片单",
      functionName: "loadDyRank",
      cacheDuration: 300,
      params: [
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "dyFeed",
      title: "推荐流",
      functionName: "loadDyFeed",
      cacheDuration: 300,
      params: [
        { name: "page", title: "换一批", type: "page" }
      ]
    },
    {
      id: "dyMix",
      title: "合集",
      functionName: "loadDyMix",
      cacheDuration: 600,
      params: [
        { name: "url", title: "合集链接", type: "input", description: "粘贴抖音合集分享链接，如 https://v.douyin.com/xxxx" },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "dyTt",
      title: "TikTok",
      functionName: "loadDyTikTok",
      cacheDuration: 300,
      params: [
        { name: "url", title: "视频链接", type: "input", description: "粘贴 TikTok 视频链接，支持 vm.tiktok.com 短链" },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: []
    }
  ],
  search: {
    title: "搜索片单",
    functionName: "searchPresets",
    params: [
      { name: "keyword", title: "关键词", type: "input", placeholders: [{ title: "剧名", value: "" }] },
      { name: "page", title: "页码", type: "page" }
    ]
  }
};

var DY_FALLBACK = "https://dytk.518518.qzz.io";

// ---------- link 编解码 ----------
// dy:v:<awemeId>:<vid>
// dy:m:<playletId>:<首集vid>
// dy:e:<playletId>:<ep>:<vid>
// 末尾可跟 "!<encodeURIComponent(base)>"
function dySplitBase(raw) {
  var s = String(raw || "");
  var i = s.indexOf("!");
  if (i < 0) return { link: s, base: "" };
  return { link: s.slice(0, i), base: decodeURIComponent(s.slice(i + 1)) };
}

function dyWithBase(link, base) {
  var b = String(base || "").trim();
  if (!/^https?:\/\//i.test(b)) return link;
  return link + "!" + encodeURIComponent(b);
}

function dyParse(raw) {
  var sp = dySplitBase(raw);
  var s = sp.link;
  if (s.indexOf("dy:") !== 0) return null;
  var p = s.split(":");
  var out = { base: sp.base };
  if (p[1] === "v" && /^\d{8,}$/.test(p[2])) { out.kind = "v"; out.id = p[2]; out.vid = p[3] || ""; return out; }
  if (p[1] === "m" && /^\d{8,}$/.test(p[2])) { out.kind = "m"; out.playletId = p[2]; out.vid = p[3] || ""; return out; }
  if (p[1] === "e" && /^\d{8,}$/.test(p[2])) { out.kind = "e"; out.playletId = p[2]; out.episode = parseInt(p[3], 10) || 0; out.vid = p[4] || ""; return out; }
  if (p[1] === "t" && /^\d{10,}$/.test(p[2])) { out.kind = "t"; out.ttid = p[2]; return out; }
  return null;
}

function dyNormBase(b) {
  b = String(b || "").trim();
  if (!/^https?:\/\//i.test(b)) return "";
  if (b.charAt(b.length - 1) === "/") b = b.slice(0, -1);
  return b;
}

var DY_LAST_BASE = "";

function dyBase(params) {
  var b = dyNormBase(params && params.base);
  if (b) { DY_LAST_BASE = b; return b; }
  if (DY_LAST_BASE) return DY_LAST_BASE;
  return DY_FALLBACK;
}

function dyBaseFrom(p) {
  var b = dyNormBase(p && p.base);
  if (b) { DY_LAST_BASE = b; return b; }
  if (DY_LAST_BASE) return DY_LAST_BASE;
  return DY_FALLBACK;
}

// ---------- 网络 ----------
async function dyGet(url) {
  try {
    var res = await Widget.http.get(url, { headers: { accept: "application/json" } });
    var body = res && res.data !== undefined ? res.data : res;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { return null; } }
    if (!body || body.ok === false) return null;
    return body;
  } catch (e) {
    return null;
  }
}

function dyStreamUrl(vid) {
  return "https://www.iesdouyin.com/aweme/v1/play/?video_id=" + encodeURIComponent(vid) + "&ratio=1080p&line=0";
}

function dyDuration(sec) {
  sec = parseInt(sec, 10) || 0;
  if (!sec) return "";
  var m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

function dyStat(n) {
  n = parseInt(n, 10) || 0;
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "亿";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return String(n);
}

async function dySave(item) {
  try { if (Widget.storage && Widget.storage.set) await Widget.storage.set("dyi:" + item.id, JSON.stringify(item)); } catch (e) {}
}

async function dyLoad(id) {
  try {
    if (!Widget.storage || !Widget.storage.get) return null;
    var s = await Widget.storage.get("dyi:" + id);
    if (!s) return null;
    return typeof s === "string" ? JSON.parse(s) : s;
  } catch (e) { return null; }
}

// ---------- 条目 ----------
function dyVideoItem(v, base) {
  var title = String(v.desc || "").trim() || "抖音视频";
  var remark = [];
  if (v.author) remark.push(v.author);
  var dur = dyDuration(v.duration);
  if (dur) remark.push(dur);
  if (v.stats && v.stats.digg) remark.push("赞 " + dyStat(v.stats.digg));
  var link = dyWithBase("dy:v:" + v.id + ":" + (v.vid || ""), base);
  var item = {
    id: "dy:v:" + v.id + ":" + (v.vid || ""),
    type: "url",
    mediaType: "movie",
    title: title,
    coverUrl: v.cover || "",
    posterPath: v.cover || "",
    backdropPath: v.cover || "",
    description: title,
    link: link,
    remark: remark.join(" · ")
  };
  if (v.vid) item.videoUrl = dyStreamUrl(v.vid);
  if (dur) item.durationText = dur;
  if (v.duration) item.duration = parseInt(v.duration, 10) || 0;
  return item;
}

function dySeriesItem(pid, info, episodes, base) {
  var cover = (info && info.cover) || "";
  var total = (info && info.total) || (episodes ? episodes.length : 0);
  var firstVid = (episodes && episodes[0] && episodes[0].vid) || "";
  var series = {
    id: "dy:m:" + pid + (firstVid ? ":" + firstVid : ""),
    type: "url",
    mediaType: "tv",
    title: (info && info.title) || "抖音合集",
    coverUrl: cover,
    posterPath: cover,
    backdropPath: cover,
    description: (info && info.desc) || "",
    link: dyWithBase("dy:m:" + pid + (firstVid ? ":" + firstVid : ""), base),
    remark: total ? "全" + total + "集" : "",
    season: 1,
    selectedSeasonNumber: 1,
    playerType: "app"
  };
  if (firstVid) series.videoUrl = dyStreamUrl(firstVid);
  return series;
}

function dyEpisodeItem(pid, ep, v, base, seriesCover, seriesTitle) {
  var d = v && v.desc ? String(v.desc).replace(/\s+/g, " ").trim() : "";
  var cover = (v && v.cover) || seriesCover || "";
  var vid = (v && v.vid) || "";
  var title = seriesTitle ? seriesTitle + " 第" + ep + "集" : "第" + ep + "集";
  var item = {
    id: "dy:e:" + pid + ":" + ep + ":" + vid,
    type: "url",
    mediaType: "tv",
    title: title,
    description: d ? "第" + ep + "集 · " + d.slice(0, 60) : "第" + ep + "集",
    coverUrl: cover,
    posterPath: cover,
    backdropPath: cover,
    link: dyWithBase("dy:e:" + pid + ":" + ep + ":" + vid, base),
    season: 1,
    seasonNumber: 1,
    episode: ep,
    episodeNumber: ep,
    duration: v && v.duration ? parseInt(v.duration, 10) : 0,
    durationText: dyDuration(v && v.duration),
    playerType: "app"
  };
  if (vid) item.videoUrl = dyStreamUrl(vid);
  return item;
}

async function dyMixData(ref, base) {
  var body = await dyGet(base + "/mix?url=" + encodeURIComponent(ref) + "&count=120");
  if (!body) return null;
  return { info: body.info || {}, items: body.items || [], pid: String(body.playletId || "") };
}

// ---------- 片单（Worker 面板维护的合集列表） ----------
// ---------- 搜索已添加的片单 ----------
async function searchPresets(params) {
  params = params || {};
  var kw = String(params.keyword || "").trim();
  if (!kw) return [];
  var base = dyBase(params);
  var body = await dyGet(base + "/search?q=" + encodeURIComponent(kw));
  if (!body || !body.items || !body.items.length) return [];
  var out = [];
  for (var i = 0; i < body.items.length; i++) {
    var p = body.items[i];
    if (!p || !p.playletId) continue;
    var firstVid = p.firstVid || "";
    var cover = p.cover || "";
    var pid = String(p.playletId);
    var item = {
      id: "dy:m:" + pid + (firstVid ? ":" + firstVid : ""),
      type: "url",
      mediaType: "tv",
      title: p.title || "抖音合集",
      coverUrl: cover,
      posterPath: cover,
      backdropPath: cover,
      description: p.desc || "",
      link: dyWithBase("dy:m:" + pid + (firstVid ? ":" + firstVid : ""), base),
      remark: p.total ? "全" + p.total + "集" : "",
      season: 1,
      selectedSeasonNumber: 1,
      playerType: "app"
    };
    if (firstVid) item.videoUrl = dyStreamUrl(firstVid);
    out.push(item);
    await dySave(item);
  }
  return out;
}

async function loadDyRank(params) {
  params = params || {};
  var base = dyBase(params);
  var body = await dyGet(base + "/presets");
  if (!body || !body.items || !body.items.length) return [];
  var out = [];
  for (var i = 0; i < body.items.length; i++) {
    var p = body.items[i];
    if (!p || !p.playletId) continue;
    var firstVid = p.firstVid || "";
    var cover = p.cover || "";
    var pid = String(p.playletId);
    var item = {
      id: "dy:m:" + pid + (firstVid ? ":" + firstVid : ""),
      type: "url",
      mediaType: "tv",
      title: p.title || "抖音合集",
      coverUrl: cover,
      posterPath: cover,
      backdropPath: cover,
      description: p.desc || "",
      link: dyWithBase("dy:m:" + pid + (firstVid ? ":" + firstVid : ""), base),
      remark: p.total ? "全" + p.total + "集" : "",
      season: 1,
      selectedSeasonNumber: 1,
      playerType: "app"
    };
    if (firstVid) item.videoUrl = dyStreamUrl(firstVid);
    out.push(item);
    await dySave(item);
  }
  return out;
}

// ---------- TikTok 播放地址 ----------
// 官方 CDN 地址：走 Worker 代理，并带上页面返回的 cookie（否则 403）
// 兜底解析地址（direct）：可直接播放
function dyTtPlay(base, v) {
  if (!v || !v.video) return "";
  if (v.direct) return v.video;
  var u = base + "/tt/proxy?url=" + encodeURIComponent(v.video);
  if (v.cookie) u += "&ck=" + encodeURIComponent(v.cookie);
  return u;
}

// ---------- TikTok ----------
async function loadDyTikTok(params) {
  params = params || {};
  var raw = String(params.url || "").trim();
  if (!raw) return [];
  var base = dyBase(params);
  var body = await dyGet(base + "/tt/video?url=" + encodeURIComponent(raw));
  if (!body || !body.item) return [];
  var v = body.item;
  var title = String(v.desc || "").trim() || "TikTok 视频";
  var remark = [];
  if (v.author) remark.push("@" + v.author);
  var d = dyDuration(v.duration);
  if (d) remark.push(d);
  if (v.stats && v.stats.digg) remark.push("赞 " + dyStat(v.stats.digg));
  var playUrl = dyTtPlay(base, v);
  var item = {
    id: "dy:t:" + v.id,
    type: "url",
    mediaType: "movie",
    title: title,
    coverUrl: v.cover || "",
    posterPath: v.cover || "",
    backdropPath: v.cover || "",
    description: title,
    link: "dy:t:" + v.id + "!" + encodeURIComponent(base),
    remark: remark.join(" · ")
  };
  if (playUrl) item.videoUrl = playUrl;
  if (d) item.durationText = d;
  if (v.duration) item.duration = parseInt(v.duration, 10) || 0;
  await dySave(item);
  return [item];
}

// ---------- 列表 ----------
async function loadDyFeed(params) {
  params = params || {};
  var base = dyBase(params);
  var page = parseInt(params.page, 10) || 1;
  var body = await dyGet(base + "/feed?count=20&page=" + page);
  if (!body) return [];
  var list = body.items || [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var it = dyVideoItem(list[i], base);
    out.push(it);
    await dySave(it);
  }
  return out;
}

async function loadDyMix(params) {
  params = params || {};
  var base = dyBase(params);
  var url = String(params.url || "").trim();
  if (!url) return [];
  var data = await dyMixData(url, base);
  if (!data || !data.pid) return [];
  var series = dySeriesItem(data.pid, data.info, data.items, base);
  await dySave(series);
  return [series];
}

// ---------- 详情 ----------
async function loadDetail(link) {
  var p = dyParse(link);
  if (!p) return null;

  if (p.kind === "v") {
    var vid = "dy:v:" + p.id + ":" + p.vid;
    var cached = await dyLoad(vid);
    if (cached) { cached.link = link; return cached; }
    return {
      id: vid,
      type: "url",
      mediaType: "movie",
      title: "抖音视频 " + p.id,
      link: link
    };
  }

  if (p.kind === "t") {
    var tid = "dy:t:" + p.ttid;
    var tc = await dyLoad(tid);
    if (tc) { tc.link = link; return tc; }
    return { id: tid, type: "url", mediaType: "movie", title: "TikTok 视频", link: link };
  }

  if (p.kind === "m" || p.kind === "e") {
    var pid = p.playletId;
    var base = dyBaseFrom(p);
    var data = await dyMixData(pid, base);
    if (!data || !data.items.length) {
      return {
        id: "dy:m:" + pid + (p.vid ? ":" + p.vid : ""),
        type: "url",
        mediaType: "tv",
        title: "抖音合集 " + pid,
        link: link,
        remark: "数据加载失败，请检查 API 地址"
      };
    }
    var series = dySeriesItem(pid, data.info, data.items, base);
    series.episodeItems = [];
    for (var i = 0; i < data.items.length; i++) {
      series.episodeItems.push(dyEpisodeItem(pid, i + 1, data.items[i], base, series.coverUrl, series.title));
    }
    if (series.episodeItems.length) series.episode = series.episodeItems[0].episode;
    series.playerType = "app";
    await dySave(series);
    return series;
  }
  return null;
}

// ---------- 播放 ----------
async function loadResource(params) {
  params = params || {};
  var raw = params.link != null && params.link !== "" ? params.link : params.id;
  var p = dyParse(raw);
  if (!p && params.id) p = dyParse(params.id);
  if (!p) return [];

  if (p.kind === "t") {
    var tb = dyBaseFrom(p);
    // 签名地址会过期，优先实时向 Worker 取；失败再回退缓存
    var tt = await dyGet(tb + "/tt/video?id=" + encodeURIComponent(p.ttid));
    var tUrl = tt && tt.item ? dyTtPlay(tb, tt.item) : "";
    if (!tUrl) {
      var cached = await dyLoad("dy:t:" + p.ttid);
      if (cached && cached.videoUrl) tUrl = cached.videoUrl;
    }
    if (!tUrl) return [];
    return [{ name: "TikTok", description: "代理播放", url: tUrl, playerType: "app" }];
  }

  if (p.kind === "v") {
    if (!p.vid) return [];
    return [{ name: "抖音", description: "1080P · 自动跳转", url: dyStreamUrl(p.vid), playerType: "app" }];
  }

  if (p.kind === "e") {
    var ep = p.episode || parseInt(params.episode, 10) || parseInt(params.episodeNumber, 10) || 1;
    if (p.vid) {
      return [{ name: "抖音 · 第" + ep + "集", description: "1080P · 自动跳转", url: dyStreamUrl(p.vid), playerType: "app" }];
    }
    var base = dyBaseFrom(p);
    var data = await dyMixData(p.playletId, base);
    if (!data || !data.items.length) return [];
    var v = data.items[ep - 1];
    if (!v || !v.vid) return [];
    return [{
      name: "抖音 · 第" + ep + "集",
      description: dyDuration(v.duration) || "1080P",
      url: dyStreamUrl(v.vid),
      playerType: "app"
    }];
  }

  if (p.kind === "m") {
    var mEp = parseInt(params.episode, 10) || parseInt(params.episodeNumber, 10) || 1;
    if (p.vid && mEp === 1) {
      return [{ name: "抖音 · 第1集", description: "1080P · 自动跳转", url: dyStreamUrl(p.vid), playerType: "app" }];
    }
    var mBase = dyBaseFrom(p);
    var mData = await dyMixData(p.playletId, mBase);
    if (!mData || !mData.items.length) return [];
    var mv = mData.items[mEp - 1];
    if (!mv || !mv.vid) return [];
    return [{ name: "抖音 · 第" + mEp + "集", description: dyDuration(mv.duration) || "1080P", url: dyStreamUrl(mv.vid), playerType: "app" }];
  }

  return [];
}
