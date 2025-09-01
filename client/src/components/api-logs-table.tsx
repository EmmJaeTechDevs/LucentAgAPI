import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HttpLog {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  ipAddress: string;
  createdAt: string;
}

export default function ApiLogsTable() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: logs, isLoading } = useQuery<HttpLog[]>({
    queryKey: ["/api/logs/http", { page, limit }],
  });

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'primary';
      case 'POST': return 'secondary';
      case 'PUT': return 'accent';
      case 'DELETE': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'secondary';
    if (status >= 400) return 'destructive';
    return 'outline';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent API Logs</CardTitle>
          <CardDescription>HTTP requests and responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-api-logs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent API Logs</CardTitle>
            <CardDescription>HTTP requests and responses</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" data-testid="button-filter-logs">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button size="sm" data-testid="button-export-logs">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/50" data-testid={`row-log-${log.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground" data-testid={`text-log-timestamp-${log.id}`}>
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getMethodColor(log.method) as any} data-testid={`badge-log-method-${log.id}`}>
                        {log.method}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground" data-testid={`text-log-url-${log.id}`}>
                      {log.url}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusColor(log.statusCode) as any} data-testid={`badge-log-status-${log.id}`}>
                        {log.statusCode}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground" data-testid={`text-log-response-time-${log.id}`}>
                      {log.responseTime}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-log-ip-${log.id}`}>
                      {log.ipAddress || 'Unknown'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No API logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(limit, logs?.length || 0)} results
            </p>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                data-testid="button-previous-page"
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
                {page}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!logs || logs.length < limit}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
