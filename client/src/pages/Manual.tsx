import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MANUAL_SECTIONS, FAQ_ITEMS } from "@/lib/manual-content";

export default function Manual() {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(MANUAL_SECTIONS.length > 0 ? [MANUAL_SECTIONS[0].id] : []),
  );
  const [openFaq, setOpenFaq] = useState<Set<number>>(() => new Set());

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleFaq(i: number) {
    setOpenFaq((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function jumpTo(id: string) {
    setOpenSections((prev) => new Set(prev).add(id));
    // Allow the section to expand before scrolling to it.
    setTimeout(() => {
      document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  const allOpen = openSections.size === MANUAL_SECTIONS.length;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <BookText className="h-5 w-5 text-gold" /> User Manual & FAQ
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Everything the platform does, and how its intelligence works. Jump to a
          section below, or read straight through.
        </p>
      </div>

      {/* Jump navigation */}
      <Card className="card-glass">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {MANUAL_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => jumpTo(s.id)}
                className="rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs font-sans text-muted-foreground hover:text-gold hover:border-gold/30 transition-colors"
              >
                {s.title}
              </button>
            ))}
            <button
              onClick={() => jumpTo("faq")}
              className="rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs font-sans text-muted-foreground hover:text-gold hover:border-gold/30 transition-colors"
            >
              FAQ
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="font-sans text-xs"
            onClick={() =>
              setOpenSections(
                allOpen ? new Set() : new Set(MANUAL_SECTIONS.map((s) => s.id)),
              )
            }
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        </CardContent>
      </Card>

      {/* Sections */}
      {MANUAL_SECTIONS.map((section) => {
        const open = openSections.has(section.id);
        return (
          <Card key={section.id} id={`manual-${section.id}`} className="card-glass scroll-mt-6">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-2 px-5 py-4 text-left"
            >
              {open ? (
                <ChevronDown className="h-4 w-4 text-gold shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="font-heading text-base text-foreground">{section.title}</span>
            </button>
            {open && (
              <CardContent className="pt-0 space-y-4">
                <p className="text-sm text-muted-foreground font-body leading-relaxed">
                  {section.intro}
                </p>
                <div className="space-y-3">
                  {section.entries.map((entry, i) => (
                    <div
                      key={i}
                      className="rounded border border-border/50 bg-secondary/20 p-3 space-y-1"
                    >
                      <p className="text-sm font-heading text-gold">{entry.term}</p>
                      <p className="text-sm text-foreground font-body leading-relaxed">
                        {entry.body}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* FAQ */}
      <div id="manual-faq" className="scroll-mt-6 space-y-3">
        <h3 className="font-heading text-lg text-foreground flex items-center gap-2 pt-2">
          <HelpCircle className="h-5 w-5 text-gold" /> Frequently asked questions
        </h3>
        {FAQ_ITEMS.map((item, i) => {
          const open = openFaq.has(i);
          return (
            <Card key={i} className="card-glass">
              <button
                onClick={() => toggleFaq(i)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left"
              >
                {open ? (
                  <ChevronDown className="h-4 w-4 text-gold shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-heading text-foreground">{item.q}</span>
              </button>
              {open && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground font-body leading-relaxed pl-6">
                    {item.a}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground font-sans text-center pt-2">
        Meridian — strategy compounds with every session.
      </p>
    </div>
  );
}
