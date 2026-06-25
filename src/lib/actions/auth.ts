"use server";
import { redirect } from "next/navigation";
import { verifyPassword, createSession, destroySession } from "../auth";

export async function login(password: string) {
  if (!password || !verifyPassword(password)) {
    return { error: "Incorrect password." };
  }
  await createSession();
  return { ok: true };
}

export async function logoutAction() {
  destroySession();
  redirect("/");
}
