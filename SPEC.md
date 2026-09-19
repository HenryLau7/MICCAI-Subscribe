# MICCAI Subscribe — 产品与技术规格

| | |
|---|---|
| 版本 | 0.3（数据管线已实现并交叉验证） |
| 编写日期 | 2026-09-19 |
| 目标会议 | MICCAI 2026，Strasbourg Convention Center，France |
| 会期 | Satellite: 9/27(日) · 主会: 9/28–9/30 · Satellite: 10/1(四) |
| **距会期** | **9 天（Satellite 开始 9/27）** |
| 域名 | miccaisubscribe.com（已持有） |
| 主要设备 | 手机浏览器 |
| 状态 | **P0 数据管线已完成**（见 §4.6）；前端未开始 |

> **v0.2 相对 v0.1 的变化**：v0.1 是在没有看过数据的情况下写的，其中若干核心假设与真实数据不符（论文规模、摘要字段、存储架构）。v0.2 的每一条数据断言都来自对真实 PDF 和官网的实测，测量方法记录在 §2。

---

## 1. 产品定位

MICCAI Subscribe 是一个**非官方的、移动优先的 MICCAI 个人日程工具**。

解决的问题很具体：MICCAI 2026 有 1165 篇 poster、153 场 oral/spotlight、111 场 satellite events，分布在 5 天、20+ 个房间。官方只提供 PDF。参会者无法搜索、无法标记、无法把"我要看的东西"变成手机日历。

核心动线：

```
搜索（标题 / 作者 / 机构）
  → 收藏单篇 · 或关注某个人/机构
  → 我的日程
  → 加入日历
```

### 1.1 设计原则

1. **移动优先** — 主场景是在会场里单手用手机。桌面端需要能用，但是次要的。
2. **零摩擦** — 不需要注册、不需要登录、落地页直接是搜索框。
3. **数据诚实** — 官方日程标注 TENTATIVE 且仍在变动。不编造 PDF 里没有的信息（尤其是时间），明确标注数据版本与不确定性。
4. **精致工具感** — 视觉方向见 §10.1。漂亮，但不牺牲信息密度。
5. **会期可靠性 > 架构先进性** — 这东西只需要在 5 天里不出问题，之后可以归档。
6. **非官方身份必须清晰** — 页脚固定显示 "Unofficial community tool for MICCAI 2026."，不使用官方 logo，不暗示任何背书。

---

## 2. 数据源真相（实测）

**这一节是整份规格的地基。** 所有数字来自 2026-09-19 对真实文件的解析，不是估计。

### 2.1 已确认的数据源

| # | 来源 | URL / 文件 | 状态 |
|---|---|---|---|
| A | 主会 Oral/Spotlight/Poster 日程 | `conferences.miccai.org/2026/files/downloads/MICCAI2026-Main-Conference-Oral-and-Poster-Program.pdf` | 权威，会变 |
| B | Satellite Events 时间网格 | `.../downloads/MICCAI2026-Satellite-Events-Program.pdf` | 权威，2 页 |
| C | Workshop 列表 | `conferences.miccai.org/2026/en/workshops.asp` | 缩写→全称映射 |
| D | Challenge 列表 | `conferences.miccai.org/2026/en/challenges.asp` | 同上 |
| E | Tutorial 列表 | `conferences.miccai.org/2026/en/tutorials.asp` | 同上 |

原本置于仓库根目录的 `MICCAI2026-Oral-Spotlight-and-Poster-Schedule.pdf`（Revised 2026-09-08，105 页）**已过期**，现归档于 `data/raw/superseded/main-program-rev2026-09-08.pdf`。它不作为导入源，但仍是 §4.6 中 keynote 草稿的唯一来源（当前版 PDF 删掉了 at-a-glance 页）。

### 2.2 规模

| 实体 | 数量 | 说明 |
|---|---|---|
| Poster | **1165** | 5 个 poster session，每场 230–235 |
| Oral + Spotlight 报告 | **153** | 6 个时段 × 3 并行 session = 18 个 session |
| 唯一论文 | **1165** | oral 论文同时有 poster 展位，见 §2.4 |
| Presentation（日程条目） | **1318** | 1165 poster + 153 oral/spotlight |
| 唯一作者名 | **5643** | |
| 唯一机构字符串 | **866** | 未归一化，见 §7.3 |
| Satellite events | **111** 场排期 | 三个列表页共 **112** 个活动条目；网格解析出 111 段连续排期，全部 100% 匹配上列表页。差额来自把「一格两活动」（`AFRICAI / MiRASOL`）拆开后相邻时段合并所致 |

> v0.1 写的 "approximately 3,000 papers" 是错的，实际是 1165。这个差异很重要：实测投产包 gzip 后 **129 KB**（§7.1），意味着全部搜索可以在客户端完成，不需要任何搜索后端。

### 2.3 字段可用性

**Poster 条目（来源 A，完整）**

