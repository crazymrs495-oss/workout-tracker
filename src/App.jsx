import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, ChevronDown, ChevronUp, ChevronRight, Play, Pause, Plus, Minus, Dumbbell, Trash2, X, Volume2, VolumeX, ArrowLeftRight, Scale, GripHorizontal, Settings, Flame, Timer, Square, Award, AlertTriangle, Flag, TrendingUp, Calendar, Download, Upload, Repeat } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { storage } from "./lib/storage";

// ---------- COLOR TOKENS (black & white minimalism) ----------
const C = {
  bg: "#ffffff",
  headerBg: "rgba(255,255,255,0.95)",
  cardBg: "#ffffff",
  cardBorder: "#e6e6e6",
  chipBg: "#f4f4f4",
  chipBorder: "#e0e0e0",
  inputBg: "#f5f5f5",
  inputBorder: "#dcdcdc",
  text: "#111111",
  textDim: "#5c5c5c",
  textFaint: "#9a9a9a",
  accent: "#111111",
  blue: "#111111",
  rowBorder: "#ededed",
  danger: "#4a4a4a",
};

// Fixed color per muscle group — used for the volume donut, its legend, and the weekly bars
const MUSCLE_COLORS = {
  Chest: "#C62828",
  Triceps: "#EF6C00",
  Shoulders: "#F9A825",
  Back: "#1565C0",
  Biceps: "#7B1FA2",
  Legs: "#2E7D32",
  Abs: "#00838F",
};
const MUSCLE_ORDER = ["Chest", "Triceps", "Shoulders", "Back", "Biceps", "Legs", "Abs"];

// ---------- SOUND ----------
let sharedCtx = null;
function getAudioCtx() {
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!sharedCtx) sharedCtx = new AudioCtxClass();
  if (sharedCtx.state === "suspended") sharedCtx.resume();
  return sharedCtx;
}
function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}
function playBeep(times = 4) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square"; osc2.type = "square";
    osc.frequency.value = 1046.5; osc2.frequency.value = 1318.5;
    const start = ctx.currentTime + i * 0.32;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.9, start + 0.015);
    gain.gain.linearRampToValueAtTime(0.9, start + 0.16);
    gain.gain.linearRampToValueAtTime(0, start + 0.26);
    osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
    osc.start(start); osc.stop(start + 0.28);
    osc2.start(start); osc2.stop(start + 0.28);
  }
}
function playTick() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 740;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.01);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.11);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.12);
}
function playPRSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 ascending triumphant
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle"; osc2.type = "sine";
    osc.frequency.value = freq; osc2.frequency.value = freq * 2;
    const start = ctx.currentTime + i * 0.11;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.5, start + 0.02);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.15);
    gain.gain.linearRampToValueAtTime(0, start + (i === notes.length - 1 ? 0.6 : 0.3));
    osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
    osc.start(start); osc.stop(start + 0.65);
    osc2.start(start); osc2.stop(start + 0.65);
  });
}

// ---------- DATA ----------
const PROGRAM = [
  {
    id: "push1", day: "Monday", title: "Push 1 + Abs", warmupKey: "push",
    groups: [
      { name: "Chest", exercises: [
        { id: "p1-fb", name: "Flat Bench Press", sub: "PR Maxxing", sets: 1, reps: "—" },
        { id: "p1-incline", name: "Incline Press", sets: 3, reps: "8-10" },
        { id: "p1-pecdec", name: "Pec Dec Fly", sets: 2, reps: "8-10" },
        { id: "p1-h2l", name: "High to Low Cable Fly", sets: 3, reps: "8-10" },
      ]},
      { name: "Shoulders", exercises: [
        { id: "p1-shp", name: "Shoulder Press", sets: 3, reps: "8-10" },
        { id: "p1-lat", name: "Lateral Raises", sets: 3, reps: "8-10" },
        { id: "p1-rdf", name: "Rear Delt Fly", sets: 3, reps: "8-10" },
      ]},
      { name: "Triceps", exercises: [
        { id: "p1-ote", name: "Overhead Tricep Extension", sets: 3, reps: "8-10" },
        { id: "p1-tpd", name: "Tricep Pushdown", sets: 3, reps: "8-10" },
      ]},
      { name: "Abs", exercises: [
        { id: "p1-cc", name: "Cable Crunch", sets: 3, reps: "8-10" },
        { id: "p1-lr", name: "Leg Raises", sets: 3, reps: "10-12" },
      ]},
    ],
  },
  {
    id: "pull1", day: "Tuesday", title: "Pull 1", warmupKey: "pull",
    groups: [
      { name: "Back", exercises: [
        { id: "pl1-pu", name: "Pull Ups", sets: 3, reps: "8-10" },
        { id: "pl1-cgpd", name: "Close Grip Pulldown", sets: 3, reps: "8-10" },
        { id: "pl1-dbr", name: "DB Row (Chest Supported)", sets: 3, reps: "8-10" },
        { id: "pl1-pullover", name: "Lat Pullover", sets: 3, reps: "8-10" },
      ]},
      { name: "Biceps", exercises: [
        { id: "pl1-ic", name: "Incline Curl", sets: 2, reps: "8-10" },
        { id: "pl1-pc", name: "Preacher Curl", sets: 2, reps: "8-10" },
        { id: "pl1-hc", name: "Hammer Curl", sets: 2, reps: "8-10" },
      ]},
    ],
  },
  {
    id: "legs", day: "Wednesday", title: "Legs + Abs", warmupKey: "legs",
    groups: [
      { name: "Abs", exercises: [
        { id: "lg-cc", name: "Cable Crunch", sets: 3, reps: "8-10" },
        { id: "lg-lr", name: "Leg Raises", sets: 3, reps: "10-12" },
      ]},
      { name: "Legs", exercises: [
        { id: "lg-lp", name: "Leg Press", sets: 3, reps: "8-10" },
        { id: "lg-le", name: "Leg Extension", sets: 3, reps: "8-10" },
        { id: "lg-rdl", name: "RDL", sets: 3, reps: "8-10" },
        { id: "lg-hc", name: "Hamstring Curl", sets: 3, reps: "8-10" },
      ]},
    ],
  },
  {
    id: "push2", day: "Thursday", title: "Push 2", warmupKey: "push",
    groups: [
      { name: "Chest", exercises: [
        { id: "p2-fb", name: "Flat Bench Press", sub: "Warmup", sets: 1, reps: "8-10" },
        { id: "p2-incline", name: "Incline Press", sets: 3, reps: "8-10" },
        { id: "p2-pecdec", name: "Pec Dec Fly", sets: 2, reps: "8-10" },
        { id: "p2-h2l", name: "High to Low Fly", sets: 3, reps: "8-10" },
      ]},
      { name: "Shoulders", exercises: [
        { id: "p2-shp", name: "Shoulder Press", sets: 3, reps: "8-10" },
        { id: "p2-lat", name: "Lateral Raises", sets: 3, reps: "8-10" },
        { id: "p2-rdf", name: "Rear Delt Fly", sets: 3, reps: "8-10" },
      ]},
      { name: "Triceps", exercises: [
        { id: "p2-ote", name: "Overhead Tricep Extension", sets: 3, reps: "8-10" },
        { id: "p2-tpd", name: "Tricep Pushdown", sets: 3, reps: "8-10" },
      ]},
    ],
  },
  {
    id: "pull2", day: "Friday", title: "Pull 2 + Abs", warmupKey: "pull",
    groups: [
      { name: "Back", exercises: [
        { id: "pl2-wpd", name: "Wide Pull Down", sets: 3, reps: "8-10" },
        { id: "pl2-cgr", name: "Close Grip Row", sets: 3, reps: "8-10" },
        { id: "pl2-dbr", name: "DB Row (Chest Supported)", sets: 2, reps: "8-10" },
        { id: "pl2-kelso", name: "Kelso Shrugs", sets: 2, reps: "8-10" },
        { id: "pl2-pullover", name: "Lat Pullover", sets: 3, reps: "8-10" },
      ]},
      { name: "Biceps", exercises: [
        { id: "pl2-ic", name: "Incline Curl", sets: 2, reps: "8-10" },
        { id: "pl2-pc", name: "Preacher Curl", sets: 2, reps: "8-10" },
        { id: "pl2-hc", name: "Hammer Curl", sets: 2, reps: "8-10" },
      ]},
      { name: "Abs", exercises: [
        { id: "pl2-cc", name: "Cable Crunch", sets: 3, reps: "8-10" },
        { id: "pl2-lr", name: "Leg Raises", sets: 3, reps: "10-12" },
      ]},
    ],
  },
  {
    id: "shoarms", day: "Saturday", title: "Shoulder + Arms", warmupKey: "shoarms",
    groups: [
      { name: "Shoulders", exercises: [
        { id: "sa-clr", name: "Cable Lateral Raise", sets: 3, reps: "8-10" },
        { id: "sa-dblr", name: "DB Lateral Raise", sub: "Drop Set", sets: 1, reps: "8-10" },
        { id: "sa-rdf", name: "Rear Delt Fly", sets: 2, reps: "8-10" },
      ]},
      { name: "Biceps", exercises: [
        { id: "sa-ic", name: "Incline Curl", sets: 2, reps: "8-10" },
        { id: "sa-pc", name: "Preacher Curl", sets: 2, reps: "8-10" },
        { id: "sa-hc", name: "Hammer Curl", sets: 2, reps: "8-10" },
      ]},
      { name: "Triceps", exercises: [
        { id: "sa-ote", name: "Overhead Tricep Extension", sets: 3, reps: "8-10" },
        { id: "sa-tpd", name: "Tricep Pushdown", sets: 3, reps: "8-10" },
      ]},
    ],
  },
];

