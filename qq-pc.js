var WidgetMetadata = {
  id: "qq.video.pc",
  title: "腾讯视频片库",
  version: "4.0.0",
  requiredVersion: "0.0.1",
  description: "腾讯视频电脑版片库：每个频道独立筛选维度，可叠加分类 + 地区 + 年份 + 排序，输出 TMDB 条目（含封面）",
  author: "Minis",
  modules: [
    {
      id: "qqTv",
      title: "电视剧",
      functionName: "loadQqTv",
      cacheDuration: 600,
      params: [
        { name: "itype", title: "类型", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "爱情", value: "1" }, { title: "都市", value: "2" }, { title: "青春", value: "3" },
          { title: "奇幻", value: "4" }, { title: "武侠", value: "5" }, { title: "古装", value: "6" }, { title: "科幻", value: "7" },
          { title: "猎奇", value: "8" }, { title: "竞技", value: "9" }, { title: "传奇", value: "10" }, { title: "逆袭", value: "19" },
          { title: "军旅", value: "11" }, { title: "家庭", value: "12" }, { title: "喜剧", value: "13" }, { title: "悬疑", value: "14" },
          { title: "权谋", value: "15" }, { title: "革命", value: "16" }, { title: "现实", value: "17" }, { title: "刑侦", value: "18" },
          { title: "民国", value: "20" }, { title: "IP改编", value: "21" } ] },
        { name: "iarea", title: "地区", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "内地", value: "0" }, { title: "中国香港", value: "14" }, { title: "中国台湾", value: "4" },
          { title: "美国", value: "8" }, { title: "泰国", value: "9" }, { title: "英国", value: "1" }, { title: "韩国", value: "5" },
          { title: "日本", value: "10" }, { title: "其他", value: "9999" } ] },
        { name: "iyear", title: "年份", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "即将上线", value: "1" }, { title: "2026", value: "2026" }, { title: "2025", value: "2025" },
          { title: "2024", value: "2" }, { title: "2023", value: "3" }, { title: "2022", value: "4" }, { title: "2021", value: "5" },
          { title: "2020-2016", value: "6" }, { title: "2015-2011", value: "7" }, { title: "2010-2000", value: "8" }, { title: "更早", value: "9" } ] },
        { name: "sort", title: "排序", type: "enumeration", default: "75", enumOptions: [
          { title: "最热", value: "75" }, { title: "最新上架", value: "79" }, { title: "高分好评", value: "85" } ] },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "qqMovie",
      title: "电影",
      functionName: "loadQqMovie",
      cacheDuration: 600,
      params: [
        { name: "itype", title: "类型", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "动作", value: "4" }, { title: "喜剧", value: "3" }, { title: "爱情", value: "5" },
          { title: "科幻", value: "12" }, { title: "犯罪", value: "6" }, { title: "冒险", value: "7" }, { title: "恐怖", value: "11" },
          { title: "动画", value: "15" }, { title: "战争", value: "8" }, { title: "悬疑", value: "10" }, { title: "灾难", value: "25" },
          { title: "青春", value: "26" } ] },
        { name: "iarea", title: "地区", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "内地", value: "100024" }, { title: "中国香港", value: "100025" }, { title: "中国台湾", value: "100026" },
          { title: "美国", value: "100029" }, { title: "日本", value: "100027" }, { title: "韩国", value: "100028" }, { title: "泰国", value: "100031" },
          { title: "印度", value: "100030" }, { title: "英国", value: "15" }, { title: "法国", value: "16" }, { title: "德国", value: "17" },
          { title: "加拿大", value: "18" }, { title: "西班牙", value: "19" }, { title: "意大利", value: "20" }, { title: "澳大利亚", value: "21" },
          { title: "其他", value: "100033" } ] },
        { name: "iyear", title: "年份", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "即将上线", value: "999" }, { title: "2026", value: "2026" }, { title: "2025", value: "2025" },
          { title: "2024", value: "2024" }, { title: "2023", value: "2023" }, { title: "2022", value: "2022" }, { title: "2021", value: "2021" },
          { title: "2020", value: "2020" }, { title: "2019", value: "20" }, { title: "2018", value: "2018" }, { title: "2017", value: "1" },
          { title: "2016", value: "2" }, { title: "2015", value: "3" }, { title: "2014", value: "4" }, { title: "2013-2011", value: "5" },
          { title: "2010-2006", value: "6" }, { title: "2005-2000", value: "7" }, { title: "90年代", value: "8" }, { title: "80年代", value: "9" } ] },
        { name: "characteristic", title: "特色", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "院线电影", value: "1" }, { title: "网络电影", value: "2" },
          { title: "独播", value: "5" }, { title: "原声", value: "8" }, { title: "粤语", value: "9" }, { title: "获奖佳片", value: "6" } ] },
        { name: "sort", title: "排序", type: "enumeration", default: "75", enumOptions: [
          { title: "最热", value: "75" }, { title: "最新", value: "83" }, { title: "高分好评", value: "81" } ] },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "qqVariety",
      title: "综艺",
      functionName: "loadQqVariety",
      cacheDuration: 600,
      params: [
        { name: "itype", title: "类型", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "游戏", value: "10" }, { title: "脱口秀", value: "2" }, { title: "音乐舞台", value: "11" },
          { title: "情感", value: "12" }, { title: "生活", value: "22" }, { title: "职场", value: "20" }, { title: "喜剧", value: "14" },
          { title: "美食", value: "19" }, { title: "潮流运动", value: "21" }, { title: "竞技", value: "24" }, { title: "影视", value: "16" },
          { title: "电竞", value: "15" }, { title: "推理", value: "25" }, { title: "访谈", value: "3" }, { title: "亲子", value: "17" },
          { title: "文化", value: "26" }, { title: "互动", value: "23" }, { title: "晚会", value: "6" }, { title: "资讯", value: "7" } ] },
        { name: "iarea", title: "地区", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "国内", value: "1" }, { title: "海外", value: "2" } ] },
        { name: "exclusive", title: "特色", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "腾讯自制", value: "1" }, { title: "独播", value: "2" } ] },
        { name: "iyear", title: "年份", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "2026", value: "2026" }, { title: "2025", value: "2025" }, { title: "2024", value: "2024" },
          { title: "2023", value: "2023" }, { title: "2022", value: "2022" }, { title: "2021", value: "2021" }, { title: "2020", value: "50" },
          { title: "2019", value: "7" }, { title: "2018", value: "1" }, { title: "2017", value: "2" }, { title: "2016", value: "3" },
          { title: "2015", value: "4" }, { title: "2014", value: "5" }, { title: "2013", value: "6" }, { title: "更早", value: "99" } ] },
        { name: "sort", title: "排序", type: "enumeration", default: "75", enumOptions: [
          { title: "最热", value: "75" }, { title: "最近更新", value: "23" }, { title: "高分好评", value: "85" } ] },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "qqAnime",
      title: "动漫",
      functionName: "loadQqAnime",
      cacheDuration: 600,
      params: [
        { name: "iarea", title: "地区", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "内地（国漫）", value: "1" }, { title: "日本", value: "2" }, { title: "欧美", value: "3" }, { title: "其他", value: "4" } ] },
        { name: "itype", title: "类型", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "玄幻", value: "9" }, { title: "仙侠", value: "23" }, { title: "恋爱", value: "7" },
          { title: "搞笑", value: "1" }, { title: "冒险", value: "2" }, { title: "科幻", value: "4" }, { title: "奇幻", value: "21" },
          { title: "武侠", value: "13" }, { title: "都市", value: "24" }, { title: "悬疑", value: "17" }, { title: "竞技", value: "20" },
          { title: "日常", value: "15" }, { title: "治愈", value: "25" }, { title: "游戏", value: "26" }, { title: "异能", value: "27" },
          { title: "历史", value: "19" }, { title: "古风", value: "28" }, { title: "智斗", value: "29" }, { title: "恐怖", value: "30" },
          { title: "美食", value: "31" }, { title: "音乐", value: "32" }, { title: "真人", value: "18" }, { title: "其他", value: "12" } ] },
        { name: "anime_status", title: "状态", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "更新中", value: "44" }, { title: "已完结", value: "45" }, { title: "即将上线", value: "46" } ] },
        { name: "item", title: "画风", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "2D动画", value: "3" }, { title: "3D动画", value: "2" }, { title: "特摄", value: "4" }, { title: "其他", value: "5" } ] },
        { name: "iyear", title: "年份", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "2026", value: "2026" }, { title: "2025", value: "2025" }, { title: "2024", value: "2024" },
          { title: "2023", value: "2023" }, { title: "2022", value: "2022" }, { title: "2021", value: "2021" }, { title: "2020", value: "50" },
          { title: "2019", value: "11" }, { title: "2018", value: "2018" }, { title: "2017", value: "2017" }, { title: "更早", value: "10" } ] },
        { name: "sort", title: "排序", type: "enumeration", default: "75", enumOptions: [
          { title: "最热", value: "75" }, { title: "最近更新", value: "23" }, { title: "高分好评", value: "85" } ] },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "qqDoc",
      title: "纪录片",
      functionName: "loadQqDoc",
      cacheDuration: 600,
      params: [
        { name: "itype", title: "类型", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "自然", value: "4" }, { title: "美食", value: "10" }, { title: "社会", value: "3" },
          { title: "人文", value: "6" }, { title: "历史", value: "1" }, { title: "军事", value: "2" }, { title: "科技", value: "8" },
          { title: "财经", value: "14" }, { title: "探险", value: "15" }, { title: "罪案", value: "7" }, { title: "竞技", value: "12" },
          { title: "旅游", value: "11" } ] },
        { name: "itrailer", title: "出品方", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "腾讯出品", value: "15" }, { title: "央视", value: "8" }, { title: "BBC", value: "1" },
          { title: "国家地理", value: "4" }, { title: "探索频道", value: "3174" }, { title: "HBO", value: "3175" }, { title: "NHK", value: "2" },
          { title: "ITV", value: "3530" }, { title: "历史频道", value: "7" } ] },
        { name: "iregion", title: "地区", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "国内", value: "1" }, { title: "国外", value: "2" } ] },
        { name: "iyear", title: "年份", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "2026", value: "2026" }, { title: "2025", value: "2025" }, { title: "2024", value: "1" },
          { title: "2023", value: "2" }, { title: "2022", value: "3" }, { title: "2021", value: "4" }, { title: "2020", value: "5" },
          { title: "2019-2015", value: "6" }, { title: "2014-2010", value: "7" }, { title: "2009-2005", value: "8" }, { title: "更早", value: "9" } ] },
        { name: "sort", title: "排序", type: "enumeration", default: "75", enumOptions: [
          { title: "最热", value: "75" }, { title: "最新", value: "74" }, { title: "高分好评", value: "85" } ] },
        { name: "page", title: "页码", type: "page" }
      ]
    },
    {
      id: "qqKids",
      title: "少儿",
      functionName: "loadQqKids",
      cacheDuration: 600,
      params: [
        { name: "iyear", title: "年龄段", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "0-3岁", value: "1" }, { title: "4-6岁", value: "2" },
          { title: "7-9岁", value: "3" }, { title: "10岁以上", value: "4" }, { title: "全年龄", value: "7" } ] },
        { name: "all", title: "主题", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "儿歌·童谣", value: "2" }, { title: "绘本·故事", value: "3" }, { title: "动画", value: "20" },
          { title: "早教", value: "7" }, { title: "科普", value: "23" }, { title: "英语", value: "15" }, { title: "国学", value: "11" },
          { title: "恐龙", value: "6" }, { title: "汽车", value: "5" }, { title: "玩具节目", value: "10" }, { title: "安全", value: "12" },
          { title: "行为习惯", value: "14" }, { title: "情商教育", value: "17" }, { title: "入园", value: "9" }, { title: "幼小衔接", value: "18" },
          { title: "真人剧", value: "21" }, { title: "搞笑", value: "25" }, { title: "优质佳作", value: "26" } ] },
        { name: "gender", title: "性别", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "男孩", value: "2" }, { title: "女孩", value: "1" } ] },
        { name: "language", title: "语言", type: "enumeration", default: "all", enumOptions: [
          { title: "全部", value: "all" }, { title: "普通话版", value: "3" }, { title: "英文版", value: "1" } ] },
        { name: "sort", title: "排序", type: "enumeration", default: "75", enumOptions: [
          { title: "最热", value: "75" }, { title: "最新", value: "76" } ] },
        { name: "page", title: "页码", type: "page" }
      ]
    }
  ]
};
var PC_API = "https://pbaccess.video.qq.com/trpc.multi_vector_layout.mvl_controller.MVLPageHTTPService/getMVLPage?&vversion_platform=18";
var PC_HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://v.qq.com",
  "Referer": "https://v.qq.com/tv-series-list/v-index.html",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};
