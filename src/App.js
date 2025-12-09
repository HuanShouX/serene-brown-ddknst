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
  AlertCircle,
  History,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Repeat,
  CalendarDays,
} from "lucide-react";

// --- 配置常量 ---
const IMPORTANCE_CONFIG = [
  { value: 1, label: "琐事", icon: "💭" },
  { value: 2, label: "一般", icon: "📝" },
  { value: 3, label: "重要", icon: "⭐" },
];

// --- 辅助函数：日期与优先级计算 ---
const getDaysRemaining = (ddlString) => {
  if (!ddlString) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ddl = new Date(ddlString);
  ddl.setHours(0, 0, 0, 0);
  const diffTime = ddl - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// 根据 DDL 计算时间等级 (1-3)
const calculateTimeLevel = (task) => {
  if (task.isEveryday) return 2; // 每日任务默认时间权重为中等，但不参与 Hero 竞争

  const days = getDaysRemaining(task.ddl);
  if (days <= 3) return 3; // 3天内 = 紧急
  if (days <= 7) return 2; // 7天内 = 一般
  return 1; // >7天 = 琐事
};

// 格式化剩余时间文本
const formatTimeLeft = (task) => {
  if (task.isEveryday) return "每日任务";
  const days = getDaysRemaining(task.ddl);
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天截止";
  if (days === 1) return "明天截止";
  return `${days} 天后截止`;
};

// --- Hook: 长按检测 ---
const useLongPress = (
  onLongPress,
  onClick,
  { shouldPreventDefault = true, delay = 600 } = {}
) => {
  const timerRef = useRef();
  const isLongPress = useRef(false);

  const start = useCallback(
    (event) => {
      if (shouldPreventDefault && event.target) {
        // event.target.addEventListener('touchend', preventDefault, { passive: false });
      }
      isLongPress.current = false;
      timerRef.current = setTimeout(() => {
        isLongPress.current = true;
        onLongPress(event);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (event, shouldTriggerClick = true) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (shouldTriggerClick && !isLongPress.current && onClick) {
        onClick(event);
      }
    },
    [onClick]
  );

  return {
    onMouseDown: (e) => start(e),
    onTouchStart: (e) => start(e),
    onMouseUp: (e) => clear(e),
    onMouseLeave: (e) => clear(e, false),
    onTouchEnd: (e) => clear(e),
  };
};

// --- 样式逻辑 ---
const getCardStyle = (score, type) => {
  // type: 'ddl-urgent' | 'daily' | 'normal'
  if (type === "ddl-urgent")
    return "bg-rose-50 text-rose-900 border border-rose-200 shadow-rose-100";
  if (type === "daily")
    return "bg-emerald-50 text-emerald-900 border border-emerald-200"; // 每日任务用清新的绿色

  if (score >= 5)
    return "bg-orange-50 text-orange-900 border border-orange-100";
  if (score === 4) return "bg-amber-50 text-amber-900 border border-amber-100";
  return "bg-slate-50 text-slate-800 border border-slate-200";
};

const getHeroCardStyle = (score) => {
  // Hero 卡片只会出现 DDL 任务
  if (score >= 5)
    return "bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-200";
  if (score === 4)
    return "bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-orange-200";
  return "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-200";
};

export default function SmartReminderApp() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("dashboard");
  const [editingTask, setEditingTask] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  // 初始化
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

  // 持久化
  useEffect(() => {
    localStorage.setItem("smart-reminder-data", JSON.stringify(tasks));
    localStorage.setItem("smart-reminder-history", JSON.stringify(history));
  }, [tasks, history]);

  // --- 核心逻辑：筛选与排序 ---
  const { topTask, otherTasks } = useMemo(() => {
    const todayStr = new Date().toDateString();

    // 1. 预处理：过滤掉“今天已完成的每日任务”
    const activeTasks = tasks.filter((task) => {
      if (task.isEveryday && task.lastCompletedAt) {
        const completedDate = new Date(task.lastCompletedAt).toDateString();
        if (completedDate === todayStr) return false; // 今天做过了，隐藏
      }
      return true;
    });

    // 2. 计算动态分数并排序
    const sorted = [...activeTasks]
      .map((task) => {
        const timeLevel = calculateTimeLevel(task);
        return {
          ...task,
          _score: timeLevel + task.importanceLevel,
          _timeLevel: timeLevel,
        };
      })
      .sort((a, b) => {
        // 优先级1: 分数高低
        if (b._score !== a._score) return b._score - a._score;
        // 优先级2: DDL 近的在前 (每日任务没有 DDL，视为最远)
        const daysA = a.isEveryday ? 999 : getDaysRemaining(a.ddl);
        const daysB = b.isEveryday ? 999 : getDaysRemaining(b.ddl);
        if (daysA !== daysB) return daysA - daysB;
        // 优先级3: 创建时间
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    // 3. 挑选 Hero Task (每日任务不参与 Hero)
    let hero = null;
    let others = [];

    // 找到第一个非 Everyday 的任务作为 Hero
    const heroIndex = sorted.findIndex((t) => !t.isEveryday);

    if (heroIndex !== -1) {
      hero = sorted[heroIndex];
      others = [...sorted.slice(0, heroIndex), ...sorted.slice(heroIndex + 1)];
    } else {
      others = sorted;
    }

    return { topTask: hero, otherTasks: others };
  }, [tasks]);

  // --- 操作逻辑 ---
  const completeTask = (task) => {
    if (task.isEveryday) {
      // 每日任务：更新完成时间，不删除
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, lastCompletedAt: new Date().toISOString() }
            : t
        )
      );
      // 可选：同时也加一条记录到历史，方便回顾
      setHistory((prev) => {
        const newHistory = [
          { ...task, completedAt: new Date().toISOString(), type: "daily_log" },
          ...prev,
        ];
        return newHistory.slice(0, 20);
      });
    } else {
      // 普通任务：删除并归档
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
    if (task.type === "daily_log") {
      // 每日任务历史恢复其实没意义，这里主要是为了普通任务
      return;
    }
    setTasks((prev) => [{ ...task, completedAt: undefined }, ...prev]);
  };

  const handleSave = (task) => {
    // 校验
    if (!task.isEveryday && !task.ddl) {
      alert("请设置截止日期，或者设为每日任务");
      return;
    }

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
    setView("dashboard");
    setEditingTask(null);
  };

  const handleDeletePermanent = (id) => {
    if (window.confirm("彻底删除这条记录？")) {
      setHistory((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const openEditor = (task = null) => {
    // 默认明天截止，重要程度一般
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDDL = tomorrow.toISOString().split("T")[0];

    setEditingTask(
      task || {
        title: "",
        content: "",
        importanceLevel: 2,
        ddl: defaultDDL,
        isEveryday: false,
      }
    );
    setView("editor");
  };

  // --- 组件：普通卡片 (支持 DDL 和 Everyday 水印) ---
  const GridCard = ({ task }) => {
    const isDDLUrgent = !task.isEveryday && getDaysRemaining(task.ddl) <= 1;
    const cardType = task.isEveryday
      ? "daily"
      : isDDLUrgent
      ? "ddl-urgent"
      : "normal";
    const styleClass = getCardStyle(task._score, cardType);
    const [isShaking, setIsShaking] = useState(false);

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
          relative flex flex-col p-4 rounded-2xl shadow-sm active:scale-95 transition-all cursor-pointer aspect-[4/3] select-none overflow-hidden
          ${styleClass}
          ${isShaking ? "animate-shake ring-2 ring-offset-2 ring-current" : ""}
        `}
        style={{ WebkitTouchCallout: "none" }}
      >
        {/* 水印区域 */}
        {isDDLUrgent && (
          <div className="absolute -right-2 -top-2 w-20 h-20 opacity-10 pointer-events-none rotate-12 z-0">
            <span className="font-black text-5xl text-red-900 block pt-2 pl-2 border-4 border-red-900 rounded-lg -rotate-12">
              DDL
            </span>
          </div>
        )}
        {task.isEveryday && (
          <div className="absolute -right-4 -top-3 w-24 h-24 opacity-10 pointer-events-none z-0">
            <Repeat className="w-full h-full text-emerald-900" />
          </div>
        )}

        {/* 顶部元数据 */}
        <div className="flex justify-between items-center mb-2 z-10 relative">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${
              isDDLUrgent ? "text-rose-600" : "text-gray-400"
            }`}
          >
            {formatTimeLeft(task)}
          </span>
          <div className="flex gap-1 opacity-50 scale-75 origin-right">
            {/* 既然时间是自动的，这里只显示重要程度图标 */}
            <span>{IMPORTANCE_CONFIG[task.importanceLevel - 1].icon}</span>
          </div>
        </div>

        {/* 内容预览 */}
        <div className="flex-1 min-h-0 z-10 relative">
          <p className="text-xs text-gray-500/80 leading-relaxed font-medium line-clamp-3">
            {task.content || (
              <span className="italic opacity-50">无详细备注...</span>
            )}
          </p>
        </div>

        {/* 标题 */}
        <div className="mt-auto pt-2 z-10 relative">
          <h3
            className={`font-black leading-none tracking-tight line-clamp-2 ${
              isDDLUrgent ? "text-rose-700" : "text-gray-800"
            }`}
            style={{ fontSize: "1.15rem" }}
          >
            {task.title || "无标题"}
          </h3>
        </div>
      </div>
    );
  };

  // --- 组件：Hero 卡片 (Top 1) ---
  const HeroCard = ({ task }) => {
    // Hero 必定不是 Everyday
    const isDDLUrgent = getDaysRemaining(task.ddl) <= 1;
    const styleClass = getHeroCardStyle(task._score);
    const [isShaking, setIsShaking] = useState(false);

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
          relative w-full rounded-3xl p-6 mb-8 shadow-2xl text-white overflow-hidden group select-none active:scale-[0.98] transition-transform
          ${styleClass}
          ${
            isShaking
              ? "animate-shake ring-4 ring-offset-4 ring-red-500/50"
              : ""
          }
        `}
        style={{ WebkitTouchCallout: "none" }}
      >
        <div className="absolute -bottom-4 -right-4 p-4 opacity-10 rotate-12">
          {isDDLUrgent ? (
            <AlertTriangle className="w-56 h-56" />
          ) : (
            <Clock className="w-48 h-48" />
          )}
        </div>

        {isDDLUrgent && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07] pointer-events-none">
            <span className="text-[120px] font-black tracking-tighter">
              NOW
            </span>
          </div>
        )}

        <div className="relative z-10 flex justify-between items-start mb-6">
          <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
            {formatTimeLeft(task)}
          </span>

          <div className="bg-white/20 backdrop-blur-md w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-inner border border-white/10">
            {IMPORTANCE_CONFIG[task.importanceLevel - 1].icon}
          </div>
        </div>

        <div className="relative z-10 mt-auto">
          <div className="mb-3 opacity-90 min-h-[24px]">
            <p className="text-sm font-medium line-clamp-2">{task.content}</p>
          </div>
          <h2 className="text-4xl font-black leading-[0.95] tracking-tight drop-shadow-sm">
            {task.title}
          </h2>
        </div>
      </div>
    );
  };

  // --- 视图：编辑器 (重构) ---
  if (view === "editor") {
    return (
      <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <button
            onClick={() => setView("dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <span className="font-bold text-gray-800">
            {editingTask.id ? "编辑" : "新建"}
          </span>
          {editingTask.id ? (
            <button
              onClick={() => {
                if (window.confirm("直接删除而不保存？")) {
                  setTasks((prev) =>
                    prev.filter((t) => t.id !== editingTask.id)
                  );
                  setView("dashboard");
                }
              }}
              className="p-2 text-rose-500"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <input
            autoFocus={!editingTask.id}
            type="text"
            placeholder="要做什么？"
            value={editingTask.title}
            onChange={(e) =>
              setEditingTask({ ...editingTask, title: e.target.value })
            }
            className="w-full text-2xl font-bold mb-6 outline-none placeholder-gray-300 bg-transparent"
          />

          <div className="space-y-6 mb-8">
            {/* 时间设置区域：DDL vs Everyday */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Repeat className="w-4 h-4" /> 每日任务
                </label>
                <div
                  onClick={() =>
                    setEditingTask((prev) => ({
                      ...prev,
                      isEveryday: !prev.isEveryday,
                    }))
                  }
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                    editingTask.isEveryday ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                      editingTask.isEveryday ? "translate-x-6" : ""
                    }`}
                  />
                </div>
              </div>

              {!editingTask.isEveryday && (
                <div className="animate-in fade-in duration-300">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    <CalendarDays className="w-4 h-4" /> 截止日期 (DDL)
                  </label>
                  <input
                    type="date"
                    value={editingTask.ddl}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, ddl: e.target.value })
                    }
                    className="w-full p-3 bg-white rounded-lg border border-gray-200 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-black"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    * 剩余1天以内显示 DDL 水印
                  </p>
                </div>
              )}
              {editingTask.isEveryday && (
                <p className="text-xs text-emerald-600 animate-in fade-in">
                  * 每日任务完成后，明天会自动再次出现。
                </p>
              )}
            </div>

            {/* 重要程度 */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                <Star className="w-4 h-4" /> 重要程度
              </label>
              <div className="grid grid-cols-3 gap-3">
                {IMPORTANCE_CONFIG.map((level) => (
                  <button
                    key={level.value}
                    onClick={() =>
                      setEditingTask({
                        ...editingTask,
                        importanceLevel: level.value,
                      })
                    }
                    className={`
                      py-4 rounded-xl text-sm font-bold transition-all border flex flex-col items-center gap-1
                      ${
                        editingTask.importanceLevel === level.value
                          ? "border-transparent bg-gray-900 text-white shadow-lg transform scale-105"
                          : "border-gray-100 bg-white text-gray-400"
                      }
                    `}
                  >
                    <span className="text-2xl mb-1">{level.icon}</span>
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <textarea
            placeholder="备注..."
            value={editingTask.content}
            onChange={(e) =>
              setEditingTask({ ...editingTask, content: e.target.value })
            }
            className="w-full h-40 resize-none text-base outline-none placeholder-gray-300 leading-relaxed p-4 bg-gray-50 rounded-xl"
          />
        </div>

        <div className="p-4 border-t bg-white safe-area-pb">
          <button
            onClick={() => handleSave(editingTask)}
            className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            保存
          </button>
        </div>
      </div>
    );
  }

  // --- 视图：历史记录 ---
  if (view === "history") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col animate-in slide-in-from-right-10 duration-200">
        <div className="flex items-center justify-between p-4 bg-white shadow-sm z-10">
          <button
            onClick={() => setView("dashboard")}
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
              暂无完成记录
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
      </div>
    );
  }

  // --- 主界面 (Dashboard) ---
  return (
    <div className="min-h-screen bg-white text-gray-900 pb-24 overflow-x-hidden">
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

      <div className="px-5 pt-10 pb-4 flex justify-between items-end">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
          FOCUS{" "}
          <span className="bg-black text-white px-2 text-sm rounded leading-6">
            NOW
          </span>
        </h1>
        <button
          onClick={() => setView("history")}
          className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
        >
          <History className="w-6 h-6" />
        </button>
      </div>

      <div className="px-5">
        {!topTask && otherTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <p>暂无事项，享受当下</p>
          </div>
        ) : (
          <>
            {topTask && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <HeroCard task={topTask} />
              </div>
            )}

            {otherTasks.length > 0 && (
              <div className="mt-6 animate-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="grid grid-cols-2 gap-3">
                  {otherTasks.map((task) => (
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
            className="bg-white border shadow-lg px-4 py-2 rounded-full text-xs font-bold text-gray-600"
          >
            ↓ 安装
          </button>
        </div>
      )}
    </div>
  );
}
