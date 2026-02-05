import { useState, useEffect } from "react";
import { Plus, Search, Filter, Trash2, ArrowUpDown } from "lucide-react";
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

export const BentoDashboard = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Agency | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Partial for new agency creation
  const [newAgency, setNewAgency] = useState({
    name: "",
    website: "",
    description: "",
  });

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
      return data as unknown as Agency[];
    },
  });

  const handleAddAgency = async () => {
    try {
      const { error } = await supabase
        .from("agencies")
        .insert([newAgency]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agency added successfully",
      });
      setIsAddDialogOpen(false);
      setNewAgency({ name: "", website: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add agency",
        variant: "destructive",
      });
    }
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

        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2"
          >
            View as List
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300">
            <Plus className="h-4 w-4" />
            Add Agency
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading partners...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPartners?.map((partner) => (
            <Card
              key={partner.id}
              className="group hover:scale-[1.02] transition-transform duration-300 cursor-pointer shadow-card hover:shadow-elegant border-border/50 bg-white"
              onClick={() => setSelectedPartner(partner)}
            >
              <CardHeader className="space-y-1 pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
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
          <div
            onClick={() => setIsAddDialogOpen(true)}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary/50 hover:bg-slate-50/50 transition-colors cursor-pointer group min-h-[200px]"
          >
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="h-6 w-6 text-slate-400 group-hover:text-primary" />
            </div>
            <span className="font-semibold text-slate-500 group-hover:text-primary">Add Agency</span>
          </div>
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Agency</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Agency Name</Label>
              <Input
                id="name"
                value={newAgency.name}
                onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={newAgency.website}
                onChange={(e) => setNewAgency({ ...newAgency, website: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newAgency.description}
                onChange={(e) => setNewAgency({ ...newAgency, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAgency}>Add Agency</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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