const WARMUPS = {
  push: { label: "Push Warm-up", items: [
    { id: "w1", text: "Arm circles", dur: "1 min" },
    { id: "w2", text: "Band pull-apart", dur: "1 min" },
    { id: "w3", text: "Shoulder dislocates (band)", dur: "1 min" },
    { id: "w4", text: "Push-up x 15", dur: "" },
  ]},
  pull: { label: "Pull Warm-up", items: [
    { id: "w1", text: "Band pull-aparts", dur: "1 min" },
    { id: "w2", text: "Scapular pull-ups", dur: "2 min" },
    { id: "w3", text: "Light band rows", dur: "2 min" },
  ]},
  legs: { label: "Leg Warm-up", items: [
    { id: "w1", text: "Bodyweight squats", dur: "1 min" },
    { id: "w2", text: "Leg swings (front-back, side-side)", dur: "1 min" },
    { id: "w3", text: "Walking lunges", dur: "2 min" },
  ]},
  shoarms: { label: "Shoulder + Arms Warm-up", items: [
    { id: "w1", text: "Arm circles", dur: "1 min" },
    { id: "w2", text: "Scapular pull-ups", dur: "1 min" },
    { id: "w3", text: "Band pull-aparts + external rotations", dur: "1 min" },
    { id: "w4", text: "Light band curls/pushdowns", dur: "2 min" },
  ]},
};

const REST_DEFAULT = 90;
const WEEKDAY_MAP = { 1: "push1", 2: "pull1", 3: "legs", 4: "push2", 5: "pull2", 6: "shoarms" };

function todayId() {
  return WEEKDAY_MAP[new Date().getDay()] || "push1";
}
// Local calendar-day string (YYYY-MM-DD) — NOT toISOString(), which is UTC and
// silently shifts to the wrong day for anyone not sitting at UTC+0, especially
// during an evening workout when local and UTC dates disagree.
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function fmtDuration(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function fmtHM(s) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
function weekLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}
// dominance rule: a PR if new set is >= baseline on both weight and reps, and strictly greater on at least one
function isPR(a, b) {
  if (!b) return false;
  if (a.weight <= 0 || a.reps <= 0) return false;
  return a.weight >= b.weight && a.reps >= b.reps && (a.weight > b.weight || a.reps > b.reps);
}
// Epley estimated 1-rep max
function estimate1RM(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

// Turns a raw saved workout record into the enriched shape used by the History/Progress screens
function buildEntryFromRecord(rec) {
  const dayDef = PROGRAM.find((d) => d.id === rec.dayId);
  if (!dayDef) return null;
  const { logs = {}, setCounts = {}, order = {}, sessionStart = null, sessionEnd = null } = rec;
  const durationSec = rec.durationSec ?? (sessionStart && sessionEnd ? Math.round((sessionEnd - sessionStart) / 1000) : 0);

  let total = 0, done = 0, volume = 0;
  const groups = dayDef.groups.map((g) => {
    const baseIds = g.exercises.map((e) => e.id);
    const savedOrder = order[g.name];
    const ids = savedOrder && savedOrder.length === baseIds.length ? savedOrder : baseIds;
    const orderedExs = ids.map((id) => g.exercises.find((e) => e.id === id)).filter(Boolean);
    let groupVolume = 0;
    const exercises = orderedExs.map((ex) => {
      const count = setCounts[ex.id] ?? ex.sets;
      const exLog = logs[ex.id] || {};
      const sets = Array.from({ length: count }).map((_, i) => exLog[i] || { weight: "", reps: "", done: false });
      total += count;
      sets.forEach((s) => {
        if (s.done) {
          done += 1;
          groupVolume += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
        }
      });
      return { name: ex.name, sets };
    });
    volume += groupVolume;
    return { name: g.name, exercises, volume: groupVolume };
  });

  // Skip totally empty entries (nothing logged at all)
  if (done === 0) return null;

  const finalVolume = rec.volume ?? volume;
  const finalDone = rec.doneSets ?? done;
  const finalTotal = rec.totalSets ?? total;

  return { key: rec.id, dayId: rec.dayId, date: rec.date, weekday: dayDef.day, dayTitle: dayDef.title, total: finalTotal, done: finalDone, volume: finalVolume, durationSec, groups, finishedFlag: !!rec.finished };
}

function buildHistoryEntries(history) {
  return history
    .map(buildEntryFromRecord)
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.key > a.key ? 1 : -1)));
}

// ---------- REST TIMER (movable floating box) ----------
function RestTimer({ duration, onClose, muted, onToggleMute }) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(true);
  const [total, setTotal] = useState(duration);
  const intervalRef = useRef(null);
  const tickedRef = useRef(new Set());
  const finishedRef = useRef(false);

  const panelWidth = 216;
  const panelHeight = 165;
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, (typeof window !== "undefined" ? window.innerWidth : 375) / 2 - panelWidth / 2),
    y: (typeof window !== "undefined" ? window.innerHeight : 700) - panelHeight - 28,
  }));
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setRemaining(duration);
    setTotal(duration);
    setRunning(true);
    tickedRef.current = new Set();
    finishedRef.current = false;
  }, [duration]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          const next = r - 1;
          if (!muted && next > 0 && next <= 3 && !tickedRef.current.has(next)) {
            tickedRef.current.add(next);
            playTick();
          }
          if (next <= 0) {
            clearInterval(intervalRef.current);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            if (!muted && !finishedRef.current) {
              finishedRef.current = true;
              playBeep(5);
            }
            setRunning(false);
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, muted]);

  const onDragStart = (clientX, clientY) => {
    setDragging(true);
    dragRef.current = { startX: clientX, startY: clientY, originX: pos.x, originY: pos.y };
  };
  const onDragMove = useCallback((clientX, clientY) => {
    if (!dragRef.current) return;
    const { startX, startY, originX, originY } = dragRef.current;
    let x = originX + (clientX - startX);
    let y = originY + (clientY - startY);
    x = Math.max(8, Math.min(x, window.innerWidth - panelWidth - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - panelHeight - 8));
    setPos({ x, y });
  }, []);
  const onDragEnd = () => {
    setDragging(false);
    dragRef.current = null;
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      if (e.touches && e.touches[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      else onDragMove(e.clientX, e.clientY);
    };
    const up = () => onDragEnd();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragging, onDragMove]);

  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const adjust = (delta) => setRemaining((r) => Math.max(0, r + delta));

  return (
    <div
      className="fixed z-50 px-3 pt-2 pb-3 backdrop-blur-md select-none"
      style={{
        left: pos.x, top: pos.y, width: panelWidth,
        backgroundColor: "rgba(120,120,130,0.22)",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
        touchAction: "none", borderRadius: 24,
      }}
    >
      <div
        className="flex items-center justify-center py-1 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => { e.preventDefault(); onDragStart(e.clientX, e.clientY); }}
        onTouchStart={(e) => { const t = e.touches[0]; onDragStart(t.clientX, t.clientY); }}
      >
        <GripHorizontal size={14} color="#2a2a2a" />
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden mb-2" style={{ backgroundColor: "rgba(255,255,255,0.35)" }}>
        <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, backgroundColor: "#111111" }} />
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <button
          onClick={() => { unlockAudio(); onToggleMute(); }}
          className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.4)" }}
        >
          {muted ? <VolumeX size={13} color="#4a4a4a" /> : <Volume2 size={13} color="#111111" />}
        </button>
        <div className="text-3xl font-black tabular-nums tracking-tight" style={{ color: "#111111" }}>
          {fmtTime(remaining)}
        </div>
        <button
          onClick={onClose}
          className="text-[10px] uppercase tracking-widest rounded-full px-2.5 py-1 font-semibold active:scale-95 transition shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.4)", color: "#2a2a2a" }}
        >
          Skip
        </button>
      </div>
      <div className="flex items-center justify-center gap-2.5">
        <button onClick={() => adjust(-15)} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition" style={{ backgroundColor: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.4)" }}>
          <Minus size={15} color="#111111" />
        </button>
        <button
          onClick={() => { unlockAudio(); setRunning((r) => !r); }}
          className="w-12 h-8 rounded-full flex items-center justify-center active:scale-95 transition"
          style={{ backgroundColor: "#111111" }}
        >
          {running ? <Pause size={14} color="#ffffff" fill="#ffffff" /> : <Play size={14} color="#ffffff" fill="#ffffff" />}
        </button>
        <button onClick={() => adjust(15)} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition" style={{ backgroundColor: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.4)" }}>
          <Plus size={16} color="#111111" />
        </button>
      </div>
    </div>
  );
}

