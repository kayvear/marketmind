import { redirect } from "next/navigation";

/**
 * Root route — immediately redirects to /dashboard.
 */
export default function RootPage() {
  redirect("/markets");
}
