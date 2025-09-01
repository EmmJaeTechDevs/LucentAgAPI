import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Shield, MessageSquare, AlertTriangle, TrendingUp } from "lucide-react";

interface StatsData {
  totalUsers: number;
  activeSessions: number;
  otpSentToday: number;
  apiErrorsToday: number;
}

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/dashboard/stats"],
  });

  const statsCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      change: "+12% from last month",
      icon: Users,
      color: "primary",
    },
    {
      title: "Active Sessions",
      value: stats?.activeSessions || 0,
      change: "+8% from yesterday",
      icon: Shield,
      color: "secondary",
    },
    {
      title: "OTP Sent Today",
      value: stats?.otpSentToday || 0,
      change: "+15% from yesterday",
      icon: MessageSquare,
      color: "accent",
    },
    {
      title: "API Errors",
      value: stats?.apiErrorsToday || 0,
      change: "-5% from yesterday",
      icon: AlertTriangle,
      color: "destructive",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsCards.map((card, index) => {
        const Icon = card.icon;
        const isNegative = card.change.startsWith("-");
        
        return (
          <Card key={index} data-testid={`card-stat-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold text-foreground" data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {card.value.toLocaleString()}
                  </p>
                  <p className={`text-sm mt-1 ${isNegative ? 'text-destructive' : 'text-secondary'}`}>
                    <TrendingUp className="inline w-3 h-3 mr-1" />
                    {card.change}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  card.color === 'primary' ? 'bg-primary/10' :
                  card.color === 'secondary' ? 'bg-secondary/10' :
                  card.color === 'accent' ? 'bg-accent' :
                  'bg-destructive/10'
                }`}>
                  <Icon className={`text-xl ${
                    card.color === 'primary' ? 'text-primary' :
                    card.color === 'secondary' ? 'text-secondary' :
                    card.color === 'accent' ? 'text-primary' :
                    'text-destructive'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
