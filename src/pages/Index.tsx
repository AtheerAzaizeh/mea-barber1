import { useState, useRef } from "react";
import { HeroSection } from "@/components/booking/HeroSection";
import { BookingForm } from "@/components/booking/BookingForm";

const Index = () => {
  const [showBooking, setShowBooking] = useState(false);
  const bookingRef = useRef<HTMLDivElement>(null);

  const handleBookClick = () => {
    setShowBooking(true);
    // Scroll to booking form
    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <HeroSection onBookClick={handleBookClick} compact={showBooking} />
      
      {showBooking && (
        <div ref={bookingRef}>
          <BookingForm onClose={() => setShowBooking(false)} />
        </div>
      )}
    </div>
  );
};

export default Index;
