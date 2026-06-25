import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DayPicker } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import {
  ApiError,
  type DepositMethod,
  FOOD_LABELS,
  type FoodFormula,
  type PriceBreakdown,
  SLOT_LABELS,
  type Slot,
  STATUS_LABELS,
  type Status,
  UnauthorizedError,
  api,
} from "@/lib/api";
import {
  AlertCircle,
  Baby,
  Calendar,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  Euro,
  Loader2,
  Minus,
  Moon,
  Percent,
  Phone,
  Plus,
  Save,
  Sparkles,
  Sun,
  Sunset,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface ReservationFormProps {
  token: string;
  onUnauthorized: () => void;
  onCreated: () => void;
}

const SLOT_DEFAULT_HOURS: Record<Slot, { start: string; end: string }> = {
  morning: { start: "10:00", end: "14:00" },
  afternoon: { start: "14:00", end: "18:00" },
  evening: { start: "18:00", end: "22:00" },
  night: { start: "22:00", end: "02:00" },
};

const SLOT_ICONS: Record<Slot, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
  night: Sparkles,
};

const DEPOSIT_METHODS: { value: DepositMethod; label: string }[] = [
  { value: "wero", label: "Wero" },
  { value: "revolut", label: "Revolut" },
  { value: "paypal", label: "PayPal" },
  { value: "cash", label: "Espèces" },
  { value: "other", label: "Autre" },
];

const inputClass =
  "w-full bg-gray-800/50 border border-white/[0.08] text-gray-50 placeholder-gray-600 rounded-xl px-4 py-3 focus:border-[#02BAD6] focus:ring-2 focus:ring-[#02BAD6]/20 focus:outline-none hover:border-white/[0.15] transition-colors";