| 字段 | 有 | 示例 |
|---|---|---|
| 展板号 | ✅ | `M-PM-001` |
| 标题 | ✅ | Automatic LV Localization and Short-Axis Plane Estimation… |
| **完整作者列表** | ✅ | Yi Yu, Yixuan Liu, Ziyu Zhang, Parker Martin, … |
| Presenter | ✅ | Yuan Xue |
| Presenter 机构 + 国家 | ✅ | The Ohio State University, United States |
| Poster session 名称 + 时间 | ✅ | Poster Session 1 – Segmentation…, Mon Sep 28, 16:00–18:00 |

**Oral / Spotlight 条目（来源 A，不完整）**

| 字段 | 有 | 说明 |
|---|---|---|
| 标题 | ✅ | |
| Presenter + 机构 + 国家 | ✅ | 仅 1 人 |
| Session 编号 / 主题 / 会场 / Chairs | ✅ | 如 O1A · Image Segmentation I · Erasme Hall |
| Session 时间窗 | ✅ | 如 Mon Sep 28, 10:30–12:00 |
| 完整作者列表 | ❌ | **通过 §2.4 的方法补齐** |
| **单个报告的精确时间** | ❌ | **PDF 里不存在，见 §9.2** |

**所有条目一律没有的字段**

❌ 摘要 ❌ 论文 PDF 链接 / DOI / arXiv ❌ 关键词或 topic 标签 ❌ 作者 ORCID 或唯一标识 ❌ 非 presenter 作者的机构

### 2.4 关键发现：Oral 论文同时拥有 Poster 展位

对 153 个 oral/spotlight 条目做标题归一化前缀匹配，**153/153 全部命中 poster 表**（未命中的 5 条是栏目标题碎片，非报告）。

推论，直接决定数据模型：

- **Poster 表是权威的论文记录**（含完整作者列表）
- **Oral 页面只是一层日程覆盖**
- 一篇 oral 论文 = **2 个 presentation**（一场口头 + 一个展位）
- 通过标题匹配可以把完整作者列表补给 oral 条目，无需外部数据源

### 2.5 数据正在变动 —— 且格式也在变

对比两个版本，这是本项目最大的技术风险：

| | Revised 2026-09-08（本地） | Revised 2026-09-10（官网当前） |
|---|---|---|
| 页数 | 105 | 93 |
| Poster 数 | 1166 | **1165**（`T-AM-098` 撤回） |
| Poster 区排版 | 四列**带框表格** | **纯文本流**，无表格线 |
| `Paper ID` 列（投稿号） | ✅ 有 | ❌ **被删掉了** |
| Poster session 名称与时间 | ❌ 没有 | ✅ **新增了** |

两条结论：

1. **展板号是稳定的。** 跨版本对比：仅 `T-AM-098` 被移除，**没有发生任何重新编号**。因此展板号可以作为主键（§5.1）。
2. **官方会在会前几天改 PDF 的排版结构。** 导入器必须带格式校验闸门（§4.3），解析失败要报警而不是静默产出坏数据。

### 2.6 Satellite Events 数据形态

来源 B 是一个干净的 2 页网格：

- 2 天：9/27（周日）、10/1（周四）
- 每天 4 个时段：`8:00–10:00` `10:30–12:30` `13:30–15:30` `16:00–18:00`
- 每天约 23 个房间，含楼层标记（G / U），如 `Auditorium Cassin (G)`、`Etoile C (U)`
- 每格给出：类型 `(W)/(C)/(T)`、缩写、所属主题（如 "Foundation Models (FMs) 1"）

来源 C/D/E 提供：缩写 → 全称、主题、日期、联系人、外部网站链接。

**明确的范围限制：satellite 只做到活动级。** 各 workshop 内部的论文列表散落在 100+ 个独立网站上，9 天内无法可靠抓取，不在范围内。用户可以收藏 "STACOM @ Curie B, 9/27 8:00–10:00"，但不能收藏其中某一篇论文。

---

## 3. 已确认的决策

以下 7 条已与产品负责人确认，是设计的硬约束：

| # | 决策 | 理由 / 影响 |
|---|---|---|
| D1 | **9/27 前必须上线** | 范围要狠砍，见 §13 |
| D2 | **包含 satellite events**，从官网抓取 | 仅活动级，见 §2.6 |
| D3 | **论文元数据只用官方 PDF** | 不做 arXiv/Semantic Scholar 富化，不抓摘要 |
| D4 | **"订阅" = 收藏单篇 + 日历，外加关注某人/某机构** | 不做保存搜索条件式订阅，见 §8 |
| D5 | **本地优先 + 可选云同步** | 默认 localStorage；仅在用户主动要日历订阅链接时才写 Cloudflare KV，见 §6 |
| D6 | **Oral 日历事件 = 整个 session** | 不编造单个报告的时间，见 §9.2 |
| D7 | **视觉方向 = 精致工具感** | Linear / Arc 那一档，见 §10.1 |
| D8 | **Poster 厅名称查不到就不写** | 官方从未公布，`room` 留 `null`，不编造，见 R3 |

---

## 4. 数据管线

### 4.1 原则

- 会议数据**绝不硬编码在前端组件里**
- 管线是**构建期**的，不是运行时的。产出静态 JSON，随站点一起发布
- 幂等：跑两次结果一致
- 每次运行产出一份与上一版的 **diff 报告**（新增/移除/改时间/改房间）

