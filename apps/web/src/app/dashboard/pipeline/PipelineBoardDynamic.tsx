"use client";

import dynamic from "next/dynamic";
import type { StageWithOpportunities } from "@/app/actions/pipeline";
import { PipelineBoardSkeleton } from "./PipelineBoardSkeleton";

type ContactOption = { id: string; firstName: string; lastName: string };

export type PipelineBoardDynamicProps = {
  stages: StageWithOpportunities[];
  contacts?: ContactOption[];
  contactContext?: { contactId: string };
  onMutationComplete?: () => void;
  initialOpenCreateStageId?: string | null;
  onOpenCreateConsumed?: () => void;
  totalPotential?: number;
};

const PipelineBoard = dynamic(
  () => import("./PipelineBoard").then((m) => m.PipelineBoard),
  {
    ssr: false,
    loading: () => <PipelineBoardSkeleton />,
  },
);

/** Code-splits the heavy pipeline board (DnD, modals) from the route shell. */
export function PipelineBoardDynamic(props: PipelineBoardDynamicProps) {
  return <PipelineBoard {...props} />;
}