var CHANNELS = { tv: "100113", movie: "100173", variety: "100109", anime: "100119", doc: "100105", kids: "100150" };
var FILTER_KEYS = { sort: 1, itype: 1, iarea: 1, iyear: 1, ipay: 1, pay: 1, anime_status: 1, item: 1, itrailer: 1, iregion: 1, gender: 1, language: 1, all: 1, producer: 1, characteristic: 1, exclusive: 1 };

function pcBody(ch, filterParams, ctx) {
  return {
    page_params: {
      page_type: "operation",
      page_id: "channel_list",
      channel_id: ch,
      filter_params: filterParams || ""
    },
    page_bypass_params: {
      params: { platform_id: "2", caller_id: "3000010", data_mode: "default", user_mode: "default", specified_strategy: "" },
      scene: "operation"
    },
    page_context: ctx || {}
  };
}

async function pcRequest(ch, filterParams, ctx) {
  var res = await Widget.http.post(PC_API, JSON.stringify(pcBody(ch, filterParams, ctx)), { headers: PC_HEADERS });
  var json = res && res.data ? res.data : res;
  if (!json || !json.data) throw new Error("腾讯片库返回异常");
  return json;
}

function pcCards(json) {
  var cards = (json.data.modules && json.data.modules.normal && json.data.modules.normal.cards) || [];
  for (var i = 0; i < cards.length; i++) {
    var pc = cards[i].children_list && cards[i].children_list.poster_card;
    if (!pc) continue;
    var list = pc.cards || pc;
    if (!list || !list.length) continue;
    var out = [];
    for (var j = 0; j < list.length; j++) {
      var p = list[j].params || {};
      if (!p.cid || !p.title) continue;
      out.push({
        cid: p.cid,
        title: p.title,
        year: String(p.year || "").slice(0, 4),
        genre: p.main_genre || "",
        area: p.area_name || "",
        cover: "https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/" + p.cid + "/0"
      });
    }
    return out;
  }
  return [];
}

