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

// --- helpers ---
function normalizePhoneZW(input: string) {
  const raw = String(input ?? '').trim();
  const cleaned = raw.replace(/\s+/g, '').replace(/-/g, '');
  if (!cleaned) return '';

  // already +E.164
  if (cleaned.startsWith('+')) return cleaned;

  // 263xxxxxxxxx -> +263xxxxxxxxx
  if (cleaned.startsWith('263')) return `+${cleaned}`;

  // 0xxxxxxxxx -> +263xxxxxxxxx
  if (cleaned.startsWith('0')) return `+263${cleaned.slice(1)}`;

  // if user typed without 0 (e.g. 771840862), assume ZW
  if (/^\d{9,10}$/.test(cleaned)) return `+263${cleaned}`;

  return cleaned;
}

function makeReferenceId() {
  // simple, non-crypto id for UX only
  const a = Math.random().toString(36).slice(2, 6).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `QX-${a}-${b}`;
}

export function LeadIntake() {
  const [step, setStep] = React.useState<Step>('service');
  const [submitting, setSubmitting] = React.useState(false);
  const [referenceId, setReferenceId] = React.useState<string>('');

  const [formData, setFormData] = React.useState({
    service: '',
    urgency: 'standard',
    address: '',
    // preferredDate: '', // optional
    // notes: '', // optional
    name: '',
    phone: '',
    email: '', 
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
    const phoneE164 = normalizePhoneZW(formData.phone);
    const ref = makeReferenceId();

    // Basic validations (keep it light + same flow)
    if (!formData.service) return alert("Please select a service.");
    if (!formData.address) return alert("Please enter the service address.");
    if (!formData.name) return alert("Please enter your full name.");
    if (!formData.phone) return alert("Please enter your phone number.");
    if (!phoneE164.startsWith('+')) return alert("Please enter a valid phone number (e.g. +44771840862).");

    setSubmitting(true);

    const payload = {
      source: "nexusq-website",
      service: formData.service,
      urgency: formData.urgency,
      address: formData.address,
      // preferred_date: formData.preferredDate || null,
      // notes: formData.notes || null,
      name: formData.name,
      phone: phoneE164,        // ✅ normalized for Twilio + storage
      phone_raw: formData.phone, // keep original too (optional)
      email: formData.email || null,
      reference_id: ref,
    };

    const urls = [
      "https://n8n-k7j4.onrender.com/webhook-test/lead-webhook",
      "https://n8n-k7j4.onrender.com/webhook/lead-webhook",
    ];

    try {
      const results = await Promise.allSettled(
        urls.map((url) =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        )
      );

      const atLeastOneOk = results.some(
        (r) => r.status === "fulfilled" && (r.value?.ok ?? false)
      );

      if (!atLeastOneOk) {
        console.error("Lead submit failed:", results);
        alert("Something went wrong. Please try again.");
        return;
      }

      setReferenceId(ref);
      setStep("success");
    } catch (error) {
      console.error("Failed to submit lead", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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

                {/* optional preferred date */}
                {/* <div className="space-y-3">
                  <Label htmlFor="preferredDate" className="font-bold text-xs uppercase tracking-wider">Preferred Date (Optional)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="preferredDate"
                      type="date"
                      className="pl-10 h-12"
                      value={formData.preferredDate}
                      onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    />
                  </div>
                </div> */}

                {/* optional notes */}
                {/* <div className="space-y-3">
                  <Label htmlFor="notes" className="font-bold text-xs uppercase tracking-wider">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    placeholder="Quick details (e.g. leaking pipe under sink)"
                    className="h-12"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div> */}
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
                    placeholder="+447911123456"
                    className="h-12"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Tip : do not leave any empty spaces when inputting your phone number. Include the country code (e.g. +44 for UK, +263 for Zimbabwe).
                  </div>
                </div>

                {/* optional email */}
                <div className="space-y-3">
                  <Label htmlFor="email" className="font-bold text-xs uppercase tracking-wider">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="h-12"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="ghost" onClick={prevStep} className="font-bold gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button 
                  className="flex-1 font-bold gap-2 h-12" 
                  disabled={!formData.name || !formData.phone || submitting}
                  onClick={submitLead}
                >
                  {submitting ? "Submitting..." : "Request Service"}{" "}
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-[10px] text-center text-muted-foreground">
                By clicking "Request Service", a text message will be sent to the contacted person via phone or text regarding your request.
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
                  Nexus Q is currently qualifying your request. The contacted person will receive an instant confirmation text in less than 2 minutes.
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
                    <span className="font-mono text-[10px] font-bold">{referenceId || "QX-XXXX-XXXX"}</span>
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full font-bold h-12"
                onClick={() => {
                  setFormData({
                    service: '',
                    urgency: 'standard',
                    address: '',
                    // preferredDate: '',
                    // notes: '',
                    name: '',
                    phone: '',
                    email: '',
                  });
                  setReferenceId('');
                  setStep('service');
                }}
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
