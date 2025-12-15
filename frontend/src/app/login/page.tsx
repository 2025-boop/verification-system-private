"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";

// ---- Validation schema ----
const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginValues) => {
    setServerError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/dashboard");
      return;
    }

    const err = await res.json();
    setServerError(err.error || "Invalid credentials");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-sm border border-border/40 backdrop-blur-sm bg-card text-card-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-300">
        
        <CardHeader className="text-center space-y-1">
          <div className="relative text-3xl font-bold tracking-tight">
            <span className="relative z-10">Control Room</span>
            <div className="absolute inset-0 mx-auto h-8 w-32 rounded-full blur-2xl opacity-40 bg-primary/20"></div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Realtime Intelligence
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="your username"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-red-500 text-sm">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <p className="text-red-500 text-center text-sm">{serverError}</p>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
