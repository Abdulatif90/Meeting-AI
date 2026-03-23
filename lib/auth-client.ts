import { polarClient } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react"



export const authClient = createAuthClient({
      plugins: [polarClient()]
    /** The base URL of the server (optional if you're using the same domain) */
    // baseURL: "http://localhost:3000"  // bu kerak emas chunki BETTER_AUTH_URL ni .env faylida belgiladik
})

