import { useLocation } from "wouter";
import { Home, Plus, Dumbbell, User, Moon, Sun, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/upload", icon: Plus, label: "Upload" },
    { path: "/workout", icon: Dumbbell, label: "Workouts" },
  ];

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-primary-foreground ml-1"></div>
            </div>
            <h1 className="text-lg font-semibold text-foreground">DrillMaster</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-lg bg-muted/50 hover:bg-muted"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg bg-muted/50 hover:bg-muted"
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "flex flex-col items-center p-2 h-auto space-y-1",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setLocation(item.path)}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            className="flex flex-col items-center p-2 h-auto space-y-1 text-muted-foreground hover:text-foreground"
            data-testid="nav-profile"
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Button>
        </div>
      </nav>
    </>
  );
}
