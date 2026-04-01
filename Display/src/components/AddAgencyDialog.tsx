import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";

export function AddAgencyDialog({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        website: "",
        description: "",
        revenue_estimate: "",
    });

    // Add state for company disambiguation
    const [companyOptions, setCompanyOptions] = useState<{ title: string, company_number: string, address: string }[]>([]);
    const [selectedCompanyNumber, setSelectedCompanyNumber] = useState<string>("");

    const queryClient = useQueryClient();
    const { toast } = useToast();

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.from("agencies").insert({
                name: formData.name,
                website: formData.website || null,
                description: formData.description || null,
                revenue_estimate: formData.revenue_estimate || null,
                // Default empty arrays for array fields to avoid null issues if UI expects arrays
                specializations: [],
                platforms: [],
                clients: [],
                case_studies: [],
            });

            if (error) throw error;

            toast({
                title: "Agency added",
                description: `${formData.name} has been added to the database.`,
            });

            queryClient.invalidateQueries({ queryKey: ["agencies"] });
            setOpen(false);
            setFormData({ name: "", website: "", description: "", revenue_estimate: "" });
            setCompanyOptions([]);
            setSelectedCompanyNumber("");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to add agency",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Agency
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add New Agency</DialogTitle>
                    <DialogDescription>Enter the agency details below. Use Auto-fill to fetch details from a website.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                            placeholder="Agency Name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <div className="flex gap-2">
                            <Input
                                id="website"
                                type="url"
                                value={formData.website}
                                onChange={(e) => handleInputChange("website", e.target.value)}
                                placeholder="https://example.com"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                    if (!formData.website && !formData.name) {
                                        toast({
                                            title: "Name or URL required",
                                            description: "Please enter a website URL or agency name first.",
                                            variant: "destructive",
                                        });
                                        return;
                                    }

                                    setLoading(true);
                                    try {
                                        const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
                                            body: {
                                                // Support taking from memory if a disambiguation selected, else generic
                                                url: formData.website || undefined,
                                                name: !formData.website ? formData.name : undefined,
                                                companyNumber: selectedCompanyNumber || undefined
                                            }
                                        });

                                        if (error) throw error;

                                        // Handle disambiguation case
                                        if (data?.action === 'select_company') {
                                            setCompanyOptions(data.companies);
                                            toast({
                                                title: "Multiple matches found",
                                                description: "Please select the correct company from the list below.",
                                            });
                                            return;
                                        }

                                        // Success fetching final data
                                        setFormData(prev => ({
                                            ...prev,
                                            name: data.name || prev.name,
                                            description: data.description || prev.description,
                                        }));

                                        // Clear out options if we arrived from them
                                        setCompanyOptions([]);

                                        toast({
                                            title: "Details fetched",
                                            description: "Agency details have been auto-filled.",
                                        });

                                    } catch (error: any) {
                                        console.error('Fetch error:', error);
                                        toast({
                                            title: "Error fetching details",
                                            description: error.message || "Could not fetch agency details.",
                                            variant: "destructive",
                                        });
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading || (!formData.website && !formData.name)}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Auto-fill"}
                            </Button>
                        </div>
                    </div>

                    {companyOptions.length > 0 && (
                        <div className="space-y-3 pt-4 pb-4 border-t border-b">
                            <Label className="text-sm font-semibold text-primary">
                                Multiple matches found. Select correct company:
                            </Label>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {companyOptions.map((co) => (
                                    <div
                                        key={co.company_number}
                                        className={`flex items-start space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${selectedCompanyNumber === co.company_number
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:bg-slate-50"
                                            }`}
                                        onClick={() => setSelectedCompanyNumber(co.company_number)}
                                    >
                                        <div className="flex h-5 items-center">
                                            <input
                                                type="radio"
                                                name="companySelection"
                                                checked={selectedCompanyNumber === co.company_number}
                                                onChange={() => setSelectedCompanyNumber(co.company_number)}
                                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium leading-none">{co.title}</span>
                                            <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                {co.address}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                                                No. {co.company_number}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button
                                type="button"
                                className="w-full mt-2"
                                disabled={!selectedCompanyNumber || loading}
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const { data, error } = await supabase.functions.invoke('fetch-agency-details', {
                                            body: {
                                                companyNumber: selectedCompanyNumber,
                                            }
                                        });

                                        if (error) throw error;

                                        setFormData(prev => ({
                                            ...prev,
                                            name: data.name || prev.name,
                                            description: data.description || prev.description,
                                        }));

                                        setCompanyOptions([]);
                                        toast({
                                            title: "Details fetched",
                                            description: "Agency details have been auto-filled.",
                                        });
                                    } catch (error: any) {
                                        toast({
                                            title: "Error fetching details",
                                            description: error.message || "Failed to fetch company details",
                                            variant: "destructive",
                                        });
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Confirm Selection & Fetch
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="revenue">Revenue Estimate</Label>
                        <Input
                            id="revenue"
                            value={formData.revenue_estimate}
                            onChange={(e) => handleInputChange("revenue_estimate", e.target.value)}
                            placeholder="e.g. $1M - $5M"
                        />

                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleInputChange("description", e.target.value)}
                            placeholder="Brief description of the agency..."
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Agency
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
