import { Flag } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <Flag className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Bunting Admin
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">
          Feature flag management interface for your applications
        </p>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Version 0.1.0 • Development Mode
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              Ready to implement the dashboard, flag editor, and publishing interface.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}