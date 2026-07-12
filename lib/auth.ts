import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { eq } from "drizzle-orm";
import { db } from "@/db"; // your drizzle instance
import * as schema from "@/auth-schema"; // your auth schema
import { user as userTable } from "@/db/schema";

import { polarClient } from "./polar";
import { sendNewUserNotification, sendSignInNotification } from "./telegram";

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
    databaseHooks: {
        user: {
            create: {
                after: async (newUser) => {
                    // Xabarnoma xatosi ro'yxatdan o'tishni to'xtatmasligi kerak
                    try {
                        await sendNewUserNotification({
                            name: newUser.name,
                            email: newUser.email,
                            createdAt: newUser.createdAt,
                        });
                    } catch (error) {
                        console.error("[telegram] sign-up notification failed:", error);
                    }
                },
            },
        },
        session: {
            create: {
                after: async (session) => {
                    // Xabarnoma xatosi kirishni to'xtatmasligi kerak
                    try {
                        const [signedInUser] = await db
                            .select({ name: userTable.name, email: userTable.email })
                            .from(userTable)
                            .where(eq(userTable.id, session.userId));

                        await sendSignInNotification({
                            name: signedInUser?.name ?? "noma'lum",
                            email: signedInUser?.email ?? "noma'lum",
                            ipAddress: session.ipAddress,
                            userAgent: session.userAgent,
                            createdAt: session.createdAt,
                        });
                    } catch (error) {
                        console.error("[telegram] sign-in notification failed:", error);
                    }
                },
            },
        },
    },
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
