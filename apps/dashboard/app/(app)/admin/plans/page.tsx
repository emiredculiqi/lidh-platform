import { T } from "@/components/T";

// Plan management UI is a later phase. Plans are seeded via prisma/seed-plans.ts
// (Basic / Premium) and assigned per-business from the business console's
// Overview tab.
export default function AdminPlansPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[22px] font-bold tracking-tight text-brand-deep">
        <T al="Planet" en="Plans" />
      </h1>
      <p className="mt-2 text-[13.5px] text-slate-500">
        <T
          al="Menaxhimi i planeve vjen së shpejti. Planet (Basic / Premium) caktohen për çdo biznes nga skeda Përmbledhje e biznesit."
          en="Plan management is coming soon. Plans (Basic / Premium) are assigned per-business from the business Overview tab."
        />
      </p>
    </div>
  );
}
