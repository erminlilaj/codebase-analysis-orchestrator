import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProjectsPage } from './pages/ProjectsPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectPage } from './pages/ProjectPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RunPage } from './pages/RunPage';
import { AnswerPage } from './pages/AnswerPage';

export const App: React.FC = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<NewProjectPage />} />
      <Route path="/projects/:id/*" element={<ProjectPage />} />
      <Route path="/questions" element={<QuestionsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/runs/:runId" element={<RunPage />} />
      <Route path="/jobs/:jobId/answer" element={<AnswerPage />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Route>
  </Routes>
);