### 4.2 目录结构

```
data/
  raw/                      # 原样存档，提交进 git
    2026-09-19/
      main-program.pdf
      satellite-program.pdf
      workshops.html  challenges.html  tutorials.html
      MANIFEST.json         # url, sha256, fetched_at, http_etag
  processed/
    program.json            # 构建产物，提交进 git 便于审查 diff
    program.meta.json       # 版本、来源、计数、生成时间
    diff-report.md
scripts/
  fetch.py                  # 下载 + 存档 + 计算哈希
  parse_main.py             # 来源 A → papers / sessions / presentations
  parse_satellite.py        # 来源 B + C/D/E → satellite events
  validate.py               # 校验闸门（§4.3）
  build.py                  # 编排上述步骤，产出 processed/
config/
  venue.yaml                # 手维护：会场、房间别名、时区、会议元信息
  satellite-aliases.yaml    # 手维护：网格缩写 ↔ 列表页缩写（§4.4）
  affiliation-aliases.yaml  # 手维护：Top ~50 机构归一化（§7.3）
```

### 4.3 校验闸门（必须实现）

`validate.py` 在任何一条不满足时**以非零退出码失败**，阻止构建：

- Poster 数量在 `1100–1250` 区间内
- Oral/spotlight 数量在 `130–180` 区间内
- 每个 poster 记录都成功解析出 `Authors:` 与 `Presenter:`（允许 ≤ 3 条失败，但必须在报告里逐条列出）
- 5 个 poster session 全部解析到名称与起止时间
- 18 个 oral/spotlight session 全部解析到会场与时间窗
- 每个展板号匹配 `^[MTW]-(AM|PM)-\d{3}$` 且全局唯一
- 全部 oral/spotlight 标题都能匹配到某个 poster 记录（低于 95% 命中率则失败）
- Satellite 事件数在 `95–130` 区间内
- 所有时间戳落在 `2026-09-27` 至 `2026-10-01` 之间

### 4.4 Satellite 的连接难点

网格（来源 B）与列表页（来源 C/D/E）的缩写**对不齐**。已发现的实例：

| 网格里写 | 列表页里写 |
|---|---|
| `(W) AE-CAI \| PRISM` | `AE-CAI \| CARE-CAI \| OR 2.0` |
| `(W) FAIMI-BRIDGE-EPIMI` | 很可能是 3 个联合 workshop |
| `* (W) AFRICAI / MiRASOL` | 一格里两个活动 |

处理方式：`config/satellite-aliases.yaml` 手维护映射表。`validate.py` 对任何未映射的缩写报 **warning 并列出**，不静默丢弃。

**实际结果**：自动规则匹配上 106/112，手工补 6 条别名后 **111/111 全部匹配**，耗时约 10 分钟，远低于预估。

### 4.5 更新节奏

- 会前每天跑一次 `build.py`，人工看 diff 报告，无异常则合并 + 部署
- 会期（9/27–10/1）每天早上 07:00 CEST 跑一次
- 站内始终显示 `Program data: revised 2026-09-10 · fetched 2026-09-19`

### 4.6 实现状态与交叉验证（2026-09-19 完成）

管线已按 §4.2 落地，`python3 scripts/build.py` 一条命令跑通，校验闸门 **0 error**。

**产出**

```
papers 1165 · presentations 1318 · sessions 23 (5 poster + 18 oral)
satellite 111 · authors 5651 · affiliations 513
program.json 1415 KB / 303 KB gzip   program.min.json 386 KB / 129 KB gzip
```

**两套解析策略**（主会 PDF 的两个区域结构完全不同）

| 区域 | 方法 |
|---|---|
| Poster 区 | 无框的 2 列表格（展板号 \| 正文）。PyMuPDF 表格识别可精确还原，含跨页续行。**最后一页没有表格线**，另走文本流兜底 |
| Oral 区 | 3 栏。按 x 把词归入栏、按 y 重建行、按纵向间距切分条目。整页通栏的页眉会横跨两栏，归栏前先按矩形剔除 |

Oral 条目只印标题和一位 presenter，靠标题匹配回 poster 记录补齐完整作者列表——**153/153 全部命中**。

**独立交叉验证**（用 `pdftotext` 这条完全不同的抽取路径做对照，避免与解析器共享假设）

| 检查 | 结果 |
|---|---|
| 展板号集合与参照完全一致 | ✅ 1165/1165 |
| 已撤回的 `T-AM-098` 不在结果中 | ✅ |
| 每条标题在参照文本中逐字出现 | ✅ **1165/1165** |
| 每条完整作者列表逐字出现 | ✅ **1165/1165** |
| 每位 presenter 姓名出现 | ✅ 1165/1165 |
| oral/spotlight 关联到完整论文记录 | ✅ 153/153 |
| presentation 的 session 外键有效 | ✅ 1318/1318 |
| 作者数/篇 | min 1 · max 23 · mean 6.3 · 零作者 0 |

