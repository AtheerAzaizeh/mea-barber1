import { Phone, Clock, MapPin } from "lucide-react";
import { BARBERSHOP_CONFIG } from "@/lib/constants";
import heroImage from "@/assets/hero-barbershop.jpg";
interface HeroSectionProps {
  onBookClick: () => void;
  compact?: boolean;
}
export function HeroSection({
  onBookClick,
  compact = false
}: HeroSectionProps) {
  return <section className={`relative ${compact ? "h-[40vh]" : "h-screen"} min-h-[400px] overflow-hidden`}>
      {/* Background Image */}
      <div className="absolute inset-0">
        <img src={heroImage} alt="Barbershop" className="w-full h-full object-cover" />
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
          <InfoItem icon={<Phone className="w-6 h-6" />} text={BARBERSHOP_CONFIG.phone} />
          <InfoItem icon={<Clock className="w-6 h-6" />} text={`${BARBERSHOP_CONFIG.hours} א'-ו'`} />
          <InfoItem icon={<MapPin className="w-6 h-6" />} text={BARBERSHOP_CONFIG.location} />
        </div>

        {/* Book Button */}
        {!compact && <button onClick={onBookClick} className="btn-gold text-lg animate-fade-in" style={{
        animationDelay: "0.3s"
      }}>
            קביעת תור
          </button>}
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