import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";
import { Agency } from "@/types/agency";

interface PartnerCardProps {
  partner: Agency;
  onViewProfile: (partner: Agency) => void;
}

export function PartnerCard({ partner, onViewProfile }: PartnerCardProps) {
  // use real data
  const partners = partner.partners || [];
  const services = partner.specializations || [];

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm group">
      <CardContent className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
              {partner.name}
            </h3>
            {partner.revenue_estimate && (
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-green-600 bg-green-50 border-green-200">
                {partner.revenue_estimate}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
            {partner.description || "No description available."}
          </p>
        </div>

        {/* Tags (Services) - Limit to 3 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {services.slice(0, 3).map((tag, idx) => (
            <Badge key={idx} variant="secondary" className="bg-secondary/50 text-xs font-normal">
              {tag}
            </Badge>
          ))}
          {services.length > 3 && (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              +{services.length - 3}
            </Badge>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-border/50 space-y-4">

          {/* Notable Partners Row */}
          {partners && partners.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Notable Partners</h4>
              <div className="flex gap-3 overflow-hidden">
                {partners.slice(0, 3).map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap bg-muted/30 px-2 py-1 rounded">
                    <Building2 className="h-3 w-3" /> {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all group/btn"
            onClick={() => onViewProfile(partner)}
          >
            View Partner Profile
            <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
          </Button>

        </div>
      </CardContent>
    </Card>
  );
}