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
// Synthesized "premium glass crack" sound — a sharp filtered noise burst plus a few
// high, brittle ticks (mirrors the fully-synthesized sound design used elsewhere in this
// app, so no external audio asset is required). Fails silently if audio is unavailable
// or blocked by the browser's autoplay policy.
function playGlassCrackSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Short burst of filtered white noise = the "crack"
    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 3);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2600;
    bandpass.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.55, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    noise.connect(bandpass).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.35);

    // A handful of brittle high "shard" ticks scattered just after the initial crack
    const tickTimes = [0.03, 0.09, 0.14, 0.19, 0.26];
    tickTimes.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 2200 + Math.random() * 1400 - i * 60;
      const start = now + t;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    });

    // Low, dull thud underneath as the card splits
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = "sine";
    thud.frequency.setValueAtTime(180, now + 0.05);
    thud.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    thudGain.gain.setValueAtTime(0, now + 0.05);
    thudGain.gain.linearRampToValueAtTime(0.35, now + 0.08);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    thud.connect(thudGain).connect(ctx.destination);
    thud.start(now + 0.05);
    thud.stop(now + 0.42);
  } catch (e) {
    // Autoplay blocked or Web Audio unavailable — the animation still runs silently.
  }
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

// SINGLE SOURCE OF TRUTH for "does this History record represent an actual completed workout?"
// Used everywhere a completed-workout count matters: the streak, the broken-streak inactivity
// check, import counts, export filtering, and the History/Progress stats (via buildEntryFromRecord).
// A record only counts if it was truly finished AND every set for that day was logged as done —
// a "finished: true" record with doneSets: 0, or with only some sets logged (e.g. an accidental
// Start->Finish, or Finish pressed before the workout was actually completed), must never count
// toward anything. This mirrors the exact gate finishSession itself uses before ever writing to
// History, so nothing partial can ever be considered valid from any angle (new saves, imports,
// or legacy data).
function isValidCompletedWorkout(rec) {
  if (!rec || rec.finished !== true) return false;
  if (typeof rec.doneSets === "number" && typeof rec.totalSets === "number") {
    return rec.totalSets > 0 && rec.doneSets >= rec.totalSets;
  }
  if (typeof rec.doneSets === "number") return rec.doneSets > 0;
  // Legacy fallback for records saved before the doneSets field existed: recompute from logs.
  const logs = rec.logs || {};
  return Object.values(logs).some(
    (exLog) => exLog && Object.values(exLog).some((s) => s && s.done)
  );
}

// Turns a raw saved workout record into the enriched shape used by the History/Progress screens
function buildEntryFromRecord(rec) {
  // History (and everything derived from it — the streak, the History screen, weekly summaries)
  // only ever reflects genuinely completed workouts. This also guards against any legacy/imported
  // data that might still contain in-progress or empty records from an older version of the app.
  if (!isValidCompletedWorkout(rec)) return null;
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

// ---------- BROKEN STREAK ANIMATION (reusable — used for the real event AND Settings > Preview) ----------
function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler); else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler); else mq.removeListener(handler);
    };
  }, []);
  return reduced;
}

