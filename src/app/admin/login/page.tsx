import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { BrandMark } from "@/components/ui/Brand";

export const metadata = { title: "Admin Login — Score Guru" };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark size={56} />
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Score Guru Admin</h1>
            <p className="text-sm text-ink-muted">Enter the admin password to score matches.</p>
          </div>
        </div>
        <div className="sg-card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
