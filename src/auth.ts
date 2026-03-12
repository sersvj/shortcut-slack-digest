import NextAuth from 'next-auth';
import Slack from 'next-auth/providers/slack';

const ALLOWED_WORKSPACE = process.env.SLACK_WORKSPACE_ID!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Slack({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Only allow users from the configured Slack workspace
      const teamId = account?.access_token
        ? (profile as Record<string, unknown> | undefined)?.['https://slack.com/team_id'] ?? (account as { team?: { id: string } })?.team?.id
        : null;

      // Check workspace via the team field returned in the token/profile
      const workspaceId =
        (profile as Record<string, unknown> | undefined)?.['https://slack.com/team_id'] ||
        (account as { team_id?: string })?.team_id ||
        teamId;

      if (ALLOWED_WORKSPACE && workspaceId && workspaceId !== ALLOWED_WORKSPACE) {
        return false; // Deny — wrong workspace
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
