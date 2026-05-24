import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
          <AlertTriangle className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">404</h1>
          <p className="text-xl font-medium text-muted-foreground">Sector not found</p>
          <p className="text-muted-foreground">
            The coordinates you requested do not map to any active interface in the Xanda Cross terminal.
          </p>
        </div>

        <Link href="/">
          <Button size="lg" className="mt-4">
            <Home className="w-4 h-4 mr-2" />
            Return to Briefing
          </Button>
        </Link>
      </div>
    </div>
  );
}
