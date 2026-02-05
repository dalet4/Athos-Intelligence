import { PartnerDashboard } from "@/components/PartnerDashboard";
import heroImage from "@/assets/hero-dashboard.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="relative gradient-hero">
          <div className="container mx-auto px-4 py-16">
            <div className="text-center text-white">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Partner Intelligence
              </h1>
              <p className="text-xl text-white/90 max-w-2xl mx-auto">
                Overview of your agency ecosystem.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <PartnerDashboard />
      </div>
    </div>
  );
};

export default Index;
