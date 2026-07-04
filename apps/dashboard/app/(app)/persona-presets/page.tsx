import { redirect } from "next/navigation";

// Persona presets management moved into the admin console (/admin/presets).
// Keep this route as a redirect so any old links/bookmarks still land right.
export default function PersonaPresetsPage() {
  redirect("/admin/presets");
}
