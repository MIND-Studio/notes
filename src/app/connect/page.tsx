import ConnectForm from "@/components/ConnectForm";

export default function ConnectPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Connect a pod
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Your notes, in your pod.</h1>
      <p className="mt-4 text-muted-foreground">
        Sign in with your Solid identity. Every note is a plain markdown file in your pod — no
        central server ever holds your text.
      </p>
      <div className="mt-8">
        <ConnectForm />
      </div>
    </section>
  );
}
