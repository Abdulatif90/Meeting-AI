"use client"

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { OctagonAlertIcon } from "lucide-react";
import  Image  from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

import { Card, CardContent } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { useForm } from "react-hook-form";


const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters long"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],

})

export const SignUpView = () => {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        }
    })

    const onSubmit =  (data: z.infer<typeof formSchema>) => {
            setError(null);
            authClient.signUp.email({ 
                name: data.name,
                email: data.email,
                password: data.password,
            },
            { onSuccess: () => {
                    router.push("/");
            },
            onError: ({ error }) => {
                setError(error.message);
        }
        })
    }

    

    return (
        <div className="flex flex-col gap-6">
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 p-6 md:p-10">
                        <h1 className="text-2xl font-bold text-center">
                            Let`s get you started
                        </h1>
                        <p className="text-center text-sm text-muted-foreground">
                            Create your account
                        </p>
                        <div className="grid last: gap-4">
                            <div className="grid gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Enter your name"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>  
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="john.doe@example.com"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder="******"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm Password</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder="******"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {!!error && (
                                <Alert variant="destructive" className="mt-4 mb-2">
                                    <OctagonAlertIcon className="h-4 w-4" />
                                    <AlertTitle>{error}</AlertTitle>
                                </Alert>
                            )}
                            <Button
                            type="submit"
                            className="w-full"
                            >
                            Sign up
                            </Button>
                            <div className="after:border-border mt-4 relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:text after:items-center after:border-t">
                                <span className="bg-card text-muted-foreground relative px-2 z-10">
                                    Or continue with                                 
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="outline" className="w-full mt-4">
                                    Google
                                </Button>
                                <Button variant="outline" className="w-full mt-4">
                                    GitHub
                                </Button>
                            </div>
                             <div className="text-sm text-center text-muted-foreground mt-4">
                                Already have an account?{" "}
                                <Link href="/sign-in" className="underline underline-offset-4 hover:text-primary">
                                     Sign in
                                </Link>
                            </div>   
                        </div>
                    </form>
                  </Form>
                  <div className="bg-radial from-green-700 to-green-900 relative hidden md:flex flex-col items-center justify-center text-white p-10 gap-y-4">
                    <Image
                        src="/logo.svg"
                        alt="Meeting AI logo centered on a green gradient background"
                        width={92}
                        height={92}
                    />
                    <p className="text-center text-lg md:text-xl font-semibold">
                        Welcome back to Meeting AI.
                    </p>
                  </div>      
                </CardContent>
            </Card>
            <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
                By signing in, you agree to our{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                </a>
            </div>
        </div>
    )
}

