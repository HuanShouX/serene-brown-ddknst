import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Plus,
  ArrowLeft,
  Clock,
  Star,
  Calendar,
  Trash2,
  CheckCircle2,
  History,
  XCircle,
  RotateCcw,
  Repeat,
  // MoreVertical, // 移除未使用的图标引用
} from "lucide-react";

// --- 配置常量 ---
// 修改图标为感叹号数量，直观代表重要性
const IMPORTANCE_CONFIG = [
  { value: 1, label: "琐事", icon: "!" },
  { value: 2, label: "一般", icon: "!!" },
  { value: 3, label: "重要", icon: "!!!" },
];

// --- 辅助函数：触觉反馈 ---
const triggerHaptic = (pattern = [15]) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// --- 辅助函数：日期计算 ---
const getDaysRemaining = (ddlString) => {
  if (!ddlString) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ddl = new Date(ddlString);
  ddl.setHours(0, 0, 0, 0);
  const diffTime = ddl - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// --- 辅助函数：精确倒计时 ---
const formatTimeLeft = (task) => {
  if (task.isEveryday) return "每日任务";

  const days = getDaysRemaining(task.ddl);

  if (days <= 1 && days >= 0) {
    const now = new Date();
    const timeStr = task.time || "23:59";
    const target = new Date(`${task.ddl}T${timeStr}`);
    const diff = target - now;

    if (diff < 0) return "已逾期";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时 ${minutes}分`;
  }

  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天截止";
  if (days === 1) return "明天截止";
  return `${days} 天后截止`;
};

// --- Hook: 增强版长按检测 (含防误触逻辑) ---
const useLongPress = (
  onLongPress,
  onClick,
  { shouldPreventDefault = true, delay = 600 } = {}
) => {
  const timerRef = useRef();
  const isLongPress = useRef(false);
  const startPos = useRef({ x: 0, y: 0 }); // 记录起始坐标
  const isScrolling = useRef(false); // 标记是否发生了滚动

  const start = useCallback(
    (event) => {
      // 记录触摸/点击的起始位置
      const point = event.touches ? event.touches[0] : event;
      startPos.current = { x: point.clientX, y: point.clientY };
      isScrolling.current = false;
      isLongPress.current = false;

      timerRef.current = setTimeout(() => {
        // 只有在没有发生滚动的情况下才触发长按
        if (!isScrolling.current) {
          isLongPress.current = true;
          onLongPress(event);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  // 新增：移动检测函数
  const move = useCallback((event) => {
    if (isLongPress.current) return;

    const point = event.touches ? event.touches[0] : event;
    const moveX = Math.abs(point.clientX - startPos.current.x);
    const moveY = Math.abs(point.clientY - startPos.current.y);

    // 如果移动超过 10px，认为用户在滑动/滚动，取消长按和点击资格
    if (moveX > 10 || moveY > 10) {
      isScrolling.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, []);

  const clear = useCallback(
    (event, shouldTriggerClick = true) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // 触发点击的条件：
      // 1. 需要触发点击
      // 2. 不是长按
      // 3. 并且没有发生明显的滑动 (isScrolling.current 为 false)
      if (
        shouldTriggerClick &&
        !isLongPress.current &&
        !isScrolling.current &&
        onClick
      ) {
        onClick(event);
      }
    },
    [onClick]
  );

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseMove: move, // 监听鼠标移动
    onTouchMove: move, // 监听触摸移动 (关键)
    onMouseUp: (e) => clear(e),
    onMouseLeave: (e) => clear(e, false),
    onTouchEnd: (e) => clear(e),
  };
};

// --- 主题配置系统 ---
const THEMES = {
  red: {
    // DDL
    topBar: "bg-rose-700",
    main: "bg-rose-500",
    iconColor: "text-rose-600",
    watermarkColor: "text-rose-700",
  },
  green: {
    // Everyday
    topBar: "bg-emerald-700",
    main: "bg-emerald-500",
    iconColor: "text-emerald-600",
    watermarkColor: "text-emerald-700",
  },
  purple: {
    // Level 3
    topBar: "bg-purple-800",
    main: "bg-purple-600",
    iconColor: "text-purple-600",
    watermarkColor: "text-purple-800",
  },
  amber: {
    // Level 2
    topBar: "bg-orange-700",
    main: "bg-orange-500",
    iconColor: "text-orange-500",
    watermarkColor: "text-orange-700",
  },
  blue: {
    // Level 1
    topBar: "bg-blue-700",
    main: "bg-blue-500",
    iconColor: "text-blue-600",
    watermarkColor: "text-blue-700",
  },
};

// --- 样式逻辑：获取对应的主题对象 ---
const getTheme = (task, sortMode) => {
  if (task.isEveryday) return THEMES.green;

  const days = getDaysRemaining(task.ddl);

  if (days <= 1) return THEMES.red;

  if (sortMode === "time") {
    if (days <= 3) return THEMES.purple;
    if (days <= 7) return THEMES.amber;
    return THEMES.blue;
  }

  if (sortMode === "importance") {
    switch (task.importanceLevel) {
      case 3:
        return THEMES.purple;
      case 2:
        return THEMES.amber;
      default:
        return THEMES.blue;
    }
  }

  return THEMES.blue;
};

const getLevelColorClass = (levelValue) => {
  switch (levelValue) {
    case 3:
      return "text-violet-500";
    case 2:
      return "text-amber-500";
    default:
      return "text-blue-500";
  }
};

export default function SmartReminderApp() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("dashboard");
  const [editingTask, setEditingTask] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  const [sortMode, setSortMode] = useState("time");
  const [isVisible, setIsVisible] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks((prev) => [...prev]);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSortChange = (newMode) => {
    if (sortMode === newMode || !isVisible) return;
    setIsVisible(false);
    setTimeout(() => {
      triggerHaptic([10]);
      setSortMode(newMode);
      setIsVisible(true);
    }, 500);
  };

  useEffect(() => {
    const handlePopState = (event) => {
      setView((currentView) => {
        if (currentView !== "dashboard") return "dashboard";
        return currentView;
      });
      setEditingTask(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (newView) => {
    setView(newView);
    window.history.pushState({ view: newView }, null, "");
  };

  const goBack = () => {
    window.history.back();
  };

  useEffect(() => {
    const savedTasks = localStorage.getItem("smart-reminder-data");
    const savedHistory = localStorage.getItem("smart-reminder-history");
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("smart-reminder-data", JSON.stringify(tasks));
    localStorage.setItem("smart-reminder-history", JSON.stringify(history));
  }, [tasks, history]);

  const { heroTasks, gridTasks } = useMemo(() => {
    const todayStr = new Date().toDateString();
    const activeTasks = tasks.filter((task) => {
      if (task.isEveryday && task.lastCompletedAt) {
        const completedDate = new Date(task.lastCompletedAt).toDateString();
        if (completedDate === todayStr) return false;
      }
      return true;
    });

    const sorted = [...activeTasks].sort((a, b) => {
      const daysA = a.isEveryday ? 999 : getDaysRemaining(a.ddl);
      const daysB = b.isEveryday ? 999 : getDaysRemaining(b.ddl);

      const isDDLA = !a.isEveryday && daysA <= 1;
      const isDDLB = !b.isEveryday && daysB <= 1;

      if (isDDLA && !isDDLB) return -1;
      if (!isDDLA && isDDLB) return 1;

      if (isDDLA && isDDLB) {
        const timeA = new Date(`${a.ddl}T${a.time || "23:59"}`).getTime();
        const timeB = new Date(`${b.ddl}T${b.time || "23:59"}`).getTime();
        if (timeA !== timeB) return timeA - timeB;
        if (a.importanceLevel !== b.importanceLevel)
          return b.importanceLevel - a.importanceLevel;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }

      const impA = a.importanceLevel;
      const impB = b.importanceLevel;

      if (sortMode === "time") {
        if (daysA !== daysB) return daysA - daysB;
        if (!a.isEveryday && !b.isEveryday) {
          const timeA = new Date(`${a.ddl}T${a.time || "23:59"}`).getTime();
          const timeB = new Date(`${b.ddl}T${b.time || "23:59"}`).getTime();
          if (timeA !== timeB) return timeA - timeB;
        }
        if (impB !== impA) return impB - impA;
      } else {
        if (impB !== impA) return impB - impA;
        if (daysA !== daysB) return daysA - daysB;
        if (!a.isEveryday && !b.isEveryday) {
          const timeA = new Date(`${a.ddl}T${a.time || "23:59"}`).getTime();
          const timeB = new Date(`${b.ddl}T${b.time || "23:59"}`).getTime();
          if (timeA !== timeB) return timeA - timeB;
        }
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    let heroes = [];
    let others = [];

    const ddlTasks = sorted.filter(
      (t) => !t.isEveryday && getDaysRemaining(t.ddl) <= 1
    );

    if (ddlTasks.length > 0) {
      heroes = ddlTasks;
      others = sorted.filter(
        (t) => !(!t.isEveryday && getDaysRemaining(t.ddl) <= 1)
      );
    } else {
      if (sorted.length > 0) {
        heroes = [sorted[0]];
        others = sorted.slice(1);
      }
    }

    return { heroTasks: heroes, gridTasks: others };
  }, [tasks, sortMode]);

  const completeTask = (task) => {
    triggerHaptic([10, 50, 10]);
    if (task.isEveryday) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, lastCompletedAt: new Date().toISOString() }
            : t
        )
      );
      setHistory((prev) => {
        const newHistory = [
          { ...task, completedAt: new Date().toISOString(), type: "daily_log" },
          ...prev,
        ];
        return newHistory.slice(0, 20);
      });
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setHistory((prev) => {
        const newHistory = [
          { ...task, completedAt: new Date().toISOString() },
          ...prev,
        ];
        return newHistory.slice(0, 20);
      });
    }
  };

  const restoreTask = (task) => {
    setHistory((prev) => prev.filter((t) => t.id !== task.id));
    if (task.type === "daily_log") return;
    setTasks((prev) => [{ ...task, completedAt: undefined }, ...prev]);
    showToast("任务已恢复");
  };

  const handleSave = (task) => {
    if (!task.isEveryday && !task.ddl) {
      showToast("⚠️ 请设置截止日期，或设为每日任务");
      return;
    }
    triggerHaptic([20]);
    if (task.id) {
      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)));
    } else {
      setTasks([
        {
          ...task,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        },
        ...tasks,
      ]);
    }
    goBack();
  };

  const handleDeletePermanent = (id) => {
    triggerHaptic([10]);
    setHistory((prev) => prev.filter((t) => t.id !== id));
  };

  const openEditor = (task = null) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDDL = tomorrow.toISOString().split("T")[0];

    setEditingTask(
      task || {
        title: "",
        content: "",
        importanceLevel: 2,
        ddl: defaultDDL,
        time: "",
        isEveryday: false,
      }
    );
    navigateTo("editor");
  };

  // --- 组件：普通卡片 (极致压缩高度) ---
  const GridCard = ({ task }) => {
    const theme = getTheme(task, sortMode);
    const [isShaking, setIsShaking] = useState(false);
    const importanceConfig = IMPORTANCE_CONFIG[task.importanceLevel - 1];

    const handleLongPress = () => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        completeTask(task);
      }, 400);
    };

    const pressHandlers = useLongPress(handleLongPress, () => openEditor(task));

    return (
      <div
        {...pressHandlers}
        className={`
          flex flex-col rounded-xl overflow-hidden shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] bg-white relative group cursor-pointer 
          min-h-[130px] 
          transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]
          ${isShaking ? "animate-shake" : ""}
        `}
        style={{ WebkitTouchCallout: "none" }}
      >
        {/* 1. 顶部深色条 */}
        <div className={`h-1.5 w-full ${theme.topBar} shrink-0`}></div>

        {/* 2. 中间主色块 (更紧凑的 Padding) */}
        <div
          className={`flex-grow ${theme.main} px-3 pt-2 pb-5 flex flex-col relative text-white`}
        >
          <div className="flex justify-between items-center mb-0 opacity-60 h-2">
            <div className="w-1 h-1 rounded-full bg-white/50"></div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center text-center z-10">
            <h2 className="text-lg font-bold tracking-tight leading-tight drop-shadow-sm line-clamp-2 w-full break-words">
              {task.title || "无标题"}
            </h2>
          </div>

          {/* 悬浮按钮 (FAB) */}
          <div className="absolute bottom-0 right-3 transform translate-y-1/2 z-20">
            <button
              className={`bg-white ${theme.iconColor} w-8 h-8 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-black/5 flex items-center justify-center transition-all duration-200 active:scale-95 hover:shadow-lg`}
            >
              {/* 字体加粗以清晰显示感叹号 */}
              <span className="text-base font-black leading-none flex items-center justify-center tracking-tighter">
                {importanceConfig.icon}
              </span>
            </button>
          </div>
        </div>

        {/* 3. 底部白色内容区 */}
        <div className="bg-white px-3 pt-5 pb-2 shrink-0">
          <div className="flex gap-2">
            <div className="mt-0.5 shrink-0">
              <Clock className="w-3 h-3 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              {/* 内容为空时不显示 */}
              {task.content && (
                <h3 className="text-gray-600 font-medium text-xs leading-snug mb-0.5 line-clamp-1">
                  {task.content}
                </h3>
              )}
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                {formatTimeLeft(task)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 组件：Hero 卡片 (极致压缩高度) ---
  const HeroCard = ({ task }) => {
    const theme = getTheme(task, sortMode);
    const [isShaking, setIsShaking] = useState(false);
    const importanceConfig = IMPORTANCE_CONFIG[task.importanceLevel - 1];

    const days = getDaysRemaining(task.ddl);
    const isDDL = !task.isEveryday && days <= 1;

    const handleLongPress = () => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        completeTask(task);
      }, 400);
    };

    const pressHandlers = useLongPress(handleLongPress, () => openEditor(task));

    return (
      <div
        {...pressHandlers}
        className={`
          flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white relative group cursor-pointer mb-4 transition-transform active:scale-[0.99]
          ${isShaking ? "animate-shake" : ""}
        `}
        style={{ WebkitTouchCallout: "none" }}
      >
        {/* 1. 顶部深色条 */}
        <div className={`h-2 w-full ${theme.topBar} shrink-0`}></div>

        {/* 2. 中间主色块 */}
        <div
          className={`relative ${theme.main} px-5 pt-4 pb-8 flex flex-col text-white`}
        >
          {/* 背景水印 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-t-none">
            <div
              className={`absolute -bottom-4 -right-4 opacity-20 rotate-12 ${theme.watermarkColor}`}
            >
              {isDDL ? (
                <span className="text-[90px] font-black leading-none tracking-tighter">
                  DDL
                </span>
              ) : task.isEveryday ? (
                <Repeat size={100} />
              ) : (
                <Calendar size={100} />
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-2 opacity-80 z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest bg-black/10 px-2 py-0.5 rounded">
              FOCUS NOW
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center text-center z-10 my-2">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight drop-shadow-md w-full break-words">
              {task.title || "无标题"}
            </h2>
          </div>

          {/* 悬浮按钮 (FAB) */}
          <div className="absolute bottom-0 right-6 transform translate-y-1/2 z-20">
            <button
              className={`bg-white ${theme.iconColor} w-14 h-14 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.2)] ring-1 ring-black/5 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300`}
            >
              <span className="text-2xl font-black leading-none flex items-center justify-center tracking-tighter">
                {importanceConfig.icon}
              </span>
            </button>
          </div>
        </div>

        {/* 3. 底部白色内容区 */}
        <div className="bg-white px-5 pb-4 pt-9 shrink-0">
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 shrink-0 p-1.5 bg-gray-50 rounded-full">
              <Clock className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              {/* 内容为空时不显示 */}
              {task.content && (
                <h3 className="text-gray-800 font-medium text-sm leading-relaxed mb-1 line-clamp-2">
                  {task.content}
                </h3>
              )}
              <div className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold uppercase tracking-wide">
                {formatTimeLeft(task)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 视图：编辑器 (保持不变) ---
  if (view === "editor") {
    return (
      <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-bottom-8 duration-300 relative">
        <div className="flex items-center justify-between p-6 relative z-10">
          <button
            onClick={goBack}
            className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          {editingTask.id && (
            <button
              onClick={() => {
                triggerHaptic([20]);
                setTasks((prev) => prev.filter((t) => t.id !== editingTask.id));
                goBack();
              }}
              className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-100 active:scale-90 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 px-8 overflow-y-auto relative z-10">
          <input
            autoFocus={!editingTask.id}
            type="text"
            placeholder="Focus on..."
            value={editingTask.title}
            onChange={(e) =>
              setEditingTask({ ...editingTask, title: e.target.value })
            }
            className="w-full text-4xl font-black mb-8 outline-none placeholder-gray-200 bg-transparent text-gray-900 leading-tight"
          />

          <div className="space-y-8">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  triggerHaptic();
                  setEditingTask((p) => ({ ...p, isEveryday: !p.isEveryday }));
                }}
                className={`px-4 py-2 rounded-full font-bold text-sm transition-all border ${
                  editingTask.isEveryday
                    ? "bg-emerald-100 text-emerald-700 border-emerald-100"
                    : "bg-white text-gray-400 border-gray-200"
                }`}
              >
                {editingTask.isEveryday ? "Everyday" : "One-time"}
              </button>

              {!editingTask.isEveryday && (
                <>
                  <input
                    type="date"
                    value={editingTask.ddl}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, ddl: e.target.value })
                    }
                    className="px-4 py-2 rounded-full font-bold text-sm bg-gray-50 text-gray-700 border-none outline-none"
                  />
                  <div className="flex items-center bg-gray-50 rounded-full px-4 py-2 gap-2 border border-transparent focus-within:border-gray-200 transition-colors">
                    <Clock size={16} className="text-gray-400" />
                    <input
                      type="time"
                      value={editingTask.time || ""}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, time: e.target.value })
                      }
                      className="bg-transparent text-sm font-bold text-gray-700 outline-none w-20"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {IMPORTANCE_CONFIG.map((level) => (
                <button
                  key={level.value}
                  onClick={() => {
                    triggerHaptic();
                    setEditingTask({
                      ...editingTask,
                      importanceLevel: level.value,
                    });
                  }}
                  className={`
                    h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2
                    ${
                      editingTask.importanceLevel === level.value
                        ? "border-black bg-black text-white"
                        : "border-transparent bg-gray-50 text-gray-400"
                    }
                  `}
                >
                  <span
                    className={`text-2xl ${getLevelColorClass(level.value)}`}
                  >
                    {level.icon}
                  </span>
                  <span className="text-xs font-bold">{level.label}</span>
                </button>
              ))}
            </div>

            <textarea
              placeholder="添加备注..."
              value={editingTask.content}
              onChange={(e) =>
                setEditingTask({ ...editingTask, content: e.target.value })
              }
              className="w-full h-32 resize-none text-lg outline-none placeholder-gray-300 bg-transparent text-gray-600"
            />
          </div>
        </div>

        <div className="p-6">
          <button
            onClick={() => handleSave(editingTask)}
            className="w-full bg-black text-white h-16 rounded-[2rem] font-bold text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            保存事项
          </button>
        </div>
      </div>
    );
  }

  // --- 视图：历史记录 (保持不变) ---
  if (view === "history") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col animate-in slide-in-from-right-10 duration-200">
        <div className="flex items-center justify-between p-4 bg-white shadow-sm z-10">
          <button
            onClick={goBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <span className="font-bold text-gray-800">
            已完成 ({history.length}/20)
          </span>
          <div className="w-9" />
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40 text-sm">
              <History className="w-12 h-12 mb-2 text-gray-300" />
              空空如也
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((task) => (
                <div
                  key={task.id}
                  className="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex-1 opacity-50">
                    <h3 className="font-bold text-gray-800 line-through decoration-gray-400 decoration-2">
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {task.type === "daily_log" && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1 rounded">
                          每日
                        </span>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(task.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {task.type !== "daily_log" && (
                      <button
                        onClick={() => restoreTask(task)}
                        className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePermanent(task.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-[#1e293b] text-white px-6 py-3 rounded-xl shadow-xl text-sm font-bold flex items-center gap-2 border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              {toast}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 主界面 ---
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-24 overflow-x-hidden relative font-sans">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px) rotate(-2deg); }
          40% { transform: translateX(4px) rotate(2deg); }
          60% { transform: translateX(-4px) rotate(-2deg); }
          80% { transform: translateX(4px) rotate(2deg); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-[#1e293b] text-white px-6 py-3 rounded-xl shadow-xl text-sm font-bold flex items-center gap-2 border border-white/10">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            {toast}
          </div>
        </div>
      )}

      {/* 顶部导航栏 (修改后) */}
      <div className="px-5 pt-10 pb-6 flex justify-between items-center relative z-10">
        {/* 左侧：标题 */}
        <h1 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
          FOCUS{" "}
          <span className="bg-black text-white px-2 text-sm rounded leading-6">
            NOW
          </span>
        </h1>

        {/* 右侧：排序按钮组 + 历史记录 (编组，防止重叠) */}
        <div className="flex items-center gap-3">
          {/* 排序按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSortChange("time")}
              className={`
                    flex items-center justify-center w-9 h-9 rounded-full transition-all border border-gray-200 shadow-sm
                    ${
                      sortMode === "time"
                        ? "bg-black text-white"
                        : "bg-white text-gray-400 hover:text-gray-600"
                    }
                    `}
            >
              <Clock size={16} />
            </button>
            <button
              onClick={() => handleSortChange("importance")}
              className={`
                    flex items-center justify-center w-9 h-9 rounded-full transition-all border border-gray-200 shadow-sm
                    ${
                      sortMode === "importance"
                        ? "bg-black text-white"
                        : "bg-white text-gray-400 hover:text-gray-600"
                    }
                    `}
            >
              <Star size={16} />
            </button>
          </div>

          {/* 历史记录按钮 */}
          <button
            onClick={() => navigateTo("history")}
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors -mr-2"
          >
            <History className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div
        className={`
          px-5 relative z-10 transition-all duration-500 ease-in-out transform
          ${
            isVisible
              ? "opacity-100 translate-y-0 scale-100 blur-0"
              : "opacity-0 -translate-y-12 scale-95 blur-sm"
          }
        `}
      >
        {!heroTasks.length && !gridTasks.length ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-30">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
            <p className="font-bold text-gray-400">人生如逆旅 我亦是行人</p>
          </div>
        ) : (
          <>
            {/* Hero Tasks */}
            {heroTasks.map((task) => (
              <div
                key={task.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <HeroCard task={task} />
              </div>
            ))}

            {/* Grid Tasks */}
            {gridTasks.length > 0 && (
              <div className="mt-2 animate-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="grid grid-cols-2 gap-4">
                  {gridTasks.map((task) => (
                    <GridCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => openEditor(null)}
        className="fixed bottom-8 right-6 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20 ring-4 ring-white"
      >
        <Plus className="w-7 h-7" />
      </button>

      {installPrompt && (
        <div className="fixed bottom-8 left-6 z-10">
          <button
            onClick={() => installPrompt.prompt()}
            className="bg-white border border-gray-200 shadow-lg px-4 py-2 rounded-full text-xs font-bold text-gray-600"
          >
            ↓ 安装应用
          </button>
        </div>
      )}
    </div>
  );
}
