// app/sessions.js
import { redirect, createCookieSessionStorage } from "@remix-run/node"; // or "@remix-run/cloudflare"

// Initialize Firebase
// ---------------------
import * as admin from "firebase-admin";
import adminApp from './lib/firebase.admin.server';
console.log({adminApp});

/**
 * setup the session cookie to be used for firebase
 */
const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
    cookie: {
      name: "fb:token",
      expires: new Date(Date.now() + 600),
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
      secrets: ["S8f3cr@z7"],
      secure: true,
    },
  });

/**
 * checks that the current session is a valid session be getting the token
 * from the session cookie and validating it with firebase
 *
 * @param {*} request
 * @param {string} redirectTo
 * @returns
 */
export const isSessionValid = async (request, redirectTo) => {
  const session = await getSession(request.headers.get("cookie"));
  try {
    // Verify the session cookie. In this case an additional check is added to detect
    // if the user's Firebase session was revoked, user deleted/disabled, etc.
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(session.get("idToken"), true /** checkRevoked */);
    return {
      success: true,
      decodedClaims,
      // todo - actually use role-based access control (rbac)
      isAdmin: decodedClaims?.uid === "B1bwZ5eYo6Qhjt9wtSLJHHClaNq2",
    };
  } catch (error) {
    // Session cookie is unavailable or invalid. Force user to login.
    // return { error: error?.message };
    throw redirect(redirectTo, {
      statusText: error?.message,
    });
  }
};

/**
 * set the cookie on the header and redirect to the specified route
 *
 * @param {*} request
 * @param {*} sessionCookie
 * @param {string} redirectTo
 * @returns
 */
const setCookieAndRedirect = async (
  request,
  sessionCookie,
  redirectTo = "/"
) => {
  const session = await getSession(request.headers.get("cookie"));
  session.set("idToken", sessionCookie);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
};

/**
 * login the session by verifying the token, if all is good create/set cookie
 * and redirect to the appropriate route
 *
 * @param {*} request
 * @param {*} idToken
 * @param {string} redirectTo
 * @returns
 */
export const sessionLogin = async (request, idToken, redirectTo) => {

  const token = await admin.auth().verifyIdToken(idToken);
  console.log("idtoken verified", {token, idToken});

  return admin
    .auth()
    .createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 5 * 1000,
    })
    .then(
      (sessionCookie) => {
        // Set cookie policy for session cookie.
        return setCookieAndRedirect(request, sessionCookie, redirectTo);
      },
      (error) => {
        return {
          error: `sessionLogin error!: ${error.message}`,
        };
      }
    );
};

/**
 * revokes the session cookie from the firebase admin instance
 * @param {*} request
 * @returns
 */
export const sessionLogout = async (request) => {
  const session = await getSession(request.headers.get("cookie"));

  // Verify the session cookie. In this case an additional check is added to detect
  // if the user's Firebase session was revoked, user deleted/disabled, etc.
  return admin
    .auth()
    .verifySessionCookie(session.get("idToken") , true /** checkRevoked */)
    .then((decodedClaims) => {
      return admin.auth().revokeRefreshTokens(decodedClaims?.sub);
    })
    .then(async () => {
      return redirect("/login", {
        headers: {
          "Set-Cookie": await destroySession(session),
        },
      });
    })
    .catch((error) => {
      console.log(error);
      // Session cookie is unavailable or invalid. Force user to login.
      return { error: error?.message };
    });
};
