import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your drizzle instance
import * as schema from "@/auth-schema"; // your auth schema

export const auth = betterAuth({
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
    // boshqa sozlamalar...
});
