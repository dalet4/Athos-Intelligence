import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Partner {
  id: string;
  [key: string]: any; // Allow any fields from CSV headers
}
interface EditPartnerDialogProps {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedPartner: Partner) => void;
}

export function EditPartnerDialog({ partner, open, onOpenChange, onSave }: EditPartnerDialogProps) {
  const [formData, setFormData] = useState<Partner>(() => 
    partner || { id: '', name: '' }
  );

  // Update form data when partner changes
  useEffect(() => {
    if (partner) {
      setFormData(partner);
    }
  }, [partner]);

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  const handleInputChange = (field: keyof Partner, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!partner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Partner</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Name field (always shown) */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Partner name"
            />
          </div>

          {/* Dynamic fields based on partner data */}
          {partner && Object.keys(partner)
            .filter(key => key !== 'id' && key !== 'name')
            .map(field => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                </Label>
                {field.toLowerCase().includes('notes') || field.toLowerCase().includes('description') ? (
                  <Textarea
                    id={field}
                    value={formData[field] || ''}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    placeholder={`Enter ${field.toLowerCase()}`}
                    rows={3}
                  />
                ) : (
                  <Input
                    id={field}
                    value={formData[field] || ''}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    placeholder={`Enter ${field.toLowerCase()}`}
                  />
                )}
              </div>
            ))
          }

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name.trim()}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}