import NextAuth from 'next-auth';
import AzureAD from 'next-auth/providers/azure-ad';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import {
	checkUserAccess,
	createOrUpdateUser,
	isFirstUser,
} from './access-control';

const providers = [];

// Generic OIDC — the "bring your own IdP" path (Okta, Auth0, Keycloak, Google
// Workspace, Azure, and, in dev, the local dex container).
if (
	process.env.OIDC_ISSUER &&
	process.env.OIDC_CLIENT_ID &&
	process.env.OIDC_CLIENT_SECRET
) {
	providers.push({
		id: 'oidc',
		name: process.env.OIDC_PROVIDER_NAME || 'SSO',
		type: 'oidc' as const,
		issuer: process.env.OIDC_ISSUER,
		clientId: process.env.OIDC_CLIENT_ID,
		clientSecret: process.env.OIDC_CLIENT_SECRET,
		...(process.env.OIDC_SCOPES
			? { authorization: { params: { scope: process.env.OIDC_SCOPES } } }
			: {}),
	});
}

// Named providers — conveniences for common IdPs.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
	providers.push(
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		}),
	);
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
	providers.push(
		GitHub({
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
		}),
	);
}

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
	providers.push(
		AzureAD({
			clientId: process.env.MICROSOFT_CLIENT_ID,
			clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
		}),
	);
}

if (process.env.RESEND_API_KEY) {
	providers.push(
		Resend({
			apiKey: process.env.RESEND_API_KEY,
			from: process.env.EMAIL_FROM,
		}),
	);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	providers,
	callbacks: {
		async signIn({ user }) {
			if (!user.email) {
				return false;
			}

			// First user bootstraps the instance as ADMIN.
			if (await isFirstUser()) {
				return true;
			}

			// Everyone else must be on the access list.
			if (await checkUserAccess(user.email)) {
				return true;
			}

			return '/auth/error?error=AccessDenied';
		},
		async jwt({ token, user }) {
			if (user?.email) {
				const dbUser = await createOrUpdateUser({
					email: user.email,
					name: user.name,
					image: user.image,
				});
				token.role = dbUser.role;
				token.id = dbUser.id;
			}
			return token;
		},
		async session({ session, token }) {
			if (token.id) {
				session.user.id = token.id as string;
				session.user.role = token.role as string;
			}
			return session;
		},
	},
	pages: {
		signIn: '/auth/signin',
		error: '/auth/error',
	},
	session: {
		strategy: 'jwt',
		maxAge: 14 * 24 * 60 * 60, // 14 days
		updateAge: 24 * 60 * 60, // 24 hours
	},
});
