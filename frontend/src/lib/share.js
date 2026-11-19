// Sharing a card by WhatsApp or SMS opens the phone's own app with the message ready to send.
// No third-party gateway, no cost. Only offered after the patient has agreed to family sharing.

export function publicUrl(token) {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}/c/${token}`;
}

export const shareText = (card) => `${card.patientName} এর ওষুধের কার্ড (শুনুন ও দেখুন): ${publicUrl(card.token)}`;

const digits = (p) => String(p || "").replace(/\D/g, "");

export const whatsappLink = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;
export const smsLink = (phone, text) => `sms:+${digits(phone)}?&body=${encodeURIComponent(text)}`;

export const followUpText = (name, endsOn) =>
  `নমস্কার/আসসালামু আলাইকুম। ${name} এর ওষুধের কোর্স ${endsOn} তারিখে শেষ হবে। ওষুধ ঠিকমতো খাচ্ছেন তো? আরও ওষুধ লাগলে বা কোনো সমস্যা হলে ফার্মেসিতে আসুন।`;