function buildFilterParams(params) {
  var keys = Object.keys(params || {});
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = params[k];
    if (k === "page" || !FILTER_KEYS[k]) continue;
    if (v === undefined || v === null) continue;
    v = String(v).trim();
    if (!v || v === "all" || v === "-1") continue;
    parts.push(k + "=" + v);
  }
  return parts.join("&");
}

function shiftContext(ctx, page) {
  var c = {};
  for (var k in ctx || {}) c[k] = ctx[k];
  c._ctrl_page_index = String(page);
  c.page_index = String(page);
  var offset = String((page - 1) * 12);
  for (var key in c) {
    if (/_offset$/.test(key) && /^\d+$/.test(String(c[key]))) c[key] = offset;
  }
  return c;
}

async function baseContext(ch, filterParams) {
  var key = "qqpc:ctx:" + ch + ":" + (filterParams || "-");
  try {
    var raw = await Widget.storage.get(key);
    if (raw) {
      var o = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (o && o.ctx && Date.now() - (o.ts || 0) < 1800000) return o.ctx;
    }
  } catch (e) {}
  var json = await pcRequest(ch, filterParams, {});
  var ctx = json.data.page_context || {};
  try { await Widget.storage.set(key, JSON.stringify({ ts: Date.now(), ctx: ctx })); } catch (e) {}
  return ctx;
}

