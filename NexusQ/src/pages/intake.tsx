import React from 'react';
import { 
  CheckCircle2, 
  ArrowRight, 
  ChevronLeft,
  Wrench,
  Droplets,
  Flame,
  Zap,
  Clock,
  MapPin,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Step = 'service' | 'details' | 'contact' | 'success';

const services = [
  { id: 'plumbing', label: 'Plumbing', icon: Droplets, description: 'Leaks, pipes, and drains' },
  { id: 'hvac', label: 'Heating & Air', icon: Flame, description: 'AC, furnace, and comfort' },
  { id: 'electrical', label: 'Electrical', icon: Zap, description: 'Wiring, panels, and lights' },
  { id: 'general', label: 'General Repair', icon: Wrench, description: 'Standard home maintenance' },
];

export function LeadIntake() {
  const [step, setStep] = React.useState<Step>('service');
  const [formData, setFormData] = React.useState({
    service: '',
    urgency: 'standard',
    address: '',
    name: '',
    phone: '',
  });

  const progress = {
    service: 25,
    details: 50,
    contact: 75,
    success: 100,
  }[step];

  const nextStep = (current: Step) => {
    if (current === 'service') setStep('details');
    if (current === 'details') setStep('contact');
    if (current === 'contact') setStep('success');
  };

  const prevStep = () => {
    if (step === 'details') setStep('service');
    if (step === 'contact') setStep('details');
  };

  async function submitLead() {
  try {
    await fetch("https://n8n-k7j4.onrender.com/webhook-test/lead-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "nexusq-website",
        service: formData.service,
        urgency: formData.urgency,
        address: formData.address,
        name: formData.name,
        phone: formData.phone,
      }),
    });

    setStep("success");
  } catch (error) {
    console.error("Failed to submit lead", error);
    alert("Something went wrong. Please try again.");
  }
}


  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8 animate-fade-in-up">
        {step !== 'success' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Step {step === 'service' ? 1 : step === 'details' ? 2 : 3} of 3
              </span>
              <span className="text-xs font-bold text-primary">Nexus Q Assistant</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}

        <div className="space-y-6">
          {step === 'service' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">How can we help today?</h2>
                <p className="text-muted-foreground">Select the service you need assistance with.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setFormData({ ...formData, service: item.id });
                      nextStep('service');
                    }}
                    className={cn(
                      "group flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left hover:border-primary/50 hover:bg-muted/50",
                      formData.service === item.id ? "border-primary bg-muted" : "border-border"
                    )}
                  >
                    <item.icon className="h-6 w-6 mb-4 text-primary" />
                    <div className="font-bold">{item.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Tell us a bit more</h2>
                <p className="text-muted-foreground">This helps us prepare for your service.</p>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="font-bold text-xs uppercase tracking-wider">Urgency Level</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setFormData({ ...formData, urgency: 'standard' })}
                      className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold text-sm",
                        formData.urgency === 'standard' ? "border-primary bg-muted" : "border-border"
                      )}
                    >
                      <Clock className="h-4 w-4" /> Standard
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, urgency: 'emergency' })}
                      className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-lg border-2 font-bold text-sm",
                        formData.urgency === 'emergency' ? "border-status-error text-status-error bg-status-error/5" : "border-border"
                      )}
                    >
                      <Zap className="h-4 w-4" /> Emergency
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="address" className="font-bold text-xs uppercase tracking-wider">Service Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="Street address, City, Zip"
                      className="pl-10 h-12"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="ghost" onClick={prevStep} className="font-bold gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button 
                  className="flex-1 font-bold gap-2 h-12" 
                  disabled={!formData.address}
                  onClick={() => nextStep('details')}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 'contact' && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Almost there</h2>
                <p className="text-muted-foreground">Who should we contact to confirm?</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="name" className="font-bold text-xs uppercase tracking-wider">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Justina Amari"
                    className="h-12"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="phone" className="font-bold text-xs uppercase tracking-wider">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 000-0000"
                    className="h-12"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="ghost" onClick={prevStep} className="font-bold gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button 
                  className="flex-1 font-bold gap-2 h-12" 
                  disabled={!formData.name || !formData.phone}
                  onClick={submitLead}
                >
                  Request Service <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-[10px] text-center text-muted-foreground">
                By clicking "Request Service", you agree to be contacted via phone or text regarding your request.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-8 py-8">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-status-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-status-success animate-bounce" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold tracking-tight">Request Received</h2>
                <p className="text-muted-foreground">
                  Nexus Q is currently qualifying your request. You will receive an instant confirmation text in less than 2 minutes.
                </p>
              </div>
              
              <Card className="border-none bg-muted/50">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="text-muted-foreground">Service Type</span>
                    <span className="font-bold capitalize">{formData.service}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reference ID</span>
                    <span className="font-mono text-[10px] font-bold">QX-8492-BT</span>
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full font-bold h-12"
                onClick={() => setStep('service')}
              >
                Back to Home
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
