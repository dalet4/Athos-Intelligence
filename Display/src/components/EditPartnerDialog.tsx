import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, Merge, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { Agency } from "@/types/agency";

type Partner = Agency;

interface EditPartnerDialogProps {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedPartner: Partner) => void;
}

// Helper function to calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const costs = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}

// Calculate similarity percentage
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return ((maxLength - distance) / maxLength) * 100;
}

// Normalize domain from URL
function normalizeDomain(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
  }
}

export function EditPartnerDialog({ partner, open, onOpenChange, onSave }: EditPartnerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [findingDuplicates, setFindingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<Partner[]>([]);
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Initialize form data with partial Agency type to allow for empty/default state
  const [formData, setFormData] = useState<Partial<Agency>>(() =>
    partner || { name: '', website: '', description: '', revenue_estimate: '' }
  );

  // Update form data when partner changes
  useEffect(() => {
    if (partner) {
      setFormData(partner);
      setDuplicates([]);
      setDismissedDuplicates(new Set());
    }
  }, [partner]);

  const findDuplicates = async () => {
    if (!formData.id) return;

    setFindingDuplicates(true);
    try {
      // Fetch all agencies - cast response to match our Agency interface
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .neq('id', formData.id);

      if (error) throw error;

      const allAgencies = data as unknown as Agency[];

      if (error) throw error;

      if (!allAgencies) {
        setDuplicates([]);
        return;
      }

      // Find potential duplicates
      const potentialDuplicates = allAgencies.filter((agency: Partner) => {
        // Check website domain match
        if (formData.website && agency.website) {
          const currentDomain = normalizeDomain(formData.website);
          const agencyDomain = normalizeDomain(agency.website);
          if (currentDomain === agencyDomain && currentDomain !== '') {
            return true;
          }
        }

        // Check name similarity (>80% similar)
        if (formData.name && agency.name) {
          const similarity = calculateSimilarity(formData.name, agency.name);
          if (similarity > 80) {
            return true;
          }
        }

        return false;
      });

      setDuplicates(potentialDuplicates);

      if (potentialDuplicates.length === 0) {
        toast({
          title: "No duplicates found",
          description: "No potential duplicate partners detected.",
        });
      } else {
        toast({
          title: "Duplicates found",
          description: `Found ${potentialDuplicates.length} potential duplicate${potentialDuplicates.length > 1 ? 's' : ''}.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error finding duplicates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFindingDuplicates(false);
    }
  };

  const mergeWithDuplicate = async (duplicate: Partner) => {
    try {
      // Merge data - prefer non-null values, combine arrays
      const mergedData: any = { ...formData };

      // Merge simple fields (prefer non-null)
      ['name', 'website', 'description', 'revenue_estimate'].forEach(field => {
        if (!mergedData[field] && duplicate[field]) {
          mergedData[field] = duplicate[field];
        }
      });

      // Merge array fields (combine and deduplicate)
      const arrayFields = ['specializations', 'platforms', 'partners', 'clients', 'case_studies', 'directors', 'awards'];
      arrayFields.forEach(field => {
        if (Array.isArray(duplicate[field]) || Array.isArray(mergedData[field])) {
          const current = Array.isArray(mergedData[field]) ? mergedData[field] : [];
          const dup = Array.isArray(duplicate[field]) ? duplicate[field] : [];

          // For simple arrays (strings), deduplicate
          if (field === 'specializations' || field === 'platforms' || field === 'partners') {
            mergedData[field] = [...new Set([...current, ...dup])];
          } else {
            // For complex arrays (objects), combine
            mergedData[field] = [...current, ...dup];
          }
        }
      });

      // Update the current partner with merged data
      const { error: updateError } = await supabase
        .from('agencies')
        .update(mergedData)
        .eq('id', formData.id);

      if (updateError) throw updateError;

      // Delete the duplicate
      const { error: deleteError } = await supabase
        .from('agencies')
        .delete()
        .eq('id', duplicate.id);

      if (deleteError) throw deleteError;

      // Update local state
      setFormData(mergedData);
      setDuplicates(prev => prev.filter(d => d.id !== duplicate.id));

      toast({
        title: "Partners merged",
        description: `Successfully merged with "${duplicate.name || duplicate.website}".`,
      });

      // Notify parent to refresh
      onSave(mergedData);
    } catch (error: any) {
      toast({
        title: "Merge failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteDuplicate = async (duplicate: Partner) => {
    if (!confirm(`Are you sure you want to delete "${duplicate.name || duplicate.website}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', duplicate.id);

      if (error) throw error;

      setDuplicates(prev => prev.filter(d => d.id !== duplicate.id));

      toast({
        title: "Duplicate deleted",
        description: `"${duplicate.name || duplicate.website}" has been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const dismissDuplicate = (duplicateId: string) => {
    setDismissedDuplicates(prev => new Set([...prev, duplicateId]));
  };

  const handleAutoFill = async () => {
    if (!formData.website) {
      toast({
        title: "URL required",
        description: "Please enter a website URL first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
        body: { url: formData.website }
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          description: data.description || prev.description,
          revenue_estimate: data.revenue || prev.revenue_estimate,
        }));
        toast({
          title: "Auto-filled from website",
          description: "Agency details have been populated.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Auto-fill failed",
        description: error.message || "Could not fetch website details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave(formData as Agency);
    onOpenChange(false);
  };

  const handleInputChange = (field: keyof Partner, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!partner) return null;

  const visibleDuplicates = duplicates.filter(d => !dismissedDuplicates.has(d.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Partner</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Partner name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="flex gap-2">
              <Input
                id="website"
                value={formData.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://example.com"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAutoFill}
                disabled={loading || !formData.website}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading
                  </>
                ) : (
                  "Auto-fill"
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenue_estimate">Revenue Estimate</Label>
            <Input
              id="revenue_estimate"
              value={formData.revenue_estimate || ''}
              onChange={(e) => handleInputChange('revenue_estimate', e.target.value)}
              placeholder="$1M - $5M"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description..."
              rows={4}
            />
          </div>

          {/* Duplicate Detection Section */}
          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Duplicate Detection</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={findDuplicates}
                disabled={findingDuplicates || !formData.id}
              >
                {findingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Find Duplicates
                  </>
                )}
              </Button>
            </div>

            {visibleDuplicates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Found {visibleDuplicates.length} potential duplicate{visibleDuplicates.length > 1 ? 's' : ''}:
                </p>
                {visibleDuplicates.map((duplicate) => (
                  <Card key={duplicate.id} className="border-warning/50 bg-warning/5">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">
                              {duplicate.name || 'Unnamed'}
                            </h4>
                            {duplicate.website && (
                              <p className="text-xs text-muted-foreground truncate">
                                {duplicate.website}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => dismissDuplicate(duplicate.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {duplicate.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {duplicate.description}
                          </p>
                        )}

                        <div className="flex gap-2">
                          {duplicate.revenue_estimate && (
                            <Badge variant="secondary" className="text-xs">
                              {duplicate.revenue_estimate}
                            </Badge>
                          )}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => mergeWithDuplicate(duplicate)}
                            className="flex-1"
                          >
                            <Merge className="h-3 w-3 mr-1" />
                            Merge
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteDuplicate(duplicate)}
                            className="flex-1"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name?.trim() && !formData.website?.trim()}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}