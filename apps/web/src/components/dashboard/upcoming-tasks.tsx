"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  category: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  completed: boolean;
}

const priorityStyles = {
  LOW: "bg-white/5 text-white/40 border-white/10",
  MEDIUM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  HIGH: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  URGENT: "bg-red-500/10 text-red-400 border-red-500/20",
} as const;

export function UpcomingTasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/moving")
      .then((res) => res.json())
      .then((data) => {
        const plans = data.plans || [];
        const allTasks: TaskItem[] = [];
        plans.forEach((plan: any) => {
          if (plan.tasks) {
            plan.tasks.forEach((t: any) => {
              allTasks.push({
                id: t.id,
                title: t.title,
                category: t.category || "Task",
                dueDate: t.dueDate,
                priority: t.priority || "MEDIUM",
                completed: t.completed,
              });
            });
          }
        });
        allTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        setTasks(allTasks.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-white">Upcoming Tasks</h3>
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 font-medium">
          {tasks.filter((t) => !t.completed).length} remaining
        </span>
      </div>
      <div className="px-5 pb-5 space-y-2">
        {loading ? (
          <p className="text-sm text-white/30 text-center py-4">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-4">No upcoming tasks</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-all",
                task.completed && "opacity-50"
              )}
            >
              <button className="mt-0.5 shrink-0">
                {task.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 text-white/20 hover:text-orange-400 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <p className={cn("text-sm font-medium text-white/80", task.completed && "line-through text-white/40")}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <span>{task.category}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0", priorityStyles[task.priority])}>
                {task.priority}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