**唯一遗留 warning**：4 篇论文的 presenter 国家解析不出（`M-PM-074` `M-PM-148` `W-AM-013` `W-AM-025`）。逐条看过，**是源数据本身的问题**——两条根本没写国家，两条是跨国双机构（`United Kingdon / Germany`、`Singapore & UK`）。按数据诚实原则留 `null`，不猜。

**Keynote / 开闭幕 / Gala 未进 `program.json`。** at-a-glance 网格只存在于已过期的 09-08 版，且两处不可靠：poster session 3/5 在该网格是 16:00 而权威版是 15:30；高合并单元格里的文字是垂直居中的，Gala 落在 21:00 行而它自己的标签写着 19:00–23:00。因此 `parse_glance.py` 只产出 `config/program-events.yaml` **审阅草稿**（20 条，全部 `needs_review: true`），人工确认前一条都不进投产数据。

---

## 5. 数据模型

产出单一静态文件 `program.json`。没有数据库参与程序数据。

### 5.1 标识符策略

| 实体 | 主键 | 理由 |
|---|---|---|
| Paper | `board_number`（如 `M-PM-001`） | §2.5 实测跨版本稳定 |
| Presentation | `{board_number}` 或 `{board_number}:oral` | 一篇论文最多 2 个 presentation |
| Session | `O1A`…`O6C`、`P1`…`P5` | PDF 原生编号 |
| Satellite event | `sat:{day}:{room_slug}:{slot_index}` | 网格坐标，天然稳定 |
| Author | 归一化姓名字符串 | 见下方限制 |

每条 paper 额外携带 `title_key`（标题 NFKD 归一化 + 去非字母数字 + 小写）。**用途是版本迁移**：万一未来官方真的重新编号展板，用 `title_key` 把老收藏重新对上，而不是让用户的收藏凭空消失。

> **已知限制：作者身份。** 数据里没有 ORCID 或任何作者唯一标识，作者身份只能靠姓名字符串。5643 个姓名中，同名不同人（尤其是常见中文姓名的拼音形式）无法区分。"关注作者" 功能必须在 UI 上诚实标注这一点，并展示机构帮助用户判断。

### 5.2 Schema

```jsonc
{
  "meta": {
    "conference": "MICCAI 2026",
    "timezone": "Europe/Paris",
    "venue": "Strasbourg Convention Center",
    "source_revision": "2026-09-10",
    "fetched_at": "2026-09-19T08:00:00Z",
    "generated_at": "2026-09-19T08:04:11Z",
    "schema_version": 1,
    "counts": { "papers": 1165, "presentations": 1318, "satellite": 112   // 以解析结果为准 }
  },

  "papers": [{
    "id": "M-PM-001",
    "title_key": "automatic lv localization and short axis plane estimation from arbitrary cmr slice",
    "title": "Automatic LV Localization and Short-Axis Plane Estimation from Arbitrary CMR Slice",
    "authors": ["Yi Yu", "Yixuan Liu", "…", "Yuan Xue"],
    "presenters": ["Yuan Xue"],          // 复数：源数据存在 "Presenters: A & B" 的写法
    "affiliation": "The Ohio State University",
    "country": "United States",
    "affiliation_canonical": "ohio-state-university",
    "presentations": ["M-PM-001", "M-PM-001:oral"]   // 第二项仅 oral 论文有
  }],

  "presentations": [{
    "id": "M-PM-001",
    "paper_id": "M-PM-001",
    "kind": "poster",                    // poster | oral | spotlight
    "session_id": "P1",
    "board_number": "M-PM-001",
    "order_in_session": null             // oral/spotlight 才有，用于 §9.2 的弱提示
  }],

  "sessions": [{
    "id": "P1",
    "kind": "poster",                    // poster | oral | keynote | ceremony | social | satellite
    "name": "Poster Session 1 – Segmentation, Registration and Detection",
    "start": "2026-09-28T16:00:00+02:00",
    "end":   "2026-09-28T18:00:00+02:00",
    "room": null,                        // poster 大厅名称在来源 A 中缺失，见 §12-R3
    "chairs": []
  }],

  "satellite": [{
    "id": "sat:2026-09-27:curie-b:0",
    "acronym": "STACOM",
    "name": "Statistical Atlases and Computational Modelling of the Heart",
    "type": "workshop",                  // workshop | challenge | tutorial
    "theme": "Cardiac Imaging 1",
    "room": "Curie B", "floor": "U",
    "start": "2026-09-27T08:00:00+02:00",
    "end":   "2026-09-27T10:00:00+02:00",
    "url": "https://…",                  // 来自列表页，可能为 null
    "continues": true                    // 与相邻时段是同一活动，UI 合并显示
  }],

  "program_events": [{                   // keynote / 开闭幕 / coffee / gala，来自 at-a-glance 网格
    "id": "keynote-1",
    "kind": "keynote",
    "name": "Keynote 1 – Karim Lekadir",
    "room": "Erasme Hall",
    "start": "2026-09-28T09:00:00+02:00",
    "end":   "2026-09-28T09:45:00+02:00"
  }]
}
```

### 5.3 客户端持久化（localStorage）

