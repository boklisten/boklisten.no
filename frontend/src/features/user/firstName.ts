/** The user's first name, as the menu and the dashboard greet them; the email's local part before that is known. */
export function firstName(user: { name: string | null; email: string }): string {
  const [first] = (user.name ?? "").trim().split(/\s+/);
  if (first) {
    return first;
  }
  return user.email.split("@")[0] ?? user.email;
}
