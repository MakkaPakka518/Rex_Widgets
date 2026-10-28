# 抖音片单系统 · 备份与部署说明

备份时间：2026-10-29

## 文件

| 文件 | 说明 |
|---|---|
| `douyin-worker_20261029.js` | Worker 完整代码（59 KB，md5 `e357dbf2...`） |
| `douyin-module_2.8.0.js` | Rex 模块（16 KB） |

## 线上信息

- **地址**：`https://dytk.518518.qzz.io`（自定义域，绑定到 Worker `douyin`）
- **备用地址**：`https://douyin.wlwg5zr97.workers.dev`
- **Cloudflare 账号 ID**：`c646072df2a50c876e423bc24f093eeb`

## 必需的绑定（重新部署时务必带上）

```json
{
  "main_module": "index.js",
  "compatibility_date": "2024-09-23",
  "bindings": [
    { "type": "d1", "name": "DB", "id": "7a60396c-8c0f-4167-918b-cca9dc6a5c0c" },
    { "type": "secret_text", "name": "PANEL_KEY", "text": "suhan202518" },
    { "type": "secret_text", "name": "PUBLIC_KEY", "text": "public" }
  ]
}
```

> ⚠️ **不带 bindings 上传会把 D1 和环境变量全部清空**，片单数据虽在 D1 里不会丢，但 Worker 会连不上库。

## 定时任务

Cron Trigger：`0 0 * * *`（UTC 00:00 = 北京时间 08:00），每天自动同步集数/封面。

上传脚本后必须重新设置：

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts/douyin/schedules" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '[{"cron":"0 0 * * *"}]'
```

## D1 表结构

```sql
CREATE TABLE presets (
  playlet_id   TEXT PRIMARY KEY,
  url          TEXT,
  sort         INTEGER DEFAULT 0,
  added_at     INTEGER DEFAULT 0,
  custom_title TEXT DEFAULT '',
  share_title  TEXT DEFAULT '',
  meta         TEXT DEFAULT ''      -- JSON：title/desc/cover/author/total/firstVid
);
```

## 接口

| 路径 | 说明 |
|---|---|
| `GET /` | 管理面板 |
| `GET/POST /api/presets` | 片单管理（需 `X-Panel-Key`） |
| `GET /presets` | 模块用，无需密码 |
| `GET /search?q=` | 搜索自己添加的片单 |
| `POST /api/import` | 批量导入（json / url 两种） |
| `GET /feed` | 抖音推荐流 |
| `GET /mix?url=` | 解析合集 |
| `GET /series?url=` | 剧集结构 |
| `GET /tt/video?url=` | TikTok 单视频 |
| `GET /tt/proxy?url=` | TikTok 视频代理 |

## 权限

| 密码 | 权限 |
|---|---|
| `suhan202518` | 全部（增删改、导入、刷新） |
| `public` | 只能添加 |

## 快指令配置

「添加到 Rex 模块列表」：

```
从共享表单接收
获取 URL 内容
  URL: https://dytk.518518.qzz.io/api/presets
  方法: POST
  头部: X-Panel-Key = public
  请求体 JSON:
    action = add
    url    = [快捷指令输入]
在"快速查看"中显示 → URL 的内容
```

## 已知问题

- 抖音官方搜索接口需登录（`status_code 2483`），所以搜索只能搜自己添加的片单
- TikTok 推荐流拿不到（需 X-Bogus 签名），单视频解析可用
- TikTok 视频走 `/tt/proxy` 代理，依赖 Worker 出口 IP 不被 TikTok 封
