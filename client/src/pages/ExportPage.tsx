import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, AlertCircle, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GpOnlyGate } from "./Distillation";

interface ExportPageProps {
  activeCompanyId: number | null;
}

export default function ExportPage({ activeCompanyId }: ExportPageProps) {
  const [jobId, setJobId] = useState<number | null>(null);

  const createMut = trpc.export.create.useMutation({
    onSuccess: (data) => {
      toast.success("Export created successfully");
      setJobId(data.jobId);
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: job, isLoading: loadingJob } = trpc.export.getJob.useQuery(
    { jobId: jobId!, companyId: activeCompanyId! },
    { enabled: !!jobId && !!activeCompanyId, refetchInterval: 3000 }
  );

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to export its data.</span>
      </div>
    );
  }

  return (
    <GpOnlyGate>
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Encrypted Export</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1 flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          Per-portco encrypted archive · Stored in Manus file storage · Signed download URL
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-gold" />
            Export Company Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-secondary/40 rounded-lg p-4 border border-border/40 space-y-2">
            <p className="text-sm font-sans text-foreground">
              This will create an encrypted archive of all data for company #{activeCompanyId}:
            </p>
            <ul className="text-xs text-muted-foreground font-sans space-y-1 list-disc list-inside">
              <li>Company profile and metadata</li>
              <li>All strategy projects and sessions</li>
              <li>Memory items (embeddings excluded)</li>
              <li>Prediction ledger entries</li>
              <li>Decision records</li>
            </ul>
            <p className="text-xs text-muted-foreground font-sans mt-2">
              The archive is encrypted with a per-company key and stored securely. The download link expires in 24 hours.
            </p>
          </div>

          <Button
            className="gradient-gold text-background font-sans gap-2"
            disabled={createMut.isPending}
            onClick={() => createMut.mutate({ companyId: activeCompanyId })}
          >
            {createMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating export...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Create Export
              </>
            )}
          </Button>

          {jobId && (
            <div className="mt-4 p-4 rounded-lg border border-border/40 bg-secondary/30 space-y-3">
              {loadingJob ? (
                <Skeleton className="h-10 w-full" />
              ) : job ? (
                <>
                  <div className="flex items-center gap-2">
                    {job.status === "complete" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : job.status === "processing" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gold" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm font-sans capitalize">{job.status}</span>
                    <span className="text-xs text-muted-foreground font-sans">Job #{job.id}</span>
                  </div>
                  {job.status === "complete" && job.downloadUrl && (
                    <a
                      href={job.downloadUrl}
                      download={`export-company-${activeCompanyId}.enc`}
                      className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-bright font-sans transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download encrypted archive
                    </a>
                  )}
                  {job.expiresAt && (
                    <p className="text-xs text-muted-foreground font-sans">
                      Expires: {new Date(job.expiresAt).toLocaleString()}
                    </p>
                  )}
                  {job.errorMessage && (
                    <p className="text-xs text-destructive font-sans">{job.errorMessage}</p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </GpOnlyGate>
  );
}
