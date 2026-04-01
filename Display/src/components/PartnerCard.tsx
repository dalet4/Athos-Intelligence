import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Agency } from "@/types/agency";

interface PartnerCardProps {
  partner: Agency;
  onViewProfile: (partner: Agency) => void;
  onEdit: (partner: Agency) => void;
  onDelete: (partner: Agency) => void;
}

export function PartnerCard({ partner, onViewProfile, onEdit, onDelete }: PartnerCardProps) {
  // use real data
  const partners = partner.partners || [];
  const services = partner.specializations || [];

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm group">
      <CardContent className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                {partner.name}
              </h3>
              {partner.parent_company && (
                <p className="text-[11px] font-medium text-primary uppercase tracking-tight -mt-1 mb-1">
                  Part of {partner.parent_company}
                </p>
              )}
            </div>
            <div className="flex gap-2 items-start">
              {partner.lead_score !== undefined && partner.lead_score !== null && (
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-bold ${partner.lead_score >= 70 ? "bg-green-50 text-green-600 border-green-200" :
                    partner.lead_score >= 40 ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                      "bg-red-50 text-red-600 border-red-200"
                    }`}
                  title={`Breakdown: Rev: ${partner.score_breakdown?.revenue}, Growth: ${partner.score_breakdown?.growth}, Align: ${partner.score_breakdown?.alignment}, Comp: ${partner.score_breakdown?.competition}, Group: ${partner.score_breakdown?.group_bonus || 0}`}
                >
                  Score: {partner.lead_score}
                </Badge>
              )}
              {partner.revenue_estimate && (
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/30 border-muted-foreground/20">
                  {partner.revenue_estimate}
                </Badge>
              )}
            </div>
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

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 text-destructive hover:bg-destructive hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(partner);
              }}
              title="Delete Agency"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(partner);
              }}
              title="Edit Agency"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all group/btn"
              onClick={() => onViewProfile(partner)}
            >
              View Partner Profile
              <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}