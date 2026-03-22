import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { db } from "@/db"; // your drizzle instance
import * as schema from "@/auth-schema"; // your auth schema

import { polarClient } from "./polar";

export const auth = betterAuth({

    plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          authenticatedUsersOnly: true,
          successUrl: "/upgrade",
        }),
        portal(),
      ],
    }),
  ],
  
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
        schema: {
            ...schema,
        },
    }),
    emailAndPassword: {
    	enabled: true,
    	autoSignIn: false, // agar true bo'lsa, foydalanuvchi ro'yxatdan o'tgandan so'ng avtomatik ravishda tizimga kiradi
    },
    socialProviders: {
    github: { 
      clientId: process.env.GITHUB_CLIENT_ID as string, 
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string, 
    },
    google: { 
      clientId: process.env.GOOGLE_CLIENT_ID as string, 
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
    }, 
  },
});
