import { useEffect, useState } from "react";
import { firebaseConfigured, logOut, observeUser, signInEmail, signInGoogle, signUpEmail } from "./firebase";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ email: string | null } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => observeUser((next) => setUser(next ? { email: next.email } : null)), []);

  if (!firebaseConfigured) return <div className="auth-note">Firebase optional · local demo without login</div>;
  if (user) return <div className="auth-user"><span>{user.email ?? "Signed in"}</span><button className="text-button" onClick={() => void logOut()}>Sign out</button></div>;

  const run = async (action: () => Promise<unknown>) => {
    try { await action(); setMessage("Signed in."); } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); }
  };
  return <div className="auth-panel">
    <div className="label">Account (Firebase)</div>
    <div className="auth-fields"><input aria-label="Email" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><input aria-label="Password" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    <div className="auth-actions"><button className="secondary" onClick={() => void run(() => signInEmail(email, password))}>Sign in</button><button className="secondary" onClick={() => void run(() => signUpEmail(email, password))}>Create account</button><button className="secondary" onClick={() => void run(signInGoogle)}>Google</button></div>
    {message && <div className="auth-message">{message}</div>}
  </div>;
}
