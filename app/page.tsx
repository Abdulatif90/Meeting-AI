"use client";

import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";


export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      window.alert("Name, email, and password are required.");
      return;
    }

    if (password.length < 8) {
      window.alert("Password must be at least 8 characters.");
      return;
    }

    await authClient.signUp.email(
      {
        name: trimmedName,
        email: trimmedEmail,
        password,
      },
      {
        onError: (context) => {
          window.alert(context.error.message || "Error signing up");
        },
        onSuccess: () => {
          window.alert("Signed up successfully");
        },
      }
    );
  };



  return  (
    <div className="flex flex-col items-center justify-center min-h-screen width-20 gap-y-2">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={onSubmit} className="px-4 py-2 bg-blue-500 text-white rounded">Sign Up</button>
    </div>
   
);
}

