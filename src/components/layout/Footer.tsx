import { useTranslation } from "react-i18next";
import { Heart, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WHATSAPP_URL,
  PHONE_DISPLAY,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from "@/lib/contact";

interface FooterProps {
  isNight: boolean;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.823 9.823 0 0 0 12.04 2zm0 18.15h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.69-8.23 8.23-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.84-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01s-.43.06-.66.31c-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.29z" />
    </svg>
  );
}

export function Footer({ isNight }: FooterProps) {
  const { t } = useTranslation(["common", "home"]);
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t py-10 px-6",
        isNight ? "border-white/5 bg-[#050A12]" : "border-gray-200 bg-[#F8FAFC]"
      )}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top row: brand + contact channels */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <span
            className={cn(
              "font-heading text-2xl font-bold",
              isNight ? "text-white" : "text-[#0A1628]"
            )}
          >
            Nooz<span className="text-[#02BAD6]">ha</span>
          </span>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-2 text-sm font-medium transition-colors",
                isNight
                  ? "text-gray-300 hover:text-[#25D366]"
                  : "text-gray-600 hover:text-[#25D366]"
              )}
            >
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              {PHONE_DISPLAY}
            </a>

            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-2 text-sm font-medium transition-colors",
                isNight
                  ? "text-gray-300 hover:text-[#E1306C]"
                  : "text-gray-600 hover:text-[#E1306C]"
              )}
            >
              <Instagram
                className={cn(
                  "w-4 h-4",
                  isNight ? "text-[#E1306C]" : "text-[#E1306C]"
                )}
              />
              @{INSTAGRAM_HANDLE}
            </a>
          </div>
        </div>

        {/* Divider */}
        <div
          className={cn(
            "h-px",
            isNight ? "bg-white/5" : "bg-gray-200"
          )}
        />

        {/* Bottom row: legal + signature */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span
              className={cn(isNight ? "text-gray-500" : "text-gray-400")}
            >
              {t("common:footer.legal")}
            </span>
            <span
              className={cn(isNight ? "text-gray-500" : "text-gray-400")}
            >
              {t("common:footer.privacy")}
            </span>
            <span
              className={cn(isNight ? "text-gray-500" : "text-gray-400")}
            >
              {t("common:footer.terms")}
            </span>
          </div>

          <p
            className={cn(
              "flex items-center gap-1.5",
              isNight ? "text-gray-500" : "text-gray-400"
            )}
          >
            {t("common:footer.madeWith")}{" "}
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />{" "}
            {t("common:footer.inChelles")} · {year}
          </p>
        </div>
      </div>
    </footer>
  );
}
