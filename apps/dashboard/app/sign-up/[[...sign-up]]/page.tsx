import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-fog px-4">
      <SignUp />
    </main>
  );
}
