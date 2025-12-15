// src/app/dashboard/sessions/[id]/loading.tsx
export default function LoadingSession() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-muted rounded" />
      <div className="h-32 w-full bg-muted rounded" />
    </div>
  );
}
