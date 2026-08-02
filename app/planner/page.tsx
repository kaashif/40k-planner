import { Suspense } from 'react';
import DeploymentPlanner from './DeploymentPlanner';

export default function PlannerPage() {
  return (
    <Suspense fallback={<main className="planner-shell">Loading planner…</main>}>
      <DeploymentPlanner />
    </Suspense>
  );
}
