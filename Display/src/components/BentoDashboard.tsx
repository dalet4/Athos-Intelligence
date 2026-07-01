import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Sparkles, Loader2, Pencil, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PartnerProfileDialog } from "./PartnerProfileDialog";
import { EditPartnerDialog } from "./EditPartnerDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Agency } from "@/types/agency";
import { AddAgencyDialog } from "./AddAgencyDialog";
import { SettingsDialog, loadModelSettings } from "./SettingsDialog";

const FILTER_FIELDS = ['specializations', 'platforms'] as const;

export const BentoDashboard = () => {
  const [selectedPartner, setSelectedPartner] = useState<Agency | null>(null);
  const [editPartner, setEditPartner] = useState<Agency | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    supabase.from("usage_events").insert({ event_type: "visit" });
  }, []);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name");

      if (error) throw error;

      const seen = new Set<string>();
      return (data as unknown as Agency[]).filter(agency => {
        const key = agency.website
          ? agency.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
          : agency.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    FILTER_FIELDS.forEach(field => {
      const vals = (partners ?? []).flatMap(p => {
        const v = p[field as keyof Agency];
        return Array.isArray(v) ? v : [];
      }).filter(Boolean) as string[];
      options[field] = [...new Set(vals)].sort();
    });
    return options;
  }, [partners]);

  const filteredPartners = useMemo(() => {
    return (partners ?? []).filter(partner => {
      const matchesSearch =
        !searchQuery ||
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.specializations?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilters = Object.entries(activeFilters).every(([field, value]) => {
        if (!value || value === 'all') return true;
        const arr = partner[field as keyof Agency];
        return Array.isArray(arr) && arr.includes(value);
      });

      return matchesSearch && matchesFilters;
    });
  }, [partners, searchQuery, activeFilters]);

  const handleEnrichData = async () => {
    if (!partners || partners.length === 0) return;

    const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    const ENRICHABLE_FIELDS = ['description', 'revenue_estimate', 'clients', 'awards', 'directors', 'partner_managers', 'case_studies', 'partners', 'specializations', 'platforms'] as const;
    const incompletePartners = partners.filter(
      p => (p.website || p.name) && ENRICHABLE_FIELDS.some(f => isEmpty(p[f as keyof Agency]))
    );

    if (incompletePartners.length === 0) {
      toast({ title: "Nothing to enrich", description: "All agencies already have details." });
      return;
    }

    setIsEnriching(true);
    supabase.from("usage_events").insert({
      event_type: "manual_enrich",
      metadata: { count: incompletePartners.length },
    });
    toast({ title: "Enrichment started", description: `Updating ${incompletePartners.length} agencies...` });
    let updatedCount = 0;

    for (const partner of incompletePartners) {
      try {
        const { structured_extraction: model } = loadModelSettings();
        const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
          body: { url: partner.website || undefined, name: !partner.website ? partner.name : undefined, autoSelect: true, model, existingData: partner }
        });

        if (error) throw error;
        if (data?._skipped) continue;

        const updateData: Partial<Agency> = { last_analyzed: new Date().toISOString() };
        if (!partner.description && data.description) updateData.description = data.description;
        if (!partner.revenue_estimate && data.revenue_estimate) updateData.revenue_estimate = data.revenue_estimate;
        if ((!partner.clients || partner.clients.length === 0) && data.clients?.length) updateData.clients = data.clients;
        if ((!partner.awards || partner.awards.length === 0) && data.awards?.length) updateData.awards = data.awards;
        if ((!partner.directors || partner.directors.length === 0) && data.directors?.length) updateData.directors = data.directors;
        if ((!partner.partner_managers || partner.partner_managers.length === 0) && data.partner_managers?.length) updateData.partner_managers = data.partner_managers;
        if ((!partner.case_studies || partner.case_studies.length === 0) && data.case_studies?.length) updateData.case_studies = data.case_studies;
        if ((!partner.partners || partner.partners.length === 0) && data.partners?.length) updateData.partners = data.partners;
        if ((!partner.specializations || partner.specializations.length === 0) && data.specializations?.length) updateData.specializations = data.specializations;
        if ((!partner.platforms || partner.platforms.length === 0) && data.platforms?.length) updateData.platforms = data.platforms;

        await supabase.from('agencies').update(updateData as any).eq('id', partner.id);
        updatedCount++;
      } catch (e) {
        console.error(`Failed to enrich ${partner.name}:`, e);
      }
    }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["partners"] });
    toast({ title: "Enrichment complete", description: `Successfully updated ${updatedCount} agencies.` });
  };

  const handleSaveEdit = async (updatedPartner: Agency) => {
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          name: updatedPartner.name,
          website: updatedPartner.website,
          description: updatedPartner.description,
          revenue_estimate: updatedPartner.revenue_estimate,
        })
        .eq('id', updatedPartner.id);

      if (error) throw error;
      toast({ title: "Saved", description: `${updatedPartner.name} updated.` });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (partner: Agency, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${partner.name || partner.website}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('agencies').delete().eq('id', partner.id);
      if (error) throw error;
      toast({ title: "Deleted", description: `${partner.name} removed.` });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4">
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

        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          {FILTER_FIELDS.map(field => (
            <Select
              key={field}
              value={activeFilters[field] || 'all'}
              onValueChange={(value) => setActiveFilters(prev => ({ ...prev, [field]: value }))}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder={`Filter ${field}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {field}</SelectItem>
                {(filterOptions[field] ?? []).map(val => (
                  <SelectItem key={val} value={val}>{val}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {Object.values(activeFilters).some(v => v && v !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => setActiveFilters({})}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="text-center py-8">Loading partners...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPartners.map((partner) => (
            <Card
              key={partner.id}
              className="group hover:scale-[1.02] transition-transform duration-300 cursor-pointer shadow-card hover:shadow-elegant border-border/50 bg-white overflow-hidden"
              onClick={() => setSelectedPartner(partner)}
            >
              <CardHeader className="space-y-1 pb-2">
                {/* Name always on its own line */}
                <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                  {partner.name}
                </CardTitle>
                {/* Badges + action buttons on second line */}
                <div className="flex items-center gap-1 flex-wrap">
                  {partner.lead_score != null && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${
                        partner.lead_score >= 70 ? "bg-green-50 text-green-600 border-green-200" :
                        partner.lead_score >= 40 ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                        "bg-red-50 text-red-600 border-red-200"
                      }`}
                    >
                      Score: {partner.lead_score}
                    </Badge>
                  )}
                  {partner.revenue_estimate && (
                    <Badge variant="outline" className="text-[10px] font-bold text-green-700 bg-green-50 border-green-200 uppercase">
                      {partner.revenue_estimate.split('(')[0].trim()}
                    </Badge>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setEditPartner(partner); }}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(partner, e)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {partner.specializations && partner.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
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

          <AddAgencyDialog>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary/50 hover:bg-slate-50/50 transition-colors cursor-pointer group min-h-[200px]">
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

      <EditPartnerDialog
        partner={editPartner}
        open={!!editPartner}
        onOpenChange={(open) => !open && setEditPartner(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
};