```jsonc
{
  "v": 1,
  "bookmarks":   ["M-PM-001", "T-AM-042:oral", "sat:2026-09-27:curie-b:0"],
  "followed_authors":      ["yuan xue", "xiahai zhuang"],
  "followed_affiliations": ["ohio-state-university"],
  "sync": { "token": null, "last_pushed_at": null },
  "prefs": { "reminder_minutes": 15, "theme": "system" }
}
```

单个 key：`miccai-subscribe:v1`。所有读写走 try/catch —— 隐私模式下 localStorage 会抛异常，抛了也要能正常浏览。

---

## 6. 存储架构（决策 D5）

### 6.1 本地优先

默认情况下**没有后端参与**。收藏与关注全部存在 localStorage。这带来：

- 全站纯静态托管在 Cloudflare Pages，全球边缘毫秒级
- 会期内不可能因为后端故障而挂
- 零隐私足迹，零运维成本

代价：换设备不同步。通过两条路径缓解：

1. **导出/导入**：一个包含收藏 ID 列表的 URL（`/import#<base64>`）或 JSON 文件下载，可自己发给自己
2. **可选云同步**（下节）

### 6.2 可选云同步（仅在用户主动开启时）

用户点击「生成日历订阅链接」时才发生：

1. 客户端用 `crypto.getRandomValues` 生成 160-bit token
2. `PUT /api/sync/<token>` → Cloudflare Worker 把收藏 + 关注列表写入 **Cloudflare KV**
3. 返回订阅地址 `https://miccaisubscribe.com/cal/<token>.ics`
4. 客户端存下 token，此后每次收藏变更做防抖（2s）后台推送

选 KV 而不是 D1，理由：**KV 是多区域复制的，读延迟在边缘；D1 是单区域主库，跨洲写入要回源。** 这个场景只有 key-value 读写，用不上 SQL。

KV 键值：`sync:<sha256(token)>` → `{ bookmarks, followed_authors, followed_affiliations, updated_at }`，TTL 设到 2026-12-31。**存 token 的哈希，不存明文。**

---

## 7. 搜索

搜索是这个产品最重要的部分。

### 7.1 架构

**全部在客户端。** 构建期产出两份产物：

| 文件 | 大小 | 用途 |
|---|---|---|
| `program.json` | 1415 KB raw / 303 KB gzip | 权威、可读，提交进 git 以便审查 diff |
| `program.min.json` | 386 KB raw / **129 KB gzip**（brotli 约 110 KB）| **浏览器下载的就是这份** |

投产包把记录压成定长数组，并对作者名与机构名做字典编码（作者名平均重复 6.3 次）；作者→论文、机构→论文这类反向索引在客户端加载后现建（几毫秒），不随包下发。

- 首屏先渲染 UI 骨架，`program.json` 用 `<link rel="preload">` 并行拉取
- 加载后写入 Cache Storage，配合 Service Worker 实现**离线可用**（会场 Wi-Fi 很差，这是刚需，见 §11.3）
- 缓存键带 `source_revision`，数据更新自动失效

1165 条记录不需要任何搜索库。构建期为每条记录预生成归一化的检索字段，查询时线性扫描 + 字段加权打分，实测量级 < 20 ms。不引入 MiniSearch / Lunr / FlexSearch。

### 7.2 可搜索字段与排序

| 字段 | 权重 | 示例查询 |
|---|---|---|
| 标题 | 最高 | `evidential`、`foundation model` |
| 作者姓名（完整列表，不只 presenter） | 高 | `Yuanye Liu`、`Zhuang` |
| Presenter | 高 | |
| 机构 | 高 | `Fudan`、`Technical University of Munich` |
| 国家 | 中 | `Japan` |
| Session 主题 | 中 | `Image Segmentation` |
| 展板号 | 精确匹配直达 | `M-PM-001`、`T-AM-042` |
| Satellite 缩写与全称 | 高 | `STACOM`、`BraTS` |

排序优先级：精确展板号 > 标题完全匹配 > 标题词首匹配 > 作者精确匹配 > 机构匹配 > 标题子串 > 其他。

**必须做的归一化**：NFKD 变音符折叠。数据里大量出现 `Rüveyda Yilmaz`、`Friedrich-Alexander-Universität Erlangen-Nürnberg`、`Maša Božić-Iven`。搜 `Nurnberg` 必须能命中 `Nürnberg`，搜 `Bozic` 必须能命中 `Božić`。

大小写不敏感；标点差异容忍（连字符、撇号、`&` 与 `and`）。MVP 不做模糊纠错。

### 7.3 机构搜索（用户明确要求，v0.1 完全缺失）

866 个原始机构字符串里存在大量同一机构的不同写法。例如慕尼黑工大同时以 `Technical University of Munich` 和 `Technical University of Munich, Germany` 出现；`Department of Radiology, Jichi Medical University, Japan` 这种含内部逗号的形式也很常见。

处理方式，按复杂度递增：

1. **解析**：presenter 串按 `Name, <机构可能含逗号>, <国家>` 切分。国家用一份国家名清单（gazetteer）从**末尾**匹配，剩下的整段作为机构。这比从左切分稳健得多。
2. **归一化**：小写、去变音符、去 `Dept. of` / `Department of` / `The` 等前缀、统一 `Univ.` → `University`。
3. **别名合并**：`config/affiliation-aliases.yaml` 手维护 Top ~50 机构（按出现次数排序）的规范名，覆盖长尾无收益。

