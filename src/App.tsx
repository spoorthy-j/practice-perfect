import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import InterviewSetup from "./pages/InterviewSetup";
import InterviewInstructions from "./pages/InterviewInstructions";
import InterviewSession from "./pages/InterviewSession";
import Results from "./pages/Results";
import InterviewHistory from "./pages/InterviewHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/setup" element={<ProtectedRoute><AppLayout><InterviewSetup /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/instructions" element={<ProtectedRoute><InterviewInstructions /></ProtectedRoute>} />
            <Route path="/interview/session" element={<ProtectedRoute><InterviewSession /></ProtectedRoute>} />
            <Route path="/results/:interviewId" element={<ProtectedRoute><AppLayout><Results /></AppLayout></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><AppLayout><InterviewHistory /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
