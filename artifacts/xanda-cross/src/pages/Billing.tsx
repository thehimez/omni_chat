import { useGetUserStatus, useCreateCheckout, useGetBillingPortal } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CreditCard, ExternalLink, Zap } from "lucide-react";
import { format } from "date-fns";

export default function Billing() {
  const { data: status, isLoading } = useGetUserStatus();
  const checkoutMutation = useCreateCheckout();
  const portalMutation = useGetBillingPortal();

  const handleUpgrade = () => {
    checkoutMutation.mutate({ data: { addOnAccounts: [] } }, {
      onSuccess: (res) => {
        window.location.href = res.url;
      }
    });
  };

  const handlePortal = () => {
    portalMutation.mutate(undefined, {
      onSuccess: (res) => {
        window.location.href = res.url;
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isTrial = status?.status === 'trial';
  const isActive = status?.status === 'active';

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-14 border-b flex items-center px-6 shrink-0 bg-card">
        <h1 className="font-semibold">Billing & Plan</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          
          <Card className="border-2 border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5 pb-8">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    Xanda Cross Pro <Zap className="w-5 h-5 text-primary fill-primary" />
                  </CardTitle>
                  <CardDescription className="mt-2 text-base">
                    The ultimate command center for power users.
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">$29<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {isTrial && (
                  <div className="bg-accent p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Trial Active</p>
                      <p className="text-sm text-muted-foreground">
                        {status.trialDaysLeft} days remaining. Ends on {status.trialEndsAt ? format(new Date(status.trialEndsAt), 'MMM d, yyyy') : ''}
                      </p>
                    </div>
                  </div>
                )}
                {isActive && (
                  <div className="bg-primary/10 p-4 rounded-lg flex items-center gap-3 text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Active Subscription</span>
                  </div>
                )}

                <ul className="space-y-3 mt-6">
                  {['Unlimited connected accounts', 'Xan AI priority ranking', 'Unlimited semantic search', 'Smart contact enrichment', 'Auto-draft replies'].map(feature => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 border-t mt-6 flex justify-between bg-card">
              {isActive ? (
                <Button variant="outline" onClick={handlePortal} disabled={portalMutation.isPending}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Billing
                </Button>
              ) : (
                <Button className="w-full md:w-auto" size="lg" onClick={handleUpgrade} disabled={checkoutMutation.isPending}>
                  Upgrade to Pro
                </Button>
              )}
            </CardFooter>
          </Card>

        </div>
      </div>
    </div>
  );
}
