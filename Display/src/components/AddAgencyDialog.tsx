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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";

export function AddAgencyDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        website: "",
        description: "",
        revenue_estimate: "",
    });

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
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Agency
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add New Agency</DialogTitle>
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
                        <Input
                            id="website"
                            type="url"
                            value={formData.website}
                            onChange={(e) => handleInputChange("website", e.target.value)}
                            placeholder="https://example.com"
                        />
                    </div>
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
