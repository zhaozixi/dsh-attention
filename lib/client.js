window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-attention",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom = require("react-dom");
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region \0dsh-css:src/client/AttentionPanel.module.css.mjs
		const css = ".T0x_root{position:fixed;right:24px;bottom:24px;z-index:2147483647;width:340px;max-width:calc(100vw - 48px);box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}.T0x_header{display:flex;align-items:center;justify-content:space-between;gap:8px}.T0x_title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px}.T0x_timer{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}.T0x_close{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:4px;display:grid;place-items:center}.T0x_close:hover{color:var(--dsw-alias-label-secondary)}.T0x_stats{display:flex;gap:8px;flex-wrap:wrap}.T0x_stat{background:var(--dsw-alias-fill-l2);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px}.T0x_suggestion{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;background:var(--dsw-alias-fill-l1)}.T0x_suggestionTitle{display:flex;align-items:center;gap:8px;font-weight:600}.T0x_suggestionBody{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.T0x_actions{display:flex;gap:8px;margin-top:2px}.T0x_countdown{color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:right}";
		const tagId = "@deepseek-ai/dsh-attention/AttentionPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-attention";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AttentionPanel_module_css_default = {
			"actions": "T0x_actions",
			"close": "T0x_close",
			"countdown": "T0x_countdown",
			"header": "T0x_header",
			"root": "T0x_root",
			"stat": "T0x_stat",
			"stats": "T0x_stats",
			"suggestion": "T0x_suggestion",
			"suggestionBody": "T0x_suggestionBody",
			"suggestionTitle": "T0x_suggestionTitle",
			"timer": "T0x_timer",
			"title": "T0x_title"
		};
		//#endregion
		//#region lib/types/client/AttentionPanel.js
		/** Poll cadence for the attention state endpoint. */
		const POLL_MS = 3000;
		/** Endpoint base served by the host attention service. */
		const STATE_URL = "/api/attention/state";
		/** A suggestion already shown to the user this page-load; keyed by seq. */
		const NO_SUGGESTION = null;
		/** Format an elapsed millisecond count as M:SS or H:MM:SS. */
		function formatElapsed(ms) {
			const total = Math.max(0, Math.floor(ms / 1e3));
			const seconds = total % 60;
			const minutes = Math.floor(total / 60) % 60;
			const hours = Math.floor(total / 3600);
			const pad = (value) => String(value).padStart(2, "0");
			return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
		}
		/**
		* Floating attention panel. Polls the host endpoint, renders the running
		* timer + suggestion stats while a task is busy, and surfaces the latest
		* suggestion with done / snooze actions.
		* @param props - slot currency: namespace translator.
		* @returns the floating panel, or null when idle and nothing to show.
		*/
		function AttentionPanel({ t }) {
			const [state, setState] = (0, react.useState)(null);
			const [now, setNow] = (0, react.useState)(() => Date.now());
			const [dismissedSeq, setDismissedSeq] = (0, react.useState)(null);
			const [closed, setClosed] = (0, react.useState)(false);
			const acknowledgedRef = (0, react.useRef)(new Set());
			const polledAtRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				const tick = async () => {
					try {
						const response = await fetch(STATE_URL, { cache: "no-store" });
						if (!response.ok) return;
						const next = await response.json();
						if (!alive) return;
						setState(next);
						polledAtRef.current = Date.now();
						if (next.lastSuggestion != null && !acknowledgedRef.current.has(next.lastSuggestion.seq)) {
							acknowledgedRef.current.add(next.lastSuggestion.seq);
							setDismissedSeq(null);
						}
					} catch {
						/* host route not ready yet; keep polling */
					}
				};
				tick();
				const timer = setInterval(tick, POLL_MS);
				const clock = setInterval(() => setNow(Date.now()), 1000);
				return () => {
					alive = false;
					clearInterval(timer);
					clearInterval(clock);
				};
			}, []);
			const busy = state?.busy === true;
			const runningMs = busy
				? (state.runningMs ?? 0) + Math.max(0, now - (polledAtRef.current ?? now))
				: 0;
			const currentSuggestion =
				busy && state?.lastSuggestion != null && dismissedSeq !== state.lastSuggestion.seq && !closed
					? state.lastSuggestion
					: NO_SUGGESTION;
			if (!busy || closed) return null;
			const nextFireAt = state?.nextFireAt ?? null;
			const countdownMs = nextFireAt == null ? null : Math.max(0, nextFireAt - now);
			const onDone = async () => {
				// Advance the engine to the next suggestion immediately instead
				// of waiting for the cadence; the upcoming poll picks up the
				// fresh suggestion (new seq) and re-shows the panel.
				try {
					await fetch("/api/attention/advance", { method: "POST" });
				} catch {
					/* ignore */
				}
				setDismissedSeq(state?.lastSuggestion?.seq ?? null);
			};
			const onSnooze = async () => {
				try {
					await fetch("/api/attention/snooze", { method: "POST" });
				} catch {
					/* ignore */
				}
				setDismissedSeq(state?.lastSuggestion?.seq ?? null);
			};
			return (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
				className: AttentionPanel_module_css_default.root,
				role: "region",
				"aria-label": t("panel.aria"),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: AttentionPanel_module_css_default.header,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: AttentionPanel_module_css_default.title,
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }),
									(0, react_jsx_runtime.jsx)("span", { children: t("panel.title") }),
									(0, react_jsx_runtime.jsx)("span", {
										className: AttentionPanel_module_css_default.timer,
										children: formatElapsed(runningMs)
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AttentionPanel_module_css_default.close,
								"aria-label": t("panel.close"),
								onClick: () => setClosed(true),
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: AttentionPanel_module_css_default.stats,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: AttentionPanel_module_css_default.stat,
								children: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [t("panel.suggested", { count: state?.suggestedCount ?? 0 }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 12 })] })
							}),
							countdownMs != null ? (0, react_jsx_runtime.jsx)("span", {
								className: AttentionPanel_module_css_default.stat,
								children: t("panel.nextIn", { time: formatElapsed(countdownMs) })
							}) : null
						]
					}),
					currentSuggestion != null ? (0, react_jsx_runtime.jsxs)("div", {
						className: AttentionPanel_module_css_default.suggestion,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: AttentionPanel_module_css_default.suggestionTitle,
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 }),
									(0, react_jsx_runtime.jsx)("span", { children: currentSuggestion.title })
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: AttentionPanel_module_css_default.suggestionBody,
								children: currentSuggestion.body
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: AttentionPanel_module_css_default.actions,
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 12 }),
										onClick: onDone,
										children: t("action.done")
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPauseOutline16, { size: 12 }),
										onClick: onSnooze,
										children: t("action.snooze")
									})
								]
							})
						]
					}) : null
				]
			}), document.body);
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"panel.aria": "注意力碎片时间面板",
			"panel.title": "碎片时间利用",
			"panel.close": "关闭面板",
			"panel.suggested": "已建议 {count} 个活动",
			"panel.nextIn": "下次提醒 {time} 后",
			"action.done": "已完成",
			"action.snooze": "稍后提醒",
			"toast.reminder": "碎片时间建议：{title}"
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"panel.aria": "Attention fragmented-time panel",
			"panel.title": "Fragmented time",
			"panel.close": "Close panel",
			"panel.suggested": "{count} activities suggested",
			"panel.nextIn": "Next reminder in {time}",
			"action.done": "Done",
			"action.snooze": "Snooze",
			"toast.reminder": "Fragment-time tip: {title}"
		};
		//#endregion
		//#region lib/types/client/activity-pool-editor.js
		/** Stable CSS id for the pool editor's injected stylesheet. */
		const POOL_CSS_ID = "@deepseek-ai/dsh-attention/ActivityPoolEditor.css";
		/** Pool-editor stylesheet (single line; kept separate from the panel css above). */
		const poolCss = ".ap_overlay{background:var(--dsw-alias-bg-mask-2,#080a1073);z-index:2147483647;justify-content:center;align-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;position:fixed;inset:0}.ap_card{background:var(--dsw-alias-bg-overlay,#fdfdfd);width:min(820px,94vw);max-height:86vh;color:var(--dsw-alias-label-primary,#1c1e26);border-radius:12px;flex-direction:column;display:flex;overflow:hidden;box-shadow:0 18px 60px #00000059}.ap_head{background:var(--dsw-alias-bg-base,#fff);align-items:center;gap:10px;padding:12px 16px;display:flex;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb)}.ap_headTitle{margin:0;font-size:15px;font-weight:600;flex:1}.ap_headClose{color:var(--dsw-alias-label-tertiary,#8a8f9c);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:4px 8px;font-size:14px}.ap_headClose:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5);color:var(--dsw-alias-label-primary)}.ap_body{flex:1;overflow-y:auto;padding:8px 16px;display:flex;flex-direction:column;gap:10px}.ap_section{background:var(--dsw-alias-bg-layer-1,#f7f8fa);border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}.ap_sectionHead{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}.ap_sectionCount{color:var(--dsw-alias-label-tertiary,#8a8f9c);font-weight:400;font-size:12px}.ap_row{display:flex;align-items:center;gap:6px}.ap_title{flex:1.2;min-width:0}.ap_body{flex:2.2;min-width:0}.ap_del{flex:none;color:var(--dsw-alias-label-tertiary,#8a8f9c);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:4px 6px;font-size:12px}.ap_del:hover{color:#d83931;background:#fdecec}.ap_add{align-self:flex-start;color:var(--dsw-alias-label-secondary,#3a3f4b);cursor:pointer;background:#eef0f3;border:0;border-radius:6px;padding:4px 10px;font-size:12px;margin-top:2px}.ap_add:hover{background:#e3e6ea}.ap_input{border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:6px;padding:5px 8px;font-size:12px;background:#fff;color:var(--dsw-alias-label-primary,#1c1e26);outline:none}.ap_input:focus{border-color:#4d6bfe}.ap_foot{background:var(--dsw-alias-bg-base,#fff);border-top:1px solid var(--dsw-alias-border-l2,#e5e6eb);padding:10px 16px;display:flex;justify-content:flex-end;gap:8px}.ap_btn{border:0;border-radius:8px;padding:7px 18px;font-size:13px;cursor:pointer}.ap_btnCancel{background:#eef0f3;color:var(--dsw-alias-label-primary,#1c1e26)}.ap_btnCancel:hover{background:#e3e6ea}.ap_btnSave{background:#4d6bfe;color:#fff}.ap_btnSave:hover{background:#3d5bf5}.ap_btnSave:disabled{opacity:.55;cursor:default}.ap_error{color:#d83931;font-size:12px;padding:0 2px}";
		/** Inject the pool stylesheet once. */
		function injectPoolCss() {
			if (typeof document === "undefined" || document.querySelector("style[data-plugin-css=" + JSON.stringify(POOL_CSS_ID) + "]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-attention";
			tag.dataset.pluginCss = POOL_CSS_ID;
			tag.textContent = poolCss;
			document.head.appendChild(tag);
		}
		/** zh category labels for the pool editor. */
		const CATEGORY_LABELS_ZH = {
			"micro-movement": "微运动",
			"mind-refresh": "脑力激活",
			"micro-learning": "微学习",
			"quick-organize": "快速整理",
			"custom": "自定义"
		};
		/** CATEGORY_ORDER mirrored here (host owns the source of truth; fallback only). */
		const POOL_CATEGORY_ORDER = ["micro-movement", "mind-refresh", "micro-learning", "quick-organize", "custom"];
		/** Normalize one host activity row into the editor's editable shape. */
		function editableActivity(a) {
			return {
				id: a.id,
				category: a.category,
				title: typeof a.title === "string" ? a.title : (a.title && a.title.zh) || "",
				body: typeof a.body === "string" ? a.body : (a.body && a.body.zh) || "",
				durationSec: typeof a.durationSec === "number" && a.durationSec > 0 ? a.durationSec : 60
			};
		}
		/**
		* Pool editor row: one activity's editable fields plus a remove action.
		* @param props - value, onChange(next), onRemove.
		* @returns the row element.
		*/
		function PoolRow(props) {
			const onChange = (patch) => props.onChange({ ...props.value, ...patch });
			return react.createElement("div", { className: "ap_row" },
				react.createElement("input", { className: "ap_title ap_input", value: props.value.title, placeholder: "标题", onChange: (e) => onChange({ title: e.target.value }) }),
				react.createElement("input", { className: "ap_body ap_input", value: props.value.body, placeholder: "指引文案", onChange: (e) => onChange({ body: e.target.value }) }),
				react.createElement("button", { type: "button", className: "ap_del", "aria-label": "删除活动", onClick: props.onRemove }, "✕")
			);
		}
		/**
		* The activity-pool editor overlay: four category sections listing their
		* activities with inline editing, add/remove per category, and a
		* Save / Cancel footer. Loads from the host on open; Save persists the
		* full table via POST /api/attention/activities.
		* @param props - onClose().
		* @returns the overlay element, or null while loading.
		*/
		function ActivityPoolPanel(props) {
			const [activities, setActivities] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [saving, setSaving] = react.useState(false);
			react.useEffect(() => {
				let alive = true;
				fetch("/api/attention/activities", { cache: "no-store" })
					.then((response) => {
						if (!response.ok) throw new Error("HTTP " + response.status);
						return response.json();
					})
					.then((data) => {
						if (!alive) return;
						const list = Array.isArray(data.activities) ? data.activities : [];
						setActivities(list.map(editableActivity));
					})
					.catch((err) => {
						if (alive) setError(String((err && err.message) || err));
					});
				return () => { alive = false; };
			}, []);
			const update = (id, next) => setActivities((prev) => prev.map((a) => a.id === id ? next : a));
			const remove = (id) => setActivities((prev) => prev.filter((a) => a.id !== id));
			const add = (category) => {
				const id = "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
				setActivities((prev) => [...prev, { id, category, title: "", body: "", durationSec: 60 }]);
			};
			const save = async () => {
				if (saving || activities === null) return;
				setSaving(true);
				setError(null);
				try {
					const response = await fetch("/api/attention/activities", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							activities: activities.map((a) => ({
								id: a.id,
								category: a.category,
								title: a.title,
								body: a.body,
								durationSec: a.durationSec
							}))
						})
					});
					if (!response.ok) {
						let message = "HTTP " + response.status;
						try {
							const body = await response.json();
							if (body && typeof body.error === "string") message = body.error;
						} catch { /* keep HTTP status */ }
						throw new Error(message);
					}
					props.onClose();
				} catch (err) {
					setError(String((err && err.message) || err));
					setSaving(false);
				}
			};
			if (activities === null && error === null) {
				return react.createElement("div", { className: "ap_overlay", role: "dialog", "aria-label": "注意力活动池" },
					react.createElement("div", { className: "ap_card" },
						react.createElement("div", { className: "ap_head" },
							react.createElement("h2", { className: "ap_headTitle" }, "注意力活动池"),
							react.createElement("button", { type: "button", className: "ap_headClose", onClick: props.onClose }, "✕")),
						react.createElement("div", { className: "ap_body" }, "加载中…")));
			}
			const order = POOL_CATEGORY_ORDER;
			return react.createElement("div", { className: "ap_overlay", role: "dialog", "aria-label": "注意力活动池" },
				react.createElement("div", { className: "ap_card" },
					react.createElement("div", { className: "ap_head" },
						react.createElement("h2", { className: "ap_headTitle" }, "注意力活动池"),
						react.createElement("button", { type: "button", className: "ap_headClose", onClick: props.onClose }, "✕")),
					react.createElement("div", { className: "ap_body" },
						error !== null ? react.createElement("div", { className: "ap_error" }, "错误：" + error) : null,
						order.map((category) => {
							const rows = (activities ?? []).filter((a) => a.category === category);
							return react.createElement("div", { key: category, className: "ap_section" },
								react.createElement("div", { className: "ap_sectionHead" },
									react.createElement("span", null, CATEGORY_LABELS_ZH[category] ?? category),
									react.createElement("span", { className: "ap_sectionCount" }, rows.length + " 个")),
								rows.map((a) => react.createElement(PoolRow, { key: a.id, value: a, onChange: (next) => update(a.id, next), onRemove: () => remove(a.id) })),
								react.createElement("button", { type: "button", className: "ap_add", onClick: () => add(category) }, "+ 添加活动"));
						})),
					react.createElement("div", { className: "ap_foot" },
						react.createElement("button", { type: "button", className: "ap_btn ap_btnCancel", onClick: props.onClose }, "取消"),
						react.createElement("button", { type: "button", className: "ap_btn ap_btnSave", disabled: saving, onClick: () => void save() }, saving ? "保存中…" : "保存"))));
		}
		/**
		* Mount the activity-pool editor overlay (one instance; toggled by the
		* sidebar entry).
		* @returns controller (toggle/close) and the disposer.
		*/
		function mountPoolPanel() {
			let root;
			let container;
			const close = () => {
				if (root === void 0) return;
				root.unmount();
				root = void 0;
				container === null || container === void 0 ? void 0 : container.remove();
				container = void 0;
			};
			const open = () => {
				if (root !== void 0) return;
				injectPoolCss();
				container = document.createElement("div");
				container.dataset.dshAttentionPoolView = "";
				container.dataset.dshPlugin = "@deepseek-ai/dsh-attention";
				document.body.appendChild(container);
				root = react_dom_client.createRoot(container);
				root.render(react.createElement(ActivityPoolPanel, { onClose: close }));
			};
			return {
				toggle: () => { if (root !== void 0) close(); else open(); },
				open,
				close,
				dispose: close
			};
		}
		//#endregion
		//#region lib/types/client/sidebar-entry.js
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot$1() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
		function newSessionButton$1(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** Build the detached entry row button. */
		function createEntry$1(options) {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.setAttribute(options.rowAttribute, "");
			if (options.plugin !== void 0) {
				entry.setAttribute("data-dsh-plugin", options.plugin);
				entry.setAttribute("data-dsh-part", "sidebar-entry");
			}
			entry.className = options.css.entry;
			entry.setAttribute("aria-label", options.label);
			if (options.tooltip !== void 0) entry.setAttribute("title", options.tooltip);
			entry.innerHTML = "<span class=\"" + options.css.entryIcon + "\">" + options.icon + "</span><span class=\"" + options.css.entryLabel + "\">" + options.label + "</span>";
			entry.addEventListener("click", options.onToggle);
			return entry;
		}
		/** Insert the entry after the New Session row (before the browser region). */
		function placeEntry$1(root, entry, options) {
			const button = newSessionButton$1(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches(options.familySelectors.join(", ")));
				const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/**
		* Mount the sidebar entry, waiting for the shell to render and self-healing
		* on later React re-renders.
		* @param options - row configuration.
		* @returns disposer removing the entry and its observers.
		*/
		function mountSidebarEntry$1(options) {
			if (typeof document !== "undefined" && document.querySelector(options.rowSelector) !== null) return () => {};
			const entry = createEntry$1(options);
			let root;
			let placed = false;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry)) return;
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				root !== null && root !== void 0 ? root : (root = sidebarRoot$1());
				if (root === void 0) return;
				placed = placeEntry$1(root, entry, options);
				if (placed) rootObserver.observe(root, { childList: true, subtree: true });
			};
			const waitObserver = new MutationObserver(() => { tryPlace(); });
			waitObserver.observe(document.body, { childList: true, subtree: true });
			const rootObserver = new MutationObserver(() => {
				if (root === void 0 || !root.isConnected) {
					placed = false;
					tryPlace();
					return;
				}
				if (!root.contains(entry)) placed = placeEntry$1(root, entry, options);
			});
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				entry.remove();
			};
		}
		/** Stable data attribute identifying the injected entry row. */
		const ENTRY_SELECTOR = "[data-dsh-attention-entry]";
		/** Inline sparkle icon normalized to the shell's 18px navigation glyph size. */
		const ENTRY_ICON = "<svg viewBox=\"0 0 16 16\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6L8 2z\"/></svg>";
		/** Minimal entry-row CSS (icon + label row, collapsed rail hides the label). */
		const entryCss = {
			entry: "cAttn_entry",
			entryIcon: "cAttn_entryIcon",
			entryLabel: "cAttn_entryLabel"
		};
		const entryStyle = ".cAttn_entry{box-sizing:border-box;width:100%;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 10px;font-size:13px;display:flex}.cAttn_entry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.cAttn_entryIcon{flex:none;justify-content:center;align-items:center;width:24px;height:24px;display:inline-flex}.cAttn_entryIcon svg{width:18px;height:18px;display:block}.cAttn_entryLabel{text-overflow:ellipsis;overflow:hidden}[data-dsh-frame][data-sidebar-collapsed] .cAttn_entry,[data-sidebar-collapsed] .cAttn_entry{border-radius:50%;justify-content:center;width:36px;height:36px;margin:0 auto 12px;padding:0}[data-dsh-frame][data-sidebar-collapsed] .cAttn_entryLabel,[data-sidebar-collapsed] .cAttn_entryLabel{display:none}";
		/** Inject the entry stylesheet once. */
		function injectEntryCss() {
			if (typeof document === "undefined" || document.querySelector("style[data-plugin-css=\"@deepseek-ai/dsh-attention/sidebar-entry.css\"]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-attention";
			tag.dataset.pluginCss = "@deepseek-ai/dsh-attention/sidebar-entry.css";
			tag.textContent = entryStyle;
			document.head.appendChild(tag);
		}
		/**
		* Mount the attention pool sidebar entry (placed after task-board /
		* skill-explorer rows when present). Clicking toggles the pool editor.
		* @param onToggle - opens the activity-pool overlay.
		* @returns disposer removing the entry.
		*/
		function mountAttentionSidebarEntry(onToggle) {
			injectEntryCss();
			return mountSidebarEntry$1({
				rowAttribute: "data-dsh-attention-entry",
				rowSelector: ENTRY_SELECTOR,
				plugin: "@deepseek-ai/dsh-attention",
				icon: ENTRY_ICON,
				css: entryCss,
				label: "注意力",
				tooltip: "注意力活动池：查看与管理碎片时间活动",
				onToggle,
				familySelectors: [
					"[data-dsh-taskboard-entry]",
					"[data-dsh-ssh-entry]",
					"[data-dsh-skill-explorer-entry]",
					"[data-dsh-attention-entry]"
				]
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "attention";
		/** Required services for locale registration and the shell overlay slot. */
		const inject = [
			"slots",
			"locale"
		];
		/**
		* Client plugin body: register the dictionaries, the overlay panel, and
		* the activity-pool sidebar entry.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-attention: dictionaries");
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "attention",
				order: 10,
				locale: NS
			}, AttentionPanel));
			const poolPanel = mountPoolPanel();
			const disposers = [() => poolPanel.dispose()];
			try {
				disposers.push(mountAttentionSidebarEntry(() => poolPanel.toggle()));
			} catch (error) {
				console.warn("[attention] sidebar entry mount failed:", error);
			}
			ctx.effect(() => () => {
				for (const dispose of disposers.splice(0)) dispose();
			}, "ui-attention: pool ui mounts");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
