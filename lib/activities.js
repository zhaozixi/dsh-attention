/**
 * dsh-attention: built-in micro-activity library.
 *
 * Each activity is a short (30s–5min) suggestion the user can do during
 * fragmented time while DSH executes a long-running task. Activities are
 * keyed by id, grouped into categories, and shipped with both zh and en
 * copy. Users may add custom activities through the panel settings.
 */

/** @typedef {"micro-movement"|"mind-refresh"|"micro-learning"|"quick-organize"|"custom"} ActivityCategory */

/** Stable category ordering used by the panel and the reminder engine. */
export const CATEGORY_ORDER = /** @type {const} */ ([
  "micro-movement",
  "mind-refresh",
  "micro-learning",
  "quick-organize",
  "custom"
]);

/** Category display metadata (used by the client panel for grouping). */
export const CATEGORY_META = /** @type {const} */ ({
  "micro-movement": { icon: "🦵", color: "#4caf7d" },
  "mind-refresh": { icon: "🧠", color: "#5b8def" },
  "micro-learning": { icon: "📖", color: "#b48ce0" },
  "quick-organize": { icon: "📋", color: "#e0a458" },
  custom: { icon: "✨", color: "#7a8ba0" }
});

/**
 * @typedef {Object} Activity
 * @property {string} id - stable activity id.
 * @property {ActivityCategory} category - owning category.
 * @property {{zh: string, en: string}} title - activity headline.
 * @property {{zh: string, en: string}} body - one-line how-to copy.
 * @property {number} durationSec - suggested duration in seconds.
 */

/**
 * The built-in preset activity set. Large by design: the reminder engine
 * rotates through it round-robin so a session never repeats the same
 * suggestion until the whole library has been cycled.
 * @type {Activity[]}
 */
