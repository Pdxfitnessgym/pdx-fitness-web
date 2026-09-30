import { TrainerTopNav } from "@/app/components/TrainerTopNav";

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TrainerTopNav />
      {children}
    </>
  );
}