function BrokenStreakOverlay({ days, onDone }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState("enter"); // enter -> crack -> shake -> split -> exit
  const shardsRef = useRef(
    Array.from({ length: 12 }).map(() => {
      const angle = Math.random() * 360;
      const dist = 55 + Math.random() * 85;
      return {
        size: 4 + Math.random() * 8,
        rotate: Math.random() * 520 - 260,
        delay: Math.random() * 0.1,
        sx: Math.cos((angle * Math.PI) / 180) * dist,
        sy: Math.sin((angle * Math.PI) / 180) * dist,
      };
    })
  );
  const shards = shardsRef.current;

  useEffect(() => {
    let timers;
    if (reducedMotion) {
      timers = [
        setTimeout(() => setPhase("split"), 180), // reuse "split" to mean "revealed" here
        setTimeout(() => setPhase("exit"), 2100),
        setTimeout(() => onDone && onDone(), 2650),
      ];
    } else {
      timers = [
        setTimeout(() => setPhase("crack"), 480),
        setTimeout(() => {
          playGlassCrackSound();
          if (navigator.vibrate) { try { navigator.vibrate([25, 20, 45]); } catch (e) {} }
        }, 480),
        setTimeout(() => setPhase("shake"), 800),
        setTimeout(() => setPhase("split"), 1080),
        setTimeout(() => setPhase("exit"), 3200),
        setTimeout(() => onDone && onDone(), 3800),
      ];
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const showWhole = !reducedMotion && (phase === "enter" || phase === "crack" || phase === "shake");
  const showCracked = !reducedMotion && (phase === "crack" || phase === "shake");
  const showSplit = !reducedMotion && (phase === "split" || phase === "exit");
  const showReveal = phase === "split" || phase === "exit";
  const exiting = phase === "exit";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-6 bsk-backdrop ${exiting ? "bsk-backdrop-out" : ""}`}
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", backgroundColor: "rgba(10,10,12,0.55)" }}
      role="presentation"
    >
      <div className="relative flex items-center justify-center" style={{ width: "min(72vw, 280px)", height: "min(72vw, 280px)" }}>
        {/* Content revealed once the card parts */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-opacity"
          style={{ opacity: showReveal ? 1 : 0, transitionDuration: reducedMotion ? "450ms" : "550ms" }}
        >
          <div className={reducedMotion ? "" : "bsk-flame-pop"} style={{ fontSize: 60, lineHeight: 1 }}>🔥</div>
          <div className={reducedMotion ? "" : "bsk-text-pop"} style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.03em", color: "#ffffff", textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
            {days} DAY{days === 1 ? "" : "S"}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase" }}>
            Streak Broken
          </div>
        </div>

        {!reducedMotion && showWhole && (
          <div className={`bsk-card absolute inset-0 rounded-[28px] ${phase === "enter" ? "bsk-card-in" : ""} ${phase === "shake" ? "bsk-shake" : ""}`}>
            {showCracked && (
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 280" fill="none">
                <g stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.5))" }}>
                  <path className="bsk-crack" style={{ animationDelay: "0ms" }} d="M140 30 L129 88 L152 110 L112 140 L140 178 L120 216 L140 252" />
                  <path className="bsk-crack" style={{ animationDelay: "50ms" }} d="M140 140 L54 102 L26 120" />
                  <path className="bsk-crack" style={{ animationDelay: "90ms" }} d="M140 140 L220 94 L252 108" />
                  <path className="bsk-crack" style={{ animationDelay: "130ms" }} d="M140 140 L64 182 L30 198" />
                  <path className="bsk-crack" style={{ animationDelay: "170ms" }} d="M140 140 L206 192 L240 210" />
                </g>
              </svg>
            )}
          </div>
        )}

        {!reducedMotion && showSplit && (
          <>
            <div className="bsk-half bsk-half-a absolute inset-0 rounded-[28px]" />
            <div className="bsk-half bsk-half-b absolute inset-0 rounded-[28px]" />
            {phase === "split" && (
              <div className="absolute inset-0 pointer-events-none">
                {shards.map((s, i) => (
                  <div
                    key={i}
                    className="bsk-shard absolute"
                    style={{
                      left: "50%", top: "50%", width: s.size, height: s.size * 1.6,
                      background: "linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.15))",
                      borderRadius: 2,
                      "--sx": `${s.sx}px`, "--sy": `${s.sy}px`, "--srot": `${s.rotate}deg`,
                      animationDelay: `${s.delay}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .bsk-backdrop { animation: bskFadeIn 0.4s ease-out both; }
        .bsk-backdrop-out { animation: bskFadeOut 0.6s ease-in both; }
        @keyframes bskFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bskFadeOut { from { opacity: 1; } to { opacity: 0; } }

        .bsk-card {
          background: linear-gradient(160deg, rgba(255,255,255,0.30), rgba(255,255,255,0.11));
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.08);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .bsk-card-in { animation: bskCardIn 0.42s cubic-bezier(.2,.8,.3,1.15) both; }
        @keyframes bskCardIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }

        .bsk-crack { stroke-dasharray: 260; stroke-dashoffset: 260; animation: bskDraw 0.3s ease-out forwards; }
        @keyframes bskDraw { to { stroke-dashoffset: 0; } }

        .bsk-shake { animation: bskShake 0.28s ease-in-out both; }
        @keyframes bskShake {
          0% { transform: translate(0,0) rotate(0deg); }
          20% { transform: translate(-3px,1px) rotate(-0.6deg); }
          40% { transform: translate(3px,-1px) rotate(0.6deg); }
          60% { transform: translate(-2px,2px) rotate(-0.4deg); }
          80% { transform: translate(2px,-1px) rotate(0.4deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }

        .bsk-half {
          background: linear-gradient(160deg, rgba(255,255,255,0.30), rgba(255,255,255,0.11));
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .bsk-half-a { clip-path: polygon(0 0, 100% 0, 46% 46%, 34% 100%, 0 100%); animation: bskSplitA 0.7s cubic-bezier(.3,.7,.4,1) forwards; }
        .bsk-half-b { clip-path: polygon(100% 0, 100% 100%, 34% 100%, 46% 46%); animation: bskSplitB 0.7s cubic-bezier(.3,.7,.4,1) forwards; }
        @keyframes bskSplitA { to { transform: translate(-24px, 9px) rotate(-9deg); opacity: 0; } }
        @keyframes bskSplitB { to { transform: translate(24px, -5px) rotate(8deg); opacity: 0; } }

        .bsk-shard { opacity: 0; animation: bskShard 0.9s cubic-bezier(.2,.7,.3,1) forwards; }
        @keyframes bskShard {
          0% { opacity: 1; transform: translate(-50%, -50%) translate(0,0) rotate(0deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--sx), var(--sy)) rotate(var(--srot)); }
        }

        .bsk-flame-pop { animation: bskPop 0.5s cubic-bezier(.34,1.56,.64,1) both; }
        .bsk-text-pop { animation: bskPop 0.5s cubic-bezier(.34,1.56,.64,1) 0.06s both; }
        @keyframes bskPop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .bsk-backdrop, .bsk-backdrop-out, .bsk-card-in, .bsk-shake, .bsk-crack, .bsk-half-a, .bsk-half-b, .bsk-shard, .bsk-flame-pop, .bsk-text-pop {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ---------- FINISH BUTTON (bottom of workout content, only visible once started) ----------
function FinishBar({ state, elapsedSeconds, volume, doneSets, totalSets, onFinish, onReset }) {
  if (state === "idle") return null;

  if (state === "running") {
    const allSetsDone = totalSets > 0 && doneSets >= totalSets;

    // Not every set is logged yet — FINISH would be a no-op (see the validation gate in
    // finishSession), so don't show a button that looks actionable but silently does nothing.
    // Instead, offer Reset/Cancel so an accidental START can be cleared right away.
    if (!allSetsDone) {
      return (
        <div className="px-4 pb-4">
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 py-5 transition active:scale-[0.98]"
            style={{
              backgroundColor: "rgba(0,0,0,0.04)",
              border: "1.5px dashed rgba(0,0,0,0.18)",
              borderRadius: 28,
              color: C.textDim,
            }}
          >
            <Trash2 size={18} color={C.textDim} />
            <span className="text-base font-black tracking-wide">RESET WORKOUT</span>
            <span className="text-xs font-bold tabular-nums ml-1" style={{ color: C.textFaint }}>
              {doneSets}/{totalSets} sets · {fmtDuration(elapsedSeconds)}
            </span>
          </button>
        </div>
      );
    }

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
            No workouts logged yet.<br />Finish a workout and it'll show up here automatically.
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
function SettingsMenu({ onClose, onSelectHistory, onSelectProgress, onExport, onImport, brokenStreakAnimEnabled, onToggleBrokenStreakAnim, onPreviewBrokenStreak }) {
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

        <div className="text-[11px] uppercase tracking-[0.15em] font-bold mt-5 mb-2 px-1" style={{ color: C.textDim }}>Streak</div>
        <div className="rounded-2xl px-4 py-3.5 mb-3 flex items-center justify-between gap-3" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
          <div className="min-w-0">
            <div className="text-sm font-bold" style={{ color: C.text }}>Broken Streak Animation</div>
            <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>Cinematic effect when a streak breaks</div>
          </div>
          <button
            onClick={onToggleBrokenStreakAnim}
            className="shrink-0 relative transition"
            style={{ width: 46, height: 27, borderRadius: 999, backgroundColor: brokenStreakAnimEnabled ? "#1e7a34" : "#d9d9d9" }}
            role="switch"
            aria-checked={brokenStreakAnimEnabled}
            aria-label="Toggle broken streak animation"
          >
            <span
              className="absolute top-[2px] transition-all"
              style={{ left: brokenStreakAnimEnabled ? 21 : 2, width: 23, height: 23, borderRadius: "50%", backgroundColor: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
            />
          </button>
        </div>
        <button
          onClick={onPreviewBrokenStreak}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-3 transition active:scale-[0.98]"
          style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}`, color: C.text }}
        >
          <Flame size={15} color="#ef6a1f" fill="#ffb347" />
          Preview Animation
        </button>
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

function ProgressModal({ onClose, history, weightLog, onLogWeight }) {
  const [subtab, setSubtab] = useState("strength");
  const [exerciseFilter, setExerciseFilter] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [calorieWeightInput, setCalorieWeightInput] = useState("");

  const todayStr = localDateStr();
  const todaysWeightEntry = useMemo(
    () => (weightLog || []).find((w) => w.date === todayStr),
    [weightLog, todayStr]
  );

  // Prefill the calorie calculator with the most recent logged weight
  const latestWeightEntry = useMemo(() => {
    if (!weightLog || weightLog.length === 0) return null;
    return [...weightLog].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }, [weightLog]);

  useEffect(() => {
    if (latestWeightEntry && !calorieWeightInput) {
      setCalorieWeightInput(String(latestWeightEntry.weightKg));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestWeightEntry]);

  const monthlyWeightData = useMemo(() => {
    if (!weightLog || weightLog.length === 0) return [];
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = localDateStr(monthAgo);
    return [...weightLog]
      .filter((w) => w.date >= monthAgoStr)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((w) => ({
        date: w.date,
        weightKg: w.weightKg,
        label: new Date(w.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      }));
  }, [weightLog]);

  const calorieWeightNum = parseFloat(calorieWeightInput) || 0;
  const calorieLbs = calorieWeightNum * 2.20462;
  const maintenanceCalories = calorieLbs * 18;
  const targetCalories = maintenanceCalories - maintenanceCalories * 0.2;

  const handleLogWeight = () => {
    const val = parseFloat(weightInput);
    if (!val || val <= 0) return;
    onLogWeight(val);
    setWeightInput("");
  };

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
          {[{ id: "strength", label: "Strength" }, { id: "volume", label: "Volume" }, { id: "weight", label: "Weight" }].map((s) => {
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

        {subtab === "weight" && (
          <div className="space-y-4">
            {/* Daily weight entry */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
              <div className="text-sm font-bold mb-3" style={{ color: C.text }}>Log Today's Weight</div>
              <div className="flex items-center gap-2">
                <input
                  type="number" inputMode="decimal" placeholder="kg"
                  value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.text }}
                />
                <button
                  onClick={handleLogWeight}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold transition active:scale-95"
                  style={{ backgroundColor: C.accent, color: "#ffffff" }}
                >
                  Log
                </button>
              </div>
              {todaysWeightEntry && (
                <div className="text-[11px] mt-2" style={{ color: C.textFaint }}>
                  Logged today: <span className="font-bold" style={{ color: C.textDim }}>{todaysWeightEntry.weightKg}kg</span>
                </div>
              )}
            </div>

            {/* Monthly weight trend graph */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
              <div className="text-sm font-bold mb-3" style={{ color: C.text }}>Monthly Weight Trend</div>
              {monthlyWeightData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={monthlyWeightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.rowBorder} />
                    <XAxis dataKey="label" fontSize={10} tick={{ fill: C.textFaint }} />
                    <YAxis fontSize={10} tick={{ fill: C.textFaint }} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.cardBorder}` }} />
                    <Line type="monotone" dataKey="weightKg" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs" style={{ color: C.textFaint }}>Log your weight a couple more times to see the trend.</div>
              )}
            </div>

            {/* Calorie calculator */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
              <div className="text-sm font-bold mb-1" style={{ color: C.text }}>Calorie Calculator</div>
              <div className="text-[11px] mb-3" style={{ color: C.textFaint }}>Maintenance = weight (lbs) × 18 · Target = maintenance − 20%</div>
              <input
                type="number" inputMode="decimal" placeholder="Weight in kg"
                value={calorieWeightInput} onChange={(e) => setCalorieWeightInput(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none mb-3"
                style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.text }}
              />
              {calorieWeightNum > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ backgroundColor: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
                    <div className="text-[9px] uppercase tracking-wide" style={{ color: C.textFaint }}>Maintenance</div>
                    <div className="text-lg font-black tabular-nums" style={{ color: C.text }}>{Math.round(maintenanceCalories).toLocaleString()}</div>
                    <div className="text-[9px]" style={{ color: C.textFaint }}>kcal/day</div>
                  </div>
                  <div className="rounded-xl p-3" style={{ backgroundColor: C.accent, border: `1px solid ${C.accent}` }}>
                    <div className="text-[9px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>Target</div>
                    <div className="text-lg font-black tabular-nums" style={{ color: "#ffffff" }}>{Math.round(targetCalories).toLocaleString()}</div>
                    <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.7)" }}>kcal/day</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs" style={{ color: C.textFaint }}>Enter your weight to calculate your calories.</div>
              )}
            </div>
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

  // In-progress (not-yet-finished) session data lives here, completely separate from History.
  // This is what lets you close the app mid-workout and resume later WITHOUT it ever
  // counting as a completed workout, touching the streak, or showing up in History.
  const [drafts, setDrafts] = useState({});
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const draftsRef = useRef({});
  useEffect(() => { draftsRef.current = drafts; }, [drafts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get("drafts");
        const parsed = res ? JSON.parse(res.value) : {};
        if (!cancelled) setDrafts(parsed && typeof parsed === "object" ? parsed : {});
      } catch (e) {
        if (!cancelled) setDrafts({});
      }
      if (!cancelled) setDraftsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftsLoaded) return;
    storage.set("drafts", JSON.stringify(drafts)).catch(() => {});
  }, [drafts, draftsLoaded]);

  // Load the full workout history ONCE (single reliable key — no listing, no per-day round trips)
  // History is the single source of truth for the streak, so only ever keep genuinely
  // FINISHED workouts here. (Self-heals any in-progress records saved by older app versions.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get("history");
        const parsed = res ? JSON.parse(res.value) : [];
        if (!cancelled) setHistory(Array.isArray(parsed) ? parsed.filter((r) => r && r.finished) : []);
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

  // ---- Body weight log (date + kg entries, used by the Weight tab in Progress) ----
  const [weightLog, setWeightLog] = useState([]);
  const [weightLogLoaded, setWeightLogLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get("weightLog");
        if (!cancelled) setWeightLog(res ? JSON.parse(res.value) : []);
      } catch (e) {
        if (!cancelled) setWeightLog([]);
      }
      if (!cancelled) setWeightLogLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!weightLogLoaded) return;
    storage.set("weightLog", JSON.stringify(weightLog)).catch(() => {});
  }, [weightLog, weightLogLoaded]);

  const handleLogWeight = useCallback((weightKg) => {
    const dateStr = localDateStr();
    setWeightLog((prev) => {
      const idx = prev.findIndex((w) => w.date === dateStr);
      if (idx === -1) return [...prev, { date: dateStr, weightKg }];
      const next = [...prev];
      next[idx] = { date: dateStr, weightKg };
      return next;
    });
  }, []);

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
      const todayId2 = `${activeDay}:${todayStr}`;
      const rec = historyRef.current.find((r) => r.id === todayId2 && isValidCompletedWorkout(r));
      const draft = draftsRef.current[todayId2];
      if (rec) {
        // A finished workout already exists for today — show it as completed.
        setLogs(rec.logs || {});
        setSetCounts(rec.setCounts || {});
        setWarmupDone(rec.warmupDone || {});
        setSessionStart(rec.sessionStart || null);
        setSessionEnd(rec.sessionEnd || null);
        setFinished(true);
        setSavedVolume(rec.volume || 0);
        setSavedDuration(rec.durationSec || 0);
      } else if (draft) {
        // Resume an unfinished, in-progress session. This never touches History or the streak.
        setLogs(draft.logs || {});
        setSetCounts(draft.setCounts || {});
        setWarmupDone(draft.warmupDone || {});
        setSessionStart(draft.sessionStart || null);
        setSessionEnd(draft.sessionEnd || null);
        setFinished(false);
        setSavedVolume(0);
        setSavedDuration(0);
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
  }, [activeDay, historyLoaded, draftsLoaded, repeatToken]);

  // Live autosave of in-progress data (safety net so you can resume mid-workout) — this writes
  // ONLY to the separate `drafts` store, never to History. Starting a workout or logging sets
  // therefore can never affect History or the streak; only FINISH does that (see finishSession).
  useEffect(() => {
    if (!loaded || !draftsLoaded || finished) return;
    const hasData = !!sessionStart || Object.keys(logs).length > 0 || Object.values(warmupDone).some(Boolean);
    setDrafts((prev) => {
      if (!hasData) {
        if (!(recordId in prev)) return prev;
        const next = { ...prev };
        delete next[recordId];
        return next;
      }
      return {
        ...prev,
        [recordId]: { logs, setCounts, warmupDone, sessionStart, sessionEnd },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, setCounts, warmupDone, sessionStart, sessionEnd, loaded, draftsLoaded, finished, recordId]);

  useEffect(() => {
    if (!sessionStart || sessionEnd) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [sessionStart, sessionEnd]);

  // Load paused (manually preserved rest) dates once
  const [pausedLoaded, setPausedLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("streakPauses");
        setPausedDates(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setPausedDates([]);
      }
      setPausedLoaded(true);
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

  // History is the single source of truth for the streak, and the streak is nothing more than
  // a count of genuinely FINISHED workouts in it (rec.finished === true, written solely by
  // finishSession, deduped by id). There is NO calendar walking here and NO concept of
  // consecutive days — a skipped day never lowers this number. Starting a workout, logging
  // sets, or hitting Reset never touches History, so none of that can move the streak. Adding
  // a finished record increases it by one; deleting one decreases it by one — that's the whole
  // rule, and it's why this recalculates straight from the `history` array every time it changes.
  const computeStreakValue = useCallback((hist) => {
    const seen = new Set();
    let count = 0;
    hist.forEach((r) => {
      if (isValidCompletedWorkout(r) && !seen.has(r.id)) {
        seen.add(r.id);
        count++;
      }
    });
    return count;
  }, []);

  // Separate from the streak NUMBER above: this decides only whether the broken-streak
  // animation should fire. Skipping a day is always allowed and never touches the streak count,
  // but a day that is neither a finished-workout day nor explicitly marked as a rest day (via
  // the pause toggle) is the app's actual inactivity condition. We only need to look at the most
  // recent fully-elapsed day (yesterday) and walk back over any *consecutive* rest-marked days
  // before it — the moment we hit a workout day, everything before it is already "resolved" and
  // irrelevant; the moment we hit an unmarked empty day, that's the break. Today is never checked
  // here since it hasn't elapsed yet. No hardcoded weekday (e.g. Sunday) is ever treated specially.
  const detectInactivityBreak = useCallback((pausedList, hist) => {
    let cursor = new Date();
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      const dateStr = localDateStr(cursor);
      const anyDone = hist.some((r) => r.date === dateStr && isValidCompletedWorkout(r));
      if (anyDone) return false;
      if (!pausedList.includes(dateStr)) return true;
      cursor.setDate(cursor.getDate() - 1);
    }
    return false;
  }, []);

  // ---- Broken-streak animation state ----
  // Whether an inactivity break is the currently-active (already-flagged) state, persisted so a
  // reload while still broken doesn't replay the animation — it only fires on the *transition*
  // into a break, and again later only once a fresh break happens after being resolved.
  const [brokenStreakActive, setBrokenStreakActive] = useState(false);
  const [brokenStreakActiveLoaded, setBrokenStreakActiveLoaded] = useState(false);
  const brokenStreakActiveRef = useRef(false);
  useEffect(() => { brokenStreakActiveRef.current = brokenStreakActive; }, [brokenStreakActive]);
  const [brokenStreakAnimEnabled, setBrokenStreakAnimEnabled] = useState(true);
  const [brokenStreakAnimSettingLoaded, setBrokenStreakAnimSettingLoaded] = useState(false);
  const [brokenStreakEvent, setBrokenStreakEvent] = useState(null); // { previousStreak, id } — real event
  const [previewBrokenStreak, setPreviewBrokenStreak] = useState(false); // preview trigger

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("brokenStreakActive");
        setBrokenStreakActive(res ? res.value === "1" : false);
      } catch (e) {
        setBrokenStreakActive(false);
      }
      setBrokenStreakActiveLoaded(true);
    })();
    (async () => {
      try {
        const res = await storage.get("brokenStreakAnimEnabled");
        setBrokenStreakAnimEnabled(res ? res.value !== "0" : true);
      } catch (e) {
        setBrokenStreakAnimEnabled(true);
      }
      setBrokenStreakAnimSettingLoaded(true);
    })();
  }, []);

  const toggleBrokenStreakAnim = useCallback(() => {
    setBrokenStreakAnimEnabled((prev) => {
      const next = !prev;
      storage.set("brokenStreakAnimEnabled", next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  // The streak NUMBER: purely derived from History, recalculated whenever History changes and
  // whenever the app loads. Nothing else — not pausedDates, not the broken-streak state below —
  // is allowed to influence it.
  useEffect(() => {
    if (!historyLoaded) return;
    setStreak(computeStreakValue(history));
  }, [history, historyLoaded, computeStreakValue]);

  // The broken-streak ANIMATION: fires only on the transition into the app's defined inactivity
  // condition (see detectInactivityBreak), never merely because a day was skipped and marked as
  // rest, and never because of Reset/logging/opening the app. The "previousStreak" it displays is
  // just the current (count-based) streak value, since that count itself is never altered by a break.
  useEffect(() => {
    if (!historyLoaded || !pausedLoaded || !brokenStreakActiveLoaded || !brokenStreakAnimSettingLoaded) return;
    const isBroken = detectInactivityBreak(pausedDates, history);
    if (isBroken === brokenStreakActiveRef.current) return;

    brokenStreakActiveRef.current = isBroken;
    setBrokenStreakActive(isBroken);
    storage.set("brokenStreakActive", isBroken ? "1" : "0").catch(() => {});

    if (isBroken && brokenStreakAnimEnabled) {
      setBrokenStreakEvent({ previousStreak: computeStreakValue(history), id: Date.now() });
    }
  }, [history, pausedDates, historyLoaded, pausedLoaded, brokenStreakActiveLoaded, brokenStreakAnimSettingLoaded, brokenStreakAnimEnabled, detectInactivityBreak, computeStreakValue]);

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

  // Total/completed set counts for the whole day, used to detect when a set being
  // marked done is the very last set of the entire workout (not just the last set
  // of an individual exercise) so the rest timer can be skipped in that case.
  const totalSetsForDay = day.groups.reduce((acc, g) => acc + g.exercises.reduce((a, e) => a + getCount(e), 0), 0);
  const doneSetsForDay = day.groups.reduce((acc, g) => acc + g.exercises.reduce((a, e) => {
    const l = logs[e.id] || {};
    const c = getCount(e);
    return a + Array.from({ length: c }).filter((_, i) => l[i]?.done).length;
  }, 0), 0);

  const startRest = useCallback(() => {
    // doneSetsForDay reflects the state from BEFORE the set that just triggered this
    // call (the toggle's own setState hasn't re-rendered yet), so +1 accounts for it.
    const isLastSetOfDay = totalSetsForDay > 0 && doneSetsForDay + 1 >= totalSetsForDay;
    if (isLastSetOfDay) return;
    setRestKey((k) => k + 1);
    setShowRest(true);
  }, [doneSetsForDay, totalSetsForDay]);

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
    // Resets the on-screen session only. It intentionally does NOT touch History, so a
    // workout that was already finished today keeps its place in History (and the streak)
    // unless the person explicitly deletes it from the History screen.
    setSessionStart(null);
    setSessionEnd(null);
    setFinished(false);
    setSavedVolume(0);
    setSavedDuration(0);
    setLogs({});
    setSetCounts({});
    setWarmupDone({});
    sessionBestRef.current = {};
    setDrafts((prev) => {
      if (!(recordId in prev)) return prev;
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
  }, [recordId]);

  // ---- Backup / restore (single file covers History + Progress, since Progress is derived from history) ----
  // Export only ever includes genuinely valid completed workouts — empty/null records (e.g. an
  // accidental Start->Finish with nothing logged) are excluded entirely. The JSON shape itself
  // (app/version/exportedAt/history/prBaselines/streakPauses) is unchanged; only the contents of
  // `history` are filtered.
  const exportData = useCallback(() => {
    const payload = {
      app: "aesthetic-ascension-trakd",
      version: 1,
      exportedAt: new Date().toISOString(),
      history: history.filter(isValidCompletedWorkout),
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
        // Only finished workouts belong in History at all — skip any in-progress records that
        // might exist in an older backup file. (Empty finished-but-doneSets:0 records are kept
        // here, same as they always have been, since completed-workout calculations everywhere
        // else — the streak, stats, and export — ignore them via isValidCompletedWorkout.)
        importedHistory.forEach((r) => { if (r && r.id && r.finished) map.set(r.id, r); });
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

      // The reported count reflects only genuinely valid completed workouts among those imported —
      // e.g. importing 5 records where only 3 pass isValidCompletedWorkout reports "Imported 3".
      const validImportedCount = importedHistory.filter(isValidCompletedWorkout).length;
      return { ok: true, msg: `Imported ${validImportedCount} workout${validImportedCount === 1 ? "" : "s"}.` };
    } catch (e) {
      return { ok: false, msg: "Couldn't read that file — make sure it's an unmodified export." };
    }
  }, []);

  const totalSets = totalSetsForDay;
  const doneSets = doneSetsForDay;

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

  const finishingRef = useRef(false);
  const finishSession = useCallback(async () => {
    // Guard against duplicate History entries / streak bumps from repeated FINISH presses
    // (e.g. a fast double-tap before the UI has re-rendered into the "finished" state).
    if (finished || finishingRef.current) return;
    finishingRef.current = true;

    // VALIDATION GATE: FINISH is not itself what saves a workout — a workout is only valid
    // (and therefore savable to History) if EVERY set for the day was actually logged as done.
    // An accidental Start->Finish with nothing logged, or a Finish pressed partway through with
    // sets still remaining, is a no-op: no History write, no state change of any kind, and —
    // because the streak is derived solely from History (see computeStreakValue above) — no
    // streak change either. This is the only gate that matters; there is no separate
    // "streak + 1" anywhere for FINISH to trigger even if it wanted to.
    if (totalSets <= 0 || doneSets < totalSets) {
      finishingRef.current = false;
      return;
    }

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

    // This is the ONLY place a History record is ever written for a finish. The streak is never
    // touched here directly — it is recalculated afterward, purely from the resulting `history`
    // array, by the dedicated effect above (history → computeStreakValue(history) → setStreak).
    setHistory((prev) => {
      const idx = prev.findIndex((r) => r.id === recordId);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });

    // The session is now a completed History entry — it no longer needs a separate draft.
    setDrafts((prev) => {
      if (!(recordId in prev)) return prev;
      const next = { ...prev };
      delete next[recordId];
      return next;
    });

    await Promise.all(baselineWrites);
    finishingRef.current = false;
  }, [finished, sessionStart, day, getOrderedExercises, prBaselines, logs, setCounts, warmupDone, liveVolume, doneSets, totalSets, recordId, activeDay, todayStr]);


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
          doneSets={doneSets}
          totalSets={totalSets}
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
          brokenStreakAnimEnabled={brokenStreakAnimEnabled}
          onToggleBrokenStreakAnim={toggleBrokenStreakAnim}
          onPreviewBrokenStreak={() => { setShowSettingsMenu(false); setPreviewBrokenStreak(true); }}
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
      {showProgress && <ProgressModal onClose={() => setShowProgress(false)} history={history} weightLog={weightLog} onLogWeight={handleLogWeight} />}

      {prToast && <PRToast pr={prToast} onDone={() => setPrToast(null)} />}

      {/* Real broken-streak event — fires at most once per genuine break, never on reload/rerender */}
      {brokenStreakEvent && (
        <BrokenStreakOverlay days={brokenStreakEvent.previousStreak} onDone={() => setBrokenStreakEvent(null)} />
      )}
      {/* Settings > Preview Animation — identical component/animation, sample data only, never touches real data */}
      {previewBrokenStreak && (
        <BrokenStreakOverlay days={47} onDone={() => setPreviewBrokenStreak(false)} />
      )}
    </div>
  );
}
