import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Users,
  UserCheck,
  UserX,
  Clock,
  Filter,
  Grid3X3,
  List,
  Sparkles,
  RefreshCw,
  Loader2,
  Globe
} from "lucide-react";
import { PartnerCard } from "./PartnerCard";
import { EditPartnerDialog } from "./EditPartnerDialog";
import { AddAgencyDialog } from "./AddAgencyDialog";
import { PartnerProfileDialog } from "./PartnerProfileDialog"; // [NEW]
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Agency } from "@/types/agency";

const filterableFields = ['specializations', 'platforms', 'revenue_estimate'];

export function PartnerDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ [key: string]: string }>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Dialog States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); // [NEW]
  const [isEnriching, setIsEnriching] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Agency | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ... (Query Logic remains same)
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Error fetching agencies",
          description: error.message,
          variant: "destructive",
        });
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

  // ... (Filter Logic remains same)
  // Filter and search partners
  const filteredPartners = useMemo(() => {
    if (!partners) return [];

    return partners.filter(partner => {
      const searchableText = [
        partner.name,
        partner.website,
        partner.description,
        partner.revenue_estimate
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm.toLowerCase());

      const matchesFilters = Object.entries(activeFilters).every(([field, value]) => {
        if (value === 'all') return true;
        return partner[field] === value;
      });

      return matchesSearch && matchesFilters;
    });
  }, [partners, searchTerm, activeFilters]);

  // ... (Stats and FilterOptions remain same)
  const stats = useMemo(() => {
    const total = partners.length;
    const active = total; // Mock
    const inactive = 0;
    const pending = 0;
    return { total, active, inactive, pending };
  }, [partners]);

  // filterableFields moved outside component

  const filterOptions = useMemo(() => {
    const options: { [key: string]: string[] } = {};
    filterableFields.forEach(field => {
      const allValues = partners.flatMap(p => {
        const val = p[field];
        return Array.isArray(val) ? val : [val];
      }).filter(Boolean);
      options[field] = [...new Set(allValues)];
    });
    return options;
  }, [partners]);

  // Handlers
  const handleViewProfile = (partner: Agency) => {
    setSelectedPartner(partner);
    setIsProfileOpen(true);
  };

  const handleEditPartner = (partner: Agency) => {
    setSelectedPartner(partner);
    setIsEditOpen(true);
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    toast({
      title: "Syncing agencies",
      description: "Triggering background refresh of all agency data...",
    });

    // In a real environment, this might call a backend endpoint. 
    // Here we trigger handleEnrichData for all stale ones.
    await handleEnrichData(true);
    setIsSyncing(false);
  };

  const handleEnrichData = async (all = false) => {
    const targetAgencies = all
      ? partners
      : partners.filter(p => (p.website || p.name) && (!p.last_analyzed || !p.description || (!p.revenue_estimate && !!p.website) || p.name === p.website));

    if (targetAgencies.length === 0) {
      toast({
        title: "Nothing to enrich",
        description: "All agencies already have up-to-date details.",
      });
      return;
    }

    setIsEnriching(true);
    toast({
      title: "Enrichment started",
      description: `Updating ${targetAgencies.length} agencies...`,
    });

    let updatedCount = 0;

    for (const partner of targetAgencies) {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
          body: {
            url: partner.website || undefined,
            name: !partner.website ? partner.name : undefined,
            autoSelect: true
          }
        });

        if (error) throw error;

        // Prepare update object with all enriched fields
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

        // Update database with comprehensive data
        await supabase
          .from('agencies')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(updateData as any)
          .eq('id', partner.id);

        updatedCount++;

        console.log(`Enriched ${partner.name || partner.website}: ${Object.keys(updateData).join(', ')}`);
      } catch (e) {
        console.error(`Failed to enrich ${partner.name}:`, e);
      }
    }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["agencies"] });
    toast({
      title: "Enrichment complete",
      description: `Successfully updated ${updatedCount} agencies.`,
    });
  };

  const handleDiscoverExternal = async () => {
    if (!searchTerm) return;

    setIsEnriching(true);
    toast({
      title: "Searching Web",
      description: `Looking for details for "${searchTerm}"...`,
    });

    try {
      const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
        body: {
          name: searchTerm,
          autoSelect: true
        }
      });

      if (error) throw error;

      // Add to platform
      const { data: insertData, error: insertError } = await supabase
        .from('agencies')
        .insert({
          name: data.name || searchTerm,
          website: data.website,
          description: data.description,
          revenue_estimate: data.revenue,
          specializations: data.specializations,
          platforms: data.platforms,
          clients: data.clients,
          awards: data.awards,
          directors: data.directors,
          last_analyzed: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Agency Discovered",
        description: `Successfully added ${data.name || searchTerm} to the platform.`,
      });

      setSearchTerm('');
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
    } catch (e: any) {
      toast({
        title: "Discovery Failed",
        description: e.message || "Could not find agency details.",
        variant: "destructive"
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSavePartner = async (updatedPartner: Agency) => {
    // ... (Update logic same)
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
      toast({ title: "Partner updated", description: `${updatedPartner.name} updated.` });
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeletePartner = async (partnerToDelete: Agency) => {
    if (!confirm(`Are you sure you want to delete "${partnerToDelete.name || partnerToDelete.website}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', partnerToDelete.id);

      if (error) throw error;

      toast({
        title: "Partner deleted",
        description: `${partnerToDelete.name || partnerToDelete.website} has been deleted.`
      });
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards - SAME */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{stats.active}</div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning">{stats.pending}</div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div></CardContent>
        </Card>
      </div>

      {/* Controls - SAME */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search partners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {filterableFields.map(field => (
            <Select
              key={field}
              value={activeFilters[field] || 'all'}
              onValueChange={(value) => setActiveFilters(prev => ({ ...prev, [field]: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={`Filter ${field.replace('_', ' ')}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {field.replace('_', ' ')}</SelectItem>
                {(filterOptions[field] || []).map(value => (
                  <SelectItem key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggles (Grid/List) */}
          <div className="flex border rounded-md mr-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              className="gap-2"
              disabled={isSyncing}
            >
              {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEnrichData(false)}
              className="gap-2"
              disabled={isEnriching}
            >
              {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isEnriching ? "Enriching..." : "Enrich Incomplete"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/bento'} className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              Try Bento Grid
            </Button>
          </div>
          <AddAgencyDialog />
        </div>
      </div>

      {/* Partners Display */}
      {filteredPartners.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No partners found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || Object.values(activeFilters).some(f => f !== 'all')
                ? `No results for "${searchTerm}". Would you like to check the web?`
                : "Add your first agency"}
            </p>
            {searchTerm ? (
              <Button onClick={handleDiscoverExternal} className="gap-2" disabled={isEnriching}>
                {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Discover External Agency
              </Button>
            ) : !Object.values(activeFilters).some(f => f !== 'all') && <AddAgencyDialog />}
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filteredPartners.map((partner) => (
            <div key={partner.id} className="animate-slide-up h-full">
              <PartnerCard
                partner={partner}
                onViewProfile={handleViewProfile}
                onEdit={handleEditPartner}
                onDelete={handleDeletePartner}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <EditPartnerDialog
        partner={selectedPartner}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSave={handleSavePartner}
      />

      <PartnerProfileDialog // [NEW]
        partner={selectedPartner}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
      />
    </div>
  );
}