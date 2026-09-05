import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./api/queryClient";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { TooltipProvider } from "./components/primitives/Tooltip";
import { ThemeProvider } from "./theme/ThemeProvider";

import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingDetailPage } from "./pages/MeetingDetailPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { MembersPage } from "./pages/MembersPage";
import { MyWorkPage } from "./pages/MyWorkPage";
import { NoteDetailPage } from "./pages/NoteDetailPage";
import { NotesPage } from "./pages/NotesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { BacklogPage } from "./pages/BacklogPage";
import { BoardPage } from "./pages/BoardPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ChatLayout, DirectMessagesIndex } from "./pages/ChatLayout";
import { ChatPage } from "./pages/ChatPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { DirectMessagePage } from "./pages/DirectMessagePage";
import { IssueDetailPage } from "./pages/IssueDetailPage";
import { IssuesPage } from "./pages/IssuesPage";
import { ProjectOverviewPage } from "./pages/ProjectOverviewPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SprintsPage } from "./pages/SprintsPage";
import { TestCaseDetailPage } from "./pages/TestCaseDetailPage";
import { TestCasesPage } from "./pages/TestCasesPage";
import { SignupPage } from "./pages/SignupPage";
import { PhaseStub } from "./pages/dev/PhaseStub";

import "./styles/index.css";

/**
 * Provider order is deliberate:
 *   ThemeProvider   stamps data-theme before anything paints
 *   QueryClient     must wrap AuthProvider — auth-dependent queries live inside
 *   AuthProvider    owns the session that ProtectedRoute reads
 *   TooltipProvider one delay configuration for the whole app
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <Routes>
                {/* Public — the landing page is the front door, reachable
                    signed in or out. */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* Authenticated.
                    ONE pathless layout route renders the shell for every page
                    below it. This matters beyond tidiness: when the shell was
                    declared separately per URL branch, navigating between
                    branches unmounted and remounted it, tearing down any open
                    Radix overlay mid-close and leaving `body` with
                    pointer-events:none — the whole page stopped accepting
                    clicks. One shell instance means in-app navigation never
                    unmounts the top bar or its menus. */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/projects" element={<ProjectsPage />} />

                  {/* Project-scoped. The pages below are Phase 1 scaffolds;
                      each is replaced by its real implementation in the phase
                      it names. */}
                  <Route path="/projects/:pid">
                    <Route index element={<ProjectOverviewPage />} />
                    {/* Chat is one area with a conversation rail: team chat
                        is its index, a direct message is a child. Sharing the
                        layout keeps /chat rendering exactly what it always
                        did, and keeps the sidebar's Chat item active for
                        both. */}
                    <Route path="my-work" element={<MyWorkPage />} />
                    <Route path="chat" element={<ChatLayout />}>
                      <Route index element={<ChatPage />} />
                      <Route path="dm" element={<DirectMessagesIndex />} />
                      <Route path="dm/:userId" element={<DirectMessagePage />} />
                    </Route>
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="meetings" element={<MeetingsPage />} />
                    <Route path="meetings/:meetingId" element={<MeetingDetailPage />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="notes/:noteId" element={<NoteDetailPage />} />
                    <Route path="board" element={<BoardPage />} />
                    <Route path="issues" element={<IssuesPage />} />
                    <Route path="backlog" element={<BacklogPage />} />
                    <Route path="sprints" element={<SprintsPage />} />
                    <Route path="test-cases" element={<TestCasesPage />} />
                    <Route path="test-cases/:tcid" element={<TestCaseDetailPage />} />
                    <Route path="issues/:iid" element={<IssueDetailPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="components" element={<ComponentsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* Deep-link resolver for notifications, which carry only an
                      issue id. Implemented in Phase 8. */}
                  <Route
                    path="/issues/:iid"
                    element={
                      <PhaseStub
                        title="Issue"
                        phase="Phase 8"
                        description="Resolves the issue's project and redirects to its canonical URL."
                      />
                    }
                  />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
