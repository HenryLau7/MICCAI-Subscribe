# MICCAI Subscribe

**订阅你关心的论文和研究者，把整个 MICCAI 2026 日程装进口袋。**

[English](README.md) · 中文

<p align="center">
  <img src="docs/screenshots/home.png" width="265" alt="首页：会议日期、搜索框，以及通往个人日程和卫星会议的入口">
  <img src="docs/screenshots/search.png" width="265" alt="搜索结果：论文卡片含标题、作者、机构、展板号，以及它出现的每一个场次">
  <img src="docs/screenshots/schedule.png" width="265" alt="我的日程：某一天已订阅的报告，两场时间重叠的 oral 上有红色冲突提示">
</p>

> **这是一个独立的非官方社区工具。** 与 MICCAI 学会及 MICCAI 2026 组委会无任何
> 隶属或背书关系，也未使用其任何标识。官方日程才是权威——现场请以官方公告为准。

---

## 它解决什么问题

MICCAI 的日程是主会三天里的 1,100+ 篇论文，外加前后两天的 workshop、challenge
和 tutorial，官方只发两份 PDF。想找出你真正关心的那六场报告，意味着在走廊里用
手机翻 PDF，翻完还得记住。

MICCAI Subscribe 把这份日程变成可搜索、可订阅、可导出的东西。全部逻辑跑在你自己
的浏览器里——不需要注册，没有账号，不向任何服务器发送数据。

## 怎么订阅

这里的「订阅」指的是订阅**论文、研究者和机构**，不是邮件列表。有两种方式，可以叠加使用。

### 收藏单场报告 ★

搜索任意内容——论文标题、作者姓名、机构名，或者像 `M-PM-001` 这样的展板号——然后
点某一场报告上的星标。它就进入了你的日程。

每一篇 oral 论文同时也有 poster 场次，这类论文两个场次都会列出来，你星标自己
打算去的那一场。

### 关注一个人或一个组

在任意作者页或机构页点 **Follow**。此后**他们的全部报告**都会自动汇总进你的日程
——包括你从没见过的论文，以及日程后续修订中新增的论文。

这才是「订阅」而非「收藏夹」的意义所在。如果你的导师、合作者，或者你在关注的某个组
有六篇论文分散在三天里，关注一次就能把六篇全部收进来。

关注带进来的论文可以单独从日程里移除，不必取消关注整个人——适用于其中某一篇跟你
方向无关的情况。

### 看每一天

<img src="docs/screenshots/schedule.png" width="290" align="right" alt="日程页：两场 oral 的红色时间冲突提示，以及同一 poster 场次的中性提示">

**My schedule** 按天铺开你订阅的内容，每一行由时间领读——因为那正是你实际扫视时
要找的东西。

它会诚实地提示冲突：

- **Time conflict**（红色）—— 两场你不可能同时参加的报告。
- **Partial overlap**（琥珀色）—— 一场报告与某个 poster 场次部分重叠。
- **Same poster session**（中性色，且刻意**不**称之为冲突）—— 同一个两小时
  poster 场次里的几篇海报，只是几步路的事，不是问题。把这个叫做「冲突」，只会
  训练你忽略真正重要的那个提示。

如果你收藏的报告在日程修订中被撤下或重新编号，页面会给出提示横幅，绝不会悄无声息
地把它删掉。

<br clear="right">

### 导入日历

<img src="docs/screenshots/calendar.png" width="290" align="right" alt="日历页：下载 .ics、加入日历、关于订阅链接刷新间隔的诚实说明，以及提醒时间选项">

下载一个包含全部日程的 `.ics` 文件，导入 Apple Calendar、Google Calendar、
Outlook，或任何能读 `.ics` 的应用。在手机上，**Add to Calendar** 会直接把文件
交给系统分享面板。

导出前可以选提醒提前量：不提醒，或 5 / 15 / 30 / 60 分钟。

有一件事这个应用刻意**不做**：编造单场报告的具体时间。官方日程只公布场次的起止
时间，所以一个日历事件对应一个**场次**，绝不拆成一场一个。把 90 分钟的场次切成
十二个编造的时间段，正是让你错过目标报告的方式。

<br clear="right">

### 换设备

你的订阅保存在浏览器本地存储里，不会自己跟着你去第二台设备。日历页的**传输链接**
负责这件事：在任何地方打开它，导入即可。数据放在 URL 里 `#` 之后的部分，浏览器
从不会把这部分发给服务器。

## 还有什么

- **卫星会议** —— 会议前后两天的 workshop、challenge 和 tutorial，可按时间顺序
  浏览，也可以看「房间 × 时间段」的网格视图，支持按天、类型、主题筛选。
