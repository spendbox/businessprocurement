import { adminSetupProblem } from "@/lib/admin-auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const problem = adminSetupProblem();

  return (
    <div className="grid min-h-[100svh] place-items-center bg-bone-100 px-5 py-12">
      <div className="w-full max-w-[400px]">
        <LoginForm problem={problem} />
      </div>
    </div>
  );
}
