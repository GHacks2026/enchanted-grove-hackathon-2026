// Shared by / and /reflect. Keeps the Grove loaded while the journal is open, so moving between
// them has no loading screen and the sky, trees and Lantern keep animating instead of restarting.
import GroveHome from "@/components/grove/GroveHome";

export default function GroveLayout({ children }: { children: React.ReactNode }) {
  return <GroveHome>{children}</GroveHome>;
}