UI 上，机构作为一个可点的实体：点进去看该机构在本届的全部报告，并可以「关注」。

---

## 8. 收藏与关注（决策 D4）

### 8.1 收藏（单篇）

一次点击。`☆` → `★`。乐观 UI，纯本地写入，零延迟。

可收藏对象：poster、oral/spotlight 报告、satellite event、keynote 等日程事件。

### 8.2 关注（人 / 机构）

在作者页或机构页点「关注」。效果：

- 该作者/机构在本届的**全部报告自动出现在「我的日程」**，视觉上与手动收藏区分（不同的角标 + 「来自关注：Yuan Xue」的来源说明）
- 同样进入日历导出
- 可以逐条「从这个关注里排除」某篇，排除项单独记录

**必须显示的限制说明**：同名作者无法区分（§5.1）。关注列表里每个作者都带机构后缀，帮助用户确认。

### 8.3 我的日程

按天分组，天内按时间排序。5 个 tab：`9/27` `9/28` `9/29` `9/30` `10/1`。

**冲突提示分三档**，比 v0.1 的二元判断更贴合真实会议：

| 情况 | 提示 | 理由 |
|---|---|---|
| 两场 oral/spotlight session 时间重叠 | 🔴 **时间冲突** | 真的只能去一个 |
| 同一个 poster session 内收藏多篇 | ⚪ **同场 poster（可依次看）** | 2 小时看几个展位很正常，不该报警 |
| poster session 与 oral session 重叠 | 🟡 **部分重叠** | 可以取舍时间 |

重叠判定：`A.start < B.end && B.start < A.end`。MVP 不做自动消解。

---

## 9. 日历

### 9.1 三种机制

| 机制 | 实现 | 定位 |
|---|---|---|
| 单条 `.ics` 下载 | **纯客户端生成**，Blob download | 快速加单个 |
| 整份日程 `.ics` 下载 | **纯客户端生成** | **主推路径**，见 §9.4 |
| 订阅 feed `.ics` | Worker + KV，`/cal/<token>.ics` | 次要，需开启云同步 |

另外为单条事件提供「加入 Google 日历」的 URL 跳转。

### 9.2 Oral 报告的时间问题（决策 D6）

PDF 只给 session 时间窗。以 O1A 为例：`10:30–12:00`，里面塞了 6 个 oral + 6 个 spotlight。均分是 7.5 分钟/个，但 oral 和 spotlight 时长显然不同，均分出来的时间是**编造的**，会直接导致用户错过报告。

**决策：日历事件 = 整个 session。**

```
SUMMARY:  O1A · Image Segmentation I
DTSTART:  2026-09-28T10:30:00+02:00
DTEND:    2026-09-28T12:00:00+02:00
LOCATION: Erasme Hall, Strasbourg Convention Center
DESCRIPTION:
  你在这场收藏了 2 个报告：
  • [Oral 3/6] ProSMA-UNet: Decoder Conditioning for Proximal-Sparse Skip Feature Selection
    Chun-Wun Cheng, University of Cambridge
  • [Spotlight 1/6] Hierarchical Disentangled Consistency Learning for …
    Feixiang Zhou, University of Liverpool
  ⚠ 单个报告的精确时间官方未公布，此事件覆盖整场 session。
```

好处：不编造时间；同一 session 收藏多篇只产生一个日历事件，不刷屏。

Poster 同理 —— 事件 = 整个 poster session（2 小时），描述里列出你要看的展板号，方便到场后直奔。

### 9.3 ICS 正确性

- 遵循 RFC 5545，在 Apple Calendar / Google Calendar / Outlook 上实测后才能发布
- 输出完整 `VTIMEZONE` for `Europe/Paris`。会期 9/27–10/1 全程在 CEST（UTC+2），2026 年夏令时 10/25 才结束，但仍然要正确输出 VTIMEZONE，不能图省事写死偏移
- 稳定 `UID`：`<presentation-id>@miccaisubscribe.com`，**每次生成必须一致**，这样日程变更时日历客户端是更新而不是新增
- 正确转义 `,` `;` `\` 和换行；正确实现 75 字节折行；CRLF 行尾
- `VALARM` 默认提前 15 分钟（用户可在设置里改）

### 9.4 必须诚实告知的限制

**订阅型日历的刷新延迟对一个 3 天的会议来说是致命的。** Google Calendar 对外部 ICS 订阅的刷新间隔最长可达 24 小时，且用户无法控制。这意味着会期中途加的收藏，很可能在会议结束前都不会出现在订阅日历里。

因此：

- **「下载 .ics」是主推路径**，在 UI 上排第一
- 「订阅链接」排第二，并且必须直白写明：*"日历应用自行决定刷新频率，Google 日历可能长达 24 小时。会期中如有改动，建议重新下载 .ics。"*
- 绝不宣称"实时同步"

---

## 10. 前端

### 10.1 视觉方向（决策 D7）

**精致工具感** —— Linear / Arc 那一档：克制的配色、考究的字体排版、舒服的间距节奏、有意义的微交互；同时保持高信息密度，一屏能看到足够多内容。

具体主张：

- **排版承担主要表达**。字号阶梯清晰，标题用紧凑字距，元信息（时间/房间/展板号）用等宽或表格数字对齐
- **色彩克制且有功能**：用颜色编码 presentation 类型（oral / spotlight / poster / workshop / challenge / tutorial）和冲突状态，而不是纯装饰
- **动效有意义**：收藏的状态转换、页面切换、列表项进入。全部尊重 `prefers-reduced-motion`
- **深色模式必做** —— 会场灯光通常很暗
- **明确避免**：大面积渐变、玻璃拟态、营销式 hero 区、桌面 dashboard 布局、无意义的装饰插图

字体：优先系统字体栈保证性能；如引入 web font，只引入一款可变字体且 `font-display: swap`。

### 10.2 技术栈

```
Vite + React 18 + TypeScript + Tailwind CSS
  → 静态输出
  → Cloudflare Pages
