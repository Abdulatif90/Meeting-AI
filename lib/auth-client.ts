import { createAuthClient } from "better-auth/react"



export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    // baseURL: "http://localhost:3000"  // bu kerak emas chunki BETTER_AUTH_URL ni .env faylida belgiladik
})

if (process.env.NODE_ENV !== "production") {
    console.log("authClient:", authClient)
    console.log("authClient keys:", Object.keys(authClient))
    console.log("authClient.signIn:", authClient.signIn)
    console.log("authClient.signUp:", authClient.signUp)
    console.log("authClient.useSession:", authClient.useSession)
    console.log("authClient.signOut:", authClient.signOut)
}