async function fetchPage(ch, filterParams, page) {
  var p = Math.max(1, Math.min(30, parseInt(page, 10) || 1));
  if (p === 1) {
    var first = await pcRequest(ch, filterParams, {});
    return pcCards(first);
  }
  var base = await baseContext(ch, filterParams);
  var json = await pcRequest(ch, filterParams, shiftContext(base, p));
  return pcCards(json);
}
function qqNorm(s) {
  return String(s || "").toLowerCase()
    .replace(/[\s·・:：!！?？,，.。'"、]/g, "")
    .replace(/[（(][^)）]*[)）]/g, "");
}

function qqVariants(title) {
  var raw = String(title || "").trim();
  if (!raw) return [];
  var list = [];
  function add(x) {
    x = String(x || "").trim();
    if (x.length >= 2 && list.indexOf(x) < 0) list.push(x);
  }
  add(raw);
  var a = raw.replace(/[（(][^)）]*[)）]/g, "").replace(/【[^】]*】/g, "").replace(/\[[^\]]*\]/g, "").trim();
  add(a);
  var b = a.replace(/[·・].*$/, "").trim();
  add(b);
  var c = b.replace(/第\s*[0-9一二三四五六七八九十]+\s*[季期部篇].*$/, "").trim();
  add(c);
  var d = c.replace(/\s*(年番|完结季|完结篇|特别篇|普通话版|国语版|日语版|粤语版|中配版)$/, "").trim();
  add(d);
  var e = d.replace(/\s*(爽看版|精编版|加更版|会员版|悠享版|抢先版|完整版|导演剪辑版|速看版|高能版|纯享版|竖屏版|横屏版|特辑|番外|大结局)$/, "").trim();
  add(e);
  return list;
}

