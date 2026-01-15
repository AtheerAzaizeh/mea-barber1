import { useNavigate } from "react-router-dom";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/barbershop-daburiyya-israel-haircut.webp";

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin onLogin={signIn} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">אין לך הרשאות מנהל</p>
          <p className="text-sm text-muted-foreground">
            צור קשר עם מנהל המערכת להקצאת הרשאות
          </p>
          <button
            onClick={async () => {
              await signOut();
            }}
            className="btn-gold"
          >
            התנתק
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mini Hero */}
      <section className="relative h-[25vh] min-h-[200px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="מספרה בדבוריה - ניהול תורים BARBERSHOP"
            className="w-full h-full object-cover"
          />
          <div className="hero-overlay" />
        </div>
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-wider mb-2">
            BARBERSHOP
          </h1>
          <p className="text-lg text-muted-foreground">by Mohammad Eyad</p>
        </div>
      </section>

      {/* Admin Content */}
      <AdminCalendar
        onLogout={async () => {
          await signOut();
        }}
      />
    </div>
  );
};

export default Admin;
