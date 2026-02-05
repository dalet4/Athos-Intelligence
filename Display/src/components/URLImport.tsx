import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface URLImportProps {
    onDataImported: (data: any[]) => void;
}

export function URLImport({ onDataImported }: URLImportProps) {
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setIsLoading(true);

        try {
            // Using the n8n webhook URL. 
            // The workflow now expects a JSON with { url } and returns the structured AgencyData.
            const response = await fetch("https://primary-production-b370c.up.railway.app/webhook-test/scrape-agency", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to scrape: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();

            // Validate that we got a meaningful result
            if (!result || !result.name) {
                console.error("Invalid response format:", result);
                throw new Error("The AI agent returned incomplete data (missing agency name).");
            }

            // Map the result to our Partner interface
            // We preserve all the rich fields (clients, caseStudies, etc) so they are stored in the state
            const newPartner = {
                id: crypto.randomUUID(),
                name: result.name, // Explicitly map name for the table view
                description: result.description,
                website: result.website || url,
                platforms: result.platforms || [],
                specializations: result.specializations || [],
                clients: result.clients || [],
                caseStudies: result.caseStudies || result.additionalCaseStudies || [],
                // Spread any other custom fields returned by the AI
                ...result
            };

            onDataImported([newPartner]);

            toast({
                title: "Import Successful",
                description: `Successfully analyzed ${newPartner.name}`,
            });

            setUrl("");
        } catch (error) {
            console.error("Import failed:", error);
            toast({
                title: "Import Failed",
                description: error instanceof Error ? error.message : "Failed to import from URL",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="url">Agency URL</Label>
                <Input
                    id="url"
                    placeholder="https://agency.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                />
                <p className="text-sm text-muted-foreground">
                    Enter the URL to scrape and analyze using n8n AI agent.
                </p>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing & Importing...
                    </>
                ) : (
                    "Import Agency"
                )}
            </Button>
        </form>
    );
}
