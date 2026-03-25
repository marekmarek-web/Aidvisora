import dynamic from "next/dynamic";

const PortalCalendarView = dynamic(
  () => import("../PortalCalendarView").then((m) => ({ default: m.PortalCalendarView })),
  {
    loading: () => (
      <div className="flex flex-1 min-h-[40vh] items-center justify-center text-slate-500 text-sm p-6">
        Načítám kalendář…
      </div>
    ),
  }
);

export default function CalendarPage() {
  return <PortalCalendarView />;
}
