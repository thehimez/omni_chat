import { SiGmail, SiWhatsapp, SiInstagram, SiTelegram, SiSlack } from "react-icons/si";
import { MessageSquare, Mail, Linkedin } from "lucide-react";

export function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: string, className?: string }) {
  switch (platform.toLowerCase()) {
    case 'gmail': return <SiGmail className={`${className} text-[#EA4335]`} />;
    case 'outlook': return <Mail className={`${className} text-[#0078D4]`} />;
    case 'whatsapp':
    case 'whatsapp_business':
      return <SiWhatsapp className={`${className} text-[#25D366]`} />;
    case 'linkedin': return <Linkedin className={`${className} text-[#0A66C2]`} />;
    case 'instagram': return <SiInstagram className={`${className} text-[#E4405F]`} />;
    case 'telegram': return <SiTelegram className={`${className} text-[#26A5E4]`} />;
    case 'slack': return <SiSlack className={`${className} text-[#4A154B]`} />;
    default: return <MessageSquare className={`${className} text-muted-foreground`} />;
  }
}
