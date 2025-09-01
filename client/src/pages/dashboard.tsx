import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import StatsCards from "@/components/stats-cards";
import RecentActivity from "@/components/recent-activity";
import SystemHealth from "@/components/system-health";
import ApiLogsTable from "@/components/api-logs-table";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 p-6 space-y-6">
          <StatsCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivity />
            <SystemHealth />
          </div>
          
          <ApiLogsTable />
        </main>
      </div>
    </div>
  );
}