```

**不用 Next.js。** 理由：所有数据都是构建期静态的，没有 SSR 需求；纯静态产物在 Cloudflare 边缘的延迟最低；避免 Next.js on Workers 的运行时兼容问题——在 9 天工期里这是不可接受的风险来源。

唯一的服务端代码是一个小 Worker，只负责 §6.2 的同步和 §9.1 的 feed。

### 10.3 路由

| 路由 | 内容 |
|---|---|
| `/` | 搜索 + 「今天」+ 快速入口 |
| `/search?q=` | 搜索结果（标题/作者/机构混合，分组展示） |
| `/paper/:boardNumber` | 论文详情 |
| `/author/:slug` | 作者页 + 关注按钮 |
| `/affiliation/:slug` | 机构页 + 关注按钮 |
| `/session/:id` | Session 详情（含 chairs、全部报告） |
| `/satellite` | Satellite 总览（按天 × 房间网格 + 列表切换） |
| `/satellite/:id` | 单个 workshop/challenge/tutorial |
| `/schedule` | 我的日程 |
| `/calendar` | 日历导出与订阅 |
| `/about` | 非官方声明、数据来源、隐私 |
| `/import#<data>` | 从另一台设备导入收藏 |

底部导航四项：**探索 · 日程 · Satellite · 关于**。需适配 iPhone safe-area inset。

### 10.4 移动端与无障碍

- 最小适配宽度 320 px；主测 iPhone Safari 与 Android Chrome
- 触控目标不小于 44×44 CSS px
- 关键信息绝不依赖 hover
- 语义化 HTML、键盘可达、可见焦点环、对比度达 WCAG AA
- 收藏按钮用 `aria-pressed` 暴露状态；图标不能是唯一的意义来源
- 正确的标题层级

---

## 11. 性能与部署

### 11.1 指标

| 指标 | 目标 |
|---|---|
| LCP（4G 移动网络） | < 1.5 s |
| 可交互 | < 2.0 s |
| JS bundle（gzip） | < 150 KB |
| `program.json`（brotli） | 约 92 KB |
| 搜索响应（索引就绪后） | < 20 ms |
| 重复访问（Service Worker 命中） | < 300 ms，且离线可用 |

### 11.2 Cloudflare 配置

- **Cloudflare Pages** 托管静态产物，GitHub 推送自动部署
- 自定义域 `miccaisubscribe.com`，全站 HTTPS + HSTS
- `program.json` 走内容哈希文件名 + `Cache-Control: immutable`
- HTML 用 `no-cache` + ETag
- 一个 **Worker** 处理 `/api/sync/*` 与 `/cal/*`；**KV** 存同步数据
- 对 `/api/sync/*` 做速率限制（每 IP 每分钟 30 次）；浏览行为完全不限流
- 用户相关响应一律 `Cache-Control: private, no-store`，绝不进共享缓存

### 11.3 离线（从 v0.1 的 Phase 2 提升到 MVP）

会场 Wi-Fi 普遍很差，这是会议工具的核心可靠性问题，而不是加分项。站点本来就是纯静态的，加一个 Service Worker 预缓存 app shell + `program.json` 成本很低（约半天），收益是**整个会期全程离线可用**。

同时提供 PWA manifest 支持添加到主屏。**不做 Web Push**（iOS Safari 支持有限，且 §9 的日历提醒已覆盖此需求）。

### 11.4 环境

`local` / `preview`（PR 自动预览）/ `production`。KV 的 production namespace 与其他环境隔离。

---

## 12. 风险登记

