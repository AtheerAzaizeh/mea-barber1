import { Phone, Clock, MapPin } from "lucide-react";
import { BARBERSHOP_CONFIG } from "@/lib/constants";
import heroImage from "@/assets/barbershop-daburiyya-israel-haircut.jpg";
interface HeroSectionProps {
  onBookClick: () => void;
  compact?: boolean;
}
export function HeroSection({
  onBookClick,
  compact = false
}: HeroSectionProps) {
  return <section className={`relative ${compact ? "h-[40vh]" : "h-screen"} min-h-[400px] overflow-hidden`}>
      {/* Background Image - LCP Element */}
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="מספרה בדבוריה - המספרה הכי מקצועית בצפון ישראל - تספורות לגברים וילדים - صالون حلاقة دبورية - BARBERSHOP Daburiyya Nazareth Afula" 
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="hero-overlay" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black tracking-wider mb-2 animate-fade-in font-serif">
          {BARBERSHOP_CONFIG.name}
        </h1>
        <p style={{
        animationDelay: "0.1s"
      }} className="text-xl md:text-2xl text-muted-foreground mb-8 animate-fade-in font-serif">
          by {BARBERSHOP_CONFIG.owner}
        </p>

        {/* Info Bar */}
        <div className="flex flex-wrap justify-center gap-8 mb-10 animate-fade-in" style={{
        animationDelay: "0.2s"
      }}>
          <a href={`tel:${BARBERSHOP_CONFIG.phone}`} className="cursor-pointer hover:opacity-80 transition-opacity">
            <InfoItem icon={<Phone className="w-6 h-6" />} text={BARBERSHOP_CONFIG.phone} />
          </a>
          <InfoItem icon={<Clock className="w-6 h-6" />} text={`${BARBERSHOP_CONFIG.hours} א'-ו'`} />
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BARBERSHOP_CONFIG.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <InfoItem icon={<MapPin className="w-6 h-6" />} text={BARBERSHOP_CONFIG.location} />
          </a>
        </div>

        {/* Book Button */}
        {!compact && <button onClick={onBookClick} className="btn-gold text-lg animate-fade-in" style={{
        animationDelay: "0.3s"
      }}>
            קביעת תור
          </button>}

        {/* Privacy Policy Link */}
        <a 
          href="/privacy-policy" 
          className="absolute bottom-4 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          מדיניות פרטיות
        </a>
      </div>
    </section>;
}
function InfoItem({
  icon,
  text
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return <div className="flex flex-col items-center gap-2">
      <div className="text-muted-foreground font-serif">{icon}</div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>;
}
