import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  type Reservation,
  type Slot,
  SLOT_LABELS,
  type Status,
  UnauthorizedError,
  api,
} from "@/lib/api";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { motion } from "motion/react";

interface CalendarProps {
  token: string;
  onUnauthorized: () => void;
  refreshKey: number;
}

const SLOT_ORDER: Slot[] = ["morning", "afternoon", "evening", "night"];
const SLOT_ICONS: Record<Slot, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
  night: Sparkles,
};

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = [
  "janv.",
  "févr.",
  "mars",
  "avril",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

const STATUS_COLORS: Record<Status, { dot: string; pill: string; text: string }> = {
  confirmed: {
    dot: "bg-emerald-400",
    pill: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    text: "text-emerald-400",
  },
  pending: {
    dot: "bg-amber-400",
    pill: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    text: "text-amber-400",
  },
  cancelled: {
    dot: "bg-red-400/60",
    pill: "bg-red-500/10 border-red-500/20 text-red-400",
    text: "text-red-400",
  },
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7; // Mon=1..Sun=7
  d.setDate(d.getDate() - (day - 1));
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatWeekHeader(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  if (sameMonth) {
    return `${monday.getDate()} – ${sunday.getDate()} ${MONTH_NAMES[monday.getMonth()]} ${monday.getFullYear()}`;
  }
  return `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface DayBucket {
  date: Date;
  bySlot: Partial<Record<Slot, Reservation[]>>;
  all: Reservation[];
}

function bucketByDay(monday: Date, reservations: Reservation[]): DayBucket[] {
  const days: DayBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    days.push({ date: d, bySlot: {}, all: [] });
  }
  for (const r of reservations) {
    const start = new Date(r.start_at);
    const dayIndex = days.findIndex((bucket) => isSameDay(bucket.date, start));
    if (dayIndex === -1) continue;
    const bucket = days[dayIndex]!;
    bucket.all.push(r);
    if (!bucket.bySlot[r.slot]) bucket.bySlot[r.slot] = [];
    bucket.bySlot[r.slot]!.push(r);
  }
  return days;
}

export function Calendar({ token, onUnauthorized, refreshKey }: CalendarProps) {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.reservations
      .list(token, {
        from: isoDate(monday),
        to: isoDate(addDays(monday, 6)),
      })
      .then((res) => setReservations(res.reservations))
      .catch((err) => {
        if (err instanceof UnauthorizedError) onUnauthorized();
        else if (err instanceof ApiError) setError(err.message);
        else setError("Erreur de chargement.");
      })
      .finally(() => setLoading(false));
  }, [token, monday, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const days = useMemo(() => bucketByDay(monday, reservations), [monday, reservations]);
  const today = useMemo(() => new Date(), []);
  const isCurrentWeek = useMemo(
    () => isSameDay(monday, startOfWeek(today)),
    [monday, today],
  );

  // Touch swipe handling — basic, no library.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? null;
    if (endX === null) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    setMonday((m) => addDays(m, delta < 0 ? 7 : -7));
  };

  return (
    <div className="space-y-4">
      {/* Header: week navigation */}
      <div className="bg-gray-900/50 border border-white/[0.08] rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMonday((m) => addDays(m, -7))}
            className="w-10 h-10 rounded-xl border border-white/[0.08] text-gray-300 hover:border-[#02BAD6] hover:text-[#02BAD6] transition-colors flex items-center justify-center"
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-0.5">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Semaine</span>
            </div>
            <p className="text-white font-semibold text-sm sm:text-base truncate">
              {formatWeekHeader(monday)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMonday((m) => addDays(m, 7))}
            className="w-10 h-10 rounded-xl border border-white/[0.08] text-gray-300 hover:border-[#02BAD6] hover:text-[#02BAD6] transition-colors flex items-center justify-center"
            aria-label="Semaine suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!isCurrentWeek && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setMonday(startOfWeek(today))}
              className="text-xs text-[#02BAD6] hover:text-[#00d4f5] underline"
            >
              Revenir à aujourd'hui
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Days */}
      <div
        className="space-y-2.5 select-none touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-gray-900/50 border border-white/[0.06] animate-pulse"
              />
            ))
          : days.map((bucket, idx) => {
              const isToday = isSameDay(bucket.date, today);
              const hasReservations = bucket.all.length > 0;
              const dayName = DAY_NAMES[idx];
              return (
                <motion.div
                  key={bucket.date.toISOString()}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.02 }}
                  className={cn(
                    "rounded-2xl border overflow-hidden",
                    isToday
                      ? "bg-[#02BAD6]/[0.04] border-[#02BAD6]/30"
                      : "bg-gray-900/40 border-white/[0.06]",
                  )}
                >
                  {/* Day header */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div
                      className={cn(
                        "shrink-0 w-12 text-center",
                        isToday ? "text-[#02BAD6]" : "text-gray-300",
                      )}
                    >
                      <p className="text-[10px] uppercase tracking-wider font-medium opacity-80">
                        {dayName}
                      </p>
                      <p className="font-bold text-xl leading-tight">
                        {bucket.date.getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Dots — 4 slots */}
                      <div className="flex items-center gap-1.5">
                        {SLOT_ORDER.map((s) => {
                          const list = bucket.bySlot[s] ?? [];
                          const has = list.length > 0;
                          const dominantStatus =
                            list.find((r) => r.status === "confirmed")?.status ??
                            list[0]?.status;
                          return (
                            <span
                              key={s}
                              title={SLOT_LABELS[s].name}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                has
                                  ? dominantStatus
                                    ? STATUS_COLORS[dominantStatus].dot
                                    : "bg-gray-500"
                                  : "bg-white/[0.06]",
                              )}
                            />
                          );
                        })}
                        <span className="text-xs text-gray-500 ml-1">
                          {hasReservations
                            ? `${bucket.all.length} résa${bucket.all.length > 1 ? "s" : ""}`
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reservations under this day */}
                  {hasReservations && (
                    <div className="border-t border-white/[0.04] divide-y divide-white/[0.04]">
                      {bucket.all.map((r) => {
                        const SlotIcon = SLOT_ICONS[r.slot];
                        const colors = STATUS_COLORS[r.status];
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelected(r)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
                          >
                            <SlotIcon className="w-4 h-4 text-gray-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-500 font-mono">
                                  {formatTime(r.start_at)}–{formatTime(r.end_at)}
                                </span>
                                <span
                                  className={cn(
                                    "inline-block w-1 h-1 rounded-full",
                                    colors.dot,
                                  )}
                                />
                                <span className="text-sm text-gray-200 truncate">
                                  {r.customer_name}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {r.adults}A
                                {r.children > 0 ? ` + ${r.children}E` : ""} ·{" "}
                                {Number(r.total_price).toFixed(0)}€
                                {r.food_formula && " · repas"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
      </div>

      {/* Detail modal */}
      {selected && (
        <DetailModal reservation={selected} onClose={() => setSelected(null)} />
      )}

      {loading && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
}

function DetailModal({
  reservation: r,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const colors = STATUS_COLORS[r.status];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-white/[0.08] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {SLOT_LABELS[r.slot].name} · {formatTime(r.start_at)}–{formatTime(r.end_at)}
            </p>
            <h3 className="text-xl font-semibold text-white">{r.customer_name}</h3>
            {r.customer_phone && (
              <a
                href={`tel:${r.customer_phone}`}
                className="text-sm text-[#02BAD6] hover:text-[#00d4f5] underline"
              >
                {r.customer_phone}
              </a>
            )}
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap",
              colors.pill,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
            {r.status === "confirmed"
              ? "Confirmée"
              : r.status === "cancelled"
                ? "Annulée"
                : "En attente"}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-300">
          <Row label="Personnes" value={`${r.adults} adulte${r.adults !== 1 ? "s" : ""}${r.children > 0 ? ` + ${r.children} enfant${r.children !== 1 ? "s" : ""}` : ""}`} />
          <Row label="Bassin" value={`${Number(r.base_price_pool).toFixed(2)} €`} />
          {r.food_formula && (
            <Row
              label="Repas"
              value={`${r.food_formula === "platters_14" ? "Plateaux" : "Menu"} × ${r.food_persons}${
                r.food_children > 0 ? ` (dont ${r.food_children} enf. -50%)` : ""
              } = ${Number(r.food_price_total).toFixed(2)} €`}
            />
          )}
          {Number(r.discount_amount) > 0 && (
            <Row
              label="Remise"
              value={`−${Number(r.discount_amount).toFixed(2)} €${r.discount_reason ? ` (${r.discount_reason})` : ""}`}
              valueClass="text-amber-400"
            />
          )}
          <div className="pt-2 mt-2 border-t border-white/[0.06]">
            <Row
              label="Total"
              value={`${Number(r.total_price).toFixed(2)} €`}
              valueClass="text-[#02BAD6] font-bold text-lg"
            />
          </div>
          {r.food_formula && (
            <Row
              label="Acompte"
              value={r.deposit_paid ? `Reçu (${r.deposit_method ?? "—"})` : "Non reçu"}
              valueClass={r.deposit_paid ? "text-emerald-400" : "text-gray-500"}
            />
          )}
          {r.notes && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{r.notes}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full px-4 py-3 rounded-xl border border-white/[0.08] text-gray-300 hover:bg-white/[0.04] transition-colors text-sm font-medium"
        >
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-sm text-gray-300 text-right", valueClass)}>{value}</span>
    </div>
  );
}