- **离线可用。** 首次访问之后，应用本身和整份日程都会被缓存。在会场 Wi-Fi 下，
  这是「能用」和「不能用」的区别。
- **可安装。** 添加到主屏幕后像原生应用一样打开。
- **深色模式**，跟随系统设置。
- **按 320px 手机屏设计**，44px 触控区域，键盘焦点可见，每个元素都带文字标签
  ——颜色从来不是区分信息的唯一手段。

<p align="center">
  <img src="docs/screenshots/schedule-dark.png" width="280" alt="同一个日程页面的深色模式">
</p>

## 关于数据

所有数据来自 MICCAI 2026 官方日程 PDF 和官网列表页，每天重新抓取。应用里会显示
它解析的是哪个修订版本、抓取于何时。

三件值得知道的事：

- **官方日程标注为 TENTATIVE（暂定）**，确实会变——它的**结构**就在中途变过一次，
  某个修订版直接少了一整列。导入器宁可拒绝发布无法通过校验的数据，也不会悄悄把
  解析了一半的日程发出去。
- **源数据里没有单场报告的时间**，这里也不会凭空造一个。
- **作者只是一个姓名字符串。** 源数据没有 ORCID，有几百个姓名对应着不止一个机构。
  应用会把这一点明说，并展示论文数和所属机构，而不是假装已经完成了身份消歧。

源数据里没有的东西——摘要、论文链接、海报厅名称——应用就什么都不显示，绝不用
占位符填补空缺。

## 隐私

没有账号，没有统计分析，没有后端。收藏、关注和偏好设置只存在你浏览器的本地存储里。
数据离开你设备的唯一途径都由你主动触发：分享传输链接，或使用「Add to Google
Calendar」链接（这会把那一个事件的信息发给 Google）。

---

## 自己跑起来

需要 Python 3.12+ 和 Node（版本见 `.node-version`）。

```bash
# 重建日程数据（可选，data/processed 已经提交进仓库）
pip install -r requirements.txt
python3 scripts/fetch.py     # -> data/raw/<today>/，附 sha256 清单
python3 scripts/build.py     # -> data/processed/，校验不通过会直接失败

# 运行应用
cd web
npm ci
npm run dev
```

`web/public/data/program.min.json` 是生成的，没有提交进仓库。`npm run dev`、
`npm run build` 和 `npm test` 都会自动重新生成它；直接跑 `vitest` 则不会。

**整体结构：** 一个 Python 导入器把官方 PDF 解析成
`data/processed/program.min.json`（gzip 后约 130 KB）；前端是一个静态的
React + TypeScript SPA，下载这一个文件之后所有事情都在内存里完成。整个仓库里
没有任何服务端组件。

| 路径 | 内容 |
|---|---|
| `scripts/` | 导入器——抓取、解析、校验、构建。详见 `scripts/README.md`。 |
| `config/` | 手工维护的解析器输入（卫星会议缩写别名、议程事件）。 |
| `data/` | 带校验和的源文件存档，以及构建产物 JSON。 |
| `web/src/` | 应用本体：`routes/` 页面、`ui/` 组件、`store/` 状态与日程逻辑、`search/` 索引、`calendar/` `.ics` 生成。 |
| `.github/workflows/` | 每日数据刷新，只开 PR，绝不自动合并。 |

质量门禁：

```bash
cd web
npm test                        # 24 个文件共 252 个测试
npx tsc -b && npm run lint
npm run build                   # 输出 gzip 体积，预算 150 KB
node scripts/verify-offline.mjs # 真实无头 Chrome，断网，11 条断言
```

## 部署

构建产物是纯静态的，任何能托管文件的服务都可以。以 Cloudflare Pages 为例：
构建命令 `cd web && npm ci && npm run build`，输出目录 `web/dist`，Node 版本
从 `.node-version` 读取。

`web/public/_redirects` 把所有路径重写到 `index.html` 以支持前端路由，
`web/public/_headers` 给应用路由设置 `no-cache`。首次部署后，确认这些响应头在
**深层路由**上也生效了，而不只是根路径：

```bash
curl -sI https://<your-domain>/paper/M-PM-001 | grep -i cache-control
```

## 参与贡献

欢迎提 issue 和 PR，尤其是官方 PDF 变动之后的解析器修复。提交前请保证测试全绿，
并跑一遍类型检查和 linter。

有几个决定看起来随意，其实不是：`program.min.json` 有且只有一个缓存写入方；同一
场次内部的任何情况都不算冲突；不再能解析的收藏项会被报告而不是丢弃；类型配色是三个
功能组而非六种色相——因为六种配色没通过色盲模拟测试。每一条都在对应代码处有注释。
