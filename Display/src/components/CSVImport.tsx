import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CSVImportProps {
  onDataImported: (data: any[]) => void;
}

export function CSVImport({ onDataImported }: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();

  // Field mapping configuration
  const fieldMapping: { [key: string]: string } = {
    'Vendor': 'Partner Name',
    'vendor': 'Partner Name',
    'VENDOR': 'Partner Name',
    'Company': 'Partner Name',
    'company': 'Partner Name',
    'COMPANY': 'Partner Name'
  };

  const mapFieldName = (fieldName: string): string => {
    return fieldMapping[fieldName] || fieldName;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      previewCSV(selectedFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
    }
  };

  const previewCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
        
        // Preview first 3 rows
        const preview = lines.slice(1, 4).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
          const obj: any = {};
          headers.forEach((header, index) => {
            const mappedHeader = mapFieldName(header);
            obj[mappedHeader] = values[index] || '';
          });
          return obj;
        });
        
        setPreviewData(preview);
      } catch (error) {
        toast({
          title: "Error parsing CSV",
          description: "Please check your CSV format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
          
            const data = lines.slice(1).map((line, index) => {
              const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
              const partner: any = { 
                id: `imported-${Date.now()}-${index}`,
              };
              
              // Map headers and keep values
              headers.forEach((header, idx) => {
                const cleanHeader = header.trim();
                const mappedHeader = mapFieldName(cleanHeader);
                partner[mappedHeader] = values[idx] || '';
              });
              
              return partner;
            });

          onDataImported(data);
          
          toast({
            title: "Import successful",
            description: `Imported ${data.length} partners successfully.`,
            variant: "default",
          });
          
          setFile(null);
          setPreviewData([]);
          
        } catch (error) {
          toast({
            title: "Import failed",
            description: "There was an error processing your CSV file.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Import failed",
        description: "There was an error reading your file.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Import Partners from CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Select CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
        </div>

        {file && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-primary-light rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{file.name}</span>
              <CheckCircle className="h-4 w-4 text-success ml-auto" />
            </div>

            {previewData.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preview (first 3 rows):</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-2 text-xs font-medium border-b">
                    {Object.keys(previewData[0]).join(' • ')}
                  </div>
                  {previewData.map((row, index) => (
                    <div key={index} className="p-2 text-xs border-b last:border-b-0">
                      {Object.values(row).join(' • ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleImport} 
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? "Importing..." : "Import Partners"}
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            CSV should include columns like: name, email, phone, company/vendor, status, location
          </p>
        </div>
      </CardContent>
    </Card>
  );
}