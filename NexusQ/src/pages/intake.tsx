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
import { toast } from 'sonner';
import { withRetry } from '@/lib/network';

type Step = 'service' | 'details' | 'contact' | 'success';

const services = [
  { id: 'plumbing', label: 'Plumbing', icon: Droplets, description: 'Leaks, pipes, and drains' },
  { id: 'hvac', label: 'Heating & Air', icon: Flame, description: 'AC, furnace, and comfort' },
  { id: 'electrical', label: 'Electrical', icon: Zap, description: 'Wiring, panels, and lights' },
  { id: 'general', label: 'General Repair', icon: Wrench, description: 'Standard home maintenance' },
];

// --- phone countries (simple + strict) ---
type PhoneCountry = {
  code: string;
  label: string;
  dial: string;         // includes +
  minLen: number;       // national digits (no leading 0)
  maxLen: number;       // national digits
  example: string;      // national example
};

const phoneCountries: PhoneCountry[] = [
  { code: 'ZW', label: 'Zimbabwe',        dial: '+263', minLen: 9,  maxLen: 9,  example: '771840862' },
  { code: 'GB', label: 'United Kingdom',  dial: '+44',  minLen: 10, maxLen: 10, example: '7911123456' },
  { code: 'US', label: 'United States',   dial: '+1',   minLen: 10, maxLen: 10, example: '4155552671' },
  { code: 'ZA', label: 'South Africa',    dial: '+27',  minLen: 9,  maxLen: 9,  example: '711234567' },
];