function qqJunk(title) {
  return /(拆解|解说|盘点|大赏|合集|预告|花絮|精选|混剪|周周看|名场面|彩蛋|剧情回顾|幕后|cut合集)/i.test(String(title || ""));
}

function qqGrams(s) {
  var t = qqNorm(s);
  var set = {};
  for (var i = 0; i < t.length - 1; i++) set[t.substr(i, 2)] = 1;
  if (t.length === 1) set[t] = 1;
  return set;
}

function qqSim(a, b) {
  var ga = qqGrams(a), gb = qqGrams(b);
  var ka = Object.keys(ga), kb = Object.keys(gb);
  if (!ka.length || !kb.length) return 0;
  var inter = 0;
  for (var i = 0; i < ka.length; i++) if (gb[ka[i]]) inter++;
  return inter / (ka.length + kb.length - inter);
}

function qqBest(results, names, year, kind) {
  var best = null, bestScore = 0;
  var imgAlt = null, imgScore = -1;
  for (var i = 0; i < (results || []).length; i++) {
    var r = results[i];
    if (!r || !r.id) continue;
    var title = r.name || r.title || r.original_name || r.original_title || "";
    var alt = (r.original_name || r.original_title || "");
    var score = 0;
    for (var n = 0; n < names.length; n++) {
      var s2 = Math.max(qqSim(names[n], title), alt ? qqSim(names[n], alt) : 0);
      if (s2 > score) score = s2;
    }
    var date = String(r.first_air_date || r.release_date || "");
    if (year && date.slice(0, 4) === String(year)) score += 0.5;
    else if (year && date && Math.abs(parseInt(date.slice(0, 4), 10) - parseInt(year, 10)) === 1) score += 0.25;
    score += Math.min(0.2, (r.popularity || 0) / 5000);
    if (r.poster_path && score > imgScore) { imgScore = score; imgAlt = r; }
    if (score > bestScore) { bestScore = score; best = r; }
  }
  if (!best || bestScore < 0.72) return null;
  if (!best.poster_path && !best.backdrop_path && imgAlt && imgScore >= bestScore - 0.18) best = imgAlt;
  return {
    id: best.id,
    kind: kind,
    poster: best.poster_path || "",
    backdrop: best.backdrop_path || "",
    date: best.first_air_date || best.release_date || "",
    vote: best.vote_average || 0
  };
}

