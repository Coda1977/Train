import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import Drill from "@/pages/drill";
import Workout from "@/pages/workout";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/navigation";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-16 pb-20">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/upload" component={Upload} />
          <Route path="/drill/:id" component={Drill} />
          <Route path="/workout" component={Workout} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Navigation />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
