import { notFound } from "next/navigation";
import { portalEnabled } from "@/lib/features";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function PortalLoginPage() {
  if (!portalEnabled()) notFound();

  return (
    <div className="grid min-h-[100svh] place-items-center bg-bone-100 px-5 py-10">
      <div className="w-full max-w-[420px]">
        <LoginForm />
      </div>
    </div>
  );
}
