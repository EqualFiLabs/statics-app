import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-page">
      <Image src="/assets/statics-lockup.png" alt="Statics Protocol" width={1259} height={304} />
      <p>{"// Route unavailable"}</p>
      <h1>404</h1>
      <span>The requested Statics surface does not exist.</span>
      <Link href="/">Return home →</Link>
    </main>
  );
}