export const PRESET_ACTIVITIES = /** @type {Activity[]} */ ([
  // ── micro-movement: 微运动 ────────────────────────────────────────────
  { id: "mm-neck-roll", category: "micro-movement", title: { zh: "颈部放松", en: "Neck roll" }, body: { zh: "缓慢转动颈部，左右各 5 圈，缓解久坐僵直", en: "Slowly roll your neck 5 times each way to release stiffness" }, durationSec: 45 },
  { id: "mm-eye-palm", category: "micro-movement", title: { zh: "眼部按摩", en: "Eye palm" }, body: { zh: "搓热双手轻捂双眼 30 秒，远眺 20 秒", en: "Warm palms over closed eyes for 30s, then look into the distance" }, durationSec: 50 },
  { id: "mm-wrist-stretch", category: "micro-movement", title: { zh: "手腕伸展", en: "Wrist stretch" }, body: { zh: "伸直手臂，另一手轻拉手指 15 秒，换边", en: "Extend arm and gently pull fingers back 15s each side" }, durationSec: 40 },
  { id: "mm-shoulder-circle", category: "micro-movement", title: { zh: "肩部绕圈", en: "Shoulder circles" }, body: { zh: "双肩向后绕圈 10 次，再向前 10 次", en: "Roll shoulders backward 10 times, then forward 10" }, durationSec: 30 },
  { id: "mm-stand-stretch", category: "micro-movement", title: { zh: "站立拉伸", en: "Standing stretch" }, body: { zh: "起身站立，双手举过头顶向上拉伸 20 秒", en: "Stand up, reach overhead and stretch upward for 20s" }, durationSec: 30 },
  { id: "mm-chair-twist", category: "micro-movement", title: { zh: "坐姿转体", en: "Seated twist" }, body: { zh: "坐直后向左右转体各 5 次，活动脊柱", en: "Sit tall and twist left/right 5 times to mobilize the spine" }, durationSec: 40 },
  { id: "mm-ankle-roll", category: "micro-movement", title: { zh: "脚踝绕环", en: "Ankle rolls" }, body: { zh: "抬腿绕动脚踝左右各 8 圈，促进下肢循环", en: "Lift a leg and circle the ankle 8 times each way" }, durationSec: 35 },
  { id: "mm-finger-tap", category: "micro-movement", title: { zh: "指尖敲击", en: "Finger taps" }, body: { zh: "双手指尖交替快速敲击桌面 30 秒，放松手腕", en: "Alternate finger taps on the desk for 30s to relax wrists" }, durationSec: 30 },
  { id: "mm-trapezius-squeeze", category: "micro-movement", title: { zh: "肩胛挤压", en: "Scapula squeeze" }, body: { zh: "双臂后展，肩胛骨向中间挤压，保持 10 秒×3", en: "Draw arms back, squeeze shoulder blades together 10s x3" }, durationSec: 40 },
  { id: "mm-walk-around", category: "micro-movement", title: { zh: "起身走动", en: "Walk around" }, body: { zh: "在房间里走动 1 分钟，喝口水或看看窗外", en: "Walk around the room for a minute, drink water or look outside" }, durationSec: 60 },
  { id: "mm-water-drink", category: "micro-movement", title: { zh: "补充水分", en: "Drink water" }, body: { zh: "起身倒杯温水喝下，保持身体水分", en: "Get up and drink a glass of warm water to stay hydrated" }, durationSec: 30 },
  { id: "mm-eyes-20-20", category: "micro-movement", title: { zh: "20-20-20 法则", en: "20-20-20 rule" }, body: { zh: "看 20 英尺外物体 20 秒，每 20 分钟一次", en: "Look at something 20 feet away for 20 seconds" }, durationSec: 25 },

  // ── mind-refresh: 脑力激活 ────────────────────────────────────────────
  { id: "mr-breath-3", category: "mind-refresh", title: { zh: "深呼吸三次", en: "Three deep breaths" }, body: { zh: "吸气 4 秒，屏息 2 秒，呼气 6 秒，重复三次", en: "Inhale 4s, hold 2s, exhale 6s — repeat three times" }, durationSec: 36 },
  { id: "mr-meditate-60", category: "mind-refresh", title: { zh: "60 秒冥想", en: "60s mini-meditation" }, body: { zh: "闭眼专注于呼吸节奏，清空脑中杂念 60 秒", en: "Close eyes, focus on breathing, clear your mind for 60s" }, durationSec: 60 },
  { id: "mr-recall-concept", category: "mind-refresh", title: { zh: "概念回忆", en: "Recall a concept" }, body: { zh: "回忆刚才工作中接触的一个新概念，用一句话复述", en: "Recall one new concept from recent work; restate it in a sentence" }, durationSec: 90 },
  { id: "mr-mental-todo", category: "mind-refresh", title: { zh: "头脑清单", en: "Mental checklist" }, body: { zh: "默想接下来 3 件要做的事，按优先级排序", en: "Think of the next 3 things to do and rank them by priority" }, durationSec: 60 },
  { id: "mr-word-game", category: "mind-refresh", title: { zh: "词语接龙", en: "Word chain" }, body: { zh: "用当前任务主题做词语联想，训练思维敏捷度", en: "Free-associate words around your task topic to stay sharp" }, durationSec: 60 },
  { id: "mr-countdown-5", category: "mind-refresh", title: { zh: "5-4-3-2-1 接地法", en: "5-4-3-2-1 grounding" }, body: { zh: "说出 5 个看到的物体、4 种触感、3 种声音、2 种气味、1 种味道", en: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste" }, durationSec: 75 },
  { id: "mr-posture-check", category: "mind-refresh", title: { zh: "姿势检查", en: "Posture check" }, body: { zh: "检查坐姿：背靠椅背、双肩放松、屏幕与眼平", en: "Check posture: back supported, shoulders relaxed, screen at eye level" }, durationSec: 20 },
  { id: "mr-gratitude", category: "mind-refresh", title: { zh: "三件好事", en: "Three good things" }, body: { zh: "快速写下今天发生的三件值得感激的小事", en: "Quickly jot down three good small things from today" }, durationSec: 90 },
  { id: "mr-muscle-relax", category: "mind-refresh", title: { zh: "渐进式放松", en: "Progressive relax" }, body: { zh: "从脚趾到头顶逐部位收紧再放松肌肉", en: "Tense then relax each muscle group from toes to head" }, durationSec: 120 },
  { id: "mr-humming", category: "mind-refresh", title: { zh: "哼唱放松", en: "Gentle humming" }, body: { zh: "哼一段旋律 30 秒，放松喉部与肩颈", en: "Hum a tune for 30s to relax throat and shoulders" }, durationSec: 30 },

  // ── micro-learning: 微学习 ────────────────────────────────────────────
  { id: "ml-ts-tip", category: "micro-learning", title: { zh: "TypeScript 技巧", en: "TypeScript tip" }, body: { zh: "用 satisfies 关键字让类型推断与字面量检查兼得", en: "Use `satisfies` to keep literal inference with type checking" }, durationSec: 60 },
  { id: "ml-design-pattern", category: "micro-learning", title: { zh: "设计模式速记", en: "Pattern flashcard" }, body: { zh: "回忆策略模式：把算法族封装成可替换的对象", en: "Recall Strategy: encapsulate interchangeable algorithm families" }, durationSec: 60 },
  { id: "ml-api-shortcut", category: "micro-learning", title: { zh: "API 速查", en: "API shortcut" }, body: { zh: "翻一眼当前项目用到的 API 文档，记住一个新参数", en: "Skim one API doc you use; memorize one new parameter" }, durationSec: 120 },
  { id: "ml-git-command", category: "micro-learning", title: { zh: "Git 命令卡片", en: "Git command card" }, body: { zh: "git stash -u 可连未跟踪文件一起暂存", en: "`git stash -u` stashes untracked files too" }, durationSec: 45 },
  { id: "ml-code-read", category: "micro-learning", title: { zh: "读一段源码", en: "Read a code snippet" }, body: { zh: "打开最近改动的一个文件，通读一个函数理解其意图", en: "Open a recently changed file and read one function fully" }, durationSec: 180 },
  { id: "ml-english-word", category: "micro-learning", title: { zh: "背一个单词", en: "Learn one word" }, body: { zh: "学一个技术英语词汇并造一个句子", en: "Learn one tech vocabulary word and use it in a sentence" }, durationSec: 60 },
  { id: "ml-pomodoro-quiz", category: "micro-learning", title: { zh: "自测小测验", en: "Self-quiz" }, body: { zh: "给自己出一道关于当前任务的小问题并回答", en: "Quiz yourself on one small question about the current task" }, durationSec: 90 },
  { id: "ml-rss-scan", category: "micro-learning", title: { zh: "扫一眼资讯", en: "Scan the feed" }, body: { zh: "浏览一条行业资讯标题，提炼核心观点", en: "Read one industry headline and extract its key point" }, durationSec: 90 },
  { id: "ml-keyboard-shortcut", category: "micro-learning", title: { zh: "快捷键新学", en: "New shortcut" }, body: { zh: "学习一个 IDE 或系统的快捷键并立即试用", en: "Learn one IDE/OS shortcut and try it immediately" }, durationSec: 60 },
  { id: "ml-error-log", category: "micro-learning", title: { zh: "错误日志复盘", en: "Error log review" }, body: { zh: "回看最近一条报错日志，找出根因关键词", en: "Review the latest error log and spot the root-cause keyword" }, durationSec: 120 },
  { id: "ml-doc-title", category: "micro-learning", title: { zh: "文档标题速读", en: "Doc headline skim" }, body: { zh: "浏览一篇技术文档的标题层级，形成知识地图", en: "Skim a doc's heading outline to build a mental map" }, durationSec: 120 },

  // ── quick-organize: 快速整理 ──────────────────────────────────────────
  { id: "qo-write-todo", category: "quick-organize", title: { zh: "写下待办", en: "Write a todo" }, body: { zh: "把脑中悬着的 2 件待办写进笔记，清空工作记忆", en: "Write two nagging todos into notes to free working memory" }, durationSec: 90 },
  { id: "qo-clean-desktop", category: "quick-organize", title: { zh: "清理桌面", en: "Clean the desktop" }, body: { zh: "把桌面上的临时文件归档到对应文件夹", en: "File one stray desktop item into its folder" }, durationSec: 120 },
  { id: "qo-archive-file", category: "quick-organize", title: { zh: "归档一个文件", en: "Archive a file" }, body: { zh: "把一个过期文件移入归档目录，减少查找噪音", en: "Move one stale file into the archive folder" }, durationSec: 60 },
  { id: "qo-close-tabs", category: "quick-organize", title: { zh: "关掉多余标签页", en: "Close extra tabs" }, body: { zh: "关闭 3 个不用的浏览器标签页", en: "Close three unused browser tabs" }, durationSec: 30 },
  { id: "qo-inbox-zero", category: "quick-organize", title: { zh: "清一条收件", en: "Clear one inbox item" }, body: { zh: "处理收件箱里最早的一条消息或邮件", en: "Handle the oldest item in your inbox" }, durationSec: 120 },
  { id: "qo-rename-file", category: "quick-organize", title: { zh: "文件重命名", en: "Rename a file" }, body: { zh: "给一个命名混乱的文件起个规范名字", en: "Give one misnamed file a proper name" }, durationSec: 30 },
  { id: "qo-snippet-save", category: "quick-organize", title: { zh: "保存片段", en: "Save a snippet" }, body: { zh: "把刚想到的一个好点子或代码片段存进笔记", en: "Save one good idea or code snippet into notes" }, durationSec: 60 },
  { id: "qo-download-sort", category: "quick-organize", title: { zh: "整理下载目录", en: "Sort downloads" }, body: { zh: "把下载目录里最新的 2 个文件移到项目目录", en: "Move the two newest downloads into project folders" }, durationSec: 90 },
  { id: "qo-calendar-peek", category: "quick-organize", title: { zh: "查看日程", en: "Peek at calendar" }, body: { zh: "确认下个时间段的日程安排，提前准备", en: "Confirm the next timeslot and prepare for it" }, durationSec: 60 },
  { id: "qo-note-merge", category: "quick-organize", title: { zh: "笔记合并", en: "Merge notes" }, body: { zh: "把两处零散笔记合并成一条结构化记录", en: "Merge two scattered notes into one structured entry" }, durationSec: 120 }
]);
