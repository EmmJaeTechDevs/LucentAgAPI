import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const systemComponents = [
  {
    name: "API Server",
    description: "Express Router - Port 5000",
    status: "Online",
    color: "secondary",
  },
  {
    name: "PostgreSQL",
    description: "Database connections: 45/100",
    status: "Healthy",
    color: "secondary",
  },
  {
    name: "SMS Gateway",
    description: "Response time: 250ms",
    status: "Active",
    color: "secondary",
  },
  {
    name: "Redis Cache",
    description: "Memory usage: 2.1GB/4GB",
    status: "Monitoring",
    color: "muted",
  },
];

export default function SystemHealth() {
  return (
    <Card data-testid="card-system-health">
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>API and database status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {systemComponents.map((component, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                component.color === 'secondary' ? 'bg-secondary' : 'bg-muted-foreground'
              } ${component.color === 'muted' ? 'animate-pulse' : ''}`}></div>
              <div>
                <p className="text-sm font-medium text-foreground" data-testid={`text-component-${component.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  {component.name}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`text-component-desc-${component.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  {component.description}
                </p>
              </div>
            </div>
            <Badge 
              variant={component.color === 'secondary' ? 'secondary' : 'outline'}
              data-testid={`status-component-${component.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {component.status}
            </Badge>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80 font-medium p-0" data-testid="button-view-metrics">
            View detailed metrics →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