// ---------- KG / LBS CONVERTER (fixed dropdown) ----------
function UnitConverter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("kg2lb");
  const [value, setValue] = useState("");

  const num = parseFloat(value);
  const hasValue = !isNaN(num);
  const result = !hasValue ? "" : mode === "kg2lb" ? (num * 2.20462).toFixed(1) : (num / 2.20462).toFixed(1);
  const fromLabel = mode === "kg2lb" ? "kg" : "lbs";
  const toLabel = mode === "kg2lb" ? "lbs" : "kg";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl transition shrink-0 active:scale-95"
        style={{ backgroundColor: open ? C.accent : C.chipBg, border: `2px solid ${open ? C.accent : C.chipBorder}` }}
      >
        <Scale size={15} color={open ? "#ffffff" : C.text} />
        <span className="text-xs font-bold" style={{ color: open ? "#ffffff" : C.text }}>kg⇄lbs</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 p-4 backdrop-blur-md select-none"
          style={{ backgroundColor: "rgba(120,120,130,0.22)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 12px 30px rgba(0,0,0,0.5)", borderRadius: 28 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "#111111" }}>Weight Converter</span>
            <button onClick={() => setOpen(false)}><X size={14} color="#2a2a2a" /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "#2a2a2a" }}>{fromLabel}</div>
              <input
                type="number" inputMode="decimal" autoFocus
                value={value} onChange={(e) => setValue(e.target.value)} placeholder="0"
                className="w-full rounded-2xl px-2.5 py-2 text-sm font-semibold focus:outline-none"
                style={{ backgroundColor: "#ffffff", border: "2px solid rgba(0,0,0,0.15)", color: "#111111" }}
              />
            </div>
            <button
              onClick={() => { setMode((m) => (m === "kg2lb" ? "lb2kg" : "kg2lb")); setValue(result || ""); }}
              className="mt-4 w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.15)" }}
            >
              <ArrowLeftRight size={14} color="#111111" />
            </button>
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "#2a2a2a" }}>{toLabel}</div>
              <div className="w-full rounded-2xl px-2.5 py-2 text-sm font-bold truncate" style={{ backgroundColor: "#ffffff", border: "2px solid rgba(0,0,0,0.15)", color: "#111111" }}>
                {result || "0"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- WARMUP CARD ----------
function WarmupCard({ warmupKey, done, onToggle }) {
  const [open, setOpen] = useState(false);
  const data = WARMUPS[warmupKey];
  if (!data) return null;
  const doneCount = data.items.filter((it) => done?.[it.id]).length;
  const complete = doneCount === data.items.length;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1 px-1">
        <div className="w-1 h-3.5 rounded-full" style={{ backgroundColor: C.blue }} />
        <span className="text-[11px] uppercase tracking-[0.15em] font-bold" style={{ color: C.textDim }}>Warm-up</span>
      </div>
      <div className="rounded-2xl px-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between py-3.5 text-left">
          <span className="font-semibold text-[15px]" style={{ color: C.text }}>{data.label}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold tabular-nums" style={{ color: complete ? C.blue : C.textFaint }}>{doneCount}/{data.items.length}</span>
            {open ? <ChevronUp size={16} color={C.textFaint} /> : <ChevronDown size={16} color={C.textFaint} />}
          </div>
        </button>
        {open && (
          <div className="pb-3">
            {data.items.map((it) => {
              const isDone = !!done?.[it.id];
              return (
                <button key={it.id} onClick={() => onToggle(it.id)} className="w-full flex items-center gap-3 py-2 text-left">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition" style={{ backgroundColor: isDone ? C.blue : C.inputBg, border: isDone ? "none" : `2px solid ${C.inputBorder}` }}>
                    <Check size={14} color={isDone ? "#0f1013" : C.textFaint} strokeWidth={3} />
                  </div>
                  <span className="text-sm flex-1" style={{ color: isDone ? C.textFaint : C.text, textDecoration: isDone ? "line-through" : "none" }}>{it.text}</span>
                  {it.dur && <span className="text-[10px] uppercase tracking-wide" style={{ color: C.textFaint }}>{it.dur}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- SET ROW ----------
function SetRow({ exId, setIndex, targetReps, log, onLog, onStartRest, onDelete, deletable }) {
  const data = log?.[setIndex] || { weight: "", reps: "", done: false };
  const update = (field, value) => onLog(exId, setIndex, { ...data, [field]: value });
  const toggleDone = () => {
    const next = { ...data, done: !data.done };
    onLog(exId, setIndex, next);
    if (!data.done) {
      unlockAudio();
      onStartRest();
    }
  };

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="w-6 text-center text-sm font-bold" style={{ color: C.textFaint }}>{setIndex + 1}</div>
      <input
        type="number" inputMode="decimal" placeholder="kg"
        value={data.weight} onChange={(e) => update("weight", e.target.value)}
        className="w-16 rounded-lg px-2 py-2 text-center text-sm focus:outline-none"
        style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.text }}
      />
      <input
        type="number" inputMode="numeric" placeholder={targetReps}
        value={data.reps} onChange={(e) => update("reps", e.target.value)}
        className="w-16 rounded-lg px-2 py-2 text-center text-sm focus:outline-none"
        style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.text }}
      />
      <button
        onClick={toggleDone}
        className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95"
        style={{ backgroundColor: data.done ? C.accent : C.inputBg, border: data.done ? "none" : `1px solid ${C.inputBorder}` }}
      >
        <Check size={18} color={data.done ? "#ffffff" : C.textFaint} strokeWidth={3} />
      </button>
      <button
        onClick={() => onDelete(setIndex)} disabled={!deletable}
        className="w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95"
        style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, opacity: deletable ? 1 : 0.3 }}
      >
        <Trash2 size={15} color={C.danger} />
      </button>
    </div>
  );
}

// ---------- EXERCISE CARD ----------
function ExerciseCard({ ex, count, log, onLog, onStartRest, onAddSet, onDeleteSet, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [open, setOpen] = useState(false);
  const doneCount = Array.from({ length: count }).filter((_, i) => log?.[i]?.done).length;
  const complete = doneCount === count && count > 0;

  return (
    <div style={{ borderBottom: `1px solid ${C.rowBorder}` }}>
      <div className="w-full flex items-center justify-between py-3.5 text-left">
        <div className="flex items-center gap-0.5 shrink-0 mr-1">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} className="w-6 h-6 rounded-md flex items-center justify-center active:scale-90 transition" style={{ opacity: isFirst ? 0.25 : 1 }}>
            <ChevronUp size={15} color={C.textFaint} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} className="w-6 h-6 rounded-md flex items-center justify-center active:scale-90 transition" style={{ opacity: isLast ? 0.25 : 1 }}>
            <ChevronDown size={15} color={C.textFaint} />
          </button>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 flex items-center justify-between text-left">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-[15px] truncate block" style={{ color: C.text }}>{ex.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              {ex.sub && <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.accent }}>{ex.sub}</span>}
              <span className="text-xs" style={{ color: C.textFaint }}>{count} × {ex.reps}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold tabular-nums" style={{ color: complete ? C.accent : C.textFaint }}>{doneCount}/{count}</span>
            {open ? <ChevronUp size={16} color={C.textFaint} /> : <ChevronDown size={16} color={C.textFaint} />}
          </div>
        </button>
      </div>
      {open && (
        <div className="pb-3 -mt-1">
          <div className="flex items-center gap-2 pl-8 pb-1">
            <div className="w-16 text-center text-[9px] uppercase tracking-wider" style={{ color: C.textFaint }}>Weight</div>
            <div className="w-16 text-center text-[9px] uppercase tracking-wider" style={{ color: C.textFaint }}>Reps</div>
          </div>
          {Array.from({ length: count }).map((_, i) => (
            <SetRow key={i} exId={ex.id} setIndex={i} targetReps={ex.reps} log={log} onLog={onLog} onStartRest={onStartRest} onDelete={onDeleteSet} deletable={count > 1} />
          ))}
          <button onClick={onAddSet} className="flex items-center gap-1.5 mt-1 ml-8 text-xs font-semibold active:scale-95 transition" style={{ color: C.accent }}>
            <Plus size={14} /> Add set
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- PR CELEBRATION TOAST ----------
function PRToast({ pr, onDone }) {
  useEffect(() => {
    playPRSound();
    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 160]);
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [pr]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none px-8">
      <div
        className="pr-pop flex flex-col items-center gap-2 px-8 py-7 backdrop-blur-xl"
        style={{
          background: "linear-gradient(160deg, rgba(255,215,90,0.35), rgba(255,170,20,0.28))",
          border: "1.5px solid rgba(255,210,90,0.7)",
          borderRadius: 32,
          boxShadow: "0 20px 60px rgba(180,120,0,0.35), 0 0 0 1px rgba(255,255,255,0.15) inset",
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-1"
          style={{ background: "linear-gradient(160deg, #ffe27a, #d99a1c)", boxShadow: "0 6px 20px rgba(180,120,0,0.5)" }}
        >
          <Award size={32} color="#5c3a00" strokeWidth={2.3} />
        </div>
        <div className="text-2xl font-black tracking-wide" style={{ color: "#5c3a00", textShadow: "0 1px 0 rgba(255,255,255,0.3)" }}>
          PR BROKEN
        </div>
        <div className="text-sm font-bold text-center" style={{ color: "#6b4600" }}>{pr.name}</div>
        <div className="text-xs font-semibold text-center" style={{ color: "#8a6200" }}>
          {pr.weight}kg × {pr.reps} · New Personal Record!
        </div>
      </div>
      <style>{`
        @keyframes prPop {
          0% { transform: scale(0.7); opacity: 0; }
          55% { transform: scale(1.06); opacity: 1; }
          75% { transform: scale(0.98); }
          100% { transform: scale(1); opacity: 1; }
        }
        .pr-pop { animation: prPop 0.45s cubic-bezier(.34,1.56,.64,1) forwards; }
      `}</style>
    </div>
  );
}

// ---------- FINISH BUTTON (bottom of workout content, only visible once started) ----------
function FinishBar({ state, elapsedSeconds, volume, onFinish, onReset }) {
  if (state === "idle") return null;

  if (state === "running") {
    return (
      <div className="px-4 pb-4">
        <button
          onClick={onFinish}
          className="w-full flex items-center justify-center gap-2 py-5 transition active:scale-[0.98] relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #c22a35 0%, #8a1620 55%, #5c0f18 100%)",
            border: "1.5px solid rgba(255,255,255,0.22)",
            borderRadius: 28,
            boxShadow: "0 14px 32px rgba(90,10,20,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -12px 20px rgba(0,0,0,0.18)",
          }}
        >
          {/* glossy glass highlight */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: "55%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 65%, rgba(255,255,255,0) 100%)",
              borderRadius: "28px 28px 50% 50% / 28px 28px 20px 20px",
            }}
          />
          <Square size={18} color="#ffffff" fill="#ffffff" className="relative" />
          <span className="text-base font-black tracking-wide relative" style={{ color: "#ffffff" }}>FINISH WORKOUT</span>
          <span className="text-xs font-bold tabular-nums ml-1 relative" style={{ color: "rgba(255,255,255,0.85)" }}>{fmtDuration(elapsedSeconds)}</span>
        </button>
      </div>
    );
  }
  // finished
  return (
    <div className="px-4 pb-4">
      <div
        className="w-full flex items-center justify-between px-5 py-4 rounded-3xl relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #2a2a2a 0%, #111111 60%, #000000 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: "50%", background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-1.5">
            <Flag size={14} color="#ffffff" />
            <span className="text-sm font-black" style={{ color: "#ffffff" }}>Workout Finished &amp; Saved</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
            {fmtDuration(elapsedSeconds)} · {Math.round(volume).toLocaleString()}kg logged
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-[10px] uppercase tracking-wide font-bold px-3 py-1.5 rounded-full transition active:scale-95 relative"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff" }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------- HISTORY MODAL ----------
function HistoryModal({ onClose, history, onDeleteOne, onDeleteAll, onRepeat }) {
  const [expanded, setExpanded] = useState(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmRepeatKey, setConfirmRepeatKey] = useState(null);

  const entries = useMemo(() => buildHistoryEntries(history), [history]);

  const fmtDate = (d) => {
    const today = localDateStr();
    if (d === today) return "Today";
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const deleteOne = (key) => {
    onDeleteOne(key);
    setConfirmDeleteKey(null);
  };
  const deleteAll = () => {
    onDeleteAll();
    setConfirmDeleteAll(false);
  };
  const repeatOne = (key) => {
    onRepeat(key);
    setConfirmRepeatKey(null);
  };

  // Weekly summary aggregation
  const weekMap = {};
  entries.forEach((e) => {
    const wk = isoWeekKey(e.date);
    if (!weekMap[wk]) weekMap[wk] = { key: wk, label: weekLabel(e.date), totalVolume: 0, totalDuration: 0, workouts: 0, latestDate: e.date };
    weekMap[wk].totalVolume += e.volume;
    weekMap[wk].totalDuration += e.durationSec || 0;
    weekMap[wk].workouts += 1;
    if (e.date > weekMap[wk].latestDate) weekMap[wk].latestDate = e.date;
  });
  const weeks = Object.values(weekMap)
    .map((w) => ({ ...w, avgDuration: w.totalDuration / w.workouts, avgVolume: w.totalVolume / w.workouts }))
    .sort((a, b) => (a.latestDate < b.latestDate ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "#ffffff" }}>
      <div className="px-4 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <Calendar size={18} color={C.text} />
          <span className="text-sm font-bold" style={{ color: C.text }}>History</span>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full transition active:scale-95"
              style={{ backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#c81e1e" }}
            >
              <Trash2 size={12} color="#c81e1e" /> Delete All
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition" style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
            <X size={15} color={C.text} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {entries.length === 0 && (
          <div className="text-sm text-center py-16" style={{ color: C.textFaint }}>
            No workouts logged yet.<br />Once you mark a set done, it'll show up here automatically.
          </div>
        )}

        {weeks.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-[0.15em] font-bold mb-2 px-1" style={{ color: C.textDim }}>Weekly Summary</div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: "none" }}>
              {weeks.map((w) => (
                <div key={w.key} className="shrink-0 w-64 rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
                  <div className="text-xs font-bold mb-2.5" style={{ color: C.text }}>{w.label}</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    <div>
                      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint }}>Total Volume</div>
                      <div className="text-sm font-black tabular-nums" style={{ color: C.text }}>{Math.round(w.totalVolume).toLocaleString()}kg</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint }}>Workouts</div>
                      <div className="text-sm font-black tabular-nums" style={{ color: C.text }}>{w.workouts}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint }}>Total Time</div>
                      <div className="text-sm font-black tabular-nums" style={{ color: C.text }}>{fmtHM(w.totalDuration)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint }}>Avg Workout</div>
                      <div className="text-sm font-black tabular-nums" style={{ color: C.text }}>{fmtHM(w.avgDuration)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint }}>Avg Volume</div>
                      <div className="text-sm font-black tabular-nums" style={{ color: C.text }}>{Math.round(w.avgVolume).toLocaleString()}kg</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div className="text-[11px] uppercase tracking-[0.15em] font-bold mb-2 px-1" style={{ color: C.textDim }}>Daily Volume</div>
        )}

        {entries.map((e) => {
          const isOpen = expanded === e.key;
          const confirming = confirmDeleteKey === e.key;
          return (
            <div key={e.key} className="mb-3 rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.cardBorder}` }}>
              <div className="w-full flex items-center px-4 py-3.5" style={{ backgroundColor: C.cardBg }}>
                <button onClick={() => setExpanded(isOpen ? null : e.key)} className="flex-1 min-w-0 flex items-center justify-between text-left">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold" style={{ color: C.text }}>{e.dayTitle}</span>
                      {e.finishedFlag ? (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#111111", color: "#ffffff" }}>Finished</span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#fff3ea", color: "#c2470c", border: "1px solid #ffd7b0" }}>In Progress</span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{e.weekday} · {fmtDate(e.date)}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-bold tabular-nums" style={{ color: C.text }}>{Math.round(e.volume).toLocaleString()}kg</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: C.text }}>{fmtDuration(e.durationSec)}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: e.done === e.total ? C.accent : C.textFaint }}>{e.done}/{e.total} sets</span>
                    </div>
                  </div>
                  <div className="ml-2 shrink-0">
                    {isOpen ? <ChevronUp size={16} color={C.textFaint} /> : <ChevronDown size={16} color={C.textFaint} />}
                  </div>
                </button>
                <button
                  onClick={() => setConfirmRepeatKey(e.key)}
                  className="ml-2 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition active:scale-95"
                  style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}
                  title="Repeat this workout's exercises & sets"
                >
                  <Repeat size={13} color={C.text} />
                </button>
                <button
                  onClick={() => setConfirmDeleteKey(e.key)}
                  className="ml-2 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition active:scale-95"
                  style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}
                >
                  <Trash2 size={13} color={C.danger} />
                </button>
              </div>

              {confirmRepeatKey === e.key && (
                <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "rgba(17,17,17,0.04)", borderTop: `1px solid ${C.cardBorder}` }}>
                  <span className="text-xs font-semibold" style={{ color: C.text }}>
                    Start today's {e.dayTitle} with these same exercises &amp; sets?
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setConfirmRepeatKey(null)} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: C.chipBg, color: C.textDim }}>Cancel</button>
                    <button onClick={() => repeatOne(e.key)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: C.accent, color: "#ffffff" }}>Repeat</button>
                  </div>
                </div>
              )}

              {confirming && (
                <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "rgba(220,38,38,0.06)", borderTop: `1px solid ${C.cardBorder}` }}>
                  <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#c81e1e" }}>
                    <AlertTriangle size={13} color="#c81e1e" /> Delete this workout?
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setConfirmDeleteKey(null)} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: C.chipBg, color: C.textDim }}>Cancel</button>
                    <button onClick={() => deleteOne(e.key)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#c81e1e", color: "#ffffff" }}>Delete</button>
                  </div>
                </div>
              )}

              {isOpen && (
                <div className="px-4 pb-4" style={{ backgroundColor: C.cardBg }}>
                  {e.groups.map((g) => (
                    <div key={g.name} className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.textFaint }}>{g.name}</span>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: C.textFaint }}>{Math.round(g.volume)}kg</span>
                      </div>
                      {g.exercises.map((ex, i) => (
                        <div key={i} className="mb-2">
                          <div className="text-xs font-semibold mb-1" style={{ color: C.text }}>{ex.name}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {ex.sets.map((s, si) => (
                              <div
                                key={si}
                                className="text-[11px] px-2 py-1 rounded-lg font-medium tabular-nums"
                                style={{ backgroundColor: s.done ? C.accent : C.inputBg, color: s.done ? "#ffffff" : C.textFaint, border: s.done ? "none" : `1px solid ${C.inputBorder}` }}
                              >
                                {s.weight || "–"}kg × {s.reps || "–"}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmDeleteAll && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-xs rounded-3xl p-5" style={{ backgroundColor: "#ffffff" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} color="#c81e1e" />
              <span className="text-sm font-bold" style={{ color: C.text }}>Delete all history?</span>
            </div>
            <p className="text-xs mb-4" style={{ color: C.textFaint }}>
              This permanently deletes all {entries.length} saved workout{entries.length === 1 ? "" : "s"}. This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDeleteAll(false)} className="flex-1 text-sm font-semibold py-2.5 rounded-2xl" style={{ backgroundColor: C.chipBg, color: C.textDim }}>Cancel</button>
              <button onClick={deleteAll} className="flex-1 text-sm font-bold py-2.5 rounded-2xl" style={{ backgroundColor: "#c81e1e", color: "#ffffff" }}>Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- SETTINGS MENU ----------
function SettingsMenu({ onClose, onSelectHistory, onSelectProgress, onExport, onImport }) {
  const [importStatus, setImportStatus] = useState(null); // { ok, msg }
  const fileInputRef = useRef(null);

  const items = [
    { key: "history", label: "History", desc: "Past workouts & weekly summaries", icon: Calendar, onClick: onSelectHistory },
    { key: "progress", label: "Progress", desc: "Strength trends & muscle volume", icon: TrendingUp, onClick: onSelectProgress },
  ];

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await onImport(file);
    setImportStatus(result);
    setTimeout(() => setImportStatus(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "#ffffff" }}>
      <div className="px-4 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <Settings size={18} color={C.text} />
          <span className="text-sm font-bold" style={{ color: C.text }}>Settings</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition" style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
          <X size={15} color={C.text} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={it.onClick}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-4 mb-3 text-left transition active:scale-[0.98]"
              style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
                <Icon size={18} color={C.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: C.text }}>{it.label}</div>
                <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{it.desc}</div>
              </div>
              <ChevronRight size={16} color={C.textFaint} />
            </button>
          );
        })}

        <div className="text-[11px] uppercase tracking-[0.15em] font-bold mt-5 mb-2 px-1" style={{ color: C.textDim }}>Backup</div>
        <div className="text-xs mb-3 px-1" style={{ color: C.textFaint }}>
          One file with everything — history &amp; progress. Export it here, then Import it on your new phone or browser.
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition active:scale-[0.98] relative overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #a855f7 0%, #7e22ce 55%, #5b1596 100%)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#ffffff",
              boxShadow: "0 10px 24px rgba(126,34,206,0.4), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 14px rgba(0,0,0,0.15)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: "55%", background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 65%, rgba(255,255,255,0) 100%)", borderRadius: "16px 16px 50% 50% / 16px 16px 10px 10px" }}
            />
            <Download size={16} color="#ffffff" className="relative" />
            <span className="relative">Export</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition active:scale-[0.98] relative overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #3b82f6 0%, #1d4ed8 55%, #1638a3 100%)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#ffffff",
              boxShadow: "0 10px 24px rgba(29,78,216,0.4), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 14px rgba(0,0,0,0.15)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: "55%", background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 65%, rgba(255,255,255,0) 100%)", borderRadius: "16px 16px 50% 50% / 16px 16px 10px 10px" }}
            />
            <Upload size={16} color="#ffffff" className="relative" />
            <span className="relative">Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChosen} />
        </div>

        {importStatus && (
          <div
            className="text-xs font-semibold mt-3 px-3 py-2.5 rounded-xl"
            style={importStatus.ok
              ? { backgroundColor: "#eef7ee", border: "1px solid #bfe3bf", color: "#1e7a34" }
              : { backgroundColor: "#fdecec", border: "1px solid #f3bcbc", color: "#b3261e" }}
          >
            {importStatus.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- PROGRESS MODAL ----------
function MuscleVolumeDonut({ weeklyVolume }) {
  const size = 160;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const total = Object.values(weeklyVolume).reduce((a, b) => a + b, 0);
  const segments = MUSCLE_ORDER
    .filter((name) => weeklyVolume[name] > 0)
    .map((name) => ({ name, value: weeklyVolume[name], color: MUSCLE_COLORS[name] }));

  let offsetSoFar = 0;
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const len = frac * circumference;
    const arc = { ...seg, len, offset: offsetSoFar };
    offsetSoFar += len;
    return arc;
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.chipBg} strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.len} ${circumference - arc.len}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap={arcs.length > 1 ? "butt" : "round"}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums" style={{ color: C.text }}>
            {Math.round(total).toLocaleString()}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.textFaint }}>
            kg vol
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-4">
        {MUSCLE_ORDER.map((name) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-[2px]"
              style={{ width: 8, height: 8, backgroundColor: MUSCLE_COLORS[name] }}
            />
            <span className="text-[11px] font-semibold" style={{ color: C.textDim }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressModal({ onClose, history }) {
  const [subtab, setSubtab] = useState("strength");
  const [exerciseFilter, setExerciseFilter] = useState(null);

  const entries = useMemo(() => buildHistoryEntries(history), [history]);

  // Build per-exercise history: { [exerciseName]: [{date, maxWeight, est1RM, volume}, ...] } sorted ascending by date
  const exerciseSeries = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      e.groups.forEach((g) => {
        g.exercises.forEach((ex) => {
          const doneSets = ex.sets.filter((s) => s.done);
          if (doneSets.length === 0) return;
          let maxWeight = 0, est1RM = 0, volume = 0;
          doneSets.forEach((s) => {
            const w = parseFloat(s.weight) || 0;
            const r = parseFloat(s.reps) || 0;
            if (w > maxWeight) maxWeight = w;
            const rm = estimate1RM(w, r);
            if (rm > est1RM) est1RM = rm;
            volume += w * r;
          });
          if (!map[ex.name]) map[ex.name] = [];
          map[ex.name].push({ date: e.date, maxWeight, est1RM: round1(est1RM), volume });
        });
      });
    });
    Object.keys(map).forEach((name) => map[name].sort((a, b) => (a.date < b.date ? -1 : 1)));
    return map;
  }, [entries]);

  const exerciseNames = useMemo(() => Object.keys(exerciseSeries).sort((a, b) => a.localeCompare(b)), [exerciseSeries]);

  const prBadges = useMemo(() => {
    if (!exerciseFilter || !exerciseSeries[exerciseFilter]) return null;
    const series = exerciseSeries[exerciseFilter];
    return series.reduce(
      (acc, d) => ({
        maxWeight: Math.max(acc.maxWeight, d.maxWeight),
        max1RM: Math.max(acc.max1RM, d.est1RM),
        maxVolume: Math.max(acc.maxVolume, d.volume),
      }),
      { maxWeight: 0, max1RM: 0, maxVolume: 0 }
    );
  }, [exerciseFilter, exerciseSeries]);

  const chartData = useMemo(() => {
    if (!exerciseFilter || !exerciseSeries[exerciseFilter]) return [];
    return exerciseSeries[exerciseFilter].map((d) => ({
      ...d,
      label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
  }, [exerciseFilter, exerciseSeries]);

  // Weekly volume by muscle group (last 7 days)
  const weeklyVolume = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = localDateStr(weekAgo);
    const result = {};
    entries.filter((e) => e.date >= weekAgoStr).forEach((e) => {
      e.groups.forEach((g) => {
        result[g.name] = (result[g.name] || 0) + g.volume;
      });
    });
    return result;
  }, [entries]);
  const maxWeeklyVolume = Math.max(1, ...Object.values(weeklyVolume));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "#ffffff" }}>
      <div className="px-4 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <TrendingUp size={18} color={C.text} />
          <span className="text-sm font-bold" style={{ color: C.text }}>Progress</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition" style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
          <X size={15} color={C.text} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <div className="flex gap-1.5">
          {[{ id: "strength", label: "Strength" }, { id: "volume", label: "Volume" }].map((s) => {
            const active = subtab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSubtab(s.id)}
                className="flex-1 text-xs px-3 py-2 rounded-full transition font-bold"
                style={{ backgroundColor: active ? C.accent : "transparent", border: `1px solid ${active ? C.accent : C.chipBorder}`, color: active ? "#ffffff" : C.textDim }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {subtab === "strength" && (
          <div>
            {exerciseNames.length === 0 && (
              <div className="text-sm text-center py-16" style={{ color: C.textFaint }}>
                No workouts logged yet.<br />Log a few sets and progress graphs will show up here.
              </div>
            )}
            {exerciseNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {exerciseNames.map((name) => {
                  const active = exerciseFilter === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setExerciseFilter(active ? null : name)}
                      className="text-xs px-3 py-1.5 rounded-full font-semibold transition"
                      style={{ backgroundColor: active ? C.accent : C.chipBg, border: `1px solid ${active ? C.accent : C.chipBorder}`, color: active ? "#ffffff" : C.textDim }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}

            {exerciseFilter && prBadges && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
                <div className="text-sm font-bold mb-3" style={{ color: C.text }}>{exerciseFilter}</div>
                <div className="flex items-center gap-1.5 flex-wrap mb-4">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: C.accent, color: "#ffffff" }}>
                    <Award size={11} color="#ffffff" /> Max {Math.round(prBadges.maxWeight)}kg
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: C.accent, color: "#ffffff" }}>
                    <Award size={11} color="#ffffff" /> Est 1RM {Math.round(prBadges.max1RM)}kg
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: C.accent, color: "#ffffff" }}>
                    <Award size={11} color="#ffffff" /> Vol {Math.round(prBadges.maxVolume).toLocaleString()}kg
                  </span>
                </div>

                {chartData.length > 1 ? (
                  <>
                    <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: C.textFaint }}>Est. 1RM Progression</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.rowBorder} />
                        <XAxis dataKey="label" fontSize={10} tick={{ fill: C.textFaint }} />
                        <YAxis fontSize={10} tick={{ fill: C.textFaint }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.cardBorder}` }} />
                        <Line type="monotone" dataKey="est1RM" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="text-[10px] uppercase tracking-wider font-bold mt-3 mb-1" style={{ color: C.textFaint }}>Weight Progression</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.rowBorder} />
                        <XAxis dataKey="label" fontSize={10} tick={{ fill: C.textFaint }} />
                        <YAxis fontSize={10} tick={{ fill: C.textFaint }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.cardBorder}` }} />
                        <Line type="monotone" dataKey="maxWeight" stroke={C.textDim} strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="text-xs" style={{ color: C.textFaint }}>Log this exercise a couple more times to see progression graphs.</div>
                )}
              </div>
            )}
          </div>
        )}

        {subtab === "volume" && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
            <div className="text-sm font-bold mb-3" style={{ color: C.text }}>Weekly Volume by Muscle</div>
            {Object.keys(weeklyVolume).length === 0 ? (
              <div className="text-xs" style={{ color: C.textFaint }}>No data yet this week.</div>
            ) : (
              <MuscleVolumeDonut weeklyVolume={weeklyVolume} />
            )}
            {Object.keys(weeklyVolume).length > 0 && (
              <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.rowBorder}` }}>
                {Object.entries(weeklyVolume).sort((a, b) => b[1] - a[1]).map(([name, v]) => (
                  <div key={name} className="mb-3">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1" style={{ color: C.text }}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block rounded-[2px]" style={{ width: 8, height: 8, backgroundColor: MUSCLE_COLORS[name] || C.accent }} />
                        {name}
                      </span>
                      <span className="tabular-nums">{Math.round(v).toLocaleString()}kg</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: C.chipBg }}>
                      <div className="h-full rounded-full" style={{ width: `${(v / maxWeeklyVolume) * 100}%`, backgroundColor: MUSCLE_COLORS[name] || C.accent }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- MAIN APP ----------
export default function WorkoutTracker() {
  const [activeDay, setActiveDay] = useState(todayId());
  const [logs, setLogs] = useState({});
  const [setCounts, setSetCounts] = useState({});
  const [warmupDone, setWarmupDone] = useState({});
  const [order, setOrder] = useState({});
  const [restDuration, setRestDuration] = useState(REST_DEFAULT);
  const [restKey, setRestKey] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [streak, setStreak] = useState(null);
  const [pausedDates, setPausedDates] = useState([]);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionEnd, setSessionEnd] = useState(null);
  const [finished, setFinished] = useState(false);
  const [savedVolume, setSavedVolume] = useState(0);
  const [savedDuration, setSavedDuration] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [prBaselines, setPrBaselines] = useState({}); // { exId: {weight, reps} }
  const [prToast, setPrToast] = useState(null);
  const sessionBestRef = useRef({}); // { exId: {weight, reps} } best achieved so far THIS live session
  const pendingRepeatRef = useRef(null); // { dayId, order, setCounts } queued by "Repeat" in History
  const [repeatToken, setRepeatToken] = useState(0);

  const day = PROGRAM.find((d) => d.id === activeDay);
  const todayStr = localDateStr();
  const orderKey = `orderCfg:${activeDay}`;
  const recordId = `${activeDay}:${todayStr}`;

  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const historyRef = useRef([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Load the full workout history ONCE (single reliable key — no listing, no per-day round trips)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get("history");
        if (!cancelled) setHistory(res ? JSON.parse(res.value) : []);
      } catch (e) {
        if (!cancelled) setHistory([]);
      }
      if (!cancelled) setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist the whole history array whenever it changes
  useEffect(() => {
    if (!historyLoaded) return;
    storage.set("history", JSON.stringify(history)).catch(() => {});
  }, [history, historyLoaded]);

  // Hydrate the on-screen session (logs/sets/warmup/timer) for the active day from history + load that day's exercise order
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    sessionBestRef.current = {};
    (async () => {
      let orderRes = null;
      try {
        orderRes = await storage.get(orderKey);
      } catch (e) {}
      if (cancelled) return;
      const rec = historyRef.current.find((r) => r.id === `${activeDay}:${todayStr}`);
      if (rec) {
        setLogs(rec.logs || {});
        setSetCounts(rec.setCounts || {});
        setWarmupDone(rec.warmupDone || {});
        setSessionStart(rec.sessionStart || null);
        setSessionEnd(rec.sessionEnd || null);
        setFinished(!!rec.finished);
        setSavedVolume(rec.volume || 0);
        setSavedDuration(rec.durationSec || 0);
      } else {
        setLogs({}); setSetCounts({}); setWarmupDone({});
        setSessionStart(null); setSessionEnd(null); setFinished(false);
        setSavedVolume(0); setSavedDuration(0);
      }
      if (pendingRepeatRef.current && pendingRepeatRef.current.dayId === activeDay) {
        // A "Repeat this workout" action from History overrides today's structure:
        // same exercises, same order, same set counts — but fresh (blank) weights/reps.
        const { order: repOrder, setCounts: repCounts } = pendingRepeatRef.current;
        setOrder(repOrder);
        setSetCounts(repCounts);
        setLogs({});
        setWarmupDone({});
        setSessionStart(null);
        setSessionEnd(null);
        setFinished(false);
        setSavedVolume(0);
        setSavedDuration(0);
        pendingRepeatRef.current = null;
      } else {
        setOrder(orderRes ? JSON.parse(orderRes.value) : {});
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay, historyLoaded, repeatToken]);

  // Live autosave of in-progress data into the history array (safety net) — does not mark as finished/permanent
  useEffect(() => {
    if (!loaded || finished) return;
    const hasData = !!sessionStart || Object.keys(logs).length > 0 || Object.values(warmupDone).some(Boolean);
    if (!hasData) return;
    setHistory((prev) => {
      const rec = {
        id: recordId, dayId: activeDay, date: todayStr,
        logs, setCounts, warmupDone,
        sessionStart, sessionEnd, finished: false,
      };
      const idx = prev.findIndex((r) => r.id === recordId);
      if (idx === -1) return [rec, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...rec };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, setCounts, warmupDone, sessionStart, sessionEnd, loaded, finished]);

  useEffect(() => {
    if (!sessionStart || sessionEnd) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [sessionStart, sessionEnd]);

  // Load paused (manually preserved rest) dates once
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("streakPauses");
        setPausedDates(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setPausedDates([]);
      }
    })();
  }, []);

  // Load PR baselines for every exercise in the program, once
  useEffect(() => {
    (async () => {
      const allExIds = [];
      PROGRAM.forEach((d) => d.groups.forEach((g) => g.exercises.forEach((ex) => allExIds.push(ex.id))));
      const results = await Promise.all(
        allExIds.map(async (id) => {
          try {
            const res = await storage.get(`prBaseline:${id}`);
            return res ? [id, JSON.parse(res.value)] : null;
          } catch (e) {
            return null;
          }
        })
      );
      const map = {};
      results.forEach((r) => { if (r) map[r[0]] = r[1]; });
      setPrBaselines(map);
    })();
  }, []);

  const computeStreak = useCallback((pausedList, hist) => {
    let count = 0;
    let cursor = new Date();
    let isToday = true;
    for (let i = 0; i < 400; i++) {
      const dateStr = localDateStr(cursor);
      const dow = cursor.getDay();
      const isSunday = dow === 0;
      const isPaused = pausedList.includes(dateStr);
      if (isSunday || isPaused) {
        cursor.setDate(cursor.getDate() - 1);
        isToday = false;
        continue;
      }
      // Any completed workout on this date counts — it doesn't have to be the "usual" split for that weekday
      const anyDone = hist.some((r) => r.date === dateStr && Object.values(r.logs || {}).some((sets) => Object.values(sets).some((s) => s.done)));
      if (anyDone) count++;
      else if (isToday) { /* today not logged yet, don't break */ }
      else break;
      cursor.setDate(cursor.getDate() - 1);
      isToday = false;
    }
    setStreak(count);
  }, []);

  // Recompute whenever the saved history actually changes (this is the real source of truth —
  // watching `logs` directly was one render behind, so today's session never got counted)
  useEffect(() => {
    if (!historyLoaded) return;
    computeStreak(pausedDates, history);
  }, [history, pausedDates, historyLoaded, computeStreak]);

  const isTodayPaused = pausedDates.includes(todayStr);
  const togglePauseToday = useCallback(async () => {
    setPausedDates((prev) => {
      const next = isTodayPaused ? prev.filter((d) => d !== todayStr) : [...prev, todayStr];
      storage.set("streakPauses", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [isTodayPaused, todayStr]);

  const onLog = useCallback((exId, setIndex, data) => {
    setLogs((prev) => ({ ...prev, [exId]: { ...(prev[exId] || {}), [setIndex]: data } }));

    if (data.done) {
      const weight = parseFloat(data.weight) || 0;
      const reps = parseFloat(data.reps) || 0;
      if (weight > 0 && reps > 0) {
        const baseline = prBaselines[exId] || null;
        const sessionBest = sessionBestRef.current[exId] || baseline;
        if (isPR({ weight, reps }, sessionBest)) {
          sessionBestRef.current[exId] = { weight, reps };
          let exName = exId;
          for (const d of PROGRAM) {
            for (const g of d.groups) {
              const found = g.exercises.find((e) => e.id === exId);
              if (found) { exName = found.name; break; }
            }
          }
          setPrToast({ name: exName, weight, reps });
        }
      }
    }
  }, [prBaselines]);

  const getCount = useCallback((ex) => setCounts[ex.id] ?? ex.sets, [setCounts]);

  const addSet = useCallback((ex) => {
    setSetCounts((prev) => ({ ...prev, [ex.id]: (prev[ex.id] ?? ex.sets) + 1 }));
  }, []);

  const deleteSet = useCallback((ex, setIndex) => {
    setSetCounts((prev) => {
      const current = prev[ex.id] ?? ex.sets;
      if (current <= 1) return prev;
      return { ...prev, [ex.id]: current - 1 };
    });
    setLogs((prev) => {
      const exLog = prev[ex.id] || {};
      const currentCount = setCounts[ex.id] ?? ex.sets;
      const newLog = {};
      let w = 0;
      for (let i = 0; i < currentCount; i++) {
        if (i === setIndex) continue;
        newLog[w] = exLog[i] || { weight: "", reps: "", done: false };
        w++;
      }
      return { ...prev, [ex.id]: newLog };
    });
  }, [setCounts]);

  const toggleWarmup = useCallback((itemId) => {
    setWarmupDone((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const startRest = useCallback(() => {
    setRestKey((k) => k + 1);
    setShowRest(true);
  }, []);

  const getOrderedExercises = useCallback((group) => {
    const baseIds = group.exercises.map((e) => e.id);
    const savedOrder = order[group.name];
    const ids = savedOrder && savedOrder.length === baseIds.length ? savedOrder : baseIds;
    return ids.map((id) => group.exercises.find((e) => e.id === id)).filter(Boolean);
  }, [order]);

  const moveExercise = useCallback((group, exId, direction) => {
    setOrder((prev) => {
      const baseIds = group.exercises.map((e) => e.id);
      const current = (prev[group.name] && prev[group.name].length === baseIds.length) ? prev[group.name] : baseIds;
      const idx = current.indexOf(exId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swapIdx < 0 || swapIdx >= current.length) return prev;
      const next = [...current];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      const nextOrder = { ...prev, [group.name]: next };
      storage.set(orderKey, JSON.stringify(nextOrder)).catch(() => {});
      return nextOrder;
    });
  }, [orderKey]);

  // "Repeat" from History: reproduce a past session's exact exercises (in order) and set counts —
  // weights/reps are intentionally left blank so it's a fresh log, not a copy of old numbers.
  const repeatWorkout = useCallback((recId) => {
    const rec = historyRef.current.find((r) => r.id === recId);
    if (!rec) return;
    const dayDef = PROGRAM.find((d) => d.id === rec.dayId);
    if (!dayDef) return;

    const newOrder = {};
    const newSetCounts = {};
    dayDef.groups.forEach((g) => {
      const baseIds = g.exercises.map((e) => e.id);
      const savedIds = (rec.order && rec.order[g.name]) || baseIds;
      const keptIds = savedIds.filter((id) => baseIds.includes(id));
      const missingIds = baseIds.filter((id) => !keptIds.includes(id)); // exercises added to the template since that session
      const finalIds = [...keptIds, ...missingIds];
      newOrder[g.name] = finalIds;
      finalIds.forEach((id) => {
        const ex = g.exercises.find((e) => e.id === id);
        newSetCounts[id] = rec.setCounts?.[id] ?? ex.sets;
      });
    });

    pendingRepeatRef.current = { dayId: rec.dayId, order: newOrder, setCounts: newSetCounts };
    setShowHistory(false);
    setActiveDay(rec.dayId);
    setRepeatToken((t) => t + 1);
  }, []);

  const startSession = useCallback(() => {
    setSessionStart(Date.now());
    setSessionEnd(null);
    setFinished(false);
  }, []);
  const resetSession = useCallback(() => {
    setSessionStart(null);
    setSessionEnd(null);
    setFinished(false);
    setSavedVolume(0);
    setSavedDuration(0);
    setLogs({});
    setSetCounts({});
    setWarmupDone({});
    sessionBestRef.current = {};
  }, []);

  // ---- Backup / restore (single file covers History + Progress, since Progress is derived from history) ----
  const exportData = useCallback(() => {
    const payload = {
      app: "aesthetic-ascension-trakd",
      version: 1,
      exportedAt: new Date().toISOString(),
      history,
      prBaselines,
      streakPauses: pausedDates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aesthetic-ascension-trakd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [history, prBaselines, pausedDates]);

  const importData = useCallback(async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedHistory = Array.isArray(parsed.history) ? parsed.history : null;
      if (!importedHistory) return { ok: false, msg: "That file doesn't look like a workout backup." };

      setHistory((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        importedHistory.forEach((r) => { if (r && r.id) map.set(r.id, r); });
        return Array.from(map.values());
      });

      if (parsed.prBaselines && typeof parsed.prBaselines === "object") {
        setPrBaselines((prev) => ({ ...prev, ...parsed.prBaselines }));
        Object.entries(parsed.prBaselines).forEach(([id, val]) => {
          storage.set(`prBaseline:${id}`, JSON.stringify(val)).catch(() => {});
        });
      }
      if (Array.isArray(parsed.streakPauses)) {
        setPausedDates((prev) => Array.from(new Set([...prev, ...parsed.streakPauses])));
      }

      return { ok: true, msg: `Imported ${importedHistory.length} workout${importedHistory.length === 1 ? "" : "s"}.` };
    } catch (e) {
      return { ok: false, msg: "Couldn't read that file — make sure it's an unmodified export." };
    }
  }, []);

  const totalSets = day.groups.reduce((acc, g) => acc + g.exercises.reduce((a, e) => a + getCount(e), 0), 0);
  const doneSets = day.groups.reduce((acc, g) => acc + g.exercises.reduce((a, e) => {
    const l = logs[e.id] || {};
    const c = getCount(e);
    return a + Array.from({ length: c }).filter((_, i) => l[i]?.done).length;
  }, 0), 0);

  const liveVolume = day.groups.reduce((acc, g) => acc + g.exercises.reduce((a, e) => {
    const l = logs[e.id] || {};
    const c = getCount(e);
    let v = 0;
    for (let i = 0; i < c; i++) {
      const s = l[i];
      if (s?.done) v += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
    }
    return a + v;
  }, 0), 0);

  const finishSession = useCallback(async () => {
    const end = Date.now();
    const start = sessionStart || end;
    const durationSec = Math.max(0, Math.round((end - start) / 1000));

    // Snapshot exercise order as it stands right now
    const orderSnapshot = {};
    day.groups.forEach((g) => { orderSnapshot[g.name] = getOrderedExercises(g).map((e) => e.id); });

    // Update PR baselines: best completed set this session per exercise becomes the new "previous workout" reference
    const newBaselines = { ...prBaselines };
    const baselineWrites = [];
    day.groups.forEach((g) => {
      g.exercises.forEach((ex) => {
        const l = logs[ex.id] || {};
        const c = getCount(ex);
        let best = null;
        for (let i = 0; i < c; i++) {
          const s = l[i];
          if (s?.done) {
            const w = parseFloat(s.weight) || 0;
            const r = parseFloat(s.reps) || 0;
            if (w > 0 && r > 0) {
              if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r };
            }
          }
        }
        if (best) {
          newBaselines[ex.id] = best;
          baselineWrites.push(storage.set(`prBaseline:${ex.id}`, JSON.stringify(best)).catch(() => {}));
        }
      });
    });

    const record = {
      id: recordId, dayId: activeDay, date: todayStr, weekday: day.day, dayTitle: day.title,
      logs, setCounts, warmupDone,
      order: orderSnapshot,
      sessionStart: start, sessionEnd: end,
      durationSec, volume: liveVolume, doneSets, totalSets,
      finished: true,
    };

    setSessionEnd(end);
    setFinished(true);
    setSavedVolume(liveVolume);
    setSavedDuration(durationSec);
    setPrBaselines(newBaselines);

    setHistory((prev) => {
      const idx = prev.findIndex((r) => r.id === recordId);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });

    await Promise.all(baselineWrites);
  }, [sessionStart, day, getOrderedExercises, prBaselines, logs, setCounts, warmupDone, liveVolume, doneSets, totalSets, recordId, activeDay, todayStr]);

  const elapsedMs = sessionStart ? ((finished ? sessionEnd : (sessionEnd || nowTick)) - sessionStart) : 0;
  const elapsedSeconds = finished ? savedDuration : Math.max(0, Math.floor(elapsedMs / 1000));
  const sessionRunning = !!sessionStart && !finished;
  const finishState = finished ? "finished" : sessionRunning ? "running" : "idle";

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="sticky top-0 z-30 backdrop-blur px-4 pt-5 pb-3" style={{ backgroundColor: C.headerBg, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Dumbbell size={20} color={C.accent} />
            <span className="text-[11px] tracking-[0.2em] uppercase font-bold" style={{ color: C.textFaint }}>Trakd</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={togglePauseToday}
              className="flex items-center gap-1 px-2.5 py-2 rounded-full transition active:scale-95"
              style={{ backgroundColor: isTodayPaused ? C.chipBg : "#fff3ea", border: `1.5px solid ${isTodayPaused ? C.chipBorder : "#ffd7b0"}` }}
              title={isTodayPaused ? "Streak paused for today — tap to resume" : "Tap to pause streak for today"}
            >
              <Flame size={14} color={isTodayPaused ? C.textFaint : "#ef6a1f"} fill={isTodayPaused ? "none" : "#ffb347"} />
              <span className="text-xs font-black tabular-nums" style={{ color: isTodayPaused ? C.textFaint : "#c2470c" }}>
                {streak === null ? "–" : streak}
              </span>
            </button>
            <button
              onClick={() => setShowSettingsMenu(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}
            >
              <Settings size={16} color={C.text} />
            </button>
            <UnitConverter />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: "none" }}>
          {PROGRAM.map((d) => {
            const active = activeDay === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setActiveDay(d.id)}
                className="shrink-0 px-3 py-2 rounded-xl text-left transition"
                style={{ backgroundColor: active ? C.accent : C.chipBg, border: `1px solid ${active ? C.accent : C.chipBorder}` }}
              >
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-xs font-bold" style={{ color: active ? "#ffffff" : C.text }}>{d.title}</span>
                  <span className="text-[9px] font-medium" style={{ color: active ? "rgba(255,255,255,0.55)" : C.textFaint }}>{d.day.slice(0, 3)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs" style={{ color: C.textDim }}>{day.title} progress</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: C.text }}>{doneSets}/{totalSets} sets</span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: C.chipBg }}>
          <div className="h-full transition-all duration-500" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`, backgroundColor: C.accent }} />
        </div>
      </div>

      <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Rest timer</span>
        {[60, 90, 120].map((s) => {
          const active = restDuration === s;
          return (
            <button
              key={s}
              onClick={() => setRestDuration(s)}
              className="text-xs px-2.5 py-1 rounded-full transition font-semibold"
              style={{ backgroundColor: active ? C.accent : "transparent", border: `1px solid ${active ? C.accent : C.chipBorder}`, color: active ? "#ffffff" : C.textDim }}
            >
              {s}s
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>Duration</span>
        {!sessionStart && (
          <button
            onClick={startSession}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition active:scale-95 relative overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #3ec26a 0%, #1e8a45 55%, #146632 100%)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#ffffff",
              boxShadow: "0 6px 16px rgba(20,102,50,0.4), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{
                height: "55%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 65%, rgba(255,255,255,0) 100%)",
                borderRadius: "999px 999px 50% 50% / 999px 999px 10px 10px",
              }}
            />
            <Play size={12} color="#ffffff" fill="#ffffff" className="relative" />
            <span className="relative">Start Workout</span>
          </button>
        )}
        {sessionStart && !finished && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "#eef7ee", border: "1px solid #bfe3bf" }}>
            <Timer size={12} color="#1e7a34" />
            <span className="text-xs font-bold tabular-nums" style={{ color: "#1e7a34" }}>{fmtDuration(elapsedSeconds)}</span>
          </div>
        )}
        {finished && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: C.accent }}>
            <Check size={12} color="#ffffff" strokeWidth={3} />
            <span className="text-xs font-bold tabular-nums" style={{ color: "#ffffff" }}>{fmtDuration(elapsedSeconds)} saved</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <WarmupCard warmupKey={day.warmupKey} done={warmupDone} onToggle={toggleWarmup} />
      </div>

      <div className="px-4 pb-2">
        {day.groups.map((g) => {
          const orderedExercises = getOrderedExercises(g);
          return (
            <div key={g.name} className="mb-5">
              <div className="flex items-center gap-2 mb-1 px-1">
                <div className="w-1 h-3.5 rounded-full" style={{ backgroundColor: C.accent }} />
                <span className="text-[11px] uppercase tracking-[0.15em] font-bold" style={{ color: C.textDim }}>{g.name}</span>
              </div>
              <div className="rounded-2xl px-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
                {orderedExercises.map((ex, i) => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    count={getCount(ex)}
                    log={logs[ex.id]}
                    onLog={onLog}
                    onStartRest={startRest}
                    onAddSet={() => addSet(ex)}
                    onDeleteSet={(idx) => deleteSet(ex, idx)}
                    onMoveUp={() => moveExercise(g, ex.id, "up")}
                    onMoveDown={() => moveExercise(g, ex.id, "down")}
                    isFirst={i === 0}
                    isLast={i === orderedExercises.length - 1}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Finish Workout — only appears once started, fixed at the bottom of the workout content in normal flow */}
      <div className="pb-28">
        <FinishBar
          state={finishState}
          elapsedSeconds={elapsedSeconds}
          volume={finished ? savedVolume : liveVolume}
          onFinish={finishSession}
          onReset={resetSession}
        />
      </div>

      {showRest && (
        <RestTimer key={restKey} duration={restDuration} onClose={() => setShowRest(false)} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
      )}

      {showSettingsMenu && (
        <SettingsMenu
          onClose={() => setShowSettingsMenu(false)}
          onSelectHistory={() => { setShowSettingsMenu(false); setShowHistory(true); }}
          onSelectProgress={() => { setShowSettingsMenu(false); setShowProgress(true); }}
          onExport={exportData}
          onImport={importData}
        />
      )}

      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          history={history}
          onDeleteOne={(id) => setHistory((prev) => prev.filter((r) => r.id !== id))}
          onDeleteAll={() => setHistory([])}
          onRepeat={repeatWorkout}
        />
      )}
      {showProgress && <ProgressModal onClose={() => setShowProgress(false)} history={history} />}

      {prToast && <PRToast pr={prToast} onDone={() => setPrToast(null)} />}
    </div>
  );
}
