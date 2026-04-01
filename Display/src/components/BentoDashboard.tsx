import { useState, useEffect } from "react";
import { Plus, Search, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PartnerProfileDialog } from "./PartnerProfileDialog";

import { Agency } from "@/types/agency";
import { AddAgencyDialog } from "./AddAgencyDialog";
import { SettingsDialog, loadModelSettings } from "./SettingsDialog";

export const BentoDashboard = () => {
  const [selectedPartner, setSelectedPartner] = useState<Agency | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEnriching, setIsEnriching] = useState(false);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      console.log("Fetching partners...");
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name");

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      // Deduplicate: agencies that are group members may appear multiple times
      const seen = new Set<string>();
      const deduped = (data as unknown as Agency[]).filter(agency => {
        const key = agency.website
          ? agency.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
          : agency.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return deduped;
    },
  });



  const handleEnrichData = async () => {
    // Only enrich if partners exist
    if (!partners || partners.length === 0) return;

    const incompletePartners = partners.filter(
      p => (p.website || p.name) && (!p.last_analyzed || !p.description || (!p.revenue_estimate && !!p.website) || p.name === p.website)
    );

    if (incompletePartners.length === 0) {
      toast({
        title: "Nothing to enrich",
        description: "All agencies with websites already have details.",
      });
      return;
    }

    setIsEnriching(true);
    toast({
      title: "Enrichment started",
      description: `Updating ${incompletePartners.length} agencies...`,
    });

    let updatedCount = 0;

    for (const partner of incompletePartners) {
      try {
        const { structured_extraction: model } = loadModelSettings();
        const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
          body: {
            url: partner.website || undefined,
            name: !partner.website ? partner.name : undefined,
            autoSelect: true,
            model,
          }
        });

        if (error) throw error;

        // Prepare update object
        const updateData: Partial<Agency> = {
          name: data.name || partner.name,
          website: data.website || partner.website,
          description: data.description || partner.description,
          revenue_estimate: data.revenue || partner.revenue_estimate,
          last_analyzed: new Date().toISOString(),
        };

        // Add newly extracted comprehensive fields
        if (data.clients) updateData.clients = data.clients;
        if (data.awards) updateData.awards = data.awards;
        if (data.directors) updateData.directors = data.directors;
        if (data.partner_managers) updateData.partner_managers = data.partner_managers;
        if (data.case_studies) updateData.case_studies = data.case_studies;
        if (data.partners) updateData.partners = data.partners;
        if (data.specializations) updateData.specializations = data.specializations;
        if (data.platforms) updateData.platforms = data.platforms;

        await supabase
          .from('agencies')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(updateData as any)
          .eq('id', partner.id);

        updatedCount++;
      } catch (e) {
        console.error(`Failed to enrich ${partner.name}:`, e);
      }
    }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["partners"] });
    toast({
      title: "Enrichment complete",
      description: `Successfully updated ${updatedCount} agencies.`,
    });
  };

  const filteredPartners = partners?.filter(partner =>
    partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.specializations?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agencies, services..."
            className="pl-9 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <SettingsDialog />

          <Button
            variant="outline"
            onClick={handleEnrichData}
            disabled={isEnriching}
            className="gap-2 shadow-sm hover:shadow-md transition-all duration-300"
          >
            {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-purple-500" />}
            {isEnriching ? "Enriching..." : "Enrich Data"}
          </Button>

          <AddAgencyDialog>
            <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300">
              <Plus className="h-4 w-4" />
              Add Agency
            </Button>
          </AddAgencyDialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading partners...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPartners?.map((partner) => (
            <Card
              key={partner.id}
              className="group hover:scale-[1.02] transition-transform duration-300 cursor-pointer shadow-card hover:shadow-elegant border-border/50 bg-white overflow-hidden"
              onClick={() => setSelectedPartner(partner)}
            >
              <CardHeader className="space-y-1 pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate min-w-0">
                    {partner.name}
                  </CardTitle>
                  {partner.revenue_estimate && (
                    <Badge variant="outline" className="text-[10px] font-bold text-green-700 bg-green-50 border-green-200 uppercase shrink-0">
                      {partner.revenue_estimate}
                    </Badge>
                  )}
                </div>
                {partner.specializations && partner.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {partner.specializations.slice(0, 3).map((spec, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        {spec}
                      </span>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">
                  {partner.description || "No description available."}
                </p>

                {/* Micro-Stats Row */}
                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Team</span>
                    <span className="text-sm font-bold text-slate-700">{partner.directors?.length || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Awards</span>
                    <span className="text-sm font-bold text-yellow-600">{partner.awards?.length || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cases</span>
                    <span className="text-sm font-bold text-slate-700">{partner.case_studies?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New Card (Ghost) */}
          <AddAgencyDialog>
            <div
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary/50 hover:bg-slate-50/50 transition-colors cursor-pointer group min-h-[200px]"
            >
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="h-6 w-6 text-slate-400 group-hover:text-primary" />
              </div>
              <span className="font-semibold text-slate-500 group-hover:text-primary">Add Agency</span>
            </div>
          </AddAgencyDialog>
        </div>
      )}



      {selectedPartner && (
        <PartnerProfileDialog
          partner={selectedPartner}
          open={!!selectedPartner}
          onOpenChange={(open) => !open && setSelectedPartner(null)}
        />
      )}
    </div>
  );
};