const selectClass =
  "w-full bg-gray-800/50 border border-white/[0.08] text-gray-50 rounded-xl px-4 py-3 focus:border-[#02BAD6] focus:ring-2 focus:ring-[#02BAD6]/20 focus:outline-none hover:border-white/[0.15] transition-colors appearance-none";

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Build an ISO datetime in Europe/Paris for the given date + time. */
function toParisIso(dateIso: string, time: string, addDays = 0): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  // Construct a Date interpreted in the BROWSER local TZ. The admin is in
  // Europe/Paris, so this matches; for other TZs the offset would shift.
  const local = new Date(y!, (m! - 1), d! + addDays, h, mi, 0);
  return local.toISOString();
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900/50 border border-white/[0.08] rounded-2xl">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3 rounded-t-2xl">
        <div className="w-8 h-8 rounded-lg bg-[#02BAD6]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#02BAD6]" />
        </div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 30,
  label,
  icon: Icon,
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-gray-400 text-sm">{label}</span>
        {hint && <span className="text-gray-600 text-xs">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-11 h-11 rounded-xl border border-white/[0.08] text-gray-300 hover:border-[#02BAD6] hover:text-[#02BAD6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className={cn(inputClass, "text-center font-semibold text-lg w-20")}
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-11 h-11 rounded-xl border border-white/[0.08] text-gray-300 hover:border-[#02BAD6] hover:text-[#02BAD6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DatePickerField({
  date,
  setDate,
}: {
  date: string;
  setDate: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = date ? new Date(date + "T00:00:00") : undefined;

  return (
    <div className="block" ref={ref}>
      <span className="text-gray-400 text-sm mb-1.5 block">Date *</span>
      <div className="relative">
        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            inputClass,
            "pl-11 text-left cursor-pointer w-full",
            !date && "text-gray-600",
          )}
        >
          {date ? formatDateDisplay(date) : "JJ/MM/AAAA"}
        </button>
        {open && (
          <div className="absolute z-50 mt-2 left-0 bg-gray-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 p-4 noozha-datepicker">
            <DayPicker
              mode="single"
              locale={fr}
              selected={selected}
              onSelect={(d) => {
                if (d) {
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  setDate(iso);
                }
                setOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ReservationForm({
  token,
  onUnauthorized,
  onCreated,
}: ReservationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form state
  const [client, setClient] = useState("");
  const [telephone, setTelephone] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot>("afternoon");
  const [startTime, setStartTime] = useState(SLOT_DEFAULT_HOURS.afternoon.start);
  const [endTime, setEndTime] = useState(SLOT_DEFAULT_HOURS.afternoon.end);
  const [adults, setAdults] = useState(6);
  const [children, setChildren] = useState(0);
  const [foodFormula, setFoodFormula] = useState<FoodFormula | "">("");
  const [foodPersons, setFoodPersons] = useState(0);
  const [foodChildren, setFoodChildren] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("wero");
  const [status, setStatus] = useState<Status>("pending");
  const [notes, setNotes] = useState("");

  // When slot changes, reset start/end to that slot's defaults.
  const setSlotAndReset = useCallback((newSlot: Slot) => {
    setSlot(newSlot);
    setStartTime(SLOT_DEFAULT_HOURS[newSlot].start);
    setEndTime(SLOT_DEFAULT_HOURS[newSlot].end);
  }, []);

  // Live price preview via /reservations/estimate (debounced).
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (adults + children < 1) {
      setBreakdown(null);
      return;
    }
    const handle = setTimeout(() => {
      setEstimating(true);
      api.reservations
        .estimate(token, {
          slot,
          adults,
          children,
          food_formula: foodFormula || null,
          food_persons: foodFormula ? foodPersons : null,
          food_children: foodFormula ? foodChildren : 0,
          discount_amount: discountAmount,
        })
        .then(setBreakdown)
        .catch((err) => {
          if (err instanceof UnauthorizedError) onUnauthorized();
        })
        .finally(() => setEstimating(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [token, slot, adults, children, foodFormula, foodPersons, foodChildren, discountAmount, onUnauthorized]);

  const tierLabel = useMemo<string>(() => {
    if (!breakdown) return "—";
    return { small: "≤6 personnes", medium: "7-10 personnes", large: "11-15 personnes" }[
      breakdown.tier
    ];
  }, [breakdown]);

  function resetForm() {
    setClient("");
    setTelephone("");
    setDate("");
    setSlotAndReset("afternoon");
    setAdults(6);
    setChildren(0);
    setFoodFormula("");
    setFoodPersons(0);
    setFoodChildren(0);
    setDiscountAmount(0);
    setDiscountReason("");
    setDepositPaid(false);
    setDepositMethod("wero");
    setStatus("pending");
    setNotes("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    try {
      // Compare custom hours vs slot defaults — only override when different.
      const defaults = SLOT_DEFAULT_HOURS[slot];
      const startOverride = startTime !== defaults.start;
      const endOverride = endTime !== defaults.end;
      const crossesMidnight = slot === "night";

      const payload = {
        slot,
        date,
        ...(startOverride ? { start_at: toParisIso(date, startTime) } : {}),
        ...(endOverride
          ? { end_at: toParisIso(date, endTime, crossesMidnight ? 1 : 0) }
          : {}),
        customer_name: client.trim(),
        customer_phone: telephone.trim(),
        adults,
        children,
        food_formula: foodFormula || null,
        food_persons: foodFormula ? foodPersons : null,
        food_children: foodFormula ? foodChildren : 0,
        discount_amount: discountAmount,
        discount_reason: discountReason.trim() || null,
        deposit_paid: depositPaid,
        deposit_method: depositPaid ? depositMethod : null,
        status,
        notes: notes.trim() || null,
      };

      await api.reservations.create(token, payload);
      setSuccess(true);
      resetForm();
      onCreated();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Erreur lors de la création.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2"
            >
              <Check className="w-5 h-5 shrink-0" />
              Réservation créée avec succès
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Client */}
        <SectionCard icon={User} title="Informations client">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-gray-400 text-sm mb-1.5 block">Nom *</span>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  required
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className={cn(inputClass, "pl-11")}
                  placeholder="Fatima B."
                />
              </div>
            </label>
            <label className="block">
              <span className="text-gray-400 text-sm mb-1.5 block">Téléphone</span>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className={cn(inputClass, "pl-11")}
                  placeholder="06 12 34 56 78 (optionnel)"
                />
              </div>
            </label>
          </div>
        </SectionCard>

        {/* Réservation : date + slot picker + horaires */}
        <SectionCard icon={Calendar} title="Créneau">
          <div className="space-y-5">
            <DatePickerField date={date} setDate={setDate} />

            <div>
              <span className="text-gray-400 text-sm mb-2 block">Catégorie tarifaire *</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(SLOT_LABELS) as Slot[]).map((s) => {
                  const Icon = SLOT_ICONS[s];
                  const active = slot === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlotAndReset(s)}
                      className={cn(
                        "p-3 rounded-xl border transition-all duration-200 text-left",
                        active
                          ? "bg-[#02BAD6]/10 border-[#02BAD6] text-[#02BAD6]"
                          : "bg-gray-800/30 border-white/[0.08] text-gray-300 hover:border-white/[0.15]",
                      )}
                    >
                      <Icon className="w-4 h-4 mb-1.5" />
                      <p className="text-sm font-semibold">{SLOT_LABELS[s].name}</p>
                      <p className="text-xs text-gray-500">{SLOT_LABELS[s].time}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-gray-400 text-sm mb-1.5 block">
                  Heure de début
                </span>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={cn(inputClass, "pl-11")}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-gray-400 text-sm mb-1.5 block">Heure de fin</span>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={cn(inputClass, "pl-11")}
                  />
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Horaires modifiables. La catégorie tarifaire reste celle choisie ci-dessus.
            </p>
          </div>
        </SectionCard>

        {/* Personnes */}
        <SectionCard icon={Users} title="Personnes">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Stepper
              label="Adultes"
              icon={User}
              value={adults}
              onChange={setAdults}
              min={0}
              max={30}
            />
            <Stepper
              label="Enfants"
              icon={Baby}
              hint="< 12 ans, tarif -50%"
              value={children}
              onChange={setChildren}
              min={0}
              max={30}
            />
          </div>
        </SectionCard>

        {/* Repas (optionnel) */}
        <SectionCard icon={ChefHat} title="Repas (optionnel)">
          <div className="space-y-4">
            <div>
              <span className="text-gray-400 text-sm mb-2 block">Formule</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { v: "", label: "Aucun", price: "" },
                  { v: "platters_14", label: "Plateaux à partager", price: "14€/pers" },
                  { v: "menu_19", label: "Menu traditionnel", price: "19€/pers" },
                ] as { v: FoodFormula | ""; label: string; price: string }[]).map((opt) => {
                  const active = foodFormula === opt.v;
                  return (
                    <button
                      key={opt.v || "none"}
                      type="button"
                      onClick={() => {
                        setFoodFormula(opt.v);
                        if (!opt.v) {
                          setFoodPersons(0);
                          setFoodChildren(0);
                          setDepositPaid(false);
                        } else if (foodPersons === 0) {
                          setFoodPersons(adults + children);
                          setFoodChildren(children);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-xl border transition-all duration-200 text-left",
                        active
                          ? "bg-[#02BAD6]/10 border-[#02BAD6] text-[#02BAD6]"
                          : "bg-gray-800/30 border-white/[0.08] text-gray-300 hover:border-white/[0.15]",
                      )}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      {opt.price && <p className="text-xs text-gray-500">{opt.price}</p>}
                    </button>
                  );
                })}
              </div>
            </div>

            {foodFormula && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <Stepper
                  label="Adultes au repas"
                  icon={User}
                  value={Math.max(0, foodPersons - foodChildren)}
                  onChange={(adultsMeal) => {
                    const total = adultsMeal + foodChildren;
                    setFoodPersons(total);
                  }}
                  min={0}
                  max={30}
                />
                <Stepper
                  label="Enfants au repas"
                  icon={Baby}
                  hint="-50% sur le repas"
                  value={foodChildren}
                  onChange={(childrenMeal) => {
                    const adultsMeal = Math.max(0, foodPersons - foodChildren);
                    setFoodChildren(childrenMeal);
                    setFoodPersons(adultsMeal + childrenMeal);
                  }}
                  min={0}
                  max={30}
                />
              </div>
            )}
            {foodFormula && (
              <p className="text-xs text-gray-500">
                Total au repas : {foodPersons} personne{foodPersons !== 1 ? "s" : ""}
                {foodChildren > 0 && ` (dont ${foodChildren} enfant${foodChildren !== 1 ? "s" : ""} à -50%)`}
              </p>
            )}
          </div>
        </SectionCard>

        {/* Remise */}
        <SectionCard icon={Percent} title="Remise (optionnel)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-gray-400 text-sm mb-1.5 block">Montant (€)</span>
              <div className="relative">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  className={cn(inputClass, "pl-11")}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-gray-400 text-sm mb-1.5 block">Raison</span>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className={inputClass}
                placeholder="Geste commercial, fidélité…"
              />
            </label>
          </div>
        </SectionCard>

        {/* Acompte + Statut + Notes */}
        <SectionCard icon={ClipboardList} title="Suivi">
          <div className="space-y-4">
            {foodFormula ? (
              <>
                <label
                  htmlFor="acompte"
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200",
                    depositPaid
                      ? "bg-[#02BAD6]/10 border-[#02BAD6]/30"
                      : "bg-gray-800/30 border-white/[0.06] hover:border-white/[0.12]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200",
                        depositPaid ? "bg-[#02BAD6]/20" : "bg-gray-700/50",
                      )}
                    >
                      <Wallet
                        className={cn(
                          "w-4 h-4 transition-colors duration-200",
                          depositPaid ? "text-[#02BAD6]" : "text-gray-500",
                        )}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium transition-colors duration-200",
                          depositPaid ? "text-[#02BAD6]" : "text-gray-300",
                        )}
                      >
                        Acompte reçu
                      </p>
                      <p className="text-xs text-gray-500">
                        10€ — requis car repas commandé
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="acompte"
                      checked={depositPaid}
                      onChange={(e) => setDepositPaid(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 rounded-full bg-gray-700 peer-checked:bg-[#02BAD6] transition-colors duration-200" />
                    <div
                      className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                        depositPaid && "translate-x-5",
                      )}
                    />
                  </div>
                </label>

                {depositPaid && (
                  <label className="block">
                    <span className="text-gray-400 text-sm mb-1.5 block">Méthode acompte</span>
                    <select
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}
                      className={selectClass}
                    >
                      {DEPOSIT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <div className="p-3 rounded-lg bg-gray-800/30 border border-white/[0.04] text-xs text-gray-500">
                Acompte non demandé (pas de repas commandé).
              </div>
            )}

            <label className="block">
              <span className="text-gray-400 text-sm mb-1.5 block">Statut</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className={selectClass}
              >
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-gray-400 text-sm mb-1.5 block">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={cn(inputClass, "resize-y")}
                placeholder="Allergies, demandes particulières…"
              />
            </label>
          </div>
        </SectionCard>

        <motion.button
          type="submit"
          disabled={submitting || !date}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full bg-[#02BAD6] hover:bg-[#00d4f5] text-white font-medium rounded-xl py-3 transition-colors flex items-center justify-center gap-2",
            (submitting || !date) && "opacity-60 cursor-not-allowed",
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Enregistrer la réservation
            </>
          )}
        </motion.button>
      </form>

      {/* Live price preview — sticky right column on desktop */}
      <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
        <div className="bg-gray-900/50 border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#02BAD6]/10 flex items-center justify-center">
              <Euro className="w-4 h-4 text-[#02BAD6]" />
            </div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1">
              Total
            </h3>
            {estimating && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
          </div>
          <div className="p-6">
            <p
              className="text-4xl font-bold text-[#02BAD6] mb-3"
              style={{ textShadow: "0 0 20px rgba(2,186,214,0.3)" }}
            >
              {breakdown?.grand_total.toFixed(2) ?? "—"} €
            </p>
            <div className="text-gray-500 text-xs space-y-1 mb-4">
              <p>
                Tier : <span className="text-gray-300">{tierLabel}</span>
              </p>
              {breakdown && (
                <>
                  <p>
                    Adulte : {breakdown.adult_unit_price}€ × {adults} ={" "}
                    {(breakdown.adult_unit_price * adults).toFixed(2)}€
                  </p>
                  {children > 0 && (
                    <p>
                      Enfant : {breakdown.child_unit_price}€ × {children} ={" "}
                      {(breakdown.child_unit_price * children).toFixed(2)}€
                    </p>
                  )}
                  {breakdown.food_total > 0 && foodFormula && (
                    <div className="space-y-0.5">
                      <p>
                        Repas {FOOD_LABELS[foodFormula].name} ({FOOD_LABELS[foodFormula].unit}€/pers) :
                      </p>
                      <p className="pl-3">
                        {Math.max(0, foodPersons - foodChildren)} ad ×{" "}
                        {FOOD_LABELS[foodFormula].unit}€
                        {foodChildren > 0 && (
                          <>
                            {" + "}
                            {foodChildren} enf × {(FOOD_LABELS[foodFormula].unit / 2).toFixed(2)}€
                          </>
                        )}
                        {" = "}
                        <span className="text-gray-300">
                          {breakdown.food_total.toFixed(2)}€
                        </span>
                      </p>
                    </div>
                  )}
                  {breakdown.discount > 0 && (
                    <p className="text-amber-400">
                      Remise : −{breakdown.discount.toFixed(2)}€
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
