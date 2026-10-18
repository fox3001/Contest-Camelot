import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Vote from "./pages/vote";
import Entra from "./pages/entra";
import Caccia from "./pages/caccia";
import Closed from "./pages/closed";
import Iscriviti from "./pages/iscriviti";
import AdminLogin from "./pages/admin/login";
import AdminDashboard from "./pages/admin/dashboard";
import AdminGestione from "./pages/admin/gestione";
import AdminAspetto from "./pages/admin/aspetto";
import AdminTarget from "./pages/admin/target";
import { BackgroundPattern, ThemeProvider } from "@/lib/theme";
import { HelpButton } from "@/components/Help";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/entra" component={Entra} />
      <Route path="/vote" component={Vote} />
      <Route path="/caccia/:code" component={Caccia} />
      <Route path="/closed" component={Closed} />
      <Route path="/iscriviti" component={Iscriviti} />
      
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/gestione" component={AdminGestione} />
      <Route path="/admin/aspetto" component={AdminAspetto} />
      <Route path="/admin/target" component={AdminTarget} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div style={{ position: "relative", minHeight: "100dvh" }}>
            <BackgroundPattern />
            <div style={{ position: "relative", zIndex: 1 }}>
              <Router />
              {/* Dentro lo stesso livello delle pagine: le loro finestre a tutto schermo lo coprono */}
              <HelpButton />
            </div>
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
