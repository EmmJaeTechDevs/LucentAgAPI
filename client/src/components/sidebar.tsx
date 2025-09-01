import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Leaf, 
  LayoutDashboard, 
  Users, 
  Shield, 
  MessageSquare, 
  Database, 
  AlertTriangle, 
  Settings 
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/users", icon: Users, label: "User Management" },
  { href: "/auth", icon: Shield, label: "Authentication" },
  { href: "/otp", icon: MessageSquare, label: "OTP Management" },
  { href: "/api-logs", icon: Database, label: "API Logs" },
  { href: "/error-logs", icon: AlertTriangle, label: "Error Logs" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}
      
      <aside className={cn(
        "w-64 bg-card border-r border-border sidebar-transition fixed md:relative z-30 h-full",
        isOpen ? "translate-x-0" : "sidebar-hidden md:translate-x-0"
      )} data-testid="sidebar">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Leaf className="text-primary-foreground text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Lucennt Ag</h1>
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>
        </div>
        
        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