async function qqSearch(kind, query) {
  try {
    var r = await Widget.tmdb.get("search/" + kind, { params: { query: query, language: "zh-CN", include_adult: "false" } });
    return (r && r.results) || [];
  } catch (e) {
    return [];
  }
}

async function cacheGet(key) {
  try {
    var v = await Widget.storage.get(key);
    if (!v) return null;
    var o = typeof v === "string" ? JSON.parse(v) : v;
    if (o && o.ts && Date.now() - o.ts < 604800000) return o;
  } catch (e) {}
  return null;
}

async function cacheSet(key, obj) {
  try { await Widget.storage.set(key, JSON.stringify(Object.assign({ ts: Date.now() }, obj))); } catch (e) {}
}
async function qqMatchOne(card, kind) {
  if (qqJunk(card.title)) return null;
  var ck = "qqpc:tmdb:" + card.cid;
  var cached = await cacheGet(ck);
  if (cached) return cached.id ? cached : null;
  var names = qqVariants(card.title).slice(0, 2);
  var hit = null;
  for (var i = 0; i < names.length && !hit; i++) {
    var res = await qqSearch(kind, names[i]);
    hit = qqBest(res, names, card.year, kind);
  }
  if (!hit) {
    var alt = kind === "tv" ? "movie" : "tv";
    var res2 = await qqSearch(alt, names[0]);
    hit = qqBest(res2, names, card.year, alt);
  }
  await cacheSet(ck, hit ? hit : { id: 0 });
  return hit;
}

function qqToItem(card, hit) {
  var poster = hit.poster ? "https://image.tmdb.org/t/p/w500" + hit.poster : "";
  var backdrop = hit.backdrop ? "https://image.tmdb.org/t/p/w780" + hit.backdrop : poster;
  if (!poster && !backdrop) return null;
  return {
    id: hit.id,
    type: "tmdb",
    title: card.title,
    mediaType: hit.kind,
    posterPath: poster,
    backdropPath: backdrop,
    coverUrl: backdrop,
    releaseDate: hit.date || (card.year ? String(card.year) : ""),
    rating: hit.vote > 0 ? hit.vote : undefined,
    genreTitle: card.genre || ""
  };
}

async function qqResolveAll(cards, kind) {
  var out = [];
  var seen = {};
  var queue = cards.slice();
  async function worker() {
    while (queue.length) {
      var card = queue.shift();
      var hit;
      try { hit = await qqMatchOne(card, kind); } catch (e) { hit = null; }
      if (!hit || !hit.id || seen[hit.id]) continue;
      var item = qqToItem(card, hit);
      if (!item) continue;
      seen[hit.id] = 1;
      out.push(item);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  return out;
}

async function loadChannel(chKey, params) {
  params = params || {};
  var ch = CHANNELS[chKey];
  if (!ch) return [];
  var fp = buildFilterParams(params);
  var page = parseInt(params.page, 10) || 1;
  var cards = await fetchPage(ch, fp, page);
  if (!cards.length) return [];
  var kind = chKey === "movie" ? "movie" : "tv";
  return await qqResolveAll(cards, kind);
}

async function loadQqTv(params) { return await loadChannel("tv", params); }
async function loadQqMovie(params) { return await loadChannel("movie", params); }
async function loadQqVariety(params) { return await loadChannel("variety", params); }
async function loadQqAnime(params) { return await loadChannel("anime", params); }
async function loadQqDoc(params) { return await loadChannel("doc", params); }
async function loadQqKids(params) { return await loadChannel("kids", params); }
