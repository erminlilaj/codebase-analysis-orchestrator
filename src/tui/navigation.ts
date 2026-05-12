export type Screen =
  | { kind: 'projects' }
  | { kind: 'new-project' }
  | { kind: 'project'; projectId: string }
  | { kind: 'new-run'; projectId: string }
  | { kind: 'run'; projectId: string; runId: string }
  | { kind: 'new-export'; projectId: string; runId?: string }
  | { kind: 'message'; title: string; body: string };

export type NavigationApi = {
  push(screen: Screen): void;
  replace(screen: Screen): void;
  pop(): void;
  reset(screen: Screen): void;
};
