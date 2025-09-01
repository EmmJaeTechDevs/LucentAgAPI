import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, MessageSquare, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  createdAt: string;
  ipAddress: string;
}

export default function RecentActivity() {
  const { data: activities, isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/dashboard/activity"],
  });

  const getActivityIcon = (url: string, statusCode: number) => {
    if (url.includes('/auth/login')) return LogIn;
    if (url.includes('/auth/verify-otp')) return MessageSquare;
    if (statusCode >= 400) return X;
    return LogIn;
  };

  const getActivityColor = (url: string, statusCode: number) => {
    if (statusCode >= 400) return 'destructive';
    if (url.includes('/auth/verify-otp')) return 'primary';
    return 'secondary';
  };

  const getActivityStatus = (statusCode: number) => {
    if (statusCode >= 400) return 'Failed';
    if (statusCode === 200) return 'Success';
    return 'Verified';
  };

  const getActivityDescription = (url: string) => {
    if (url.includes('/auth/login')) return 'User login via phone';
    if (url.includes('/auth/verify-otp')) return 'OTP verification';
    if (url.includes('/auth/register')) return 'User registration';
    return 'API request';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent User Activity</CardTitle>
          <CardDescription>Latest authentication events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3 bg-accent/50 rounded-lg animate-pulse">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-recent-activity">
      <CardHeader>
        <CardTitle>Recent User Activity</CardTitle>
        <CardDescription>Latest authentication events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities && activities.length > 0 ? (
            activities.map((activity) => {
              const Icon = getActivityIcon(activity.url, activity.statusCode);
              const color = getActivityColor(activity.url, activity.statusCode);
              const status = getActivityStatus(activity.statusCode);
              const description = getActivityDescription(activity.url);

              return (
                <div key={activity.id} className="flex items-center space-x-4 p-3 bg-accent/50 rounded-lg">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    color === 'destructive' ? 'bg-destructive' :
                    color === 'primary' ? 'bg-primary' : 'bg-secondary'
                  }`}>
                    <Icon className={`text-sm ${
                      color === 'destructive' ? 'text-destructive-foreground' :
                      color === 'primary' ? 'text-primary-foreground' : 'text-secondary-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{description}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-activity-ip-${activity.id}`}>
                      {activity.ipAddress || 'Unknown IP'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground" data-testid={`text-activity-time-${activity.id}`}>
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      color === 'destructive' ? 'bg-destructive/10 text-destructive' :
                      'bg-secondary/10 text-secondary'
                    }`} data-testid={`status-activity-${activity.id}`}>
                      {status}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent activity found
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80 font-medium p-0" data-testid="button-view-all-activity">
            View all activity →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
