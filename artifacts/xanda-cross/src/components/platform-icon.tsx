import gmailImg from "@assets/gmail_1779985609117.png";
import instagramImg from "@assets/instagram_1779985609117.png";
import linkedinImg from "@assets/linkdein_1779985609117.png";
import outlookImg from "@assets/outlook_1779985609118.png";
import telegramImg from "@assets/telegram_1779985609118.png";
import whatsappImg from "@assets/whatsapp_1779985609118.png";
import { MessageSquare } from "lucide-react";

const PLATFORM_IMAGES: Record<string, string> = {
  gmail: gmailImg,
  outlook: outlookImg,
  whatsapp: whatsappImg,
  whatsapp_business: whatsappImg,
  linkedin: linkedinImg,
  instagram: instagramImg,
  telegram: telegramImg,
};

export function PlatformIcon({
  platform,
  className = "w-4 h-4",
}: {
  platform: string;
  className?: string;
}) {
  const img = PLATFORM_IMAGES[platform.toLowerCase()];
  if (img) {
    return (
      <img
        src={img}
        alt={platform}
        className={`${className} object-contain`}
        draggable={false}
      />
    );
  }
  return <MessageSquare className={`${className} text-gray-400`} />;
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    gmail: "Gmail",
    outlook: "Outlook",
    whatsapp: "WhatsApp",
    whatsapp_business: "WhatsApp",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    telegram: "Telegram",
  };
  return labels[platform.toLowerCase()] ?? platform;
}
