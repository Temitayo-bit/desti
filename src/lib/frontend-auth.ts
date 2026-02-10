/**
 * Frontend-only authorization check for protected pages.
 * A user must have at least one verified @stetson.edu email address.
 */
export type RestrictionReason =
    | "missing_email"
    | "email_not_verified"
    | "non_stetson_domain";

interface ClerkEmailLike {
    emailAddress: string;
    verification?: {
        status?: string | null;
    } | null;
}

interface ClerkUserLike {
    emailAddresses: ClerkEmailLike[];
}

export type FrontendAccessDecision =
    | {
          allowed: true;
          verifiedStetsonEmail: string;
      }
    | {
          allowed: false;
          reason: RestrictionReason;
      };

function isVerifiedEmail(email: ClerkEmailLike): boolean {
    return email.verification?.status === "verified";
}

function isStetsonEmail(emailAddress: string): boolean {
    return emailAddress.toLowerCase().endsWith("@stetson.edu");
}

export function evaluateFrontendAccess(
    user: ClerkUserLike | null | undefined
): FrontendAccessDecision {
    if (!user || user.emailAddresses.length === 0) {
        return { allowed: false, reason: "missing_email" };
    }

    const verifiedEmails = user.emailAddresses.filter(isVerifiedEmail);
    if (verifiedEmails.length === 0) {
        return { allowed: false, reason: "email_not_verified" };
    }

    const verifiedStetsonEmail = verifiedEmails.find((email) =>
        isStetsonEmail(email.emailAddress)
    );
    if (!verifiedStetsonEmail) {
        return { allowed: false, reason: "non_stetson_domain" };
    }

    return {
        allowed: true,
        verifiedStetsonEmail: verifiedStetsonEmail.emailAddress.toLowerCase(),
    };
}

export function getRestrictionCopy(reason: RestrictionReason): string {
    if (reason === "email_not_verified") {
        return "Your email must be verified before accessing this application.";
    }

    if (reason === "non_stetson_domain") {
        return "Only verified @stetson.edu email addresses can access this application.";
    }

    return "No verified email address was found on your account.";
}
