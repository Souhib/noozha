export const PHONE_DISPLAY = "06 43 14 20 20";
export const PHONE_TEL = "+33643142020";
const WHATSAPP_NUMBER = "33643142020";

export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