| ID | 风险 | 影响 | 应对 |
|---|---|---|---|
| R1 | **官方在会前继续改 PDF 排版**（已发生一次：9/08 表格版 → 9/10 纯文本版，还删掉了 Paper ID 列） | 高 | §4.3 校验闸门；解析失败硬失败并报警；raw 全部存档可回滚 |
| R2 | 日程内容变动（已发生：撤稿 1 篇） | 中 | 每日重跑 + diff 报告；收藏按稳定展板号存活；`title_key` 作为迁移兜底 |
| R3 | **Poster 大厅名称查不到** — 已结案 | 低 | 2026-09-19 查过官网 CONFERENCE-CENTER、FAQs、MAIN-CONFERENCE-PRESENTATION-INSTRUCTIONS 及两份 PDF，**官方从未公布 poster 厅名称**。按决策 D8：`room` 留 `null`，不编造，UI 只显示展板号并注明"场地见现场指引" |
| R4 | Satellite 缩写对不齐（§4.4） | 中 | 手维护别名表；未映射项 warning 列出，不静默丢 |
| R5 | 同名作者无法区分（§5.1） | 中 | UI 明示限制；始终附带机构 |
| R6 | **订阅日历刷新最长 24 小时** | 中 | §9.4：主推下载 .ics，订阅降级为次要并直白告知 |
| R7 | **9 天工期** | 高 | §13 分阶段，D0 即可上线；每个阶段独立可发布 |
| R8 | 会场网络差 | 中 | §11.3 离线优先 |
| R9 | 官方可能发布自己的 App | 低 | 本产品定位为非官方补充，不受影响 |

---

## 13. 分阶段计划（9 天）

每个阶段结束都是**可上线状态**。如果时间不够，从后往前砍。

| 阶段 | 日期 | 内容 | 结束时的状态 |
|---|---|---|---|
| ~~**P0 · 数据**~~ ✅ | 9/19 **已完成** | 全套 importer + 校验闸门 + 交叉验证（§4.6） | **数据可信，提前 1 天** |
| **P1 · 能用** | 9/21–9/22 | Vite+React 骨架；搜索（标题/作者/机构）；论文详情；收藏（localStorage）；我的日程；部署上域名 | **最小可用版上线** |
| **P2 · 日历** | 9/23 | 客户端 ICS 生成（单条 + 整份）；Europe/Paris VTIMEZONE；三大日历客户端实测 | 日历闭环 |
| **P3 · Satellite** | 9/24 | `parse_satellite.py`；别名表手工过一遍；satellite 浏览与收藏 | 覆盖 5 天全程 |
| **P4 · 关注 + 打磨** | 9/25 | 作者页/机构页 + 关注；冲突三档提示；视觉打磨到 §10.1 标准；深色模式 | 功能完整 |
| **P5 · 加固** | 9/26 | Service Worker 离线；真机 QA（iPhone/Android）；云同步 + 订阅 feed；错误状态；无障碍检查 | **冻结发布** |
| **会期** | 9/27–10/1 | 每天 07:00 CEST 重跑导入；只修 bug，不加功能 | — |

**可以砍掉的（按优先级从低到高）**：云同步与订阅 feed（P5）→ 关注功能（P4）→ satellite（P3）。**不能砍**：搜索、收藏、日程、下载 .ics。

---

## 14. 验收标准

MVP 达标的判据 —— 一个全新用户在手机上能够：

1. 打开 `miccaisubscribe.com`，3 秒内看到搜索框
2. 搜论文标题关键词（`evidential`），命中
3. 搜作者姓名（`Yuanye Liu`），命中
4. **搜机构（`Fudan`、`Technical University of Munich`），命中**
5. 搜展板号（`M-PM-001`），直达
6. 打开论文，看到**完整作者列表**、presenter、机构、session、时间、展板号
7. 一次点击收藏，无需注册
8. 关掉浏览器重开，收藏还在
9. 打开「我的日程」，按 5 天分组、按时间排序
10. 看到分档合理的冲突提示（同场 poster 不误报为冲突）
11. 关注一位作者，其全部报告自动进入日程并标明来源
12. 下载整份 `.ics`，导入 Apple Calendar / Google Calendar，**时间在 Europe/Paris 下正确**
13. 浏览 satellite events，按天与房间查看，可收藏
14. 断网后仍能浏览全部日程与收藏
15. 页脚清晰显示非官方声明与数据版本

### 数据正确性（发布前人工验证）

- 随机抽 30 篇 poster，逐字比对官方 PDF 的标题、作者、展板号、session
- 全部 18 个 oral/spotlight session 的时间与会场逐个核对
- 全部 5 个 poster session 的时间逐个核对
- 随机抽 20 个 satellite events 与网格 PDF 比对
- 确认 `T-AM-098`（已撤回）不出现在站内

---

## 15. 明确的非目标

不做，且不因为"顺手"而做：

原生 App · 用户账号与 OAuth · 社交/评论/点赞 · 站内私信 · AI 推荐或论文相似度 · 摘要抓取 · 海报厅路径规划 · Web Push · 邮件通知 · 主办方后台 · 支付 · 多会议/历届支持 · 保存搜索条件式订阅（决策 D4 已排除） · workshop 内部论文级日程（数据不可得，§2.6）

---

## 16. 工程哲学

保持无聊。

优先：静态文件 · 确定性的导入器 · 纯客户端逻辑 · 标准 HTTP 与标准 ICS · Cloudflare 原生原语 · 极小的依赖面。

这个系统只需要在 5 天里正确工作。它应该易于理解、易于部署、易于调试，会后易于归档。任何"以后可能有用"的基础设施，现在都不要加。
