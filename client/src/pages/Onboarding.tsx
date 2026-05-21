import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, Brain, FileInput, CheckCircle2, ArrowRight, Rocket } from "lucide-react";
import { toast } from "sonner";

interface OnboardingProps {
  onSelect: (companyId: number) => void;
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string; icon: typeof Building2 }[] = [
  { n: 1, label: "Company", icon: Building2 },
  { n: 2, label: "Describe", icon: Brain },
  { n: 3, label: "First document", icon: FileInput },
  { n: 4, label: "Done", icon: CheckCircle2 },
];

export default function Onboarding({ onSelect }: OnboardingProps) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [companyId, setCompanyId] = useState<number | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  // Step 2
  const [profile, setProfile] = useState("");
  // Step 3
  const [docContent, setDocContent] = useState("");

  const createMut = trpc.company.create.useMutation({
    onSuccess: (company) => {
      setCompanyId(company.id);
      onSelect(company.id);
      toast.success(`Company "${company.name}" created`);
      setStep(2);
    },
    onError: (e) => toast.error(e.message),
  });

  const ingestMut = trpc.ingest.document.useMutation({
    onError: (e) => toast.error(e.message),
  });

  async function seedFromProfile() {
    if (!companyId || !profile.trim()) return;
    const r = await ingestMut.mutateAsync({
      companyId,
      sourceType: "text",
      content: profile.trim(),
    });
    toast.success(`Seeded ${r.added} memory item(s) from the company profile`);
    setStep(3);
  }

  async function ingestFirstDoc() {
    if (!companyId || !docContent.trim()) return;
    const r = await ingestMut.mutateAsync({
      companyId,
      sourceType: "text",
      content: docContent.trim(),
    });
    toast.success(`Ingested ${r.added} memory item(s) from the document`);
    setStep(4);
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Rocket className="h-5 w-5 text-gold" /> Onboard a Portfolio Company
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Create the company, seed its strategic memory, and ingest a first document.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center gap-1 flex-1">
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-sans ${
                  active
                    ? "bg-gold/15 text-gold border border-gold/30"
                    : done
                      ? "text-gold/70"
                      : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 ${done ? "bg-gold/40" : "bg-border/50"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Company */}
      {step === 1 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Company basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Company name *" value={name} onChange={setName} placeholder="e.g. Northwind Systems" />
            <FieldInput label="Industry" value={industry} onChange={setIndustry} placeholder="e.g. B2B SaaS" />
            <FieldInput
              label="One-line description"
              value={description}
              onChange={setDescription}
              placeholder="What does this company do?"
            />
            <Button
              className="w-full gradient-gold text-background font-sans gap-2"
              disabled={!name.trim() || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  name: name.trim(),
                  industry: industry.trim() || undefined,
                  description: description.trim() || undefined,
                })
              }
            >
              {createMut.isPending ? "Creating…" : "Create company"} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Describe / seed memory */}
      {step === 2 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Tell us about this company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground font-sans">
              Describe the business — market, customers, products, strengths, challenges. This
              seeds the company's strategic memory with its first claims.
            </p>
            <Textarea
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="Northwind Systems sells inventory software to mid-market distributors. Its main markets are the US and Canada. Strengths: deep ERP integrations, low churn. Challenges: long sales cycles, rising CAC…"
              className="bg-secondary/50 border-border/60 min-h-[200px] font-body"
              rows={10}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="font-sans" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button
                className="flex-1 gradient-gold text-background font-sans gap-2"
                disabled={!profile.trim() || ingestMut.isPending}
                onClick={seedFromProfile}
              >
                {ingestMut.isPending ? "Seeding memory…" : "Seed memory"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — First document */}
      {step === 3 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Ingest a first document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground font-sans">
              Optional — paste the text of a board deck, latest financials summary, customer
              list notes, or strategy memo. Claims are extracted into memory.
            </p>
            <Textarea
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Paste document text here…"
              className="bg-secondary/50 border-border/60 min-h-[160px] font-body"
              rows={8}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="font-sans" onClick={() => setStep(4)}>
                Skip
              </Button>
              <Button
                className="flex-1 gradient-gold text-background font-sans gap-2"
                disabled={!docContent.trim() || ingestMut.isPending}
                onClick={ingestFirstDoc}
              >
                {ingestMut.isPending ? "Ingesting…" : "Ingest document"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Done */}
      {step === 4 && (
        <Card className="card-glass">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-background" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-xl text-foreground">{name} is onboarded</h3>
              <p className="text-muted-foreground font-body text-sm">
                Its strategic memory is seeded and ready. You can ingest more, search memory,
                or recognise strategy artifacts for it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Badge variant="secondary" className="text-[10px]">company #{companyId}</Badge>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" className="font-sans" onClick={() => navigate("/memory")}>
                View memory
              </Button>
              <Button
                className="gradient-gold text-background font-sans"
                onClick={() => navigate("/")}
              >
                Go to overview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary/50 border-border/60"
      />
    </div>
  );
}