// Keep only digits; optionally remove a leading 0 (common when users type local format)
function cleanNationalDigits(input: string) {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

function buildE164(country: PhoneCountry, nationalDigits: string) {
  return `${country.dial}${nationalDigits}`;
}

function makeReferenceId() {
  const a = Math.random().toString(36).slice(2, 6).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `QX-${a}-${b}`;
}

const INTAKE_DRAFT_KEY = "nexusq.intake.draft";

export function LeadIntake() {
  const [step, setStep] = React.useState<Step>('service');
  const [submitting, setSubmitting] = React.useState(false);
  const [referenceId, setReferenceId] = React.useState<string>('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [recentAddresses, setRecentAddresses] = React.useState<string[]>([]);

  // Phone UI state (country + national digits)
  const [countryCode, setCountryCode] = React.useState<string>('ZW');
  const selectedCountry = React.useMemo(
    () => phoneCountries.find(c => c.code === countryCode) ?? phoneCountries[0],
    [countryCode]
  );
  const [phoneNational, setPhoneNational] = React.useState<string>('');

  const [formData, setFormData] = React.useState({
    service: '',
    urgency: 'standard',
    address: '',
    propertyType: 'residential',
    issueDetails: '',
    // preferredDate: '', // optional
    // notes: '', // optional
    name: '',
    phone: '',   // kept for payload (set to E.164 on submit)
    email: '', 
  });

  // derive validation for phone
  const phoneDigits = React.useMemo(() => cleanNationalDigits(phoneNational), [phoneNational]);
  const phoneLen = phoneDigits.length;
  const phoneTooLong = phoneLen > selectedCountry.maxLen;
  const phoneTooShort = phoneLen > 0 && phoneLen < selectedCountry.minLen;
  const phoneValid = phoneLen >= selectedCountry.minLen && phoneLen <= selectedCountry.maxLen;

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("nexusq.intake.addresses");
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) setRecentAddresses(parsed.slice(0, 8));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(INTAKE_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        step: Step;
        formData: typeof formData;
        countryCode: string;
        phoneNational: string;
      }>;
      if (parsed.formData) {
        setFormData((prev) => ({ ...prev, ...parsed.formData }));
      }
      if (parsed.countryCode) setCountryCode(parsed.countryCode);
      if (parsed.phoneNational) setPhoneNational(parsed.phoneNational);
      if (parsed.step && parsed.step !== "success") setStep(parsed.step);
      toast.info("Recovered your intake draft.");
    } catch {
      // ignore invalid local draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (step === "success") return;
    const draft = {
      step,
      formData,
      countryCode,
      phoneNational,
    };
    localStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify(draft));
  }, [countryCode, formData, phoneNational, step]);

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

  function validateDetailsStep() {
    const nextErrors: Record<string, string> = {};
    if (!formData.address.trim()) nextErrors.address = "Service address is required.";
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  }

  function validateContactStep() {
    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) nextErrors.name = "Full name is required.";
    if (!phoneDigits) nextErrors.phone = "Phone number is required.";
    if (phoneDigits && !phoneValid) nextErrors.phone = "Phone number format is invalid for selected country.";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) nextErrors.email = "Please enter a valid email address.";
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  }

  async function submitLead() {
    const ref = makeReferenceId();

    if (!formData.service) {
      toast.error("Please select a service first.");
      setStep("service");
      return;
    }

    if (!validateDetailsStep()) {
      toast.error("Please complete the service details.");
      setStep("details");
      return;
    }

    if (!validateContactStep()) {
      toast.error("Please fix the highlighted contact fields.");
      setStep("contact");
      return;
    }

    const phoneE164 = buildE164(selectedCountry, phoneDigits);

    setSubmitting(true);

    const payload = {
      source: "nexusq-website",
      service: formData.service,
      urgency: formData.urgency,
      address: formData.address,
      property_type: formData.propertyType,
      issue_details: formData.issueDetails || null,
      // preferred_date: formData.preferredDate || null,
      // notes: formData.notes || null,
      name: formData.name,
      phone: phoneE164,        // E.164 for Twilio + storage
      phone_raw: `${selectedCountry.dial} ${phoneDigits}`, // simple raw view
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
          withRetry(
            () =>
              fetch(url, {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  // "x-nexusq-secret" : "nexus-q-secret-123",
                },
                body: JSON.stringify(payload),
              }),
            { retries: 2, baseDelayMs: 350 }
          )
        )
      );

      const atLeastOneOk = results.some(
        (r) => r.status === "fulfilled" && (r.value?.ok ?? false)
      );

      if (!atLeastOneOk) {
        console.error("Lead submit failed:", results);
        toast.error("Something went wrong. Please try again.");
        return;
      }

      setReferenceId(ref);
      setFormData((p) => ({ ...p, phone: phoneE164 })); // keep it consistent
      setStep("success");
      setErrors({});
      localStorage.removeItem(INTAKE_DRAFT_KEY);
      if (formData.address.trim()) {
        const merged = [formData.address.trim(), ...recentAddresses.filter((addr) => addr !== formData.address.trim())].slice(0, 8);
        setRecentAddresses(merged);
        localStorage.setItem("nexusq.intake.addresses", JSON.stringify(merged));
      }
      toast.success("Service request sent.");
    } catch (error) {
      console.error("Failed to submit lead", error);
      toast.error("Something went wrong. Please try again.");
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
                      list="address-suggestions"
                      placeholder="Street address, City, Zip"
                      className="pl-10 h-12"
                      value={formData.address}
                      onChange={(e) => {
                        setFormData({ ...formData, address: e.target.value });
                        if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                      }}
                      aria-invalid={!!errors.address}
                    />
                  </div>
                  <datalist id="address-suggestions">
                    {recentAddresses.map((addr) => (
                      <option key={addr} value={addr} />
                    ))}
                  </datalist>
                  {errors.address && <p className="text-[11px] text-status-error">{errors.address}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="propertyType" className="font-bold text-xs uppercase tracking-wider">Property Type</Label>
                    <select
                      id="propertyType"
                      value={formData.propertyType}
                      onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                      className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issueDetails" className="font-bold text-xs uppercase tracking-wider">Issue Details</Label>
                    <Input
                      id="issueDetails"
                      placeholder={formData.service ? `Describe the ${formData.service} issue` : "Describe issue"}
                      className="h-12"
                      value={formData.issueDetails}
                      onChange={(e) => setFormData({ ...formData, issueDetails: e.target.value })}
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
                  onClick={() => {
                    if (validateDetailsStep()) {
                      nextStep('details');
                    }
                  }}
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
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <p className="text-[11px] text-status-error">{errors.name}</p>}
                </div>

                {/* Country picker + strict-length phone input */}
                <div className="space-y-3">
                  <Label className="font-bold text-xs uppercase tracking-wider">Phone Number</Label>

                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <select
                      value={countryCode}
                      onChange={(e) => {
                        setCountryCode(e.target.value);
                        setPhoneNational(''); // reset digits when changing country (avoids mismatch)
                      }}
                      className={cn(
                        "h-12 w-full rounded-md border border-input bg-background px-3 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-ring"
                      )}
                    >
                      {phoneCountries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label} ({c.dial})
                        </option>
                      ))}
                    </select>

                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder={selectedCountry.example}
                      className={cn(
                        "h-12",
                        (phoneTooShort || phoneTooLong) ? "border-status-error focus-visible:ring-status-error" : ""
                      )}
                      value={phoneNational}
                      onChange={(e) => {
                        // digits only + remove spaces + remove leading 0
                        const digits = cleanNationalDigits(e.target.value);

                        // enforce max length
                        const max = selectedCountry.maxLen;
                        const clipped = digits.slice(0, max);

                        setPhoneNational(clipped);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      maxLength={selectedCountry.maxLen + 2} // +2 buffer because user may paste with 0/spaces; we clip anyway
                      aria-invalid={!!errors.phone || phoneTooShort || phoneTooLong}
                    />
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    Output format: <span className="font-mono">{selectedCountry.dial}{phoneDigits || "..."}</span>
                  </div>

                  {(phoneTooShort || phoneTooLong) && (
                    <div className="text-[10px] font-bold text-status-error">
                      Invalid number: {selectedCountry.label} requires{" "}
                      {selectedCountry.minLen === selectedCountry.maxLen
                        ? `${selectedCountry.maxLen} digits`
                        : `${selectedCountry.minLen}-${selectedCountry.maxLen} digits`
                      }{" "}
                      after {selectedCountry.dial}. (Do not include the starting 0.)
                    </div>
                  )}
                  {errors.phone && <p className="text-[11px] text-status-error">{errors.phone}</p>}
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
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-[11px] text-status-error">{errors.email}</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="ghost" onClick={prevStep} className="font-bold gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button 
                  className="flex-1 font-bold gap-2 h-12" 
                  disabled={!formData.name || !phoneDigits || !phoneValid || submitting}
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
                    propertyType: 'residential',
                    issueDetails: '',
                    // preferredDate: '',
                    // notes: '',
                    name: '',
                    phone: '',
                    email: '',
                  });
                  setReferenceId('');
                  setCountryCode('ZW');
                  setPhoneNational('');
                  setErrors({});
                  localStorage.removeItem(INTAKE_DRAFT_KEY);
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
