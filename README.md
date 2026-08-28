# dsh-attention — 注意力碎片时间管理插件

在 DeepSeek Harness 执行长时间任务（目标循环、后台任务、Agent 推理、任务看板执行）期间，主动提醒用户利用碎片时间进行微活动，解决「任务进行中只能干等」的低效问题。

## 功能

- **任务监控（多信号源）**：监听 `agent/status`（主会话对话、子代理、task-board 执行会话全覆盖）、goal 轮次、后台任务（jobs）、以及任务看板（task-board）状态轮询，检测任务开始/结束。
- **重启恢复**：host 重启后自动补种恢复运行中的任务窗口——`agent/status` 与 goal 均支持 seed 查询，重启前在跑的任务重启后继续提醒。
- **提醒引擎**：任务运行期间按可配置节奏（默认 5 分钟）推送活动建议；点击「已完成」立即出下一个活动；任务结束生成碎片利用报告。
- **内置活动库**：43 条预设微活动，覆盖四大类——微运动、脑力激活、微学习、快速整理；轮询式分配，同一会话内不重复。
- **活动池编辑器**：左侧侧边栏「注意力」入口 → 弹出活动池编辑面板，四个分类列表可增删改活动，右下角「保存 / 取消」，持久化到 profile。
- **Web 浮动面板**：全局置顶浮窗（z-index 最大 + React Portal 挂 body），显示运行时长、已建议活动数、下次提醒倒计时，支持「已完成（立即下一个）/ 稍后提醒 / 关闭」。
- **HTTP 面**：`GET /api/attention/state`、`POST /api/attention/snooze`、`POST /api/attention/resume`、`POST /api/attention/advance`、`GET|POST /api/attention/activities`。

## 目录结构

```
dsh-attention/
├── package.json            # dsh.bundle + dsh.client 声明
├── cordis.patch.yml        # profile 补丁：注册 attention 行
├── lib/
│   ├── index.js            # Host Service 入口（监控 + 引擎 + HTTP 面 + 活动池持久化）
│   ├── monitor.js          # 任务状态监控（agent/status + goal + jobs + task-board 轮询 + 重启 seed）
│   ├── reminder-engine.js  # 提醒引擎（调度 + 轮询活动池 + 自定义活动表）
│   ├── activities.js       # 内置活动库（43 条预设）
│   ├── client.js           # 浏览器端：浮动面板 + 侧边栏入口 + 活动池编辑器（__ModuleLoader__ 协议）
│   ├── invariant.js        # 断言辅助
│   └── types/              # TypeScript 声明
```

## 安装

### 方式一：本地源码 link（开发）

```sh
dsh plugin --profile web add link:D:\nodeSpace\packages\dsh-attention
# 或相对路径
dsh plugin --profile web add link:../packages/dsh-attention
```

### 方式二：npm 发布后

```sh
dsh plugin --profile web add @deepseek-ai/dsh-attention@latest
```

首次安装如遇 pnpm 拦截构建脚本，在 profile 目录执行 `pnpm approve-builds --all` 后重试。

安装后**重启 DSH**（host 半加载）并**硬刷新浏览器**（client 半生效）。左侧栏「新会话」下方出现 ⭐「注意力」入口。

## 配置

在 profile 的 `cordis.patch.yml` 中覆盖 `attention` 行：

```yaml
- id: attention
  config:
    enabled: true
    remindIntervalMs: 300000      # 提醒间隔（点击「已完成」可立即推进，不等此间隔）
    firstReminderDelayMs: 5000    # 任务开始后首条提醒延迟
    categories:                   # 活动类别池
      - micro-movement
      - mind-refresh
      - micro-learning
      - quick-organize
    maxActivitiesPerSession: 6    # 每会话建议上限
```

## 活动池自定义

1. 点击左侧栏「注意力」入口（新会话下方）。
2. 面板按四个分类（微运动 / 脑力激活 / 微学习 / 快速整理）列出活动，每行可编辑标题、指引文案，可删除；每区底部「+ 添加活动」。
3. 右下角「保存」持久化到 `~/.dsh/profiles/web/attention-activities.json`（随 profile 携带），引擎立即按新表轮询；「取消」丢弃改动。

## 数据流

```
TaskMonitor (host)
   │  task-start / task-end   （agent/status · goal/changed · jobs · task-board 轮询 · 重启 seed）
   ▼
ReminderEngine (host)
   │  suggestion / session-report
   ▼
AttentionService ── emit ──► cordis bus (attention/suggestion)
   │
   ├── /api/attention/state ◄── 轮询 (3s) ── AttentionPanel (browser, portal 置顶浮窗)
   └── /api/attention/advance ◄── 「已完成」── 立即下一个活动
```

## 常见问题

| 现象 | 原因与解决 |
|---|---|
| 任务运行但无提醒 | 确认已重启 DSH（host 半改动需重启）+ 硬刷新浏览器；检查 `/api/attention/state` 的 `busy` 是否为 true |
| 无任务但提醒仍显示 | 运行中会话被关闭/删除时旧窗口残留——已通过 `agent/disposed` 监听修复；如仍出现请升级到最新版本 |
| 重启后不提醒进行中的任务 | 旧版本无 seed 恢复；升级后 `agent/status` 与 goal 均支持重启补种 |
| 活动池编辑不生效 | 保存走 `POST /api/attention/activities` 持久化；确认保存后引擎 `poolSize` 变化 |
